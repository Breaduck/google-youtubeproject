// LTX Video Service
import { GeminiService } from './geminiService';

const MODAL_API = 'https://hiyoonsh1--ltx-video-service-v2-ltx2-fp8-web-app.modal.run';

export interface VideoGenerationRequest {
  prompt: string;
  image_url: string;
  character_description?: string;
  num_frames?: number;
}

export async function generateSceneVideo(
  imageUrl: string,
  imagePrompt: string,
  dialogue: string,
  characterDescription: string = ''
): Promise<Blob> {
  console.log('[LTX] generateSceneVideo called');
  console.log('[LTX] Dialogue:', dialogue.substring(0, 50));

  // 기본 모션 프롬프트 (Gemini 비용 절약)
  const motionDescription = 'subtle natural movement, gentle facial expressions, slight body motion';
  console.log('[LTX] Using default motion prompt');

  // Combine image prompt with motion
  const enhancedPrompt = `${imagePrompt}. ${motionDescription}`;

  console.log('[LTX] Calling Modal API:', MODAL_API);
  console.log('[LTX] Enhanced prompt:', enhancedPrompt.substring(0, 100));
  const startTime = Date.now();

  const response = await fetch(`${MODAL_API}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: enhancedPrompt,
      image_url: imageUrl,
      character_description: characterDescription,
      num_frames: 97, // ~4 seconds @ 24fps
    }),
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[LTX] Modal API response: ${response.status} (${elapsed}s)`);

  if (!response.ok) {
    let errorMessage = 'Video generation failed';
    try {
      const error = await response.json();
      console.error('[LTX] Modal API error:', error);
      errorMessage = error.error || error.detail || errorMessage;
    } catch (e) {
      // Response is not JSON, try reading as text
      const text = await response.text();
      console.error('[LTX] Modal API error (non-JSON):', text.substring(0, 200));
      errorMessage = `Modal API error (${response.status}): ${text.substring(0, 100)}`;
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  console.log(`[LTX] Video blob received: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
  return blob;
}

export async function generateBatchVideos(
  scenes: VideoGenerationRequest[]
): Promise<Blob[]> {
  const response = await fetch(`${MODAL_API}/batch-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scenes,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Batch generation failed');
  }

  const data = await response.json();

  // Convert base64 to Blobs
  return data.videos.map((base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'video/mp4' });
  });
}
