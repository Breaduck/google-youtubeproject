// 브랜치2: BytePlus 공식 API 전용

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
        // BytePlus 응답: {"content": {"video_url": "..."}}
        videoUrl = queryResult.content?.video_url || queryResult.video_url || queryResult.url || queryResult.data?.video_url || queryResult.data?.url;
        console.log(`[BYTEDANCE] Video URL extracted: ${videoUrl ? videoUrl.substring(0, 50) + '...' : 'NOT FOUND'}`);
        console.log(`[BYTEDANCE] Full response: ${JSON.stringify(queryResult).substring(0, 300)}...`);
        break;
      } else if (status === 'failed' || status === 'error') {
        throw new Error(`Video generation failed: ${JSON.stringify(queryResult)}`);
      }
    }

    if (!videoUrl) {
      throw new Error(`Video generation timeout after ${MAX_ATTEMPTS} attempts`);
    }

    // Step 3: 비디오 다운로드 (CORS 우회 - Modal 프록시 사용)
    const proxyUrl = `${BYTEPLUS_API}/api/v3/video_proxy?url=${encodeURIComponent(videoUrl)}`;
    const videoRes = await fetch(proxyUrl);
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
