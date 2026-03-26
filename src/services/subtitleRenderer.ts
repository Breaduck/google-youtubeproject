import { SubtitleSettings } from '../types';

export async function renderSubtitleToCanvas(
  text: string,
  settings: SubtitleSettings,
  width: number = 1280,
  height: number = 720
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 폰트 로딩 대기
  const fontWeight = settings.fontWeight || 700;
  const fontStyle = settings.fontStyle || 'normal';
  try {
    await document.fonts.load(`${fontStyle} ${fontWeight} ${settings.fontSize}px "${settings.fontFamily}"`);
  } catch (e) {
    console.warn('Font loading failed:', e);
  }

  // 투명 배경
  ctx.clearRect(0, 0, width, height);

  ctx.font = `${fontStyle} ${fontWeight} ${settings.fontSize}px "${settings.fontFamily}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const textY = settings.yPosition;
  const textX = width / 2;

  // 배경 박스
  if (settings.backgroundColor) {
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const bgPadding = settings.bgPadding;
    const bgHeight = settings.fontSize + bgPadding * 2;

    const hex = settings.backgroundColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = settings.bgOpacity;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    const bgRadius = settings.bgRadius || 0;
    const x = textX - textWidth / 2 - bgPadding;
    const y = textY - settings.fontSize - bgPadding;
    const w = textWidth + bgPadding * 2;
    const h = bgHeight;

    if (bgRadius > 0 && ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, bgRadius);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
  }

  ctx.globalAlpha = settings.opacity;

  // 외곽선
  if (settings.strokeWidth > 0 && settings.strokeColor !== 'transparent') {
    ctx.strokeStyle = settings.strokeColor;
    ctx.lineWidth = settings.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, textX, textY);
  }

  // 텍스트
  ctx.fillStyle = settings.textColor;
  ctx.fillText(text, textX, textY);

  ctx.globalAlpha = 1.0;

  return canvas;
}
