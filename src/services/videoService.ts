// 브랜치2: Runware API 전용 (LTX 코드 전부 제거)

export type VideoEngine = 'runware';

export interface VideoGenerationRequest {
  image_url: string;
  prompt: string;
  num_frames?: number;
  fps?: number;
  duration_sec?: number;
}

export async function generateSceneVideo(
  imageUrl: string,
  imagePrompt: string,
  dialogue: string,
  characterDescription: string = '',
  multiFaceMode: boolean = false,
  testParams?: any,
  engine: VideoEngine = 'runware'
): Promise<Blob> {
  console.log(`[RUNWARE] generateSceneVideo called`);
  console.log('[RUNWARE] Dialogue:', dialogue.substring(0, 50));

  // localStorage에서 Runware API 키 읽기
  const runwareApiKey = localStorage.getItem('runware_api_key') || '';
  if (!runwareApiKey || runwareApiKey.length < 10) {
    throw new Error('Runware API key not configured. Please add it in Settings.');
  }

  const startTime = Date.now();

  // Runware API 파라미터 (testParams나 localStorage에서 읽기)
  const fps = testParams?.fps || parseInt(localStorage.getItem('runware_fps') || '12');
  const duration_sec = testParams?.duration_sec || parseInt(localStorage.getItem('runware_duration') || '10');
  const model = testParams?.model || localStorage.getItem('runware_model') || 'seedance-1.0-pro-fast';
  const num_frames = duration_sec * fps;

  // 프롬프트 구성
  const sceneDesc = (imagePrompt || 'anime character in a clean 2D scene').trim().substring(0, 200);
  const prompt = `A cinematic 2D anime scene, clean lineart, consistent character design, stable facial features. Static camera, smooth animation. Keep eyes open, minimal mouth movement. ${sceneDesc}.`;

  const requestBody = {
    taskType: 'imageToVideo',
    inputImage: imageUrl,
    model: model,
    motionStrength: 127,  // 0-255, 기본 127
    numFrames: num_frames,
    fps: fps,
    duration: duration_sec,
    seed: 42,
  };

  console.log(`[RUNWARE] Model=${model} FPS=${fps} Duration=${duration_sec}s Frames=${num_frames}`);
  console.log('[RUNWARE] Request body:', JSON.stringify({ ...requestBody, inputImage: '[omitted]' }));

  // Runware API 엔드포인트
  const RUNWARE_API = 'https://api.runware.ai/v1/video/generate';

  try {
    const response = await fetch(RUNWARE_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runwareApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([requestBody]),  // 배열로 감싸기
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Runware API failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('[RUNWARE] API response:', result);

    // Runware는 배열로 응답 (요청도 배열이므로)
    const firstResult = Array.isArray(result) ? result[0] : result;
    const videoUrl = firstResult.video_url || firstResult.url || firstResult.data?.url || firstResult.outputURL;

    if (!videoUrl) {
      throw new Error(`No video URL in response: ${JSON.stringify(result)}`);
    }

    // 비디오 다운로드
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.status}`);
    const blob = await videoRes.blob();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[RUNWARE] Done: ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

    return new Blob([blob], { type: 'video/mp4' });
  } catch (error) {
    console.error('[RUNWARE] Error:', error);
    throw error;
  }
}

export async function generateBatchVideos(
  scenes: VideoGenerationRequest[]
): Promise<Blob[]> {
  // 브랜치2에서는 batch 미지원 (필요시 순차 호출)
  throw new Error('Batch generation not supported in 브랜치2. Use single generation.');
}
