// LTX Video Service
const MODAL_API = 'https://hiyoonsh1--ltx-video-service-v2-web-app.modal.run';

export interface VideoGenerationRequest {
  prompt: string;
  image_url: string;
  character_description?: string;
  num_frames?: number;
}

export async function generateSceneVideo(
  imageUrl: string,
  prompt: string,
  characterDescription: string = ''
): Promise<Blob> {
  const response = await fetch(`${MODAL_API}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      character_description: characterDescription,
      num_frames: 97, // ~4 seconds @ 24fps
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Video generation failed');
  }

  return await response.blob();
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
