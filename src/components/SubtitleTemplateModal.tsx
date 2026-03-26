import { useState, useEffect } from 'react';
import { SubtitleSettings } from '../types';

interface SubtitleTemplateModalProps {
  current: SubtitleSettings;
  onApply: (settings: SubtitleSettings) => void;
  onClose: () => void;
  previewImage?: string; // 현재 씬 이미지
}

// 커스텀 폰트 타입
interface CustomFont {
  name: string;
  type: 'file' | 'google';
  data?: string;
}

// 기본 제공 폰트
const DEFAULT_FONTS = [
  'Noto Sans KR', 'Noto Serif KR', 'Black Han Sans', 'Jua', 'Do Hyeon',
  'Gothic A1', 'Nanum Gothic', 'Nanum Myeongjo', 'Sunflower', 'Gaegu',
  'Hi Melody', 'Poor Story', 'Single Day', 'Stylish', 'Gamja Flower',
];

// 템플릿 정의 - 시각적 차이 극대화
export const TEMPLATES: { id: string; name: string; category: string; settings: Partial<SubtitleSettings> }[] = [
  // ===== 기본 =====
  { id: 'black-box', name: '검정 박스', category: '기본', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#000000', bgOpacity: 0.85, bgPadding: 14,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},
  { id: 'semi-transparent', name: '반투명 박스', category: '기본', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#1a1a1a', bgOpacity: 0.6, bgPadding: 12,
    fontSize: 42, fontFamily: 'Noto Sans KR'
  }},
  { id: 'yellow-outline', name: '노란 자막', category: '기본', settings: {
    textColor: '#FFE500', strokeColor: '#000000', strokeWidth: 6,
    backgroundColor: undefined, fontSize: 48, fontFamily: 'Black Han Sans'
  }},
  { id: 'white-outline', name: '흰색 외곽선', category: '기본', settings: {
    textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 5,
    backgroundColor: undefined, fontSize: 46, fontFamily: 'Noto Sans KR'
  }},
  { id: 'green-outline', name: '녹색 자막', category: '기본', settings: {
    textColor: '#4ADE80', strokeColor: '#000000', strokeWidth: 5,
    backgroundColor: undefined, fontSize: 46, fontFamily: 'Black Han Sans'
  }},

  // ===== 컬러 =====
  { id: 'red-box', name: '빨간 박스', category: '컬러', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#DC2626', bgOpacity: 0.95, bgPadding: 14,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},
  { id: 'blue-box', name: '파란 박스', category: '컬러', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#2563EB', bgOpacity: 0.95, bgPadding: 14,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},
  { id: 'gold-yellow', name: '황금빛 노랑', category: '컬러', settings: {
    textColor: '#1a1a1a', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#FACC15', bgOpacity: 0.95, bgPadding: 12,
    fontSize: 44, fontFamily: 'Black Han Sans'
  }},
  { id: 'gradient-purple', name: '그라데이션', category: '컬러', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#7C3AED', bgOpacity: 0.9, bgPadding: 14,
    fontSize: 44, fontFamily: 'Jua'
  }},
  { id: 'coral-pink', name: '코랄 핑크', category: '컬러', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#F472B6', bgOpacity: 0.9, bgPadding: 12,
    fontSize: 44, fontFamily: 'Jua'
  }},

  // ===== 예능 =====
  { id: 'news-breaking', name: '뉴스 속보', category: '예능', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#B91C1C', bgOpacity: 0.98, bgPadding: 16,
    fontSize: 48, fontFamily: 'Black Han Sans'
  }},
  { id: 'news-dark', name: '뉴스 어두운', category: '예능', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#1E3A5F', bgOpacity: 0.95, bgPadding: 14,
    fontSize: 44, fontFamily: 'Noto Sans KR'
  }},
  { id: 'pop-green', name: '팝 초록', category: '예능', settings: {
    textColor: '#000000', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#4ADE80', bgOpacity: 0.95, bgPadding: 12,
    fontSize: 46, fontFamily: 'Black Han Sans'
  }},
  { id: 'pop-orange', name: '팝 주황', category: '예능', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#F97316', bgOpacity: 0.95, bgPadding: 12,
    fontSize: 46, fontFamily: 'Jua'
  }},
  { id: 'variety-highlight', name: '예능 강조', category: '예능', settings: {
    textColor: '#FFEB3B', strokeColor: '#D32F2F', strokeWidth: 6,
    backgroundColor: undefined, fontSize: 52, fontFamily: 'Black Han Sans'
  }},

  // ===== 감성 =====
  { id: 'vlog-minimal', name: '브이로그', category: '감성', settings: {
    textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2,
    backgroundColor: undefined, fontSize: 36, fontFamily: 'Noto Sans KR'
  }},
  { id: 'minimal-clean', name: '미니멀', category: '감성', settings: {
    textColor: '#F5F5F5', strokeColor: '#333333', strokeWidth: 1,
    backgroundColor: undefined, fontSize: 34, fontFamily: 'Noto Sans KR'
  }},
  { id: 'movie-style', name: '영화', category: '감성', settings: {
    textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 1,
    backgroundColor: undefined, fontSize: 32, fontFamily: 'Noto Serif KR'
  }},
  { id: 'elegant-gold', name: '우아한 골드', category: '감성', settings: {
    textColor: '#D4AF37', strokeColor: '#1a1a1a', strokeWidth: 2,
    backgroundColor: undefined, fontSize: 40, fontFamily: 'Noto Serif KR'
  }},
  { id: 'soft-rounded', name: '부드러운 박스', category: '감성', settings: {
    textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0,
    backgroundColor: '#374151', bgOpacity: 0.7, bgPadding: 14,
    fontSize: 38, fontFamily: 'Noto Sans KR'
  }},

  // ===== 프리미엄 =====
  { id: 'premium-gold', name: '골드', category: '프리미엄', settings: {
    textColor: '#FFD700', strokeColor: '#8B4513', strokeWidth: 3,
    backgroundColor: undefined, fontSize: 46, fontFamily: 'Noto Serif KR'
  }},
  { id: 'premium-silver', name: '실버', category: '프리미엄', settings: {
    textColor: '#E5E7EB', strokeColor: '#4B5563', strokeWidth: 2,
    backgroundColor: undefined, fontSize: 44, fontFamily: 'Gothic A1'
  }},
  { id: 'neon-glow', name: '네온', category: '프리미엄', settings: {
    textColor: '#00FF88', strokeColor: '#003322', strokeWidth: 3,
    backgroundColor: undefined, fontSize: 46, fontFamily: 'Black Han Sans'
  }},
  { id: 'neon-pink', name: '네온 핑크', category: '프리미엄', settings: {
    textColor: '#FF00FF', strokeColor: '#330033', strokeWidth: 3,
    backgroundColor: undefined, fontSize: 46, fontFamily: 'Jua'
  }},
  { id: 'cyber-blue', name: '사이버 블루', category: '프리미엄', settings: {
    textColor: '#00D4FF', strokeColor: '#001133', strokeWidth: 3,
    backgroundColor: undefined, fontSize: 46, fontFamily: 'Black Han Sans'
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
      if (!db.objectStoreNames.contains('fonts')) {
        db.createObjectStore('fonts', { keyPath: 'name' });
      }
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
    const request = tx.objectStore('fonts').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

export default function SubtitleTemplateModal({ current, onApply, onClose, previewImage }: SubtitleTemplateModalProps) {
  const [selected, setSelected] = useState<SubtitleSettings>(current);
  const [category, setCategory] = useState<string>('전체');
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [showFontModal, setShowFontModal] = useState(false);
  const [googleFontUrl, setGoogleFontUrl] = useState('');

  useEffect(() => {
    loadFonts().then((fonts) => {
      setCustomFonts(fonts);
      fonts.forEach(registerFont);
    });
  }, []);

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    const baseSettings: SubtitleSettings = {
      fontSize: 44, fontFamily: 'Noto Sans KR', letterSpacing: 0, lineHeight: 1.2,
      opacity: 1, template: 'custom', textColor: '#FFFFFF', strokeColor: '#000000',
      strokeWidth: 3, backgroundColor: undefined, bgPadding: 12, bgOpacity: 0.8,
      position: 'bottom', yPosition: 680, lockPosition: false, lockFont: false,
    };
    setSelected({ ...baseSettings, ...template.settings });
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
      alert(`"${fontName}" 폰트 추가 완료!`);
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
    alert(`"${fontName}" 폰트 추가 완료!`);
  };

  const handleDeleteFont = async (fontName: string) => {
    if (!confirm(`"${fontName}" 삭제?`)) return;
    await deleteFont(fontName);
    setCustomFonts(customFonts.filter(f => f.name !== fontName));
  };

  const allFonts = [...DEFAULT_FONTS, ...customFonts.map(f => f.name)];
  const categories = ['전체', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];
  const filteredTemplates = category === '전체' ? TEMPLATES : TEMPLATES.filter(t => t.category === category);

  // 네온/글로우 효과 계산
  const getTextShadow = (settings: Partial<SubtitleSettings>) => {
    if (settings.textColor?.includes('FF00') || settings.textColor?.includes('00FF') || settings.textColor?.includes('D4FF')) {
      // 네온 효과
      return `0 0 10px ${settings.textColor}, 0 0 20px ${settings.textColor}, 0 0 30px ${settings.textColor}40`;
    }
    if (settings.strokeWidth && settings.strokeWidth > 0 && settings.strokeColor !== 'transparent') {
      return `0 2px 4px rgba(0,0,0,0.5)`;
    }
    return undefined;
  };

  // 템플릿 카드 렌더링
  const renderTemplateCard = (tmpl: typeof TEMPLATES[0]) => {
    const s = tmpl.settings;
    const hasBg = !!s.backgroundColor;
    const hasStroke = (s.strokeWidth || 0) > 0 && s.strokeColor !== 'transparent';

    return (
      <button
        key={tmpl.id}
        onClick={() => applyTemplate(tmpl)}
        className="group relative rounded-xl overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all bg-gray-900"
        style={{ aspectRatio: '16/9' }}
      >
        {/* 배경 - 어두운 영상 프레임 느낌 */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #1f1f1f 0%, #0a0a0a 50%, #1a1a1a 100%)',
          }}
        />

        {/* 자막 미리보기 */}
        <div className="absolute inset-0 flex items-end justify-center pb-3">
          <span
            style={{
              fontFamily: `"${s.fontFamily || 'Noto Sans KR'}", sans-serif`,
              fontSize: '13px',
              fontWeight: 'bold',
              color: s.textColor,
              backgroundColor: hasBg ? s.backgroundColor : undefined,
              padding: hasBg ? '4px 10px' : undefined,
              borderRadius: hasBg ? '4px' : undefined,
              opacity: hasBg ? (s.bgOpacity || 0.8) : 1,
              WebkitTextStroke: hasStroke ? `${Math.max((s.strokeWidth || 0) * 0.15, 0.5)}px ${s.strokeColor}` : undefined,
              paintOrder: 'stroke fill',
              textShadow: getTextShadow(s),
              whiteSpace: 'nowrap',
            }}
          >
            {tmpl.name}
          </span>
        </div>

        {/* 호버 오버레이 */}
        <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors" />
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">자막 스타일</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFontModal(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              + 폰트
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content - 좌우 분할 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 좌측: 큰 미리보기 */}
          <div className="w-[400px] flex-shrink-0 p-4 border-r border-gray-800 flex flex-col">
            {/* 영상 미리보기 */}
            <div
              className="relative rounded-xl overflow-hidden flex-shrink-0"
              style={{
                aspectRatio: '16/9',
                background: previewImage
                  ? `url(${previewImage}) center/cover`
                  : 'linear-gradient(135deg, #374151 0%, #1f2937 50%, #111827 100%)',
              }}
            >
              {/* 자막 */}
              <div className="absolute inset-0 flex items-end justify-center pb-4">
                <span
                  style={{
                    fontFamily: `"${selected.fontFamily}", sans-serif`,
                    fontSize: `${selected.fontSize * 0.35}px`,
                    fontWeight: 'bold',
                    color: selected.textColor,
                    backgroundColor: selected.backgroundColor || undefined,
                    padding: selected.backgroundColor ? `${selected.bgPadding * 0.35}px ${selected.bgPadding * 0.5}px` : undefined,
                    borderRadius: selected.backgroundColor ? '6px' : undefined,
                    opacity: selected.backgroundColor ? (selected.bgOpacity || 0.8) : 1,
                    WebkitTextStroke: selected.strokeWidth > 0 && selected.strokeColor !== 'transparent'
                      ? `${selected.strokeWidth * 0.35}px ${selected.strokeColor}`
                      : undefined,
                    paintOrder: 'stroke fill',
                    textShadow: getTextShadow(selected),
                  }}
                >
                  자막 미리보기
                </span>
              </div>
            </div>

            {/* 세부 설정 */}
            <div className="mt-4 space-y-3 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {/* 폰트 */}
                <div className="col-span-2">
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

                {/* 크기 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">크기</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="24" max="72" value={selected.fontSize}
                      onChange={(e) => setSelected({ ...selected, fontSize: Number(e.target.value) })}
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-xs text-gray-400 w-8">{selected.fontSize}</span>
                  </div>
                </div>

                {/* 외곽선 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">외곽선</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="0" max="10" value={selected.strokeWidth}
                      onChange={(e) => setSelected({ ...selected, strokeWidth: Number(e.target.value) })}
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-xs text-gray-400 w-8">{selected.strokeWidth}</span>
                  </div>
                </div>

                {/* 텍스트 색상 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">텍스트 색상</label>
                  <input
                    type="color" value={selected.textColor}
                    onChange={(e) => setSelected({ ...selected, textColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent"
                  />
                </div>

                {/* 외곽선 색상 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">외곽선 색상</label>
                  <input
                    type="color" value={selected.strokeColor === 'transparent' ? '#000000' : selected.strokeColor}
                    onChange={(e) => setSelected({ ...selected, strokeColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer bg-transparent"
                  />
                </div>

                {/* 배경색 */}
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">배경 박스</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!selected.backgroundColor}
                      onChange={(e) => setSelected({
                        ...selected,
                        backgroundColor: e.target.checked ? '#000000' : undefined
                      })}
                      className="accent-blue-500"
                    />
                    {selected.backgroundColor && (
                      <>
                        <input
                          type="color" value={selected.backgroundColor}
                          onChange={(e) => setSelected({ ...selected, backgroundColor: e.target.value })}
                          className="w-8 h-6 rounded cursor-pointer bg-transparent"
                        />
                        <input
                          type="range" min="0.3" max="1" step="0.1" value={selected.bgOpacity}
                          onChange={(e) => setSelected({ ...selected, bgOpacity: Number(e.target.value) })}
                          className="flex-1 accent-blue-500"
                        />
                        <span className="text-xs text-gray-400">{Math.round((selected.bgOpacity || 0.8) * 100)}%</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 적용 버튼 */}
            <button
              onClick={() => onApply(selected)}
              className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              적용하기
            </button>
          </div>

          {/* 우측: 템플릿 그리드 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 카테고리 탭 */}
            <div className="flex gap-2 p-4 pb-2 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    category === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 템플릿 그리드 - 4열 */}
            <div className="flex-1 overflow-y-auto p-4 pt-2">
              <div className="grid grid-cols-4 gap-3">
                {filteredTemplates.map(renderTemplateCard)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 폰트 추가 모달 */}
      {showFontModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-lg font-bold text-white">폰트 추가</h3>

            {/* 파일 업로드 */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">파일 업로드 (ttf, otf, woff, woff2)</label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-gray-300">파일 선택</span>
                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
              </label>
            </div>

            {/* Google Fonts */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Google Fonts URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                  value={googleFontUrl}
                  onChange={(e) => setGoogleFontUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm text-white border-0 placeholder-gray-500"
                />
                <button
                  onClick={handleGoogleFontAdd}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 추가된 폰트 */}
            {customFonts.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">추가된 폰트</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {customFonts.map((f) => (
                    <div key={f.name} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
                      <span className="text-sm text-white" style={{ fontFamily: f.name }}>{f.name}</span>
                      <button onClick={() => handleDeleteFont(f.name)} className="text-red-400 hover:text-red-300 text-xs">삭제</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowFontModal(false)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
