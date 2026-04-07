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

// 오디오 길이 구하기 (초 단위)
export async function getAudioDuration(audioUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };
    audio.onerror = () => {
      reject(new Error('Failed to load audio'));
    };
    audio.src = audioUrl;
  });
}

// 대본을 호흡 단위로 분할 (자막용)
function splitIntoSubtitleChunks(text: string, maxChars: number = 15): string[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: string[] = [];
  const trimmed = text.trim();

  // 1차 분할: 문장 종결(.?!) 또는 쉼표 기준
  const segments = trimmed.split(/(?<=[.?!,])\s*/);

  for (const segment of segments) {
    if (!segment.trim()) continue;

    if (segment.length <= maxChars) {
      chunks.push(segment.trim());
    } else {
      // 2차 분할: 조사/어미 끝 또는 공백 기준
      let remaining = segment;
      while (remaining.length > maxChars) {
        // 적절한 끊김 위치 찾기 (공백 우선)
        let splitIdx = remaining.lastIndexOf(' ', maxChars);
        if (splitIdx <= 0) splitIdx = maxChars;

        chunks.push(remaining.slice(0, splitIdx).trim());
        remaining = remaining.slice(splitIdx).trim();
      }
      if (remaining.trim()) chunks.push(remaining.trim());
    }
  }

  return chunks.filter(c => c.length > 0);
}

