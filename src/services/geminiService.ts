import { GoogleGenAI } from "@google/genai";
import { CharacterProfile, StoryProject, VisualStyle, Scene, SceneEffect } from "../types";

// Layer 2: Client-side banned token strip (camera + text artifacts)
const BANNED_TERMS = [
  // Camera
  'cinematic', 'zoom', 'pan', 'tilt', 'dolly', 'tracking', 'reframe', 'reframing',
  'push in', 'pull out', 'push-in', 'pull-out', 'handheld', 'shaky',
  'camera movement', 'close-up', 'closeup', 'wide shot', 'medium shot', 'long shot',
  'full shot', 'establishing shot', 'extreme close-up', 'zoom in', 'zoom out',
  'panning', 'close up',
  // Text artifacts
  'text', 'caption', 'captions', 'subtitle', 'subtitles', 'watermark', 'logo',
  'signage', 'label', 'labels', 'lettering', 'letters', 'typography', 'title',
  'title card', 'credits', 'banner', 'poster', 'speech bubble', 'comic text',
  'quote', 'overlay', 'ui', 'hud', 'sign', 'inscription', 'writing', 'written',
];

function stripBannedTerms(text: string): string {
  let result = text;
  for (const term of BANNED_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '');
  }
  result = result.replace(/\s{2,}/g, ' ').replace(/,\s*,+/g, ',').trim();
  if (result.length > 0 && result.startsWith(',')) result = result.slice(1).trim();
  return result;
}

// Alias for backward compat
const stripCameraTerms = stripBannedTerms;

async function generateRunwareImage(prompt: string, isPortrait: boolean): Promise<string> {
  const apiKey = localStorage.getItem('runware_api_key') || '';
  if (!apiKey || apiKey.length < 10) {
    throw new Error('Runware API key not configured');
  }

  const width = isPortrait ? 512 : 1024;
  const height = isPortrait ? 1024 : 512;

  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{
      taskType: 'imageInference',
      taskUUID: crypto.randomUUID(),
      positivePrompt: prompt,
      model: 'civitai:36520@76907',
      width,
      height,
      numberResults: 1,
      outputType: 'URL'
    }])
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Runware API failed: ${res.status} ${error}`);
  }

  const data = await res.json();
  if (!data[0]?.imageURL) {
    throw new Error('No image URL in Runware response');
  }

  return data[0].imageURL;
}

export class GeminiService {
  private getApiKey(): string {
    return localStorage.getItem('gemini_api_key') || '';
  }

  private getModel(): string {
    return localStorage.getItem('gemini_model') || 'gemini-3-flash-preview';
  }

  private getClient(): GoogleGenAI {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    // Google Cloud (Vertex AI) 설정 확인
    const projectId = localStorage.getItem('google_cloud_project_id') || '';
    const location = localStorage.getItem('google_cloud_location') || 'us-central1';

    // Project ID가 있으면 Vertex AI 모드, 없으면 Gemini API 모드
    if (projectId && projectId.trim().length > 0) {
      return new GoogleGenAI({
        apiKey,
        vertexai: true,
        project: projectId,
        location: location,
        apiVersion: 'v1'
      });
    } else {
      return new GoogleGenAI({ apiKey });
    }
  }

  async extractCharacters(
    script: string,
    style: VisualStyle,
    customStyleDescription?: string
  ): Promise<{ title: string; characters: CharacterProfile[] }> {
    const ai = this.getClient();

    const stylePrompts: Record<VisualStyle, string> = {
      '2d-animation': 'vibrant 2D animation style similar to Studio Ghibli or modern anime',
      'realistic': 'photorealistic cinematic style with detailed lighting and textures',
      'animation': 'high-quality 3D animation style similar to Pixar or DreamWorks',
      'custom': customStyleDescription || 'artistic illustration style'
    };

    const styleDesc = stylePrompts[style] || stylePrompts['2d-animation'];

    const prompt = `Analyze this script and extract character information. Return a JSON object with:
