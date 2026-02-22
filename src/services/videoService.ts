// 브랜치2: BytePlus + Evolink + Runware

export type VideoEngine = 'bytedance';

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
  engine: VideoEngine = 'bytedance',
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  const provider = localStorage.getItem('video_provider') || 'byteplus';
  if (provider === 'evolink') {
    return generateEvolinkVideo(imageUrl, imagePrompt, dialogue, testParams, onProgress);
  }
  if (provider === 'runware') {
    return generateRunwareVideo(imageUrl, imagePrompt, dialogue, testParams, onProgress);
  }
  return generateByteDanceVideo(imageUrl, imagePrompt, dialogue, characterDescription, testParams, onProgress);
}

// BytePlus 공식 API (ModelArk)
async function generateByteDanceVideo(
  imageUrl: string,
  imagePrompt: string,
  dialogue: string,
  characterDescription: string = '',
  testParams?: any,
  onProgress?: (progress: number, message: string) => void
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
  const model = testParams?.model || localStorage.getItem('bytedance_model') || 'seedance-1-0-pro-fast-251015';
  const duration_sec = testParams?.duration_sec || parseInt(localStorage.getItem('bytedance_duration') || '5');
  const resolution = testParams?.resolution || localStorage.getItem('bytedance_resolution') || '720p';

  // 프롬프트 구성 (BytePlus는 파라미터를 프롬프트에 포함)
  const sceneDesc = (imagePrompt || 'anime character in a clean 2D scene').trim().substring(0, 200);
  const basePrompt = `A cinematic 2D anime scene, clean lineart, consistent character design, stable facial features. Static camera, smooth animation. Keep eyes open, minimal mouth movement. ${sceneDesc}.`;
  const prompt = `${basePrompt} --resolution ${resolution} --duration ${duration_sec} --camerafixed false`;

  console.log(`[BYTEDANCE] Model=${model} Duration=${duration_sec}s Resolution=${resolution}`);

  // BytePlus ModelArk API 엔드포인트 (Modal 프록시 사용 - CORS 문제 해결)
  const BYTEPLUS_API = 'https://hiyoonsh1--byteplus-proxy-web.modal.run';

  // Step 0: data URL → 업로드 → image_url 변환
  let finalImageUrl = imageUrl;
  if (imageUrl.startsWith('data:image/')) {
    console.log('[BYTEDANCE] Uploading data URL...');
    onProgress?.(5, '이미지 업로드 중...');
    const uploadRes = await fetch(`${BYTEPLUS_API}/api/v3/uploads`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({data_url: imageUrl}),
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    finalImageUrl = uploadData.image_url;
    console.log(`[BYTEDANCE] Uploaded: ${finalImageUrl}`);
  }

  // Step 1: 비디오 생성 태스크 생성
  const requestBody = {
    model: model,
    content: [
      {
        type: 'image_url',
        image_url: {
          url: finalImageUrl
        }
      },
      {
        type: 'text',
        text: prompt
      }
    ]
  };

  console.log('[BYTEDANCE] Request body:', JSON.stringify({ ...requestBody, content: '[omitted]' }));

  try {
    // 태스크 생성
    onProgress?.(10, '비디오 생성 요청 중...');
    const createResponse = await fetch(`${BYTEPLUS_API}/api/v3/content_generation/tasks`, {
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
    const QUERY_API = `${BYTEPLUS_API}/api/v3/content_generation/tasks/${taskId}`;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 최대 5분 대기

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

      // 진행률 계산 (대략적 추정)
      const progress = status === 'running'
        ? Math.min(95, 10 + (attempts * 10))
        : status === 'succeeded'
        ? 100
        : 5;

      const progressMessage = status === 'running'
        ? `비디오 생성 중... (${attempts}번째 확인)`
        : status === 'succeeded'
        ? '비디오 생성 완료!'
        : '비디오 생성 대기 중...';

      onProgress?.(progress, progressMessage);
      console.log(`[BYTEDANCE] Attempt ${attempts}: status=${status} (${progress}%)`);

      if (status === 'completed' || status === 'success' || status === 'succeeded') {
        console.log(`[BYTEDANCE] Task succeeded: ${taskId}`);
        break;
      } else if (status === 'failed' || status === 'error') {
        throw new Error(`Video generation failed: ${JSON.stringify(queryResult)}`);
      }
    }

    if (attempts >= MAX_ATTEMPTS) {
      throw new Error(`Video generation timeout after ${MAX_ATTEMPTS} attempts`);
    }

    // Step 3: 비디오 다운로드 (CORS 우회 - Modal 프록시 사용)
    const downloadUrl = `${BYTEPLUS_API}/api/v3/content_generation/tasks/${taskId}/download`;
    console.log(`[BYTEDANCE] Downloading via proxy: ${downloadUrl}`);

    const videoRes = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${bytedanceApiKey}`,
      },
    });

    if (!videoRes.ok) {
      const errorText = await videoRes.text();
      throw new Error(`Video download failed: ${videoRes.status} ${errorText}`);
    }

    const blob = await videoRes.blob();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[BYTEDANCE] Done: ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

    return new Blob([blob], { type: 'video/mp4' });
  } catch (error) {
    console.error('[BYTEDANCE] Error:', error);
    throw error;
  }
}

// Evolink API
async function generateEvolinkVideo(
  imageUrl: string,
  imagePrompt: string,
  dialogue: string,
  testParams?: any,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  console.log('[EVOLINK] generateEvolinkVideo called');

  const evolinkApiKey = localStorage.getItem('evolink_api_key') || '';
  if (!evolinkApiKey || evolinkApiKey.length < 10) {
    throw new Error('Evolink API key not configured. Please add it in Settings.');
  }

  const startTime = Date.now();
  const duration = testParams?.duration_sec || parseInt(localStorage.getItem('evolink_duration') || '5');
  const quality = testParams?.resolution || localStorage.getItem('evolink_resolution') || '720p';

  const API_BASE = 'https://hiyoonsh1--byteplus-proxy-web.modal.run';

  // Step 1: 이미지 업로드 (공개 URL 변환)
  let finalImageUrl = imageUrl;
  if (imageUrl.startsWith('data:image/')) {
    console.log('[EVOLINK] Uploading data URL...');
    onProgress?.(5, '이미지 업로드 중...');
    const uploadRes = await fetch(`${API_BASE}/api/v3/uploads`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({data_url: imageUrl}),
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    finalImageUrl = uploadData.image_url;
    console.log('[EVOLINK] Uploaded:', finalImageUrl);
  }

  // Step 2: 비디오 생성 요청
  const sceneDesc = (imagePrompt || 'anime character').trim().substring(0, 200);
  const prompt = `A cinematic 2D anime scene, clean lineart, smooth animation. ${sceneDesc}.`;

  onProgress?.(10, '비디오 생성 요청 중...');
  const createRes = await fetch(`${API_BASE}/api/v3/evolink/videos/generations`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      api_key: evolinkApiKey,
      prompt,
      image_urls: [finalImageUrl],
      duration,
      quality,
      aspect_ratio: '16:9'
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Evolink API failed: ${createRes.status} ${errorText}`);
  }

  const createResult = await createRes.json();
  const taskId = createResult.id;
  console.log('[EVOLINK] Task created:', taskId);

  // Step 3: 폴링
  let attempts = 0;
  const MAX_ATTEMPTS = 60;

  while (attempts < MAX_ATTEMPTS) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;

    const queryRes = await fetch(`${API_BASE}/api/v3/evolink/tasks/${taskId}`, {
      headers: {'Authorization': `Bearer ${evolinkApiKey}`}
    });
    if (!queryRes.ok) continue;

    const queryResult = await queryRes.json();
    const status = queryResult.status;

    const progress = status === 'processing' ? Math.min(95, 10 + attempts * 10) : status === 'completed' ? 100 : 5;
    onProgress?.(progress, `비디오 생성 중... (${attempts}번째 확인)`);
    console.log(`[EVOLINK] Attempt ${attempts}: ${status} (${progress}%)`);

    if (status === 'completed') {
      console.log('[EVOLINK] Task succeeded');
      const videoUrl = queryResult.result?.video_url;
      if (!videoUrl) throw new Error('No video_url in response');

      // Step 4: 다운로드 프록시
      console.log('[EVOLINK] Downloading via proxy...');
      const downloadRes = await fetch(`${API_BASE}/api/v3/evolink/download?url=${encodeURIComponent(videoUrl)}`);
      if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);

      const blob = await downloadRes.blob();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[EVOLINK] Done: ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      return new Blob([blob], { type: 'video/mp4' });
    } else if (status === 'failed') {
      throw new Error(`Evolink generation failed: ${JSON.stringify(queryResult)}`);
    }
  }

  throw new Error(`Evolink timeout after ${MAX_ATTEMPTS} attempts`);
}

