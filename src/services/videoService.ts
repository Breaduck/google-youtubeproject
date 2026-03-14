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

// 자막 템플릿 스타일 정의
interface SubtitleStyle {
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor?: string;
  bgPadding?: number;
  bgOpacity?: number;
}

const SUBTITLE_TEMPLATES: Record<SubtitleTemplate, SubtitleStyle> = {
  'default-white': {
    textColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 6,
  },
  'black-bg': {
    textColor: '#FFFFFF',
    strokeColor: 'transparent',
    strokeWidth: 0,
    backgroundColor: '#000000',
    bgPadding: 12,
    bgOpacity: 0.8,
  },
  'transparent-black': {
    textColor: '#000000',
    strokeColor: '#FFFFFF',
    strokeWidth: 4,
    backgroundColor: '#000000',
    bgPadding: 8,
    bgOpacity: 0.3,
  },
  'yellow': {
    textColor: '#FFD700',
    strokeColor: '#000000',
    strokeWidth: 6,
  },
  'neon-green': {
    textColor: '#39FF14',
    strokeColor: '#FFFFFF',
    strokeWidth: 5,
  },
  'youtube': {
    textColor: '#FFFFFF',
    strokeColor: 'transparent',
    strokeWidth: 0,
    backgroundColor: '#000000',
    bgPadding: 8,
    bgOpacity: 0.7,
  },
  'youtube-shorts': {
    textColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 8,
  },
  'custom': {
    textColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 6,
  },
};

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
  onProgress?: (progress: number, message: string) => void
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
      // 720p 해상도
      canvas.width = 1280;
      canvas.height = 720;

      const duration = 5; // 5초
      const fps = 24;
      const totalFrames = duration * fps;

      // MediaRecorder 설정
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000
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

        // 줌 방향에 따라 스케일 계산
        let scale: number;
        if (zoomDirection === 'in') {
          scale = 1.0 + (progress * 0.15); // 1.0 → 1.15 (부드럽게)
        } else {
          scale = 1.15 - (progress * 0.15); // 1.15 → 1.0 (줌아웃)
        }

        // 캔버스 클리어
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 이미지를 중앙에서 확대/축소
        const scaledWidth = canvas.width * scale;
        const scaledHeight = canvas.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;

        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

        // 자막 렌더링
        if (subtitle && subtitleSettings) {
          ctx.save();

          // 템플릿 스타일 가져오기
          const template = subtitleSettings.template === 'custom'
            ? {
                textColor: subtitleSettings.customColor,
                strokeColor: subtitleSettings.customStrokeColor,
                strokeWidth: 6,
                backgroundColor: subtitleSettings.customBgColor,
                bgPadding: 12,
                bgOpacity: subtitleSettings.customBgColor ? 0.8 : undefined,
              }
            : SUBTITLE_TEMPLATES[subtitleSettings.template];

          ctx.font = `bold ${subtitleSettings.fontSize}px "Pretendard", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          const text = subtitle;
          const textY = subtitleSettings.yPosition;

          // 배경 박스 (있을 경우)
          if (template.backgroundColor) {
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const bgPadding = template.bgPadding || 10;
            const bgHeight = subtitleSettings.fontSize * 1.4 + bgPadding * 2;

            ctx.fillStyle = template.backgroundColor;
            ctx.globalAlpha = template.bgOpacity || 0.8;
            ctx.fillRect(
              canvas.width / 2 - textWidth / 2 - bgPadding,
              textY - bgHeight,
              textWidth + bgPadding * 2,
              bgHeight
            );
            ctx.globalAlpha = 1.0;
          }

          ctx.globalAlpha = subtitleSettings.opacity;

          // 외곽선
          if (template.strokeWidth > 0 && template.strokeColor !== 'transparent') {
            ctx.strokeStyle = template.strokeColor;
            ctx.lineWidth = template.strokeWidth;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(text, canvas.width / 2, textY);
          }

          // 텍스트
          ctx.fillStyle = template.textColor;
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

    // WebM → MP4 변환
    await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', 'output.mp4']);

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
  if (onProgress) onProgress(0, '비디오 병합 중...');

  const ffmpeg = await getFFmpeg();

  // 각 비디오를 FFmpeg 파일 시스템에 쓰기
  for (let i = 0; i < videoBlobs.length; i++) {
    await ffmpeg.writeFile(`video${i}.mp4`, await fetchFile(videoBlobs[i]));
    if (onProgress) {
      const percent = Math.round(((i + 1) / videoBlobs.length) * 30);
      onProgress(percent, `비디오 ${i + 1}/${videoBlobs.length} 준비 중...`);
    }
  }

  // concat 리스트 파일 생성
  const concatList = videoBlobs.map((_, i) => `file 'video${i}.mp4'`).join('\n');
  await ffmpeg.writeFile('concat_list.txt', concatList);

  if (onProgress) onProgress(40, '비디오 병합 중...');

  // concat으로 병합
  await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', '-c', 'copy', 'merged.mp4']);

  if (onProgress) onProgress(80, '최종 처리 중...');

  // 병합된 파일 읽기
  const mergedData = await ffmpeg.readFile('merged.mp4');
  const mergedBlob = new Blob([new Uint8Array(mergedData as Uint8Array)], { type: 'video/mp4' });

  // 임시 파일 삭제
  for (let i = 0; i < videoBlobs.length; i++) {
    await ffmpeg.deleteFile(`video${i}.mp4`);
  }
  await ffmpeg.deleteFile('concat_list.txt');
  await ffmpeg.deleteFile('merged.mp4');

  if (onProgress) onProgress(100, '완료');

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
