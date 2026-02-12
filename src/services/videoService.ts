// LTX Video Service

const MODAL_API = 'https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run';

// exp/official-sdk: 공식 TI2VidTwoStagesPipeline 엔드포인트
// Modal 대시보드에서 generate_official URL 복사 후 여기 입력
const OFFICIAL_API = 'REPLACE_WITH_OFFICIAL_URL';

export type VideoEngine = 'diffusers' | 'official';

export interface VideoGenerationRequest {
  prompt: string;
  image_url: string;
  character_description?: string;
  num_frames?: number;
  // 테스트용 파라미터 (품질 실험)
  test_conditioning?: number;
  test_guidance?: number;
  test_steps?: number;
}

export async function generateSceneVideo(
  imageUrl: string,
  imagePrompt: string,
  dialogue: string,
  characterDescription: string = '',
  multiFaceMode: boolean = false,
  testParams?: {
    conditioning?: number;
    guidance?: number;
    steps?: number;
  },
  engine: VideoEngine = 'diffusers'
): Promise<Blob> {
  console.log(`[LTX] generateSceneVideo called | engine=${engine}`);
  console.log('[LTX] Dialogue:', dialogue.substring(0, 50));

  // ── 공식 SDK 경로 ─────────────────────────────────────────────
  if (engine === 'official') {
    console.log('[LTX] [OFFICIAL] Calling TI2VidTwoStagesPipeline...');
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000); // 10분
    try {
      const res = await fetch(OFFICIAL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, num_frames: 192, seed: 42 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Official API error: ${res.status} ${await res.text()}`);
      const data = await res.json();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[LTX] [OFFICIAL] Done: ${elapsed}s | cost ₩${data.cost_krw}`);
      const binary = atob(data.video_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: 'video/mp4' });
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // ── 기존 diffusers 경로 (unchanged) ──────────────────────────

  // Item 1+3: Hard-lock motion to "blink only" — deterministic, no Gemini free-form
  // Whitelist: A="blink only" | B="blink + breathing" | C="blink + breathing + micro head <0.3°"
  // Default = A (minimum motion, prevents artifacts)
  const enhancedPrompt = 'blink only';
  console.log('[LTX] Motion prompt (hardcoded):', enhancedPrompt);

  console.log('[LTX] Calling Modal API:', MODAL_API);
  console.log('[LTX] Final prompt:', enhancedPrompt.substring(0, 100));
  const startTime = Date.now();

  console.log('[LTX] multi_face_mode:', multiFaceMode);
  const requestBody: any = {
    prompt: enhancedPrompt,
    image_url: imageUrl,
    character_description: characterDescription,
    num_frames: 97, // ~4 seconds @ 24fps
    multi_face_mode: multiFaceMode,
  };

  // 테스트 파라미터 추가 (있으면)
  if (testParams) {
    if (testParams.conditioning !== undefined) requestBody.test_conditioning = testParams.conditioning;
    if (testParams.guidance !== undefined) requestBody.test_guidance = testParams.guidance;
    if (testParams.steps !== undefined) requestBody.test_steps = testParams.steps;

    console.log('[LTX] TEST MODE:', testParams);
  }

  // 1. 생성 시작 → job_id 즉시 반환
  const startResponse = await fetch(`${MODAL_API}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  if (!startResponse.ok) {
    throw new Error(`Generation start failed: ${startResponse.status} ${await startResponse.text()}`);
  }
  const { job_id } = await startResponse.json();
  console.log(`[LTX] Job started: ${job_id}`);

  // 2. 폴링으로 완료 대기
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const statusResponse = await fetch(`${MODAL_API}/status/${job_id}`);
    const statusData = await statusResponse.json();
    console.log(`[LTX] Job ${job_id} status: ${statusData.status}`);
    if (statusData.status === 'complete') break;
    if (statusData.status === 'error') throw new Error(`Generation failed: ${statusData.error}`);
    if (statusData.status === 'not_found') throw new Error('Job not found');
  }

  // 3. 결과 다운로드
  const resultResponse = await fetch(`${MODAL_API}/result/${job_id}`);
  if (!resultResponse.ok) {
    throw new Error(`Result fetch failed: ${resultResponse.status}`);
  }
  const blob = await resultResponse.blob();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[LTX] Video blob received: ${(blob.size / 1024 / 1024).toFixed(2)} MB (${elapsed}s)`);
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
