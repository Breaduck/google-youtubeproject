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

    // Using Google Cloud Text-to-Speech API via Gemini's multimodal capabilities
    // This is a workaround - ideally you'd use the dedicated TTS API
    const ai = new GoogleGenAI({ apiKey: key });

    // Map voice names to actual voice configs (8개 전체 목소리 지원)
    const voiceConfigs: Record<string, { languageCode: string; name: string }> = {
      'Kore': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Kore' },
      'Aoede': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Aoede' },
      'Leda': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Leda' },
      'Zephyr': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Zephyr' },
      'Charon': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Charon' },
      'Fenrir': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Fenrir' },
      'Puck': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Puck' },
      'Orus': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Orus' }
    };

    const selectedVoice = voiceConfigs[voice] || voiceConfigs['Kore'];

    // Try using the Gemini TTS model
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: text }]
          }
        ],
        config: {
          responseModalities: ['audio'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice.name
              }
            },
            ...(speakingRate !== 1.0 ? { speakingRate } : {})
          } as any
        }
      });

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'audio/mp3';
            return `data:${mimeType};base64,${part.inlineData.data}`;
          }
        }
      }
    } catch (e) {
      console.warn('TTS generation failed, trying fallback:', e);
    }

    // Fallback: Use Web Speech API
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = speakingRate;

      // Create audio from speech synthesis
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const mediaRecorder = new MediaRecorder(destination.stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        resolve(URL.createObjectURL(blob));
      };

      utterance.onstart = () => mediaRecorder.start();
      utterance.onend = () => {
        mediaRecorder.stop();
        audioContext.close();
      };
      utterance.onerror = () => reject(new Error('TTS failed'));

      speechSynthesis.speak(utterance);
    });
  }

  async generateMotionPrompt(dialogue: string, imagePrompt: string): Promise<string> {
    const ai = this.getClient();

    const prompt = `You must output ONLY one of these exact allowed motion templates (no scene description):

A) "blink only"
B) "blink + breathing"
C) "blink + breathing + micro head <0.3°"

INPUT:
Dialogue: "${dialogue}"

Choose the template that best matches the emotional intensity (A for calm, B for neutral, C for slight emotion).
Return ONLY one of the three strings above, nothing else.`;

    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: prompt
    });

    let generatedPrompt = response.text?.trim().toLowerCase() || 'blink only';

    // Deterministic enforcement: ONLY allow exact templates
    const allowedTemplates = ['blink only', 'blink + breathing', 'blink + breathing + micro head <0.3°'];

    // Check if output matches allowed templates
    const matched = allowedTemplates.find(t => generatedPrompt.includes(t.toLowerCase()));

    if (!matched) {
      // Any other output -> force "blink only"
      generatedPrompt = 'blink only';
    } else {
      generatedPrompt = matched;
    }

    return generatedPrompt;
  }
}