1. "title": A concise Korean title for this story (3-5 words)
2. "characters": An array of character objects with:
   - "id": unique UUID
   - "name": character name in format "EnglishName(한글이름)" e.g. "Eunhwa(은화)", "Minjun(민준)", "Sora(소라)"
   - "role": brief role description in Korean
   - "visualDescription": detailed visual description for image generation in English, including: gender, age, hair color/style, eye color, clothing, distinctive features. Style: ${styleDesc}

Script:
${script}

Return ONLY valid JSON, no markdown or explanation.`;

    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    this.recordUsage(response, 'text');

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse character data');

    const data = JSON.parse(jsonMatch[0]);

    return {
      title: data.title || '새로운 이야기',
      characters: (data.characters || []).map((char: any) => ({
        id: char.id || crypto.randomUUID(),
        name: char.name,
        role: char.role,
        visualDescription: char.visualDescription,
        portraitUrl: null,
        status: 'idle' as const
      }))
    };
  }

  async generateImage(
    prompt: string,
    isPortrait: boolean = false,
    model?: string,
    referenceImages?: string[]  // 레퍼런스 이미지 추가 (캐릭터 일관성)
  ): Promise<string> {
    const provider = localStorage.getItem('image_provider') || 'gemini';
    if (provider === 'runware') {
      return generateRunwareImage(prompt, isPortrait);
    }
    const ai = this.getClient();
    // Imagen 4 Fast로 기본 변경 (49% 비용 절감 + 레퍼런스 지원)
    const imageModel = model || localStorage.getItem('gemini_image_model') || 'imagen-4.0-fast-generate-001';

    let enhancedPrompt = prompt;
    // 🚫 절대 금지: 이미지 내 모든 텍스트/글씨/문자 생성
    const TEXT_BAN_PROMPT = "ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO CHARACTERS, NO WRITING, NO TYPOGRAPHY, NO KOREAN TEXT, NO ENGLISH TEXT, NO NUMBERS, NO SYMBOLS, NO SIGNS, NO LABELS, NO CAPTIONS, NO SUBTITLES, NO WATERMARKS, NO LOGOS, NO BANNERS, NO INSCRIPTIONS, NO SPEECH BUBBLES, NO COMIC TEXT, NO UI ELEMENTS, NO HUD, completely text-free image, pure visual scene only";

    if (isPortrait) {
      enhancedPrompt = `Portrait shot, centered composition, square 1:1 aspect ratio, ${prompt}, ${TEXT_BAN_PROMPT}, high quality, detailed, professional lighting`;
    } else {
      enhancedPrompt = `Widescreen 16:9 aspect ratio, ${TEXT_BAN_PROMPT}, ${stripBannedTerms(prompt)}, static locked framing, high quality, detailed, professional lighting`;
    }

    // Check if using Imagen or Gemini image-specific models
    if (imageModel.includes('imagen') || imageModel.includes('-image-')) {
      const config: any = {
        numberOfImages: 1,
        aspectRatio: isPortrait ? '1:1' : '16:9'
      };

      // 레퍼런스 이미지 추가 (캐릭터 일관성 확보)
      if (referenceImages && referenceImages.length > 0) {
        config.referenceImages = referenceImages.map(img => {
          const base64Data = img.includes(',') ? img.split(',')[1] : img;
          return {
            imageBytes: base64Data,
            referenceType: 'SUBJECT'  // 캐릭터 일관성
          };
        });
      }

      const response = await ai.models.generateImages({
        model: imageModel,
        prompt: enhancedPrompt,
        config
      });

      this.recordUsage(response, 'image');

      if (response.generatedImages && response.generatedImages.length > 0) {
        const imageData = response.generatedImages[0].image?.imageBytes;
        if (imageData) {
          return `data:image/png;base64,${imageData}`;
        }
      }
      throw new Error('Failed to generate image');
    }

    // For Gemini native image generation
    const response = await ai.models.generateContent({
      model: imageModel,
      contents: enhancedPrompt,
      config: {
        responseModalities: ['image', 'text']
      }
    });

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error('Failed to generate image');
  }

  async analyzeStyle(images: string[]): Promise<string> {
    const ai = this.getClient();

    const imageParts = images.slice(0, 5).map(img => {
      const base64Data = img.split(',')[1] || img;
      return {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      };
    });

    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: [
        {
          role: 'user',
          parts: [
            ...imageParts,
            { text: `Analyze these reference images and describe the visual style in detail for image generation. Include: color palette, line style, shading technique, overall mood, artistic influences. Be specific and technical. Response in English only, in a single paragraph.` }
          ]
        }
      ]
    });

    return response.text || 'Modern digital illustration style';
  }

  private chunkScript(script: string): string[] {
    const chunks: string[] = [];
    const sentences = script.split(/(?<=[.!?。！？])\s*/);

    let currentChunk = '';
    let sentenceCount = 0;
    const targetSentences = 3;  // 3문장씩 묶음 (20-30분 영상 = 120-180장 목표)

    let processedIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      processedIndex = i + 1;

      const isSceneBreak = /^[#\-\*]|장면|씬|INT\.|EXT\.|fade|cut/i.test(sentence);
      const isDramatic = /[!！]{2,}|\.{3,}|…/.test(sentence) && sentence.length < 50;

      if (isSceneBreak && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence + ' ';
        sentenceCount = 1;
        continue;
      }

      currentChunk += sentence + ' ';
      sentenceCount++;

      if (sentenceCount >= targetSentences || isDramatic) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        sentenceCount = 0;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    if (processedIndex < sentences.length) {
      console.warn(`Script chunking incomplete: processed ${processedIndex}/${sentences.length}`);
    }

    return chunks.filter(c => c.length > 0);
  }

  async createStoryboard(project: StoryProject): Promise<Scene[]> {
    const ai = this.getClient();

    const characterDescriptions = project.characters
      .map(c => `- ${c.name}: ${c.visualDescription}`)
      .join('\n');

    // 스크립트 길이 기반 목표 씬 수 계산 (비용 효율: 200자당 1씬)
    const scriptLength = project.script.length;
    const targetScenes = Math.max(120, Math.min(180, Math.floor(scriptLength / 200))); // 200자당 1씬 (비용 절감)

    const prompt = `Analyze this script and divide it into ${targetScenes} scenes for a 20-30 minute video. Each scene will be a single static image shown for ~10 seconds with narration.

