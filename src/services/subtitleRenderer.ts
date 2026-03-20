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
  try {
    await document.fonts.load(`bold ${settings.fontSize}px "${settings.fontFamily}"`);
  } catch (e) {
    console.warn('Font loading failed:', e);
  }

  // 투명 배경
  ctx.clearRect(0, 0, width, height);

  ctx.font = `bold ${settings.fontSize}px "${settings.fontFamily}", sans-serif`;
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
    ctx.fillRect(
      textX - textWidth / 2 - bgPadding,
      textY - settings.fontSize - bgPadding,
      textWidth + bgPadding * 2,
      bgHeight
    );
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
