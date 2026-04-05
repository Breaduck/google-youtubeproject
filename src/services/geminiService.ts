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

// ============================================================
// Hybrid Script Division System (앵커 기반 분할)
// - Gemini: 맥락 분석 + 분할 위치(앵커) 반환
// - 로컬: 원본 텍스트에서 직접 추출 (100% 보존)
// ============================================================

interface SegmentAnchor {
  segment_number: number;
  start_marker: string;  // 세그먼트 시작 문구 (원본 그대로)
  end_marker: string;    // 세그먼트 끝 문구 (원본 그대로)
  imagePrompt: string;
  intensity: number;
}

interface ExtractedSegment {
  scriptSegment: string;
  imagePrompt: string;
  intensity: number;
  startIndex: number;
  endIndex: number;
}

// 앵커 매칭 로직 (안전장치 포함)
function findAnchorPosition(
  text: string,
  marker: string,
  searchFrom: number = 0
): number {
  // 1. 정확히 일치하는지 먼저 검색
  let pos = text.indexOf(marker, searchFrom);
  if (pos !== -1) return pos;

  // 2. 공백/줄바꿈 정규화 후 재검색
  const normalizedText = text.replace(/\s+/g, ' ');
  const normalizedMarker = marker.replace(/\s+/g, ' ');
  const normalizedFrom = Math.max(0, searchFrom - 10); // 약간의 여유

  // 정규화된 텍스트에서 찾은 위치를 원본 위치로 변환
  const normalizedPos = normalizedText.indexOf(normalizedMarker, normalizedFrom);
  if (normalizedPos !== -1) {
    // 정규화 위치에서 가장 가까운 원본 위치 찾기
    const searchStr = marker.substring(0, Math.min(10, marker.length));
    pos = text.indexOf(searchStr, Math.max(0, searchFrom - 20));
    if (pos !== -1) return pos;
  }

  // 3. start 문구의 앞 10글자만으로 재검색
  if (marker.length > 10) {
    const shortMarker = marker.substring(0, 10);
    pos = text.indexOf(shortMarker, searchFrom);
    if (pos !== -1) return pos;
  }

  // 4. 최종 실패
  return -1;
}

// 앵커 기반 세그먼트 추출
function extractSegmentsFromAnchors(
  originalText: string,
  anchors: SegmentAnchor[]
): { segments: ExtractedSegment[]; success: boolean; error?: string } {
  const segments: ExtractedSegment[] = [];
  let lastEndIndex = 0;

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];

    // 시작 위치 찾기
    const startPos = findAnchorPosition(originalText, anchor.start_marker, lastEndIndex);
    if (startPos === -1) {
      console.warn(`Anchor start not found: "${anchor.start_marker.substring(0, 30)}..."`);
      continue; // 해당 세그먼트 스킵
    }

    // 끝 위치 찾기 (start_marker 이후부터 검색)
    let endPos = findAnchorPosition(originalText, anchor.end_marker, startPos);
    if (endPos === -1) {
      // end_marker를 못 찾으면, 다음 세그먼트의 start 직전까지 또는 끝까지
      if (i + 1 < anchors.length) {
        const nextStartPos = findAnchorPosition(originalText, anchors[i + 1].start_marker, startPos + 1);
        endPos = nextStartPos !== -1 ? nextStartPos : originalText.length;
      } else {
        endPos = originalText.length;
      }
    } else {
      // end_marker 끝까지 포함
      endPos = endPos + anchor.end_marker.length;
    }

    const scriptSegment = originalText.substring(startPos, endPos).trim();

    if (scriptSegment.length > 0) {
      segments.push({
        scriptSegment,
        imagePrompt: anchor.imagePrompt,
        intensity: anchor.intensity,
        startIndex: startPos,
        endIndex: endPos
      });
      lastEndIndex = endPos;
    }
  }

  // 검증: 모든 세그먼트 연결 시 원본과 일치하는지
  const concatenated = segments.map(s => s.scriptSegment).join('');
  const normalizedOriginal = originalText.replace(/\s+/g, '');
  const normalizedConcatenated = concatenated.replace(/\s+/g, '');

  // 95% 이상 일치하면 성공으로 간주 (공백 차이 허용)
  const matchRatio = normalizedConcatenated.length / normalizedOriginal.length;

  if (matchRatio < 0.95) {
    return {
      segments,
      success: false,
      error: `텍스트 보존율 ${Math.round(matchRatio * 100)}% (${normalizedConcatenated.length}/${normalizedOriginal.length}자)`
    };
  }

  return { segments, success: true };
}

