// LTX Video Service
import { GeminiService } from './geminiService';

const MODAL_API = 'https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run';

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
  // 테스트용 파라미터 (품질 실험)
  testParams?: {
    conditioning?: number;
    guidance?: number;
    steps?: number;
  }
): Promise<Blob> {
  console.log('[LTX] generateSceneVideo called');
  console.log('[LTX] Dialogue:', dialogue.substring(0, 50));

  // Gemini 감정 분석 → 5단계 공식 모션 프롬프트 생성
  console.log('[LTX] Generating emotion-based motion prompt via Gemini...');
  const gemini = new GeminiService();
  const motionDescription = await gemini.generateMotionPrompt(dialogue, imagePrompt);
  console.log('[LTX] Gemini motion prompt:', motionDescription);

  // 최종 프롬프트 = Gemini가 생성한 감정 기반 모션
  const enhancedPrompt = motionDescription;

  console.log('[LTX] Calling Modal API:', MODAL_API);
  console.log('[LTX] Final prompt:', enhancedPrompt.substring(0, 100));
  const startTime = Date.now();

  const requestBody: any = {
    prompt: enhancedPrompt,
    image_url: imageUrl,
    character_description: characterDescription,
    num_frames: 97, // ~4 seconds @ 24fps
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