Characters:
${characterDescriptions}

Style: ${project.customStyleDescription || project.style}

Full Script:
${project.script}

TASK: Intelligently divide the script into approximately ${targetScenes} scenes based on:
- Natural narrative flow and context
- Scene changes and location shifts
- Emotional beats and dramatic moments
- Logical grouping of dialogue/action that fits in one image

COST OPTIMIZATION (CRITICAL):
- **Each scene MUST have at least 35-40 characters** (minimum 10 seconds of narration)
- **Merge short sentences**: "안녕하세요!" alone is wasteful → combine with next lines
- **Avoid single-sentence scenes**: Always group 2-3 related sentences together when possible
- Only separate when there's a clear scene/location change or dramatic shift

For EACH scene (numbered 1 to ~${targetScenes}), provide:
1. "segment_number": Scene number
2. "scriptSegment": The exact text from the script for this scene (keep original Korean text, MINIMUM 35 characters)
3. "imagePrompt": A detailed English prompt describing the scene. CRITICAL:
   - Characters MUST match their visualDescription exactly (same face, hair, clothing, features) for consistency across all scenes
   - Describe background, lighting, mood, and character actions
   - ⚠️ ABSOLUTELY FORBIDDEN: NO TEXT, NO LETTERS, NO WORDS, NO KOREAN CHARACTERS, NO ENGLISH CHARACTERS, NO NUMBERS, NO SYMBOLS, NO SIGNS, NO LABELS, NO CAPTIONS, NO SUBTITLES, NO WATERMARKS, NO LOGOS, NO TYPOGRAPHY OF ANY KIND
   - NEVER mention shot types or camera movement
   - The image must be 100% text-free, pure visual scene only
