// 브랜치2: BytePlus + Evolink + Runware
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { SubtitleSettings, SubtitleTemplate } from '../types';

export type VideoEngine = 'bytedance';

export interface VideoGenerationRequest {
  image_url: string;
  prompt: string;
  num_frames?: number;
  fps?: number;
  duration_sec?: number;
}

// FFmpeg 인스턴스 (싱글톤)
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegLoaded) {
    return ffmpegInstance;
  }

  ffmpegInstance = new FFmpeg();

  // FFmpeg.wasm 로드 (CDN)
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegLoaded = true;
  return ffmpegInstance;
}

// 간단한 줌인-줌아웃 비디오 생성 (API 키 없을 때) - MP4 포맷 - export
export async function generateSimpleZoomVideo(
  imageUrl: string,
  subtitle: string = '',
  zoomDirection: 'in' | 'out' = 'in',
  subtitleSettings?: SubtitleSettings,
  onProgress?: (progress: number, message: string) => void,
  panDirection?: 'left' | 'right' | 'up' | 'down' | 'center',
  intensity?: number // 1-10, 긴박도 (속도/확대율 결정)
): Promise<Blob> {
  if (onProgress) onProgress(10, `${zoomDirection === 'in' ? '줌인' : '줌아웃'} 효과 생성 중...`);

  // 1단계: WebM 비디오 생성
  const webmBlob = await new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      // 폰트 로딩 대기 (자막 깨짐 방지)
      await document.fonts.ready;

      // 720p 해상도
      canvas.width = 1280;
      canvas.height = 720;

      // TTS 싱크를 위한 시간 계산 (자막 길이 기반, 최대 10초로 단축)
      const effectIntensity = intensity || 5;
      const subtitleLength = subtitle.length;

      // 한글 기준: 3-4자/초 읽기 속도
      const estimatedTtsTime = Math.max(5, Math.min(10, subtitleLength / 3.5));

      // 긴박도 보정 (긴박할수록 짧게)
      const intensityFactor = 1 - ((effectIntensity - 5) / 20); // 0.75 ~ 1.25
      const duration = Math.max(5, Math.min(10, estimatedTtsTime * intensityFactor));

      const fps = 20; // 24 → 20 FPS로 최적화 (속도 향상)
      const totalFrames = Math.floor(duration * fps);

      // MediaRecorder 설정 (최적화: VP8 + 낮은 bitrate)
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 1500000 // 2.5M → 1.5M (속도 향상)
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      recorder.start();

      // 줌인/줌아웃 애니메이션 렌더링
      let frame = 0;
      const interval = setInterval(() => {
        if (frame >= totalFrames) {
          clearInterval(interval);
          recorder.stop();
          return;
        }

        const progress = frame / totalFrames;

        // 긴박도에 따른 확대율 (1-10 → 0.08-0.20)
        const zoomAmount = 0.08 + (effectIntensity / 50); // 긴박할수록 크게 확대

        // 줌 방향에 따라 스케일 계산
        let scale: number;
        if (zoomDirection === 'in') {
          scale = 1.0 + (progress * zoomAmount); // 점진적 줌인
        } else {
          scale = 1.0 + zoomAmount - (progress * zoomAmount); // 점진적 줌아웃
        }

        // 패닝 방향에 따른 오프셋 계산 (자연스러운 움직임)
        const pan = panDirection || 'center';
        let offsetX = 0;
        let offsetY = 0;

        const panAmount = 40; // 최대 이동 거리 (픽셀)
        if (pan === 'left') {
          offsetX = progress * panAmount; // 좌→우 이동
        } else if (pan === 'right') {
          offsetX = -progress * panAmount; // 우→좌 이동
        } else if (pan === 'up') {
          offsetY = progress * panAmount; // 상→하 이동
        } else if (pan === 'down') {
          offsetY = -progress * panAmount; // 하→상 이동
        }

        // 캔버스 클리어
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 이미지 그리기 (확대 + 패닝)
        const scaledWidth = canvas.width * scale;
        const scaledHeight = canvas.height * scale;
        const x = (canvas.width - scaledWidth) / 2 + offsetX;
        const y = (canvas.height - scaledHeight) / 2 + offsetY;

        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

        // 자막 렌더링
        if (subtitle && subtitleSettings) {
          ctx.save();

          ctx.font = `bold ${subtitleSettings.fontSize}px "${subtitleSettings.fontFamily}", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          const text = subtitle;
          const textY = subtitleSettings.yPosition;

          // 배경 박스 (있을 경우)
          if (subtitleSettings.backgroundColor) {
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const bgPadding = subtitleSettings.bgPadding || 8;
            const bgHeight = subtitleSettings.fontSize + bgPadding * 2;

            ctx.fillStyle = subtitleSettings.backgroundColor;
            ctx.globalAlpha = subtitleSettings.bgOpacity || 0.8;
            ctx.fillRect(
              canvas.width / 2 - textWidth / 2 - bgPadding,
              textY - subtitleSettings.fontSize - bgPadding,
              textWidth + bgPadding * 2,
              bgHeight
            );
            ctx.globalAlpha = 1.0;
          }

          ctx.globalAlpha = subtitleSettings.opacity;

          // 외곽선
          if (subtitleSettings.strokeWidth > 0 && subtitleSettings.strokeColor !== 'transparent') {
            ctx.strokeStyle = subtitleSettings.strokeColor;
            ctx.lineWidth = subtitleSettings.strokeWidth;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(text, canvas.width / 2, textY);
          }

          // 텍스트
          ctx.fillStyle = subtitleSettings.textColor;
          ctx.fillText(text, canvas.width / 2, textY);

          ctx.restore();
        }

        frame++;

        if (onProgress && frame % 10 === 0) {
          const percent = Math.round((frame / totalFrames) * 60) + 10;
          onProgress(percent, `${zoomDirection === 'in' ? '줌인' : '줌아웃'} 효과 생성 중...`);
        }
      }, 1000 / fps);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });

  if (onProgress) onProgress(70, 'MP4로 변환 중...');

  // 2단계: WebM → MP4 변환 (FFmpeg.wasm)
  try {
    const ffmpeg = await getFFmpeg();

    // WebM 파일을 FFmpeg 가상 파일 시스템에 쓰기
    await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

    // WebM → MP4 변환 (자막 선명도 개선)
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      'output.mp4'
    ]);

    // 변환된 MP4 읽기
    const data = await ffmpeg.readFile('output.mp4');
    const mp4Blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });

    // 임시 파일 삭제
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('output.mp4');

    if (onProgress) onProgress(100, '완료');
    return mp4Blob;
  } catch (error) {
    console.error('FFmpeg conversion failed:', error);
    // 변환 실패 시 WebM 반환 (호환성)
    if (onProgress) onProgress(100, '완료 (WebM)');
    return webmBlob;
  }
}

// 여러 비디오를 하나로 합치기 (FFmpeg concat) - export
export async function mergeVideos(videoBlobs: Blob[], onProgress?: (progress: number, message: string) => void): Promise<Blob> {
  if (onProgress) onProgress(0, '병합 준비 중...');

  const ffmpeg = await getFFmpeg();
  const startTime = Date.now();

  // 각 비디오를 FFmpeg 파일 시스템에 쓰기 (병렬 처리 시뮬레이션)
  const writePromises = videoBlobs.map(async (blob, i) => {
    const data = await fetchFile(blob);
    await ffmpeg.writeFile(`video${i}.mp4`, data);
    return i;
  });

  // 모든 파일 쓰기 완료 대기
  let completed = 0;
  for (const promise of writePromises) {
    await promise;
    completed++;
    if (onProgress) {
      const percent = Math.round((completed / videoBlobs.length) * 40);
      onProgress(percent, `비디오 로딩 ${completed}/${videoBlobs.length}`);
    }
  }

  // concat 리스트 파일 생성
  const concatList = videoBlobs.map((_, i) => `file 'video${i}.mp4'`).join('\n');
  await ffmpeg.writeFile('concat_list.txt', concatList);

  if (onProgress) onProgress(50, '병합 시작...');

  // concat으로 병합 (스트림 복사 모드 - 재인코딩 없음)
  await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', '-c', 'copy', '-movflags', '+faststart', 'merged.mp4']);

  if (onProgress) onProgress(85, '파일 생성 중...');

  // 병합된 파일 읽기
  const mergedData = await ffmpeg.readFile('merged.mp4');
  const mergedBlob = new Blob([new Uint8Array(mergedData as Uint8Array)], { type: 'video/mp4' });

  if (onProgress) onProgress(95, '정리 중...');

  // 임시 파일 삭제 (순차 처리)
  for (let i = 0; i < videoBlobs.length; i++) {
    await ffmpeg.deleteFile(`video${i}.mp4`);
  }
  await ffmpeg.deleteFile('concat_list.txt');
  await ffmpeg.deleteFile('merged.mp4');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  if (onProgress) onProgress(100, `완료 (${elapsed}초)`);

  return mergedBlob;
}

export async function generateSceneVideo(
  imageUrl: string,
  imagePrompt: string,
  dialogue: string,
  characterDescription: string = '',
  multiFaceMode: boolean = false,
  testParams?: any,
  engine: VideoEngine = 'bytedance',
  subtitleSettings?: SubtitleSettings,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  const provider = localStorage.getItem('video_provider') || 'byteplus';
  if (provider === 'evolink') {
    return generateEvolinkVideo(imageUrl, imagePrompt, dialogue, testParams, subtitleSettings, onProgress);
  }
  if (provider === 'runware') {
    // Feature Flag 체크 (Billing Gate)
    const runwareEnabled = import.meta.env.VITE_RUNWARE_ENABLED === 'true';
    if (!runwareEnabled) {
      throw new Error(
        'Runware provider is disabled.\n\n' +
        'To enable: Set VITE_RUNWARE_ENABLED=true in .env file.\n' +
        'WARNING: Requires minimum $20 top-up (see docs/BILLING_GATE.md)'
      );
    }
    return generateRunwareVideo(imageUrl, imagePrompt, dialogue, testParams, subtitleSettings, onProgress);
  }
  return generateByteDanceVideo(imageUrl, imagePrompt, dialogue, characterDescription, testParams, subtitleSettings, onProgress);
}

async function generateByteDanceVideo(
  imageUrl: string,
  imagePrompt: string,
  dialogue: string,
  characterDescription: string = '',
  testParams?: any,
  subtitleSettings?: SubtitleSettings,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  console.log(`[BYTEDANCE] generateByteDanceVideo called`);
  console.log('[BYTEDANCE] Dialogue:', dialogue.substring(0, 50));

  // localStorage에서 BytePlus API 키 읽기
  const bytedanceApiKey = localStorage.getItem('bytedance_api_key') || '';
  if (!bytedanceApiKey || bytedanceApiKey.length < 10) {
    // API 키가 없으면 간단한 줌인-줌아웃 비디오 생성
    console.log('[BYTEDANCE] No API key - generating simple zoom video');
    // dialogue를 자막으로, zoomDirection은 외부에서 설정
    return generateSimpleZoomVideo(imageUrl, dialogue, 'in', subtitleSettings, onProgress);
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
  const BYTEPLUS_API = 'https://byteplus-video-proxy.hiyoonsh1.workers.dev';

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
  subtitleSettings?: SubtitleSettings,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  console.log('[EVOLINK] generateEvolinkVideo called');

  const evolinkApiKey = localStorage.getItem('evolink_api_key') || '';
  if (!evolinkApiKey || evolinkApiKey.length < 10) {
    console.log('[EVOLINK] No API key - generating simple zoom video');
    return generateSimpleZoomVideo(imageUrl, dialogue, 'in', subtitleSettings, onProgress);
  }

  const startTime = Date.now();
  const duration = testParams?.duration_sec || parseInt(localStorage.getItem('evolink_duration') || '5');
  const quality = testParams?.resolution || localStorage.getItem('evolink_resolution') || '720p';

  const API_BASE = 'https://byteplus-video-proxy.hiyoonsh1.workers.dev';

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
  subtitleSettings?: SubtitleSettings,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  console.log('[RUNWARE] generateRunwareVideo called');

  const runwareApiKey = localStorage.getItem('runware_api_key') || '';
  if (!runwareApiKey || runwareApiKey.length < 10) {
    console.log('[RUNWARE] No API key - generating simple zoom video');
    return generateSimpleZoomVideo(imageUrl, dialogue, 'in', subtitleSettings, onProgress);
  }

  const startTime = Date.now();
  const duration = testParams?.duration_sec || parseInt(localStorage.getItem('runware_duration') || '5');
  const resolution = testParams?.resolution || localStorage.getItem('runware_resolution') || '720p';

  // 해상도 매핑 (Runware aspect ratio)
  const resolutionMap: Record<string, string> = {
    '480p': '16:9',
    '720p': '16:9',
    '1080p': '16:9'
  };
  const aspectRatio = resolutionMap[resolution] || '16:9';

  const API_BASE = 'https://byteplus-video-proxy.hiyoonsh1.workers.dev';

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

  onProgress?.(10, '비디오 생성 중... (동기 완료 대기)');
  const createRes = await fetch(`${API_BASE}/api/v3/runware/videos/generations`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      api_key: runwareApiKey,
      image_url: finalImageUrl,
      prompt,
      duration,
      resolution
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();

    // Feature Flag 체크
    if (createRes.status === 403) {
      throw new Error('Runware provider is disabled. Contact admin to enable.');
    }

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
  const videoUrl = createResult.result?.video_url;
  console.log('[RUNWARE] Completed:', taskId, videoUrl ? 'video available' : 'no video');

  if (!videoUrl) {
    throw new Error('No video_url in response (unexpected status)');
  }

  onProgress?.(90, '비디오 다운로드 중...');

  // 다운로드 프록시 (CORS 우회)
  console.log('[RUNWARE] Downloading via proxy...');
  const downloadRes = await fetch(`${API_BASE}/api/v3/runware/download?url=${encodeURIComponent(videoUrl)}`);
  if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);

  const blob = await downloadRes.blob();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[RUNWARE] Done: ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  return new Blob([blob], { type: 'video/mp4' });
}

export async function generateBatchVideos(
  scenes: VideoGenerationRequest[]
): Promise<Blob[]> {
  // 브랜치2에서는 batch 미지원 (필요시 순차 호출)
  throw new Error('Batch generation not supported in 브랜치2. Use single generation.');
}