// 간단한 줌인-줌아웃 비디오 생성 (API 키 없을 때) - FFmpeg 직접 사용 (초고속)
export async function generateSimpleZoomVideo(
  imageUrl: string,
  subtitle: string = '',
  zoomDirection: 'in' | 'out' = 'in',
  subtitleSettings?: SubtitleSettings,
  onProgress?: (progress: number, message: string) => void,
  panDirection?: 'left' | 'right' | 'up' | 'down' | 'center',
  intensity?: number, // 1-10, 긴박도 (속도/확대율 결정)
  audioDuration?: number // 오디오 길이 (초) - 이 값이 있으면 이에 맞춤
): Promise<Blob> {
  if (onProgress) onProgress(5, '프레임 생성 준비 중...');

  const ffmpeg = await getFFmpeg();

  // 캔버스 설정
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // 1080p
  canvas.width = 1920;
  canvas.height = 1080;

  // 이미지 로드
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = imageUrl;
  });

  // 폰트 로드
  if (subtitleSettings?.fontFamily) {
    try {
      await document.fonts.load(`bold ${subtitleSettings.fontSize || 48}px "${subtitleSettings.fontFamily}"`);
      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading failed:', e);
    }
  }

  // 시간 계산 - 오디오 길이 우선, 없으면 자막 기반 추정
  const effectIntensity = intensity || 5;
  let duration: number;
  if (audioDuration && audioDuration > 0) {
    // 오디오 길이 + 약간의 여유 (0.5초)
    duration = audioDuration + 0.5;
    console.log(`[VIDEO] Using audio duration: ${audioDuration}s → video: ${duration}s`);
  } else {
    const subtitleLength = subtitle.length;
    const baseDuration = subtitleLength > 0
      ? Math.max(7, Math.min(12, subtitleLength / 3.0))
      : 8;
    const intensityFactor = effectIntensity >= 7 ? 0.8 : effectIntensity <= 3 ? 1.3 : 1.0;
    duration = Math.max(6, Math.min(12, baseDuration * intensityFactor));
  }

  // 24fps (부드러운 재생)
  const fps = 24;
  const totalFrames = Math.floor(duration * fps);

  // 자막 분할 (시간에 따라 다른 자막 표시)
  const maxChars = subtitleSettings?.maxLineChars || 15;
  const subtitleChunks = subtitle ? splitIntoSubtitleChunks(subtitle, maxChars) : [];
  const chunkDuration = subtitleChunks.length > 0 ? duration / subtitleChunks.length : duration;

  console.log(`[VIDEO] Duration: ${duration}s, Frames: ${totalFrames}, FPS: ${fps}`);
  console.log(`[VIDEO] Subtitle chunks: ${subtitleChunks.length}`, subtitleChunks);

  if (onProgress) onProgress(10, '프레임 렌더링 중...');

  // 프레임 렌더링 (빠르게 - interval 없이)
  const framePromises: Promise<boolean>[] = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    const progress = frame / totalFrames;

    // Easing 함수 (부드러운 가속/감속)
    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const easedProgress = easeInOutCubic(progress);

    // 줌 계산
    const zoomAmount = 0.08 + (effectIntensity / 50);
    let scale: number;
    if (zoomDirection === 'in') {
      scale = 1.0 + (easedProgress * zoomAmount);
    } else {
      scale = 1.0 + zoomAmount - (easedProgress * zoomAmount);
    }

    // 패닝 계산
    const pan = panDirection || 'center';
    let offsetX = 0, offsetY = 0;
    const panAmount = 40;
    if (pan === 'left') offsetX = progress * panAmount;
    else if (pan === 'right') offsetX = -progress * panAmount;
    else if (pan === 'up') offsetY = progress * panAmount;
    else if (pan === 'down') offsetY = -progress * panAmount;

    // 캔버스 렌더링
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scaledWidth = canvas.width * scale;
    const scaledHeight = canvas.height * scale;
    const x = (canvas.width - scaledWidth) / 2 + offsetX;
    const y = (canvas.height - scaledHeight) / 2 + offsetY;
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

    // 자막 렌더링 (시간에 따라 다른 자막 chunk 표시)
    if (subtitleChunks.length > 0 && subtitleSettings) {
      ctx.save();
      const scaleFactor = 1.5;
      const scaledFontSize = Math.round(subtitleSettings.fontSize * scaleFactor);
      const scaledYPosition = Math.round(subtitleSettings.yPosition * scaleFactor);

      // fontWeight 800 고정 (일관성)
      ctx.font = `800 ${scaledFontSize}px "${subtitleSettings.fontFamily}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      // 현재 프레임 시간에 해당하는 자막 chunk 선택
      const currentTime = frame / fps;
      const chunkIndex = Math.min(
        Math.floor(currentTime / chunkDuration),
        subtitleChunks.length - 1
      );
      const displayText = subtitleChunks[chunkIndex] || '';
      const lines: string[] = [displayText];

      const lineHeight = scaledFontSize * (subtitleSettings.lineHeight || 1.2);
      const totalHeight = lines.length * lineHeight;
      let textY = scaledYPosition;

      // 배경 렌더링
      if (subtitleSettings.backgroundColor) {
        let maxLineWidth = 0;
        lines.forEach(line => {
          const metrics = ctx.measureText(line);
          if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
        });

        const bgPaddingX = Math.round((subtitleSettings.bgPaddingX ?? subtitleSettings.bgPadding ?? 12) * scaleFactor);
        const bgPaddingY = Math.round((subtitleSettings.bgPaddingY ?? subtitleSettings.bgPadding ?? 12) * scaleFactor);
        const bgRadius = Math.round((subtitleSettings.bgRadius || 8) * scaleFactor);
        const bgHeight = totalHeight + bgPaddingY * 2;

        ctx.fillStyle = subtitleSettings.backgroundColor;
        ctx.globalAlpha = subtitleSettings.bgOpacity || 0.8;

        const x = canvas.width / 2 - maxLineWidth / 2 - bgPaddingX;
        const y = textY - totalHeight - bgPaddingY;
        const w = maxLineWidth + bgPaddingX * 2;
        const h = bgHeight;

        // 라운드 사각형
        if (bgRadius > 0) {
          ctx.beginPath();
          ctx.moveTo(x + bgRadius, y);
          ctx.lineTo(x + w - bgRadius, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + bgRadius);
          ctx.lineTo(x + w, y + h - bgRadius);
          ctx.quadraticCurveTo(x + w, y + h, x + w - bgRadius, y + h);
          ctx.lineTo(x + bgRadius, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - bgRadius);
          ctx.lineTo(x, y + bgRadius);
          ctx.quadraticCurveTo(x, y, x + bgRadius, y);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
        ctx.globalAlpha = 1.0;
      }

      ctx.globalAlpha = subtitleSettings.opacity;

      // 네온 효과 (형광색 텍스트)
      const textColor = subtitleSettings.textColor;
      const isNeon = textColor === '#00FF88' || textColor === '#FF00FF' || textColor === '#00D4FF';
      const isGold = textColor === '#FFD700' || textColor === '#D4AF37';
      const isSilver = textColor === '#C0C0C0';

      // 텍스트 렌더링
      lines.forEach((line, i) => {
        const y = textY - totalHeight + (i + 1) * lineHeight;

        // 네온/골드/실버 그림자 효과
        if (isNeon) {
          ctx.shadowColor = textColor;
          ctx.shadowBlur = 20 * scaleFactor;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else if (isGold || isSilver) {
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 6 * scaleFactor;
          ctx.shadowOffsetX = 3 * scaleFactor;
          ctx.shadowOffsetY = 3 * scaleFactor;
        } else if (!subtitleSettings.backgroundColor) {
          // 배경 없으면 그림자로 가독성 확보
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 6 * scaleFactor;
          ctx.shadowOffsetX = 3 * scaleFactor;
          ctx.shadowOffsetY = 3 * scaleFactor;
        }

        if (subtitleSettings.strokeWidth > 0 && subtitleSettings.strokeColor !== 'transparent') {
          ctx.strokeStyle = subtitleSettings.strokeColor;
          ctx.lineWidth = Math.round(subtitleSettings.strokeWidth * scaleFactor);
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.strokeText(line, canvas.width / 2, y);
        }

        ctx.fillStyle = textColor;
        ctx.fillText(line, canvas.width / 2, y);

        // 네온 효과 시 추가 레이어
        if (isNeon) {
          ctx.shadowBlur = 40 * scaleFactor;
          ctx.fillText(line, canvas.width / 2, y);
        }

        // 그림자 리셋
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      });

      ctx.restore();
    }

    // JPEG로 저장 (PNG보다 빠름)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const frameNum = String(frame).padStart(5, '0');
    framePromises.push(ffmpeg.writeFile(`frame${frameNum}.jpg`, bytes));

    // 프로그레스 업데이트 (10프레임마다)
    if (onProgress && frame % 10 === 0) {
      const percent = Math.round((frame / totalFrames) * 50) + 10;
      onProgress(percent, `프레임 렌더링 ${frame}/${totalFrames}...`);
    }
  }

  // 모든 프레임 파일 쓰기 대기
  await Promise.all(framePromises);

  if (onProgress) onProgress(65, 'MP4 생성 중...');

  // FFmpeg로 이미지 시퀀스 → 비디오 변환 (초고속)
  await ffmpeg.exec([
    '-framerate', String(fps),
    '-i', 'frame%05d.jpg',
    '-c:v', 'libx264',
    '-preset', 'ultrafast', // 최고 속도
    '-crf', '23', // 적정 품질 (속도 우선)
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    'output.mp4'
  ]);

  if (onProgress) onProgress(90, '파일 정리 중...');

  // 결과 읽기
  const data = await ffmpeg.readFile('output.mp4');
  const mp4Blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });

  // 임시 파일 삭제 (병렬)
  const deletePromises: Promise<void>[] = [];
  for (let i = 0; i < totalFrames; i++) {
    const frameNum = String(i).padStart(5, '0');
    deletePromises.push(ffmpeg.deleteFile(`frame${frameNum}.jpg`).then(() => {}).catch(() => {}));
  }
  deletePromises.push(ffmpeg.deleteFile('output.mp4').then(() => {}).catch(() => {}));
  await Promise.all(deletePromises);

  if (onProgress) onProgress(100, '완료');
  return mp4Blob;
}

// 비디오에 자막 오버레이 추가
export async function addSubtitleOverlay(
  videoBlob: Blob,
  subtitleCanvas: HTMLCanvasElement,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  if (onProgress) onProgress(0, '자막 적용 중...');

  const ffmpeg = await getFFmpeg();

  // 비디오 파일 쓰기
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoBlob));

  // 자막 이미지 PNG로 변환
  const subtitleBlob = await new Promise<Blob>((resolve) => {
    subtitleCanvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
  await ffmpeg.writeFile('subtitle.png', await fetchFile(subtitleBlob));

  if (onProgress) onProgress(30, '자막 합성 중...');

  // overlay 필터로 자막 합성
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-i', 'subtitle.png',
    '-filter_complex', '[0:v][1:v]overlay=0:0',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    'output.mp4'
  ]);

  if (onProgress) onProgress(80, '파일 생성 중...');

  const data = await ffmpeg.readFile('output.mp4');
  const resultBlob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });

  // 정리
  await ffmpeg.deleteFile('input.mp4');
  await ffmpeg.deleteFile('subtitle.png');
  await ffmpeg.deleteFile('output.mp4');

  if (onProgress) onProgress(100, '완료');
  return resultBlob;
}

// 비디오에 텍스트 자막 추가 (FFmpeg drawtext)
export async function addTextSubtitleToVideo(
  videoBlob: Blob,
  subtitleText: string,
  settings?: SubtitleSettings
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoBlob));

  const fontSize = settings?.fontSize || 48;
  const fontColor = settings?.textColor?.replace('#', '') || 'FFFFFF';
  const strokeColor = settings?.strokeColor?.replace('#', '') || '000000';
  const strokeWidth = settings?.strokeWidth || 2;
  const yPos = settings?.position === 'top' ? 50 : settings?.position === 'center' ? '(h-text_h)/2' : 'h-th-80';

  // 긴 텍스트 줄바꿈 처리
  const maxChars = 20;
  const words = subtitleText.split(' ');
  let lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  const text = lines.join('\\n').replace(/'/g, "\\'");

  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vf', `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:borderw=${strokeWidth}:bordercolor=${strokeColor}:x=(w-text_w)/2:y=${yPos}`,
    '-c:a', 'copy',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  await ffmpeg.deleteFile('input.mp4').catch(() => {});
  await ffmpeg.deleteFile('output.mp4').catch(() => {});
  return new Blob([data as BlobPart], { type: 'video/mp4' });
}

// 비디오에 오디오 추가 (오디오가 더 길면 마지막 프레임 연장)
export async function addAudioToVideo(
  videoBlob: Blob,
  audioUrl: string,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  if (onProgress) onProgress(0, '오디오 통합 중...');

  const ffmpeg = await getFFmpeg();

  // 비디오 파일 쓰기
  await ffmpeg.writeFile('video.mp4', await fetchFile(videoBlob));

  // 오디오 파일 가져오기
  const audioResponse = await fetch(audioUrl);
  const audioBlob = await audioResponse.blob();
  const audioExt = audioUrl.includes('.mp3') ? 'mp3' : 'wav';
  await ffmpeg.writeFile(`audio.${audioExt}`, await fetchFile(audioBlob));

  // 오디오 길이 측정
  const audioDur = await getAudioDuration(audioUrl);
  console.log(`[VIDEO] Audio duration: ${audioDur}s`);

  if (onProgress) onProgress(20, '영상 길이 분석 중...');

  // 오디오가 영상보다 길면 마지막 프레임을 줌인 효과로 연장
  const extraTime = Math.max(0, audioDur - 10 + 0.5); // 10초 영상 기준, 여유 0.5초

  if (extraTime > 0.5) {
    console.log(`[VIDEO] Extending video by ${extraTime}s with zoom effect`);

    if (onProgress) onProgress(30, '마지막 프레임 추출 중...');

    // 1. 마지막 프레임 추출 (PNG)
    await ffmpeg.exec([
      '-sseof', '-0.1',
      '-i', 'video.mp4',
      '-frames:v', '1',
      '-q:v', '2',
      'lastframe.jpg'
    ]);

    if (onProgress) onProgress(40, '줌인 효과 생성 중...');

    // 2. 마지막 프레임으로 줌인 영상 생성 (zoompan 필터)
    const fps = 24;
    const totalFrames = Math.ceil(extraTime * fps);
    // 천천히 줌인: 1.0 → 1.15 (약 15% 확대)
    await ffmpeg.exec([
      '-loop', '1',
      '-i', 'lastframe.jpg',
      '-filter_complex', `zoompan=z='1+0.15*on/${totalFrames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1920x1080:fps=${fps}`,
      '-t', String(extraTime),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      'zoom_extend.mp4'
    ]);

    if (onProgress) onProgress(60, '영상 연결 중...');

    // 3. 원본 + 줌인 영상 concat
    await ffmpeg.writeFile('concat.txt', "file 'video.mp4'\nfile 'zoom_extend.mp4'");
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat.txt',
      '-c', 'copy',
      'extended.mp4'
    ]);

    if (onProgress) onProgress(70, '오디오 합성 중...');

    // 4. 오디오 합치기
    await ffmpeg.exec([
      '-i', 'extended.mp4',
      '-i', `audio.${audioExt}`,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      'output.mp4'
    ]);

    // 임시 파일 정리
    await ffmpeg.deleteFile('lastframe.jpg').catch(() => {});
    await ffmpeg.deleteFile('zoom_extend.mp4').catch(() => {});
    await ffmpeg.deleteFile('concat.txt').catch(() => {});
    await ffmpeg.deleteFile('extended.mp4').catch(() => {});
  } else {
    if (onProgress) onProgress(50, '오디오 합성 중...');
    // 오디오가 짧거나 같음 - 단순 합치기
    await ffmpeg.exec([
      '-i', 'video.mp4',
      '-i', `audio.${audioExt}`,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      'output.mp4'
    ]);
  }

  if (onProgress) onProgress(80, '파일 생성 중...');

  const data = await ffmpeg.readFile('output.mp4');
  const resultBlob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });

  // 정리
  await ffmpeg.deleteFile('video.mp4');
  await ffmpeg.deleteFile(`audio.${audioExt}`);
  await ffmpeg.deleteFile('output.mp4');

  if (onProgress) onProgress(100, '완료');
  return resultBlob;
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
  // settingsStore에서 provider 읽기
  const storageData = localStorage.getItem('app-settings-storage');
  const provider = storageData ? JSON.parse(storageData).state.videoProvider : 'byteplus';
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

  // settingsStore에서 BytePlus API 키 읽기 (Zustand persist 사용)
  const storageData = localStorage.getItem('app-settings-storage');
  const bytedanceApiKey = storageData ? JSON.parse(storageData).state.bytedanceApiKey : '';
  if (!bytedanceApiKey || bytedanceApiKey.length < 10) {
    // API 키가 없으면 간단한 줌인-줌아웃 비디오 생성
    console.log('[BYTEDANCE] No API key - generating simple zoom video');
    // dialogue를 자막으로, zoomDirection은 외부에서 설정
    return generateSimpleZoomVideo(imageUrl, dialogue, 'in', subtitleSettings, onProgress);
  }

  const startTime = Date.now();

  // BytePlus API 파라미터
  const storageDataParams = storageData ? JSON.parse(storageData).state : {};
  const model = testParams?.model || storageDataParams.bytedanceModel || 'seedance-1-0-pro-fast-251015';
  const duration_sec = testParams?.duration_sec || 5;
  const resolution = testParams?.resolution || '1080p';

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

    let blob = await videoRes.blob();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[BYTEDANCE] Done: ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

    // 자막 오버레이 추가
    console.log('[BYTEDANCE] Subtitle check:', { dialogue: dialogue?.substring(0, 50), hasSubtitleSettings: !!subtitleSettings });
    if (dialogue && subtitleSettings) {
      console.log('[BYTEDANCE] Adding subtitle overlay...');
      onProgress?.(85, '자막 적용 중...');
      const { renderSubtitleToCanvas } = await import('./subtitleRenderer');
      // 1080p 해상도로 자막 캔버스 생성 (BytePlus 비디오와 동일)
      const subtitleCanvas = await renderSubtitleToCanvas(dialogue, subtitleSettings, 1920, 1080);
      console.log('[BYTEDANCE] Subtitle canvas created:', subtitleCanvas.width, 'x', subtitleCanvas.height);
      blob = await addSubtitleOverlay(blob, subtitleCanvas, (p, msg) => {
        onProgress?.(85 + (p / 100) * 15, msg);
      });
      console.log('[BYTEDANCE] Subtitle overlay applied');
    } else {
      console.log('[BYTEDANCE] Skipping subtitle:', { noDialogue: !dialogue, noSettings: !subtitleSettings });
    }

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

  // settingsStore에서 Evolink API 키 읽기
  const storageData = localStorage.getItem('app-settings-storage');
  const storageState = storageData ? JSON.parse(storageData).state : {};
  const evolinkApiKey = storageState.evolinkApiKey || '';
  if (!evolinkApiKey || evolinkApiKey.length < 10) {
    console.log('[EVOLINK] No API key - generating simple zoom video');
    return generateSimpleZoomVideo(imageUrl, dialogue, 'in', subtitleSettings, onProgress);
  }

  const startTime = Date.now();
  const duration = testParams?.duration_sec || storageState.evolinkDuration || 5;
  const quality = testParams?.resolution || storageState.evolinkResolution || '1080p';

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

  // settingsStore에서 Runware API 키 읽기
  const storageData = localStorage.getItem('app-settings-storage');
  const storageState = storageData ? JSON.parse(storageData).state : {};
  const runwareApiKey = storageState.runwareApiKey || '';
  if (!runwareApiKey || runwareApiKey.length < 10) {
    console.log('[RUNWARE] No API key - generating simple zoom video');
    return generateSimpleZoomVideo(imageUrl, dialogue, 'in', subtitleSettings, onProgress);
  }

  const startTime = Date.now();
  const duration = testParams?.duration_sec || storageState.runwareDuration || 5;
  const resolution = testParams?.resolution || storageState.runwareResolution || '1080p';

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