// 기계적 분할 (Fallback)
function mechanicalSplit(text: string, targetLength: number = 70): string[] {
  const segments: string[] = [];
  const sentences = text.split(/(?<=[.!?。！？\n])\s*/);

  let currentSegment = '';

  for (const sentence of sentences) {
    if (currentSegment.length + sentence.length <= targetLength * 1.5) {
      currentSegment += (currentSegment ? ' ' : '') + sentence;
    } else {
      if (currentSegment.trim()) {
        segments.push(currentSegment.trim());
      }
      currentSegment = sentence;
    }
  }

  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments.filter(s => s.length > 0);
}

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

    // Check if style description contains character reference
    const hasCharacterReference = styleDesc.includes('Character reference:') || styleDesc.includes('characterAppearance');

    const prompt = `Analyze this script and extract character information. Return a JSON object with:
1. "title": A concise Korean title for this story (3-5 words)
2. "characters": An array of character objects with:
   - "id": unique UUID
   - "name": character name in format "EnglishName(한글이름)" e.g. "Eunhwa(은화)", "Minjun(민준)", "Sora(소라)"
   - "role": brief role description in Korean
   - "visualDescription": DETAILED visual description for image generation in English

VISUAL DESCRIPTION REQUIREMENTS:
${hasCharacterReference ? `
⚠️ CRITICAL: Reference character appearance is provided below. You MUST:
- Match the EXACT same art style, eye style, face shape, body proportions
- If creating similar characters, use the SAME visual style but vary hair color/outfit
- Maintain consistent line art style, shading technique, and color palette
- Keep head-to-body ratio consistent with reference
` : ''}
For each character include:
- Face shape and features (round, oval, angular)
- Eye style and color (large anime eyes, realistic, etc.)
- Hair: EXACT color, length, style, bangs
- Skin tone
- Body proportions (chibi, normal, etc.)
- Clothing with colors and details
- Any distinctive marks or accessories

Art Style: ${styleDesc}

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

  async analyzeStyle(images: string[]): Promise<{ style: string; characterAppearance: string }> {
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
            { text: `Analyze these reference images thoroughly for ANIMATION/ILLUSTRATION style content. Provide TWO separate analyses:

1. "style": Describe the VISUAL STYLE for image generation. Be VERY SPECIFIC for animation reproduction:
   - Art style category (anime, webtoon, cartoon, chibi, manhwa, etc.)
   - Line art style (thick outlines, thin lines, no outlines, sketchy, clean vector)
   - Color palette (vibrant, pastel, muted, specific dominant colors)
   - Shading technique (cel-shading, soft gradients, flat colors, no shading)
   - Eye style (large anime eyes, realistic, dot eyes, specific shape)
   - Overall rendering (digital, hand-drawn, watercolor effect, etc.)
   - Background style (detailed, simple, gradient, abstract)

2. "characterAppearance": Describe ALL CHARACTERS/FIGURES with PRECISE VISUAL DETAILS for consistent reproduction:

For EACH character, describe these EXACT features (critical for consistency):
- **Face shape**: Round, oval, angular, heart-shaped
- **Eyes**: Size (large/medium/small), shape, color, style (anime sparkle, realistic, simple dots)
- **Eyebrows**: Shape, thickness, color
- **Hair**: EXACT color (e.g., "bright pink #FF69B4"), length, style, bangs, accessories
- **Skin tone**: Specific shade (pale, fair, tan, dark, etc.)
- **Body proportions**: Head-to-body ratio (chibi 1:2, normal 1:6, etc.)
- **Clothing**: DETAILED description of outfit, colors, patterns, accessories
- **Distinctive marks**: Scars, moles, tattoos, unique features
- **Expression style**: How emotions are typically shown

If multiple characters, label each: "Character 1 (Name if visible):", "Character 2:", etc.
Include their relationship/size relative to each other.

Response in English only, as valid JSON with two keys: "style" and "characterAppearance".
Example:
{
  "style": "Modern Korean webtoon style, clean digital art with thick black outlines, cel-shading with soft shadows, vibrant saturated colors, large expressive anime-style eyes, pastel background gradients...",
  "characterAppearance": "Character 1 (Main girl): Round face, very large sparkling blue eyes with white highlights, thin arched eyebrows, long straight pink hair (#FFB6C1) reaching waist with blunt bangs, fair pale skin, chibi-like 1:3 head-to-body ratio, wearing white sailor uniform with blue collar and red ribbon, small beauty mark under left eye..."
}` }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    try {
      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          style: parsed.style || 'Modern digital illustration style',
          characterAppearance: parsed.characterAppearance || ''
        };
      }
    } catch (e) {
      console.warn('Failed to parse style analysis JSON, using raw text');
    }

    return {
      style: response.text || 'Modern digital illustration style',
      characterAppearance: ''
    };
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

  async generateImagePromptsForScenes(
    scriptScenes: Array<{ scriptSegment: string }>,
    project: StoryProject
  ): Promise<Scene[]> {
    const ai = this.getClient();

    const characterDescriptions = project.characters
      .map(c => `- ${c.name}: ${c.visualDescription}`)
      .join('\n');

    const scenesWithNumbers = scriptScenes.map((s, i) => ({
      segment_number: i + 1,
      scriptSegment: s.scriptSegment
    }));

    // 캐릭터 외형 레퍼런스 포함
    const characterAppearanceSection = project.characterAppearance
      ? `\n\n⚠️ CRITICAL CHARACTER REFERENCE (MUST MATCH EXACTLY):\n${project.characterAppearance}\n\nAll characters MUST maintain these exact visual features throughout all scenes.`
      : '';

    const prompt = `Generate image prompts for these pre-divided script scenes.

