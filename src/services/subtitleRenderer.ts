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

  // 1줄로 제한 (maxLineChars 글자까지만)
  const maxChars = settings.maxLineChars || 15;
  let displayText = text.trim();
  if (displayText.length > maxChars) {
    displayText = displayText.slice(0, maxChars);
  }
  const lines: string[] = [displayText];

  const lineHeight = settings.fontSize * (settings.lineHeight || 1.2);
  const totalHeight = lines.length * lineHeight;

  // 배경 박스
  if (settings.backgroundColor) {
    let maxLineWidth = 0;
    lines.forEach(line => {
      const metrics = ctx.measureText(line);
      if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
    });

    const bgPaddingX = settings.bgPaddingX ?? settings.bgPadding;
    const bgPaddingY = settings.bgPaddingY ?? settings.bgPadding;
    const bgHeight = totalHeight + bgPaddingY * 2;

    const hex = settings.backgroundColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = settings.bgOpacity;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    const bgRadius = settings.bgRadius || 0;
    const x = textX - maxLineWidth / 2 - bgPaddingX;
    const y = textY - totalHeight - bgPaddingY;
    const w = maxLineWidth + bgPaddingX * 2;
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

  // 네온 효과 (형광색 텍스트)
  const textColor = settings.textColor;
  const isNeon = textColor === '#00FF88' || textColor === '#FF00FF' || textColor === '#00D4FF';
  const isGold = textColor === '#FFD700' || textColor === '#D4AF37';
  const isSilver = textColor === '#C0C0C0';

  // 텍스트 렌더링
  lines.forEach((line, i) => {
    const y = textY - totalHeight + (i + 1) * lineHeight;

    // 네온/골드/실버 그림자 효과
    if (isNeon) {
      ctx.shadowColor = textColor;
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (isGold || isSilver) {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
    } else if (!settings.backgroundColor) {
      // 배경 없으면 그림자로 가독성 확보
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
    }

    // 외곽선
    if (settings.strokeWidth > 0 && settings.strokeColor !== 'transparent') {
      ctx.strokeStyle = settings.strokeColor;
      ctx.lineWidth = settings.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, textX, y);
    }

    // 텍스트
    ctx.fillStyle = textColor;
    ctx.fillText(line, textX, y);

    // 네온 효과 시 추가 레이어
    if (isNeon) {
      ctx.shadowBlur = 40;
      ctx.fillText(line, textX, y);
    }

    // 그림자 리셋
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  });

  ctx.globalAlpha = 1.0;

  return canvas;
}
