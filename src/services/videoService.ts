// 브랜치2: Runware API + BytePlus 공식 API

export type VideoEngine = 'runware' | 'bytedance';

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
  if (engine === 'bytedance') {
    return generateByteDanceVideo(imageUrl, imagePrompt, dialogue, characterDescription, testParams);
  }

  // Runware 엔진 (Feature Flag 체크)
  // CRITICAL: Runware는 기본 비활성화 (BILLING_GATE.md 참조)
  const runwareEnabled = import.meta.env.VITE_RUNWARE_ENABLED === 'true';
  if (!runwareEnabled) {
    const disabledError: any = new Error(
      `⚠️ Runware 비활성화\n\n` +
      `Runware는 기본적으로 비활성화되어 있습니다.\n\n` +
      `이유:\n` +
      `• API 최소 요구: $5 크레딧 또는 paid invoice\n` +
      `• 실제 최소 충전: $20 (공식 정책)\n` +
      `• 무료 크레딧 적용 불명확\n\n` +
      `활성화 방법:\n` +
      `1. .env 파일에 VITE_RUNWARE_ENABLED=true 추가\n` +
      `2. docs/BILLING_GATE.md 참조`
    );
    disabledError.isRunwareDisabled = true;
    throw disabledError;
  }

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
    taskType: 'videoInference',
    inputImage: imageUrl,
    model: model,
    motionStrength: 127,
    numFrames: num_frames,
    outputType: 'URL',
    outputFormat: 'MP4',
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
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        throw new Error(`Runware API failed: ${response.status} ${errorText}`);
      }

      // InsufficientCredits 에러 처리 (BILLING_GATE.md 참조)
      const errors = errorJson.errors || [];
      const creditError = errors.find((e: any) => e.code === 'videoInferenceInsufficientCredits');
      if (creditError) {
        console.error('[BILLING] insufficient credits - ABORT (no retry)');
        const billingError: any = new Error(
          `⚠️ Runware 크레딧 부족\n\n` +
          `• API 최소 요구: $5 크레딧 또는 paid invoice\n` +
          `• 실제 최소 충전: $20 (공식 정책)\n` +
          `• 크레딧 만료: 없음 (영구 사용 가능)\n` +
          `• 환불: 크레딧 형태로만 가능 (현금 불가)\n\n` +
          `충전 페이지: https://my.runware.ai/wallet\n\n` +
          `자세한 내용: docs/BILLING_GATE.md 참조`
        );
        billingError.isBillingError = true;
        billingError.need_min_credit_usd = 5;
        billingError.min_topup_usd = 20;
        billingError.wallet_url = 'https://my.runware.ai/wallet';
        billingError.action = 'topup_required';
        billingError.no_retry = true;  // 재시도 금지
        throw billingError;
      }

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

// BytePlus 공식 API (ModelArk)
async function generateByteDanceVideo(
  imageUrl: string,
  imagePrompt: string,
  dialogue: string,
  characterDescription: string = '',
  testParams?: any
): Promise<Blob> {
  console.log(`[BYTEDANCE] generateByteDanceVideo called`);
  console.log('[BYTEDANCE] Dialogue:', dialogue.substring(0, 50));

  // localStorage에서 BytePlus API 키 읽기
  const bytedanceApiKey = localStorage.getItem('bytedance_api_key') || '';
  if (!bytedanceApiKey || bytedanceApiKey.length < 10) {
    throw new Error('BytePlus API key not configured. Please add it in Settings.');
  }

  const startTime = Date.now();

  // BytePlus API 파라미터
  const model = testParams?.model || localStorage.getItem('bytedance_model') || 'seedance-1.0-pro';
  const duration_sec = testParams?.duration_sec || parseInt(localStorage.getItem('bytedance_duration') || '5');
  const resolution = testParams?.resolution || localStorage.getItem('bytedance_resolution') || '1080p';

  // 프롬프트 구성
  const sceneDesc = (imagePrompt || 'anime character in a clean 2D scene').trim().substring(0, 200);
  const prompt = `A cinematic 2D anime scene, clean lineart, consistent character design, stable facial features. Static camera, smooth animation. Keep eyes open, minimal mouth movement. ${sceneDesc}.`;

  console.log(`[BYTEDANCE] Model=${model} Duration=${duration_sec}s Resolution=${resolution}`);

  // BytePlus ModelArk API 엔드포인트
  const BYTEPLUS_API = 'https://ark.ap-southeast.bytepluses.com/api/v3/content_generation/tasks';

  // Step 1: 비디오 생성 태스크 생성
  const requestBody = {
    model: model,
    content: [
      {
        type: 'image',
        image_url: imageUrl
      },
      {
        type: 'text',
        text: prompt
      }
    ],
    parameters: {
      duration: duration_sec,
      resolution: resolution,
      fps: 24
    }
  };

  console.log('[BYTEDANCE] Request body:', JSON.stringify({ ...requestBody, content: '[omitted]' }));

  try {
    // 태스크 생성
    const createResponse = await fetch(BYTEPLUS_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bytedanceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`BytePlus API task creation failed: ${createResponse.status} ${errorText}`);
    }

    const createResult = await createResponse.json();
    console.log('[BYTEDANCE] Task created:', createResult);

    const taskId = createResult.task_id || createResult.id || createResult.data?.task_id;
    if (!taskId) {
      throw new Error(`No task ID in response: ${JSON.stringify(createResult)}`);
    }

    // Step 2: 태스크 완료 대기 (폴링)
    const QUERY_API = `${BYTEPLUS_API}/${taskId}`;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 최대 5분 대기
    let videoUrl = '';

    while (attempts < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
      attempts++;

      const queryResponse = await fetch(QUERY_API, {
        headers: {
          'Authorization': `Bearer ${bytedanceApiKey}`,
        },
      });

      if (!queryResponse.ok) {
        console.warn(`[BYTEDANCE] Query attempt ${attempts} failed`);
        continue;
      }

      const queryResult = await queryResponse.json();
      const status = queryResult.status || queryResult.data?.status;

      console.log(`[BYTEDANCE] Attempt ${attempts}: status=${status}`);

      if (status === 'completed' || status === 'success') {
        videoUrl = queryResult.video_url || queryResult.url || queryResult.data?.video_url || queryResult.data?.url;
        break;
      } else if (status === 'failed' || status === 'error') {
        throw new Error(`Video generation failed: ${JSON.stringify(queryResult)}`);
      }
    }

    if (!videoUrl) {
      throw new Error(`Video generation timeout after ${MAX_ATTEMPTS} attempts`);
    }

    // Step 3: 비디오 다운로드
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.status}`);
    const blob = await videoRes.blob();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[BYTEDANCE] Done: ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

    return new Blob([blob], { type: 'video/mp4' });
  } catch (error) {
    console.error('[BYTEDANCE] Error:', error);
    throw error;
  }
}

export async function generateBatchVideos(
  scenes: VideoGenerationRequest[]
): Promise<Blob[]> {
  // 브랜치2에서는 batch 미지원 (필요시 순차 호출)
  throw new Error('Batch generation not supported in 브랜치2. Use single generation.');
}