Characters:
${characterDescriptions}
${characterAppearanceSection}

Style: ${project.customStyleDescription || project.style}

Scenes (${scriptScenes.length} total):
${JSON.stringify(scenesWithNumbers, null, 2)}

TASK: For EACH scene, generate ONLY the "imagePrompt" field. The scriptSegment is already final and must NOT be changed.

For EACH scene, provide:
1. "segment_number": Scene number (same as input)
2. "scriptSegment": EXACT copy from input (DO NOT CHANGE)
3. "imagePrompt": Detailed English visual description. CRITICAL:
   - Characters MUST match visualDescription exactly (same face/hair/clothing)
   - Describe background, lighting, mood, character actions/expressions based on scriptSegment
   - ⚠️ ABSOLUTELY NO TEXT/LETTERS/WORDS/SYMBOLS/SIGNS in the image
   - NEVER mention camera shots or movement terms
   - Pure visual scene only
4. "effect_type": Always "static_subtle"
5. "intensity": 1-10 emotional intensity based on scriptSegment content

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
    if (!jsonMatch) throw new Error('Failed to parse image prompts');

    const aiScenes = JSON.parse(jsonMatch[0]);

    return aiScenes.map((aiScene: any, index: number) => {
      const effectType = 'static_subtle';
      const intensity = aiScene.intensity || 5;
      const motionParams = this.generateMotionParams(effectType, intensity);

      return {
        id: crypto.randomUUID(),
        scriptSegment: scriptScenes[index].scriptSegment,
        imagePrompt: stripCameraTerms(aiScene.imagePrompt || 'Scene depicting the script'),
        imageUrl: null,
        audioUrl: null,
        videoUrl: null,
        uploadedVideoUrl: null,
        activeMedia: 'image' as const,
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

  // 하이브리드 분할: Gemini에게 앵커만 요청
  private async getScriptAnchors(
    script: string,
    characterDescriptions: string,
    characterAppearanceSection: string,
    style: string
  ): Promise<SegmentAnchor[]> {
    const ai = this.getClient();

    const prompt = `Analyze this Korean script and divide it into scenes for video generation.
Each scene = 1 static image + 10 seconds of TTS narration.

Characters:
${characterDescriptions}
${characterAppearanceSection}

Style: ${style}

Full Script (${script.length} characters):
${script}

=== CRITICAL RULES ===

1. **ANCHOR EXTRACTION (가장 중요)**
   - start_marker와 end_marker는 원본 텍스트에서 **그대로 복사**해서 반환해라
   - 절대 바꾸지 마라. 띄어쓰기, 마침표, 쉼표까지 원본 그대로
   - 오타가 있어도 그대로 복사
   - 이것은 텍스트 보존을 위한 "위치 표시"용이다

2. **SEGMENT LENGTH** (CRITICAL)
   - 각 세그먼트는 반드시 20자 이내 (1줄 자막 필수)
   - 20자 초과 시 의미 단위로 반드시 분리
   - 너무 짧으면 (10자 미만) 다음과 합치기 (단, 20자 초과 금지)

3. **NATURAL BREAKS**
   - 의미가 끊기는 자연스러운 지점에서 분할
   - 문장 중간에서 자르지 말 것
   - 문단, 대화 전환, 장면 전환 지점 활용

=== OUTPUT FORMAT ===

For EACH scene, provide:
1. "segment_number": Scene number (1, 2, 3...)
2. "start_marker": **EXACT first 15-30 characters** of this segment (copy from original)
3. "end_marker": **EXACT last 15-30 characters** of this segment (copy from original)
4. "imagePrompt": Detailed English visual description
   - Characters MUST match visualDescription exactly
   - ⚠️ NO TEXT/LETTERS/WORDS in the image
   - NEVER mention camera shots
5. "intensity": 1-10 emotional intensity

=== EXAMPLE ===

If original script is:
"안녕하세요 여러분, 오늘은 특별한 이야기를 해볼게요. 먼저 우리가 알아야 할 것은..."

Good response:
[
  {
    "segment_number": 1,
    "start_marker": "안녕하세요 여러분, 오늘은",
    "end_marker": "이야기를 해볼게요.",
    "imagePrompt": "...",
    "intensity": 5
  },
  {
    "segment_number": 2,
    "start_marker": "먼저 우리가 알아야",
    "end_marker": "알 것은...",
    "imagePrompt": "...",
    "intensity": 5
  }
]

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
    if (!jsonMatch) throw new Error('Failed to parse anchor data');

    return JSON.parse(jsonMatch[0]);
  }

  async createStoryboard(project: StoryProject, onRetry?: (message: string) => void): Promise<Scene[]> {
    const characterDescriptions = project.characters
      .map(c => `- ${c.name}: ${c.visualDescription}`)
      .join('\n');

    const characterAppearanceSection = project.characterAppearance
      ? `\n\n⚠️ CRITICAL CHARACTER REFERENCE (MUST MATCH EXACTLY):\n${project.characterAppearance}\n\nAll characters in scenes MUST maintain these exact visual features.`
      : '';

    const style = project.customStyleDescription || project.style;
    const originalScript = project.script;

    // 최대 3회 시도 (초기 1회 + 재시도 2회)
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(`[Hybrid Split] Attempt ${attempt}/${MAX_ATTEMPTS}`);

        // 1. Gemini에게 앵커만 요청
        const anchors = await this.getScriptAnchors(
          originalScript,
          characterDescriptions,
          characterAppearanceSection,
          style
        );

        console.log(`[Hybrid Split] Got ${anchors.length} anchors from Gemini`);

        // 2. 앵커 기반으로 원본에서 텍스트 추출
        const result = extractSegmentsFromAnchors(originalScript, anchors);

        if (result.success) {
          console.log(`[Hybrid Split] Success! ${result.segments.length} segments extracted`);

          // 성공: Scene 객체로 변환
          return result.segments.map((seg) => {
            const effectType = 'static_subtle';
            const motionParams = this.generateMotionParams(effectType, seg.intensity);

            return {
              id: crypto.randomUUID(),
              scriptSegment: seg.scriptSegment,
              imagePrompt: stripCameraTerms(seg.imagePrompt || 'Scene depicting the script'),
              imageUrl: null,
              audioUrl: null,
              videoUrl: null,
              uploadedVideoUrl: null,
              activeMedia: 'image' as const,
              status: 'idle' as const,
              audioStatus: 'idle' as const,
              videoStatus: 'idle' as const,
              effect: {
                effect_type: effectType,
                intensity: seg.intensity,
                motion_params: motionParams
              } as SceneEffect
            };
          });
        }

        // 실패: 재시도 메시지
        const errorMsg = `분할 검증 실패 (${result.error}), 재시도 중... (${attempt}/${MAX_ATTEMPTS})`;
        console.warn(`[Hybrid Split] ${errorMsg}`);
        onRetry?.(errorMsg);

      } catch (error) {
        console.error(`[Hybrid Split] Attempt ${attempt} error:`, error);
        if (attempt === MAX_ATTEMPTS) {
          throw error;
        }
      }
    }

    // 모든 시도 실패: 기계적 분할로 Fallback
    console.warn('[Hybrid Split] All attempts failed, falling back to mechanical split');
    onRetry?.('AI 분할 실패, 문장 단위 기계적 분할로 전환...');

    const mechanicalSegments = mechanicalSplit(originalScript, 70);

    // 기계적 분할된 텍스트로 이미지 프롬프트 생성 요청
    const scriptScenes = mechanicalSegments.map(seg => ({ scriptSegment: seg }));
    return this.generateImagePromptsForScenes(scriptScenes, project);
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

    // 캐릭터 외형 레퍼런스 포함
    const characterAppearanceSection = project.characterAppearance
      ? `\n\n⚠️ CRITICAL - Reference Character Appearance (MUST MATCH):\n${project.characterAppearance}`
      : '';

    const prompt = `Modify this image generation prompt based on the user's request while maintaining character consistency.

Current prompt:
${currentPrompt}

User's modification request (in Korean):
${userRequest}

Character reference:
${characterDescriptions}
${characterAppearanceSection}

Style: ${project.customStyleDescription || project.style}

Generate a new, detailed English prompt that:
1. Incorporates the user's requested changes
2. Maintains the EXACT same visual style and art style
3. Keeps character appearances IDENTICAL to their descriptions (same eyes, hair, face shape, proportions)
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