4. "effect_type": Always use "static_subtle"
5. "intensity": 1-10 emotional intensity

IMPORTANT:
- Aim for ${targetScenes} scenes (±10 is acceptable based on natural breaks)
- Character appearance consistency is CRITICAL - always refer to the visualDescription above
- **MERGE short lines to minimize image generation cost**
- Each scriptSegment should ideally be 50-100 characters for optimal cost/quality balance

Return ONLY valid JSON array, no markdown.`;

    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    this.recordUsage(response, 'text');

    const text = response.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Failed to parse storyboard data');

    const aiScenes = JSON.parse(jsonMatch[0]);

    return aiScenes.map((aiScene: any) => {
      const effectType = 'static_subtle';
      const intensity = aiScene.intensity || 5;
      const motionParams = this.generateMotionParams(effectType, intensity);

      return {
        id: crypto.randomUUID(),
        scriptSegment: aiScene.scriptSegment || '',
        imagePrompt: stripCameraTerms(aiScene.imagePrompt || 'Scene depicting the script'),
        imageUrl: null,
        audioUrl: null,
        videoUrl: null,
        status: 'idle' as const,
        audioStatus: 'idle' as const,
        videoStatus: 'idle' as const,
        effect: {
          effect_type: effectType,
          intensity,
          motion_params: motionParams
        } as SceneEffect
      };
    });
  }

  private generateMotionParams(effectType: string, intensity: number): SceneEffect['motion_params'] {
    // Scale ranges from 1.1 to 1.3 based on intensity (1-10)
    const baseScale = 1.1 + ((intensity - 1) / 9) * 0.2;
    // Add small random variation
    const scale = Math.round((baseScale + (Math.random() * 0.05 - 0.025)) * 100) / 100;

    // Determine direction based on effect type
    let direction: 'center' | 'left' | 'right' = 'center';
    if (effectType === 'pan_left' || effectType === '3d_parallax') {
      direction = Math.random() > 0.5 ? 'left' : 'center';
    } else if (effectType === 'pan_right') {
      direction = 'right';
    } else if (effectType === '3d_parallax') {
      const rand = Math.random();
      direction = rand < 0.33 ? 'left' : rand < 0.66 ? 'right' : 'center';
    }

    // Determine speed based on effect type
    let speed: 'slow' | 'medium' | 'fast' = 'medium';
    if (effectType.includes('slow') || effectType === 'static_subtle') {
      speed = 'slow';
    } else if (effectType.includes('fast')) {
      speed = 'fast';
    } else if (effectType === '3d_parallax') {
      speed = intensity > 6 ? 'medium' : 'slow';
    }

    return { scale, direction, speed };
  }

  async regeneratePrompt(
    currentPrompt: string,
    userRequest: string,
    project: StoryProject
  ): Promise<string> {
    const ai = this.getClient();

    const characterDescriptions = project.characters
      .map(c => `- ${c.name}: ${c.visualDescription}`)
      .join('\n');

    const prompt = `Modify this image generation prompt based on the user's request while maintaining character consistency.

Current prompt:
${currentPrompt}

User's modification request (in Korean):
${userRequest}

Character reference:
${characterDescriptions}

Style: ${project.customStyleDescription || project.style}

Generate a new, detailed English prompt that:
1. Incorporates the user's requested changes
2. Maintains the same visual style
3. Keeps character appearances consistent with their descriptions
4. Preserves the overall composition quality
5. ⚠️ CRITICAL: NEVER include any text, letters, words, characters, symbols, signs, captions, subtitles, watermarks, logos, or typography in the scene. The image must be 100% text-free.

