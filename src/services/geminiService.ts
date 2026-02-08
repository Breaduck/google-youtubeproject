import { GoogleGenAI } from "@google/genai";
import { CharacterProfile, StoryProject, VisualStyle, Scene, SceneEffect } from "../types";

export class GeminiService {
  private getApiKey(): string {
    return localStorage.getItem('gemini_api_key') || '';
  }

  private getModel(): string {
    return localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
  }

  private getClient(): GoogleGenAI {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
    return new GoogleGenAI({ apiKey });
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

  async generateImage(prompt: string, isPortrait: boolean = false, model?: string): Promise<string> {
    const ai = this.getClient();
    const imageModel = model || localStorage.getItem('gemini_image_model') || 'gemini-2.5-flash-image';

    let enhancedPrompt = prompt;
    if (isPortrait) {
      enhancedPrompt = `Portrait shot, centered composition, square 1:1 aspect ratio, ${prompt}, high quality, detailed, professional lighting`;
    } else {
      enhancedPrompt = `Widescreen 16:9 aspect ratio, ${prompt}, cinematic composition, high quality, detailed, professional lighting`;
    }

    // Check if using Imagen models
    if (imageModel.includes('imagen')) {
      const response = await ai.models.generateImages({
        model: imageModel,
        prompt: enhancedPrompt,
        config: {
          numberOfImages: 1,
          aspectRatio: isPortrait ? '1:1' : '16:9'
        }
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
    const targetSentences = 4;

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
    const chunks = this.chunkScript(project.script);

    if (chunks.length === 0) {
      throw new Error('스크립트를 파싱할 수 없습니다.');
    }

    const characterDescriptions = project.characters
      .map(c => `- ${c.name}: ${c.visualDescription}`)
      .join('\n');

    const prompt = `Generate image prompts for these ${chunks.length} script segments.

Characters:
${characterDescriptions}

Style: ${project.customStyleDescription || project.style}

Script segments (numbered):
${chunks.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n')}

For EACH numbered segment, provide:
1. "segment_number": The segment number (1 to ${chunks.length})
2. "imagePrompt": A detailed English prompt for image generation including scene composition, character positions, background, lighting, mood
3. "effect_type": One of "3d_parallax", "zoom_in_slow", "zoom_in_fast", "zoom_out_slow", "pan_left", "pan_right", "static_subtle"
4. "intensity": 1-10 emotional intensity

IMPORTANT: You MUST generate exactly ${chunks.length} scene objects, one for each segment number.

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
    const sceneMap = new Map<number, any>();

    for (const scene of aiScenes) {
      const num = scene.segment_number || scene.segmentNumber || sceneMap.size + 1;
      sceneMap.set(num, scene);
    }

    return chunks.map((chunk, index) => {
      const segNum = index + 1;
      const aiScene = sceneMap.get(segNum) || {};
      const effectType = aiScene.effect_type || aiScene.effectType || '3d_parallax';
      const intensity = aiScene.intensity || 5;
      const motionParams = this.generateMotionParams(effectType, intensity);

      return {
        id: crypto.randomUUID(),
        scriptSegment: chunk,
        imagePrompt: aiScene.imagePrompt || `Scene depicting: ${chunk.substring(0, 100)}`,
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

Return ONLY the new prompt text, no explanation or markdown.`;

    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: prompt
    });

    return response.text || currentPrompt;
  }

  async generateGoogleTTS(text: string, voice: string, apiKey?: string): Promise<string> {
    const key = apiKey || this.getApiKey();
    if (!key) {
      throw new Error('API key is required for TTS');
    }

    // Using Google Cloud Text-to-Speech API via Gemini's multimodal capabilities
    // This is a workaround - ideally you'd use the dedicated TTS API
    const ai = new GoogleGenAI({ apiKey: key });

    // Map voice names to actual voice configs
    const voiceConfigs: Record<string, { languageCode: string; name: string }> = {
      'Kore': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Kore' },
      'Zephyr': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Zephyr' },
      'Puck': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Puck' },
      'Charon': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Charon' },
      'Fenrir': { languageCode: 'ko-KR', name: 'ko-KR-Chirp3-HD-Fenrir' }
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
            }
          }
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
      utterance.rate = 1.0;

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

    const prompt = `Generate a SHORT I2V (image-to-video) motion prompt for subtle animation.

INPUT:
Dialogue (for emotional context only): "${dialogue}"
Reference image: "${imagePrompt}"

CRITICAL: Do NOT describe character appearance (we already have the reference image).
Focus ONLY on micro-motion + ambience.

RULES:
- Motion: blinking (every 3-5 sec), micro-nod (1-2 degrees), subtle breathing, tiny hand gesture only
- Camera: STATIC (no pan/zoom/movement)
- Mouth: ALWAYS CLOSED, NO speaking
- Audio: Ambience only (wind / room tone / nature), NO narration/dialogue

OUTPUT FORMAT (1 line):
"Subtle motion: [micro-movements] | Ambience: [wind/room tone/nature] | Static camera | Mouth closed"

EXAMPLES:
Input: "I can't believe this happened..." (sad scene)
Output: "Subtle motion: Slow blinking, micro-nod downward (1 degree), shoulders subtly rising and falling with breathing | Ambience: Quiet room tone with distant wind | Static camera | Mouth closed"

Input: "Hahaha! That's hilarious!" (happy scene)
Output: "Subtle motion: Quick blinking, tiny head tilt (2 degrees), slight shoulder movement with silent laughter | Ambience: Light outdoor breeze, rustling leaves | Static camera | Mouth closed"

Now generate for the input above. Return ONLY the single-line prompt, no explanation.`;

    const response = await ai.models.generateContent({
      model: this.getModel(),
      contents: prompt
    });

    let generatedPrompt = response.text?.trim() || 'Subtle motion: Blinking, micro-nod (1 degree), gentle breathing | Ambience: Soft room tone | Static camera | Mouth closed';

    // Enforce format if not followed
    if (!generatedPrompt.toLowerCase().includes('|')) {
      // Fallback to structured format
      generatedPrompt = `Subtle motion: Blinking, micro-nod (1-2 degrees), subtle breathing | Ambience: Soft wind or room tone | Static camera | Mouth closed`;
    }

    // Ensure critical constraints
    if (!generatedPrompt.toLowerCase().includes('mouth closed')) {
      generatedPrompt += ' | Mouth closed';
    }

    if (!generatedPrompt.toLowerCase().includes('static camera')) {
      generatedPrompt = generatedPrompt.replace(/camera[^|]*\|/i, 'Static camera |');
    }

    return generatedPrompt;
  }
}
