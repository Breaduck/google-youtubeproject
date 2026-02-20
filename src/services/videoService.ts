// LTX Video Service

const MODAL_API = 'https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run';

// exp/official-sdk: 공식 TI2VidTwoStagesPipeline 엔드포인트
const OFFICIAL_API = 'https://hiyoonsh1--ltx-official-exp-web.modal.run';

export type VideoEngine = 'diffusers' | 'official' | 'seedance';

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

  // ── 공식 SDK 경로 (비동기 job queue) ──────────────────────────
  if (engine === 'official') {
    console.log('[LTX] [OFFICIAL] Calling TI2VidTwoStagesPipeline...');
    const startTime = Date.now();

    // 대사 길이/강도 기반 motion 선택 (서버 Preset B whitelist 호환)
    // Preset A(서버 기본)는 motion_desc를 무시하고 "subtle breathing"으로 강제함
    // Preset B whitelist: {"subtle breathing", "brief blink once"}
    const dialogueLen = (dialogue || '').trim().length;
    let motionDesc: string;
    if (dialogueLen === 0) {
      motionDesc = 'subtle breathing';
    } else if (dialogueLen < 15) {
      motionDesc = 'subtle breathing, brief blink once';
    } else {
      motionDesc = 'subtle breathing, brief blink once';
    }
    console.log(`[LTX] [OFFICIAL] motion_desc="${motionDesc}" (dialogue len=${dialogueLen})`);

    // 1. 생성 시작 → job_id 즉시 반환
    const requestBody = {
      image_url: imageUrl,
      num_frames: 73,        // server clamps to 72
      seed: 42,
      motion_desc: motionDesc,
      dialogue: (dialogue || '').trim().substring(0, 200),   // Safe Motion Mapper용
      image_prompt: (imagePrompt || '').trim().substring(0, 200), // scene_description용
    };
    console.log('[LTX] [OFFICIAL] Request body:', JSON.stringify({ ...requestBody, image_url: '[omitted]' }));

    const startRes = await fetch(`${OFFICIAL_API}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!startRes.ok) throw new Error(`Official API start failed: ${startRes.status} ${await startRes.text()}`);
    const { job_id } = await startRes.json();
    console.log(`[LTX] [OFFICIAL] Job started: ${job_id}`);

    // 2. 폴링으로 완료 대기
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const statusRes = await fetch(`${OFFICIAL_API}/status/${job_id}`);
      const statusData = await statusRes.json();
      console.log(`[LTX] [OFFICIAL] Job ${job_id} status: ${statusData.status}`);
      if (statusData.status === 'complete') break;
      if (statusData.status === 'error') throw new Error(`Official generation failed: ${statusData.error}`);
      if (statusData.status === 'not_found') throw new Error('Job not found');
    }

    // 3. MP4 다운로드
    const resultRes = await fetch(`${OFFICIAL_API}/download/${job_id}`);
    if (!resultRes.ok) throw new Error(`Official download failed: ${resultRes.status}`);
    const blob = await resultRes.blob();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[LTX] [OFFICIAL] Done: ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    return new Blob([blob], { type: 'video/mp4' });
  }

  // ── SeeDANCE 경로 (BytePlus 직접 호출) ────────────────────────
  if (engine === 'seedance') {
    console.log('[LTX] [SEEDANCE] Calling BytePlus SeeDANCE API directly...');
    const startTime = Date.now();

    // localStorage에서 API 키 읽기
    const seedanceApiKey = localStorage.getItem('seedance_api_key') || '';
    if (!seedanceApiKey || seedanceApiKey.length < 10) {
      throw new Error('SeeDANCE API key not configured. Please add it in Settings.');
    }

    // BytePlus API 직접 호출
    const BYTEPLUS_API = 'https://api.byteplus.com/v1/video/generations';

    // 이미지를 base64로 변환
    let imageBase64 = '';
    if (imageUrl.startsWith('data:')) {
      imageBase64 = imageUrl;
    } else {
      const imgRes = await fetch(imageUrl);
      const imgBlob = await imgRes.blob();
      const reader = new FileReader();
      imageBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });
    }

    // Safe Motion Mapper (서버 로직과 동일)
    const d = (dialogue || '').trim();
    let motionTemplate = '';
    if (d.includes('!')) {
      motionTemplate = 'quick head turn toward the listener';
    } else if (d.includes('?')) {
      motionTemplate = 'micro nod once';
    } else if (d.length >= 20) {
      motionTemplate = 'slight forward lean';
    } else {
      motionTemplate = 'raise one hand slightly below the chin (hand stays away from face)';
    }
    const motionDesc = motionTemplate + ', then hold still, subtle breathing';

    // 프롬프트 조립
    const prompt = `A cinematic 2D anime scene, clean lineart, consistent character design, stable facial features. Static camera, smooth animation. Keep eyes open, minimal mouth movement. ${imagePrompt}. Motion: ${motionDesc}.`;
    const negativePrompt = 'closed eyes, eyes shut, face morphing, deformed face, jitter, flicker, camera movement, text, watermark';

    const requestBody = {
      model: 'seedance-1.0-pro-fast',
      prompt: prompt,
      negative_prompt: negativePrompt,
      image: imageBase64,
      width: 1248,
      height: 704,
      num_frames: 120,
      fps: 24,
      duration: 5.0,
      seed: 42,
    };

    console.log('[LTX] [SEEDANCE] Calling BytePlus API...');
    const apiRes = await fetch(BYTEPLUS_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${seedanceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      throw new Error(`BytePlus API failed: ${apiRes.status} ${errorText}`);
    }

    const result = await apiRes.json();
    console.log('[LTX] [SEEDANCE] API response:', result);

    // 응답에서 비디오 URL 추출 (BytePlus 응답 형식에 맞게 조정 필요)
    const videoUrl = result.video_url || result.data?.url;
    if (!videoUrl) {
      throw new Error(`No video URL in response: ${JSON.stringify(result)}`);
    }

    // 비디오 다운로드
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.status}`);
    const blob = await videoRes.blob();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[LTX] [SEEDANCE] Done: ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    return new Blob([blob], { type: 'video/mp4' });
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
