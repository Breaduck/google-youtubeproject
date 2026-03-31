import { useState, useEffect } from 'react';
import { SubtitleSettings } from '../types';

interface SubtitleTemplateModalProps {
  current: SubtitleSettings;
  onApply: (settings: SubtitleSettings) => void;
  onClose: () => void;
  previewImage?: string;
}

interface CustomFont {
  name: string;
  type: 'file' | 'google';
  data?: string;
}

const DEFAULT_FONTS = [
  'Noto Sans KR', 'Noto Serif KR', 'Black Han Sans', 'Jua', 'Do Hyeon',
  'Gothic A1', 'Nanum Gothic', 'Nanum Myeongjo', 'Sunflower', 'Gaegu',
  'Hi Melody', 'Poor Story', 'Single Day', 'Stylish', 'Gamja Flower',
];

// 템플릿 정의
export const TEMPLATES: { id: string; name: string; category: string; settings: Partial<SubtitleSettings> }[] = [
  // ===== 기본 =====
  { id: 'black-box', name: '검정 박스', category: '기본', settings: {
    textColor: '#FFFFFF', backgroundColor: '#000000', bgOpacity: 0.85, bgPadding: 14,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},
  { id: 'semi-transparent', name: '반투명 박스', category: '기본', settings: {
    textColor: '#FFFFFF', backgroundColor: '#1a1a1a', bgOpacity: 0.6, bgPadding: 12,
    fontSize: 42, fontFamily: 'Noto Sans KR'
  }},
  { id: 'white-shadow', name: '흰색 그림자', category: '기본', settings: {
    textColor: '#FFFFFF', backgroundColor: undefined, fontSize: 46, fontFamily: 'Noto Sans KR'
  }},
  { id: 'yellow-text', name: '노란색', category: '기본', settings: {
    textColor: '#FFE500', backgroundColor: undefined, fontSize: 48, fontFamily: 'Black Han Sans'
  }},
  { id: 'green-text', name: '녹색', category: '기본', settings: {
    textColor: '#4ADE80', backgroundColor: undefined, fontSize: 46, fontFamily: 'Black Han Sans'
  }},

  // ===== 컬러 박스 =====
  { id: 'red-box', name: '빨간 박스', category: '컬러', settings: {
    textColor: '#FFFFFF', backgroundColor: '#DC2626', bgOpacity: 0.95, bgPadding: 14,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},
  { id: 'blue-box', name: '파란 박스', category: '컬러', settings: {
    textColor: '#FFFFFF', backgroundColor: '#2563EB', bgOpacity: 0.95, bgPadding: 14,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},
  { id: 'yellow-box', name: '노란 박스', category: '컬러', settings: {
    textColor: '#1a1a1a', backgroundColor: '#FACC15', bgOpacity: 0.95, bgPadding: 12,
    fontSize: 44, fontFamily: 'Black Han Sans'
  }},
  { id: 'green-box', name: '초록 박스', category: '컬러', settings: {
    textColor: '#FFFFFF', backgroundColor: '#16A34A', bgOpacity: 0.95, bgPadding: 12,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},
  { id: 'purple-box', name: '보라 박스', category: '컬러', settings: {
    textColor: '#FFFFFF', backgroundColor: '#7C3AED', bgOpacity: 0.9, bgPadding: 14,
    fontSize: 44, fontFamily: 'Jua'
  }},
  { id: 'pink-box', name: '핑크 박스', category: '컬러', settings: {
    textColor: '#FFFFFF', backgroundColor: '#EC4899', bgOpacity: 0.9, bgPadding: 12,
    fontSize: 44, fontFamily: 'Jua'
  }},
  { id: 'orange-box', name: '주황 박스', category: '컬러', settings: {
    textColor: '#FFFFFF', backgroundColor: '#EA580C', bgOpacity: 0.95, bgPadding: 12,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},

  // ===== 예능 =====
  { id: 'news-red', name: '뉴스 속보', category: '예능', settings: {
    textColor: '#FFFFFF', backgroundColor: '#B91C1C', bgOpacity: 0.98, bgPadding: 16,
    fontSize: 48, fontFamily: 'Black Han Sans'
  }},
  { id: 'news-blue', name: '뉴스 파랑', category: '예능', settings: {
    textColor: '#FFFFFF', backgroundColor: '#1E3A5F', bgOpacity: 0.95, bgPadding: 14,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},
  { id: 'variety-yellow', name: '예능 노랑', category: '예능', settings: {
    textColor: '#FFE500', backgroundColor: undefined, fontSize: 52, fontFamily: 'Jua'
  }},
  { id: 'variety-white', name: '예능 흰색', category: '예능', settings: {
    textColor: '#FFFFFF', backgroundColor: undefined, fontSize: 52, fontFamily: 'Jua'
  }},
  { id: 'fun-highlight', name: '강조 노랑', category: '예능', settings: {
    textColor: '#000000', backgroundColor: '#FDE047', bgOpacity: 0.95, bgPadding: 10,
    fontSize: 46, fontFamily: 'Black Han Sans'
  }},

  // ===== 감성 =====
  { id: 'vlog', name: '브이로그', category: '감성', settings: {
    textColor: '#FFFFFF', backgroundColor: undefined, fontSize: 36, fontFamily: 'Noto Sans KR'
  }},
  { id: 'minimal', name: '미니멀', category: '감성', settings: {
    textColor: '#E5E5E5', backgroundColor: undefined, fontSize: 34, fontFamily: 'Noto Sans KR'
  }},
  { id: 'movie', name: '영화', category: '감성', settings: {
    textColor: '#FFFFFF', backgroundColor: undefined, fontSize: 32, fontFamily: 'Noto Serif KR'
  }},
  { id: 'elegant', name: '우아한', category: '감성', settings: {
    textColor: '#D4AF37', backgroundColor: undefined, fontSize: 40, fontFamily: 'Noto Serif KR'
  }},
  { id: 'soft-box', name: '부드러운 박스', category: '감성', settings: {
    textColor: '#FFFFFF', backgroundColor: '#374151', bgOpacity: 0.65, bgPadding: 14,
    fontSize: 38, fontFamily: 'Noto Sans KR'
  }},

  // ===== 프리미엄 =====
  { id: 'neon-green', name: '네온 그린', category: '프리미엄', settings: {
    textColor: '#00FF88', backgroundColor: undefined, fontSize: 46, fontFamily: 'Black Han Sans'
  }},
  { id: 'neon-pink', name: '네온 핑크', category: '프리미엄', settings: {
    textColor: '#FF00FF', backgroundColor: undefined, fontSize: 46, fontFamily: 'Jua'
  }},
  { id: 'neon-blue', name: '네온 블루', category: '프리미엄', settings: {
    textColor: '#00D4FF', backgroundColor: undefined, fontSize: 46, fontFamily: 'Black Han Sans'
  }},
  { id: 'gold', name: '골드', category: '프리미엄', settings: {
    textColor: '#FFD700', backgroundColor: undefined, fontSize: 46, fontFamily: 'Noto Serif KR'
  }},
  { id: 'silver', name: '실버', category: '프리미엄', settings: {
    textColor: '#C0C0C0', backgroundColor: undefined, fontSize: 44, fontFamily: 'Gothic A1'
  }},
];

// IndexedDB 헬퍼
const openFontDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CustomFonts', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('fonts')) db.createObjectStore('fonts', { keyPath: 'name' });
    };
  });
};

const saveFont = async (font: CustomFont): Promise<void> => {
  const db = await openFontDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fonts', 'readwrite');
    tx.objectStore('fonts').put(font);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const loadFonts = async (): Promise<CustomFont[]> => {
  const db = await openFontDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fonts', 'readonly');
    const req = tx.objectStore('fonts').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const deleteFont = async (name: string): Promise<void> => {
  const db = await openFontDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fonts', 'readwrite');
    tx.objectStore('fonts').delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const registerFont = (font: CustomFont) => {
  if (font.type === 'file' && font.data) {
    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: '${font.name}'; src: url(${font.data}); font-display: swap; }`;
    document.head.appendChild(style);
  } else if (font.type === 'google' && font.data) {
    const link = document.createElement('link');
    link.href = font.data;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
};

// 텍스트 그림자 계산
const getTextShadow = (color: string, hasBg: boolean) => {
  // 네온 효과 (형광색)
  if (color === '#00FF88' || color === '#FF00FF' || color === '#00D4FF') {
    return `0 0 8px ${color}, 0 0 16px ${color}, 0 0 24px ${color}80`;
  }
  // 골드/실버
  if (color === '#FFD700' || color === '#D4AF37') {
    return `0 2px 4px rgba(0,0,0,0.6), 0 0 8px rgba(255,215,0,0.3)`;
  }
  if (color === '#C0C0C0') {
    return `0 2px 4px rgba(0,0,0,0.6), 0 0 6px rgba(192,192,192,0.4)`;
  }
  // 배경 없는 일반 텍스트 - 그림자로 가독성 확보
  if (!hasBg) {
    return '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 3px rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.4)';
  }
  return undefined;
};

export default function SubtitleTemplateModal({ current, onApply, onClose, previewImage }: SubtitleTemplateModalProps) {
  const [selected, setSelected] = useState<SubtitleSettings>({
    ...current, strokeWidth: 0, strokeColor: 'transparent'
  });
  const [category, setCategory] = useState<string>('전체');
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [showFontModal, setShowFontModal] = useState(false);
  const [googleFontUrl, setGoogleFontUrl] = useState('');
  const [tempPreviewImage, setTempPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    loadFonts().then((fonts) => {
      setCustomFonts(fonts);
      fonts.forEach(registerFont);
    });
  }, []);

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    const baseSettings: SubtitleSettings = {
      fontSize: 44, fontFamily: 'Noto Sans KR', fontWeight: 700, fontStyle: 'normal',
      letterSpacing: 0, lineHeight: 1.2,
      opacity: 1, template: 'custom', textColor: '#FFFFFF',
      strokeColor: 'transparent', strokeWidth: 0,
      backgroundColor: undefined, bgPadding: 12, bgPaddingX: undefined, bgPaddingY: undefined, bgOpacity: 0.8, bgRadius: 8,
      position: 'bottom', yPosition: 680, lockPosition: false, lockFont: false,
    };
    setSelected({ ...baseSettings, ...template.settings, strokeWidth: 0, strokeColor: 'transparent' });
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
      alert('ttf, otf, woff, woff2 파일만 가능합니다.');
      return;
    }
    const fontName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9가-힣\s]/g, '');
    const reader = new FileReader();
    reader.onload = async () => {
      const font: CustomFont = { name: fontName, type: 'file', data: reader.result as string };
      await saveFont(font);
      registerFont(font);
      setCustomFonts([...customFonts, font]);
      alert(`"${fontName}" 폰트 추가!`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGoogleFontAdd = async () => {
    if (!googleFontUrl.includes('fonts.googleapis.com')) {
      alert('Google Fonts URL을 입력해주세요.');
      return;
    }
    const match = googleFontUrl.match(/family=([^&:]+)/);
    if (!match) { alert('올바른 URL이 아닙니다.'); return; }
    const fontName = decodeURIComponent(match[1].replace(/\+/g, ' '));
    const font: CustomFont = { name: fontName, type: 'google', data: googleFontUrl };
    await saveFont(font);
    registerFont(font);
    setCustomFonts([...customFonts, font]);
    setGoogleFontUrl('');
    alert(`"${fontName}" 폰트 추가!`);
  };

  const handleDeleteFont = async (fontName: string) => {
    if (!confirm(`"${fontName}" 삭제?`)) return;
    await deleteFont(fontName);
    setCustomFonts(customFonts.filter(f => f.name !== fontName));
  };

  const allFonts = [...DEFAULT_FONTS, ...customFonts.map(f => f.name)];
  const categories = ['전체', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];
  const filteredTemplates = category === '전체' ? TEMPLATES : TEMPLATES.filter(t => t.category === category);

  // ========== 템플릿 카드 렌더링 ==========
  const renderTemplateCard = (tmpl: typeof TEMPLATES[0]) => {
    const s = tmpl.settings;
    const hasBg = !!s.backgroundColor;
    const textShadow = getTextShadow(s.textColor || '#FFFFFF', hasBg);

    return (
      <div key={tmpl.id} className="flex flex-col gap-1">
        {/* 카드: 가로로 긴 직사각형 (자막 모양) */}
        <button
          onClick={() => applyTemplate(tmpl)}
          className="w-full h-14 rounded-lg bg-gray-950 flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition-all"
        >
          {/* 샘플 텍스트에 실제 스타일 적용 */}
          <span
            style={{
              fontFamily: `"${s.fontFamily || 'Noto Sans KR'}", sans-serif`,
              fontSize: '15px',
              fontWeight: 'bold',
              color: s.textColor,
              // 배경 박스가 있으면 span에 적용
              backgroundColor: hasBg ? s.backgroundColor : undefined,
              padding: hasBg ? '5px 14px' : undefined,
              borderRadius: hasBg ? '4px' : undefined,
              opacity: hasBg ? (s.bgOpacity || 0.85) : 1,
              // 그림자
              textShadow: textShadow,
            }}
          >
            가나다라 ABC 123
          </span>
        </button>
        {/* 템플릿 이름 */}
        <p className="text-xs text-gray-500 text-center">{tmpl.name}</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[350] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">자막 스타일</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFontModal(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
            >
              + 폰트
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex overflow-hidden">
          {/* 좌측: 미리보기 + 설정 */}
          <div className="w-[340px] flex-shrink-0 p-4 border-r border-gray-800 flex flex-col">
            {/* 큰 미리보기 */}
            <div
              className="relative rounded-xl overflow-hidden flex-shrink-0 group/preview"
              style={{
                aspectRatio: '16/9',
                background: (tempPreviewImage || previewImage)
                  ? `url(${tempPreviewImage || previewImage}) center/cover`
                  : 'linear-gradient(135deg, #374151 0%, #1f2937 50%, #111827 100%)',
              }}
            >
              {/* 호버 시 업로드 버튼 */}
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-all flex items-center justify-center cursor-pointer z-20">
                <div className="px-4 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  예시 이미지 업로드
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setTempPreviewImage(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>

              <div
                className="absolute left-0 right-0 flex justify-center"
                style={{ top: `${((selected.yPosition || 680) / 720) * 100}%`, transform: 'translateY(-50%)' }}
              >
                <span
                  style={{
                    fontFamily: `"${selected.fontFamily}", sans-serif`,
                    fontSize: `${selected.fontSize * 0.36}px`,
                    fontWeight: selected.fontWeight || 700,
                    color: selected.textColor,
                    backgroundColor: selected.backgroundColor || undefined,
                    padding: selected.backgroundColor
                      ? `${(selected.bgPaddingY ?? selected.bgPadding ?? 12) * 0.36}px ${(selected.bgPaddingX ?? selected.bgPadding ?? 12) * 0.5}px`
                      : undefined,
                    borderRadius: selected.backgroundColor ? `${(selected.bgRadius ?? 8) * 0.36}px` : undefined,
                    opacity: selected.backgroundColor ? (selected.bgOpacity || 0.8) : 1,
                    textShadow: getTextShadow(selected.textColor, !!selected.backgroundColor),
                  }}
                >
                  자막 미리보기
                </span>
              </div>
            </div>

            {/* 설정 패널 */}
            <div className="mt-4 space-y-3 flex-1 overflow-y-auto">
              {/* 폰트 + 굵기 */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">폰트</label>
                  <select
                    value={selected.fontFamily}
                    onChange={(e) => setSelected({ ...selected, fontFamily: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                    style={{ fontFamily: selected.fontFamily }}
                  >
                    {allFonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs text-gray-500 mb-1 block">굵기</label>
                  <select
                    value={selected.fontWeight || 700}
                    onChange={(e) => setSelected({ ...selected, fontWeight: parseInt(e.target.value) })}
                    className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                  >
                    <option value="400">Regular</option>
                    <option value="500">Medium</option>
                    <option value="600">Semi Bold</option>
                    <option value="700">Bold</option>
                    <option value="800">Extra Bold</option>
                    <option value="900">Black</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">크기: {selected.fontSize}px</label>
                <input
                  type="range" min="24" max="72" value={selected.fontSize}
                  onChange={(e) => setSelected({ ...selected, fontSize: Number(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Y축 위치: {selected.yPosition || 680}px</label>
                <input
                  type="range" min="100" max="1000" value={selected.yPosition || 680}
                  onChange={(e) => setSelected({ ...selected, yPosition: Number(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">텍스트 색상</label>
                  <input
                    type="color" value={selected.textColor}
                    onChange={(e) => setSelected({ ...selected, textColor: e.target.value })}
                    className="w-full h-9 rounded-lg cursor-pointer bg-transparent border border-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">배경 {selected.backgroundColor ? '' : '(없음)'}</label>
                  <div className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      checked={!!selected.backgroundColor}
                      onChange={(e) => setSelected({ ...selected, backgroundColor: e.target.checked ? '#000000' : undefined })}
                      className="accent-blue-500 w-4 h-4"
                    />
                    {selected.backgroundColor && (
                      <input
                        type="color" value={selected.backgroundColor}
                        onChange={(e) => setSelected({ ...selected, backgroundColor: e.target.value })}
                        className="flex-1 h-full rounded-lg cursor-pointer bg-transparent border border-gray-700"
                      />
                    )}
                  </div>
                </div>
              </div>

              {selected.backgroundColor && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">배경 투명도: {Math.round((selected.bgOpacity || 0.8) * 100)}%</label>
                    <input
                      type="range" min="0.3" max="1" step="0.05" value={selected.bgOpacity || 0.8}
                      onChange={(e) => setSelected({ ...selected, bgOpacity: Number(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">가로 패딩: {selected.bgPaddingX ?? selected.bgPadding ?? 12}px</label>
                      <input
                        type="range" min="4" max="60" value={selected.bgPaddingX ?? selected.bgPadding ?? 12}
                        onChange={(e) => setSelected({ ...selected, bgPaddingX: Number(e.target.value) })}
                        className="w-full accent-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">세로 패딩: {selected.bgPaddingY ?? selected.bgPadding ?? 12}px</label>
                      <input
                        type="range" min="2" max="40" value={selected.bgPaddingY ?? selected.bgPadding ?? 12}
                        onChange={(e) => setSelected({ ...selected, bgPaddingY: Number(e.target.value) })}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">모서리 둥글기: {selected.bgRadius ?? 8}px</label>
                    <input
                      type="range" min="0" max="30" value={selected.bgRadius ?? 8}
                      onChange={(e) => setSelected({ ...selected, bgRadius: Number(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => onApply(selected)}
              className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
            >
              적용하기
            </button>
          </div>

          {/* 우측: 템플릿 그리드 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 카테고리 */}
            <div className="flex gap-2 p-4 pb-2 overflow-x-auto flex-shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                    category === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 템플릿 그리드: 2열 */}
            <div className="flex-1 overflow-y-auto p-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                {filteredTemplates.map(renderTemplateCard)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 폰트 모달 */}
      {showFontModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-lg font-bold text-white">폰트 추가</h3>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">파일 업로드</label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-gray-300">ttf, otf, woff, woff2</span>
                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
              </label>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Google Fonts URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                  value={googleFontUrl}
                  onChange={(e) => setGoogleFontUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm text-white border-0"
                />
                <button onClick={handleGoogleFontAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">추가</button>
              </div>
            </div>

            {customFonts.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">추가된 폰트</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {customFonts.map((f) => (
                    <div key={f.name} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
                      <span className="text-sm text-white" style={{ fontFamily: f.name }}>{f.name}</span>
                      <button onClick={() => handleDeleteFont(f.name)} className="text-red-400 text-xs">삭제</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setShowFontModal(false)} className="w-full py-2 bg-gray-800 rounded-lg text-gray-300">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