// Runware API (SeeDance 1.0 Pro Fast)
async function generateRunwareVideo(
  imageUrl: string,
  imagePrompt: string,
  dialogue: string,
  testParams?: any,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  console.log('[RUNWARE] generateRunwareVideo called');

  const runwareApiKey = localStorage.getItem('runware_api_key') || '';
  if (!runwareApiKey || runwareApiKey.length < 10) {
    throw new Error('Runware API key not configured. Please add it in Settings.');
  }

  const startTime = Date.now();
  const duration = testParams?.duration_sec || parseInt(localStorage.getItem('runware_duration') || '5');

  const API_BASE = 'https://hiyoonsh1--byteplus-proxy-web.modal.run';

  // Step 1: 이미지 업로드
  let finalImageUrl = imageUrl;
  if (imageUrl.startsWith('data:image/')) {
    console.log('[RUNWARE] Uploading data URL...');
    onProgress?.(5, '이미지 업로드 중...');
    const uploadRes = await fetch(`${API_BASE}/api/v3/uploads`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({data_url: imageUrl}),
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    finalImageUrl = uploadData.image_url;
    console.log('[RUNWARE] Uploaded:', finalImageUrl);
  }

  // Step 2: 비디오 생성 요청
  const sceneDesc = (imagePrompt || 'anime character').trim().substring(0, 200);
  const prompt = `A cinematic 2D anime scene, clean lineart, smooth animation. ${sceneDesc}.`;

  onProgress?.(10, '비디오 생성 요청 중...');
  const createRes = await fetch(`${API_BASE}/api/v3/runware/videos/generations`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      api_key: runwareApiKey,
      image_url: finalImageUrl,
      prompt,
      duration
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();

    // Billing Gate: insufficient credits 체크
    if (createRes.status === 402 || errorText.includes('insufficient')) {
      const billingError: any = new Error(
        `⚠️ Runware 크레딧 부족\n\n` +
        `• API 최소 요구: $5 크레딧 또는 paid invoice\n` +
        `• 실제 최소 충전: $20 (공식 정책)\n` +
        `• 환불: 크레딧 형태로만 가능\n` +
        `• 충전 페이지: https://my.runware.ai/wallet`
      );
      billingError.isBillingError = true;
      throw billingError;
    }

    throw new Error(`Runware API failed: ${createRes.status} ${errorText}`);
  }

  const createResult = await createRes.json();
  const taskId = createResult.id;
  console.log('[RUNWARE] Task created:', taskId);

  // Step 3: 폴링
  let attempts = 0;
  const MAX_ATTEMPTS = 60;

  while (attempts < MAX_ATTEMPTS) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;

    const queryRes = await fetch(`${API_BASE}/api/v3/runware/tasks/${taskId}`, {
      headers: {'Authorization': `Bearer ${runwareApiKey}`}
    });
    if (!queryRes.ok) continue;

    const queryResult = await queryRes.json();
    const status = queryResult.status;

    const progress = status === 'processing' ? Math.min(95, 10 + attempts * 10) : status === 'completed' ? 100 : 5;
    onProgress?.(progress, `비디오 생성 중... (${attempts}번째 확인)`);
    console.log(`[RUNWARE] Attempt ${attempts}: ${status} (${progress}%)`);

    if (status === 'completed') {
      console.log('[RUNWARE] Task succeeded');
      const videoUrl = queryResult.result?.video_url;
      if (!videoUrl) throw new Error('No video_url in response');

      // Step 4: 다운로드 프록시
      console.log('[RUNWARE] Downloading via proxy...');
      const downloadRes = await fetch(`${API_BASE}/api/v3/runware/download?url=${encodeURIComponent(videoUrl)}`);
      if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);

      const blob = await downloadRes.blob();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[RUNWARE] Done: ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      return new Blob([blob], { type: 'video/mp4' });
    } else if (status === 'failed') {
      throw new Error(`Runware generation failed: ${JSON.stringify(queryResult)}`);
    }
  }

  throw new Error(`Runware timeout after ${MAX_ATTEMPTS} attempts`);
}

export async function generateBatchVideos(
  scenes: VideoGenerationRequest[]
): Promise<Blob[]> {
  // 브랜치2에서는 batch 미지원 (필요시 순차 호출)
  throw new Error('Batch generation not supported in 브랜치2. Use single generation.');
}