Return ONLY the new prompt text, no explanation or markdown.`;

    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: prompt
    });

    return stripCameraTerms(response.text || currentPrompt);
  }

  async generateGoogleTTS(text: string, voice: string, speakingRate: number = 1.0, apiKey?: string): Promise<string> {
    const key = apiKey || this.getApiKey();
    if (!key) {
      throw new Error('API key is required for TTS');
    }

    // Map voice names to actual Google Cloud TTS voice configs
    const voiceConfigs: Record<string, { languageCode: string; name: string; ssmlGender?: string }> = {
      // Chirp3 HD voices (8개)
      'Kore': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Kore' },
      'Aoede': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Aoede' },
      'Leda': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Leda' },
      'Zephyr': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Zephyr' },
      'Charon': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Charon' },
      'Fenrir': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Fenrir' },
      'Puck': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Puck' },
      'Orus': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Orus' },
      // Neural2 voices (3개)
      'ko-KR-Neural2-A': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A', ssmlGender: 'FEMALE' },
      'ko-KR-Neural2-B': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-B', ssmlGender: 'FEMALE' },
      'ko-KR-Neural2-C': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-C', ssmlGender: 'MALE' },
      // Standard voices (4개) - 저렴한 옵션
      'ko-KR-Standard-A': { languageCode: 'ko-KR', name: 'ko-KR-Standard-A', ssmlGender: 'FEMALE' },
      'ko-KR-Standard-B': { languageCode: 'ko-KR', name: 'ko-KR-Standard-B', ssmlGender: 'FEMALE' },
      'ko-KR-Standard-C': { languageCode: 'ko-KR', name: 'ko-KR-Standard-C', ssmlGender: 'MALE' },
      'ko-KR-Standard-D': { languageCode: 'ko-KR', name: 'ko-KR-Standard-D', ssmlGender: 'MALE' },
      // WaveNet voices (4개) - 고품질
      'ko-KR-Wavenet-A': { languageCode: 'ko-KR', name: 'ko-KR-Wavenet-A', ssmlGender: 'FEMALE' },
      'ko-KR-Wavenet-B': { languageCode: 'ko-KR', name: 'ko-KR-Wavenet-B', ssmlGender: 'FEMALE' },
      'ko-KR-Wavenet-C': { languageCode: 'ko-KR', name: 'ko-KR-Wavenet-C', ssmlGender: 'MALE' },
      'ko-KR-Wavenet-D': { languageCode: 'ko-KR', name: 'ko-KR-Wavenet-D', ssmlGender: 'MALE' },
      // Studio voices (4개) - 스튜디오 품질
      'ko-KR-Studio-A': { languageCode: 'ko-KR', name: 'ko-KR-Studio-A', ssmlGender: 'FEMALE' },
      'ko-KR-Studio-B': { languageCode: 'ko-KR', name: 'ko-KR-Studio-B', ssmlGender: 'FEMALE' },
      'ko-KR-Studio-C': { languageCode: 'ko-KR', name: 'ko-KR-Studio-C', ssmlGender: 'MALE' },
      'ko-KR-Studio-D': { languageCode: 'ko-KR', name: 'ko-KR-Studio-D', ssmlGender: 'MALE' }
    };

    const selectedVoice = voiceConfigs[voice] || voiceConfigs['Kore'];

    // Use Google Cloud Text-to-Speech API directly
    try {
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: selectedVoice.languageCode,
            name: selectedVoice.name,
            ...(selectedVoice.ssmlGender ? { ssmlGender: selectedVoice.ssmlGender } : {})
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: speakingRate,
            pitch: 0,
            volumeGainDb: 0
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Google TTS API error:', error);
        throw new Error(`TTS API failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.audioContent) {
        return `data:audio/mp3;base64,${data.audioContent}`;
      }

      throw new Error('No audio content in response');
    } catch (e) {
      console.error('Google TTS failed:', e);
      throw new Error(`TTS generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async generateMotionPrompt(dialogue: string, imagePrompt: string): Promise<string> {
    const ai = this.getClient();

    const prompt = `Generate a natural motion prompt for a 10-second video based on this dialogue.
Be specific and contextual. Max 15 words. Include facial expressions, gestures, and body language.

Dialogue: "${dialogue}"

Output only the motion description, nothing else.`;

    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: prompt
    });

    this.recordUsage(response, 'text');

    let motionPrompt = response.text?.trim() || 'subtle breathing and natural blinking';

    // Ensure reasonable length (truncate if too long)
    const words = motionPrompt.split(' ');
    if (words.length > 20) {
      motionPrompt = words.slice(0, 20).join(' ');
    }

    return motionPrompt;
  }

  async generateAudioTimestamps(fullScript: string, numScenes: number): Promise<number[]> {
    const ai = this.getClient();

    const prompt = `Given this full narration script divided into ${numScenes} scenes, calculate the cumulative timestamp (in seconds) where each scene should start.

Full Script:
${fullScript}

Return ONLY a JSON array of ${numScenes} numbers representing the start time in seconds for each scene.
Example: [0, 5.2, 12.8, 20.1, ...] where first scene starts at 0s, second at 5.2s, etc.

Calculate based on average reading speed of 150 words per minute in Korean.`;

    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Failed to parse timestamps');

    return JSON.parse(jsonMatch[0]);
  }

  async analyzeYoutubeStyle(youtubeUrl: string): Promise<string> {
    const ai = this.getClient();

    const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    if (!videoId) throw new Error('Invalid YouTube URL');

    const prompt = `Analyze the visual style of this YouTube video (first 60 seconds).

Describe: art style, color palette, line style, character design, background style.
Provide a concise technical description for image generation (English, 100-150 words).`;

    // 유튜브는 직접 전달 불가, 스크린샷 필요
    // 임시: URL만 분석
    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: `Based on this YouTube URL: ${youtubeUrl}\n\n${prompt}`
    });

    this.recordUsage(response, 'text');

    return response.text || 'Modern digital animation style';
  }

  // 토큰 사용량 기록
  private recordUsage(response: any, type: 'text' | 'image') {
    try {
      const usage = response.usageMetadata || response.usage || {};
      const inputTokens = usage.promptTokenCount || 0;
      const outputTokens = usage.candidatesTokenCount || usage.completionTokens || 0;

      // 기존 사용량 불러오기
      const stored = JSON.parse(localStorage.getItem('gemini_usage') || '{"input":0,"output":0,"images":0}');

      if (type === 'image') {
        stored.images += 1;
      } else {
        stored.input += inputTokens;
        stored.output += outputTokens;
      }

      localStorage.setItem('gemini_usage', JSON.stringify(stored));

      // 타임스탬프 로그 기록
      const log = JSON.parse(localStorage.getItem('gemini_usage_log') || '[]');
      log.push({
        timestamp: Date.now(),
        type,
        input: type === 'text' ? inputTokens : 0,
        output: type === 'text' ? outputTokens : 0,
        images: type === 'image' ? 1 : 0,
      });

      // 최대 1000개 로그 유지
      if (log.length > 1000) {
        log.splice(0, log.length - 1000);
      }

      localStorage.setItem('gemini_usage_log', JSON.stringify(log));
    } catch (e) {
      console.warn('Failed to record usage:', e);
    }
  }

  async getUsageStats(): Promise<{ inputTokens: number; outputTokens: number; images: number; estimatedCost: string }> {
    try {
      const stored = JSON.parse(localStorage.getItem('gemini_usage') || '{"input":0,"output":0,"images":0}');

      // 가격 (2025 기준)
      // Gemini 3 Flash: $0.50 / 1M input, $3.00 / 1M output
      // Imagen 4 Fast: $0.02 / image
      const inputCost = (stored.input / 1000000) * 0.50;
      const outputCost = (stored.output / 1000000) * 3.00;
      const imageCost = stored.images * 0.02;
      const totalCost = inputCost + outputCost + imageCost;

      return {
        inputTokens: stored.input,
        outputTokens: stored.output,
        images: stored.images,
        estimatedCost: `$${totalCost.toFixed(4)}`,
      };
    } catch (error) {
      return { inputTokens: 0, outputTokens: 0, images: 0, estimatedCost: '$0.00' };
    }
  }
}
