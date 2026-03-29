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

  // 폰트 로딩 대기 - fontWeight 800 고정 (일관성)
  const fontWeight = 800;
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

  // Y축 위치 scale 적용 (720p 기준 → 실제 해상도)
  const scaleFactor = height / 720;
  const textY = settings.yPosition * scaleFactor;
  const textX = width / 2;

  // 줄바꿈 처리 (20자 기준)
  const lines: string[] = [];
  let currentLine = '';
  const chars = text.split('');

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const testLine = currentLine + char;

    if (testLine.length >= 20) {
      if (char === ' ') {
        lines.push(currentLine);
        currentLine = '';
      } else if (chars[i + 1] === ' ') {
        lines.push(testLine);
        currentLine = '';
        i++;
      } else {
        const lastSpace = currentLine.lastIndexOf(' ');
        if (lastSpace > 0) {
          lines.push(currentLine.slice(0, lastSpace));
          currentLine = currentLine.slice(lastSpace + 1) + char;
        } else {
          currentLine = testLine;
        }
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  const lineHeight = settings.fontSize * (settings.lineHeight || 1.2);
  const totalHeight = lines.length * lineHeight;

  // 배경 박스
  if (settings.backgroundColor) {
    let maxLineWidth = 0;
    lines.forEach(line => {
      const metrics = ctx.measureText(line);
      if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
    });

    const bgPadding = settings.bgPadding;
    const bgHeight = totalHeight + bgPadding * 2;

    const hex = settings.backgroundColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = settings.bgOpacity;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    const bgRadius = settings.bgRadius || 0;
    const x = textX - maxLineWidth / 2 - bgPadding;
    const y = textY - totalHeight - bgPadding;
    const w = maxLineWidth + bgPadding * 2;
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

  // 텍스트 렌더링 (여러 줄)
  lines.forEach((line, i) => {
    const y = textY - totalHeight + (i + 1) * lineHeight;

    // 외곽선
    if (settings.strokeWidth > 0 && settings.strokeColor !== 'transparent') {
      ctx.strokeStyle = settings.strokeColor;
      ctx.lineWidth = settings.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, textX, y);
    }

    // 텍스트
    ctx.fillStyle = settings.textColor;
    ctx.fillText(line, textX, y);
  });

  ctx.globalAlpha = 1.0;

  return canvas;
}
