import { useState, useEffect } from 'react';
import { SubtitleSettings } from '../types';

interface SubtitleTemplateModalProps {
  current: SubtitleSettings;
  onApply: (settings: SubtitleSettings) => void;
  onClose: () => void;
}

// 커스텀 폰트 타입
interface CustomFont {
  name: string;
  type: 'file' | 'google';
  data?: string; // base64 for file, URL for google
}

// 기본 제공 폰트 목록
const DEFAULT_FONTS = [
  'Noto Sans KR',
  'Noto Serif KR',
  'Black Han Sans',
  'Jua',
  'Do Hyeon',
  'Gothic A1',
  'Nanum Gothic',
  'Nanum Myeongjo',
  'Sunflower',
  'Gaegu',
  'Hi Melody',
  'Poor Story',
  'Single Day',
  'Stylish',
  'Gamja Flower',
];

// 미리보기 스케일 (1080p 기준 → 미리보기)
const PREVIEW_SCALE = 1 / 14; // 1080 → ~77px 높이
const PREVIEW_WIDTH = 140; // 16:9 비율
const PREVIEW_HEIGHT = 79;

export const TEMPLATES: { id: string; name: string; category: string; settings: Partial<SubtitleSettings> }[] = [
  // ===== 기본 (가장 많이 쓰이는 스타일) =====
  { id: 'white-outline', name: '흰색 기본', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 4, backgroundColor: undefined, fontSize: 46, fontFamily: 'Noto Sans KR' } },
  { id: 'white-bold', name: '흰색 굵은', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 6, backgroundColor: undefined, fontSize: 50, fontFamily: 'Black Han Sans' } },
  { id: 'yellow-basic', name: '노란색 기본', category: '기본', settings: { textColor: '#FFE500', strokeColor: '#000000', strokeWidth: 4, backgroundColor: undefined, fontSize: 46, fontFamily: 'Noto Sans KR' } },
  { id: 'yellow-bold', name: '노란색 굵은', category: '기본', settings: { textColor: '#FFD700', strokeColor: '#000000', strokeWidth: 5, backgroundColor: undefined, fontSize: 50, fontFamily: 'Black Han Sans' } },
  { id: 'black-box', name: '검정 박스', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#000000', bgOpacity: 0.85, bgPadding: 12, fontSize: 44, fontFamily: 'Noto Sans KR' } },
  { id: 'semi-box', name: '반투명 박스', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#000000', bgOpacity: 0.6, bgPadding: 10, fontSize: 44, fontFamily: 'Noto Sans KR' } },

  // ===== 강조 =====
  { id: 'impact-white', name: '임팩트 흰색', category: '강조', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 8, fontSize: 56, backgroundColor: undefined, fontFamily: 'Black Han Sans' } },
  { id: 'impact-yellow', name: '임팩트 노랑', category: '강조', settings: { textColor: '#FFD700', strokeColor: '#000000', strokeWidth: 8, fontSize: 56, backgroundColor: undefined, fontFamily: 'Black Han Sans' } },
  { id: 'red-box', name: '빨간 박스', category: '강조', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#D32F2F', bgOpacity: 0.95, bgPadding: 12, fontSize: 46, fontFamily: 'Noto Sans KR' } },
  { id: 'blue-box', name: '파란 박스', category: '강조', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#1976D2', bgOpacity: 0.95, bgPadding: 12, fontSize: 46, fontFamily: 'Noto Sans KR' } },
  { id: 'highlight-yellow', name: '형광펜 노랑', category: '강조', settings: { textColor: '#000000', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#FFEB3B', bgOpacity: 0.95, bgPadding: 8, fontSize: 44, fontFamily: 'Noto Sans KR' } },

  // ===== 예능 =====
  { id: 'variety-white', name: '예능 흰색', category: '예능', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 6, backgroundColor: undefined, fontSize: 52, fontFamily: 'Jua' } },
  { id: 'variety-yellow', name: '예능 노랑', category: '예능', settings: { textColor: '#FFEB3B', strokeColor: '#000000', strokeWidth: 6, backgroundColor: undefined, fontSize: 52, fontFamily: 'Jua' } },
  { id: 'comic-pink', name: '코믹 핑크', category: '예능', settings: { textColor: '#FFFFFF', strokeColor: '#E91E63', strokeWidth: 5, backgroundColor: undefined, fontSize: 50, fontFamily: 'Black Han Sans' } },
  { id: 'fun-green', name: '재미 초록', category: '예능', settings: { textColor: '#69F0AE', strokeColor: '#000000', strokeWidth: 5, backgroundColor: undefined, fontSize: 50, fontFamily: 'Jua' } },
  { id: 'cute', name: '귀여운', category: '예능', settings: { textColor: '#FF80AB', strokeColor: '#FFFFFF', strokeWidth: 3, backgroundColor: undefined, fontSize: 46, fontFamily: 'Hi Melody' } },

  // ===== 정보 =====
  { id: 'news-blue', name: '뉴스 파랑', category: '정보', settings: { textColor: '#FFFFFF', backgroundColor: '#0D47A1', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 14, fontSize: 42, fontFamily: 'Noto Sans KR' } },
  { id: 'news-dark', name: '뉴스 어두운', category: '정보', settings: { textColor: '#FFFFFF', backgroundColor: '#212121', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 14, fontSize: 42, fontFamily: 'Noto Sans KR' } },
  { id: 'tip-green', name: '팁 초록', category: '정보', settings: { textColor: '#FFFFFF', backgroundColor: '#2E7D32', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 12, fontSize: 42, fontFamily: 'Noto Sans KR' } },
  { id: 'tip-orange', name: '팁 주황', category: '정보', settings: { textColor: '#FFFFFF', backgroundColor: '#E65100', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 12, fontSize: 42, fontFamily: 'Noto Sans KR' } },

  // ===== 감성 =====
  { id: 'vlog', name: '브이로그', category: '감성', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2, backgroundColor: undefined, fontSize: 38, fontFamily: 'Noto Sans KR' } },
  { id: 'minimal', name: '미니멀', category: '감성', settings: { textColor: '#FFFFFF', strokeColor: '#444444', strokeWidth: 1, backgroundColor: undefined, fontSize: 36, fontFamily: 'Noto Sans KR' } },
  { id: 'movie', name: '영화', category: '감성', settings: { textColor: '#F5F5F5', strokeColor: '#000000', strokeWidth: 1, backgroundColor: undefined, fontSize: 34, fontFamily: 'Noto Serif KR' } },
  { id: 'elegant', name: '우아한', category: '감성', settings: { textColor: '#FFFFFF', strokeColor: '#333333', strokeWidth: 2, backgroundColor: undefined, fontSize: 40, fontFamily: 'Noto Serif KR' } },
  { id: 'soft-box', name: '부드러운 박스', category: '감성', settings: { textColor: '#FFFFFF', backgroundColor: '#000000', bgOpacity: 0.5, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 10, fontSize: 38, fontFamily: 'Noto Sans KR' } },
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

// 폰트 등록 함수
const registerFont = (font: CustomFont) => {
  if (font.type === 'file' && font.data) {
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: '${font.name}';
        src: url(${font.data});
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  } else if (font.type === 'google' && font.data) {
    const link = document.createElement('link');
    link.href = font.data;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
};

export default function SubtitleTemplateModal({ current, onApply, onClose }: SubtitleTemplateModalProps) {
  const [selected, setSelected] = useState<SubtitleSettings>(current);
  const [category, setCategory] = useState<string>('전체');
  const [previewBg, setPreviewBg] = useState<string>('');
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [showFontModal, setShowFontModal] = useState(false);
  const [googleFontUrl, setGoogleFontUrl] = useState('');
  const [savedPresets, setSavedPresets] = useState<Array<{ name: string; settings: Partial<SubtitleSettings> }>>([]);

  // Load custom fonts and saved presets
  useEffect(() => {
    loadFonts().then((fonts) => {
      setCustomFonts(fonts);
      fonts.forEach(registerFont);
    });

    const saved = localStorage.getItem('subtitle_presets');
    if (saved) {
      try {
        setSavedPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load subtitle presets:', e);
      }
    }
  }, []);

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    const baseSettings: SubtitleSettings = {
      fontSize: 46,
      fontFamily: 'Noto Sans KR',
      letterSpacing: 0,
      lineHeight: 1.2,
      opacity: 1,
      template: 'custom',
      textColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 3,
      backgroundColor: undefined,
      bgPadding: 12,
      bgOpacity: 0.8,
      position: 'bottom',
      yPosition: 680,
      lockPosition: false,
      lockFont: false,
    };
    setSelected({ ...baseSettings, ...template.settings });
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExts = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validExts.includes(ext)) {
      alert('ttf, otf, woff, woff2 파일만 업로드 가능합니다.');
      return;
    }

    const fontName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9가-힣\s]/g, '');

    const reader = new FileReader();
    reader.onload = async () => {
      const font: CustomFont = {
        name: fontName,
        type: 'file',
        data: reader.result as string,
      };
      await saveFont(font);
      registerFont(font);
      setCustomFonts([...customFonts, font]);
      alert(`"${fontName}" 폰트가 추가되었습니다!`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGoogleFontAdd = async () => {
    if (!googleFontUrl.includes('fonts.googleapis.com')) {
      alert('Google Fonts URL을 입력해주세요.\n예: https://fonts.googleapis.com/css2?family=Nanum+Gothic&display=swap');
      return;
    }

    // Extract font name from URL
    const match = googleFontUrl.match(/family=([^&:]+)/);
    if (!match) {
      alert('올바른 Google Fonts URL이 아닙니다.');
      return;
    }

    const fontName = decodeURIComponent(match[1].replace(/\+/g, ' '));

    const font: CustomFont = {
      name: fontName,
      type: 'google',
      data: googleFontUrl,
    };

    await saveFont(font);
    registerFont(font);
    setCustomFonts([...customFonts, font]);
    setGoogleFontUrl('');
    alert(`"${fontName}" 폰트가 추가되었습니다!`);
  };

  const handleDeleteFont = async (fontName: string) => {
    if (!confirm(`"${fontName}" 폰트를 삭제하시겠습니까?`)) return;
    await deleteFont(fontName);
    setCustomFonts(customFonts.filter(f => f.name !== fontName));
  };

  const allFonts = [...DEFAULT_FONTS, ...customFonts.map(f => f.name)];
  const categories = ['전체', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];
  const filteredTemplates = category === '전체' ? TEMPLATES : TEMPLATES.filter(t => t.category === category);

  // 미리보기 렌더링 함수 (실제 비율 유지)
  const renderPreview = (settings: Partial<SubtitleSettings>, text: string = '가나다') => {
    const fontSize = (settings.fontSize || 46) * PREVIEW_SCALE;
    const strokeWidth = (settings.strokeWidth || 0) * PREVIEW_SCALE;
    const bgPadding = (settings.bgPadding || 10) * PREVIEW_SCALE;
    const hasBg = !!settings.backgroundColor;
    const hasStroke = strokeWidth > 0 && settings.strokeColor !== 'transparent';

    return (
      <div
        className="relative flex items-end justify-center"
        style={{
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          backgroundColor: '#1a1a1a',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2"
          style={{
            fontFamily: `"${settings.fontFamily || 'Noto Sans KR'}", sans-serif`,
            fontSize: `${Math.max(fontSize, 8)}px`,
            fontWeight: 'bold',
            color: settings.textColor || '#FFFFFF',
            backgroundColor: hasBg ? settings.backgroundColor : undefined,
            padding: hasBg ? `${bgPadding}px ${bgPadding * 1.5}px` : undefined,
            borderRadius: hasBg ? 2 : undefined,
            opacity: hasBg ? (settings.bgOpacity || 0.8) : 1,
            WebkitTextStroke: hasStroke ? `${Math.max(strokeWidth, 0.5)}px ${settings.strokeColor}` : undefined,
            paintOrder: 'stroke fill',
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">자막 템플릿</h2>
          <button
            onClick={() => setShowFontModal(true)}
            className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
          >
            + 폰트 추가
          </button>
        </div>

        {/* 선택된 템플릿 미리보기 */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-6">
            <div
              className="rounded-lg overflow-hidden flex-shrink-0"
              style={{
                width: 280,
                height: 158,
                backgroundColor: '#1a1a1a',
                backgroundImage: previewBg ? `url(${previewBg})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
              }}
            >
              {/* 실제 비율 미리보기 */}
              <div
                className="absolute bottom-3 left-1/2 -translate-x-1/2"
                style={{
                  fontFamily: `"${selected.fontFamily}", sans-serif`,
                  fontSize: `${(selected.fontSize || 46) * (158 / 1080)}px`,
                  fontWeight: 'bold',
                  color: selected.textColor,
                  backgroundColor: selected.backgroundColor || undefined,
                  padding: selected.backgroundColor ? `${(selected.bgPadding || 10) * (158 / 1080)}px ${(selected.bgPadding || 10) * 1.5 * (158 / 1080)}px` : undefined,
                  borderRadius: selected.backgroundColor ? 3 : undefined,
                  opacity: selected.backgroundColor ? (selected.bgOpacity || 0.8) : 1,
                  WebkitTextStroke: selected.strokeWidth > 0 && selected.strokeColor !== 'transparent'
                    ? `${(selected.strokeWidth || 0) * (158 / 1080)}px ${selected.strokeColor}`
                    : undefined,
                  paintOrder: 'stroke fill',
                  whiteSpace: 'nowrap',
                }}
              >
                자막 미리보기
              </div>
              {/* 배경 업로드 버튼 */}
              <label className="absolute top-2 right-2 cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
                <div className="bg-white/90 p-1.5 rounded-lg">
                  <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setPreviewBg(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600 dark:text-slate-400 w-16">폰트</label>
                <select
                  value={selected.fontFamily}
                  onChange={(e) => setSelected({ ...selected, fontFamily: e.target.value })}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                  style={{ fontFamily: selected.fontFamily }}
                >
                  {allFonts.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600 dark:text-slate-400 w-16">크기</label>
                <input
                  type="range"
                  min="24"
                  max="72"
                  value={selected.fontSize}
                  onChange={(e) => setSelected({ ...selected, fontSize: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm text-slate-500 w-10">{selected.fontSize}px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 카테고리 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  category === cat
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 저장된 설정 */}
          {savedPresets.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">내 저장 설정</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {savedPresets.map((preset, index) => (
                  <button
                    key={`preset-${index}`}
                    onClick={() => applyTemplate({ id: `saved-${index}`, name: preset.name, category: '저장', settings: preset.settings })}
                    className="p-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:border-indigo-400 transition-all"
                  >
                    {renderPreview(preset.settings)}
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 text-center mt-1 truncate">{preset.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 템플릿 그리드 */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {filteredTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => applyTemplate(tmpl)}
                className="p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg hover:ring-2 hover:ring-blue-500 transition-all"
              >
                {renderPreview(tmpl.settings)}
                <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-1 truncate">{tmpl.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onApply(selected)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            적용
          </button>
        </div>
      </div>

      {/* 폰트 추가 모달 */}
      {showFontModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 space-y-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">폰트 추가</h3>

            {/* 파일 업로드 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">파일 업로드</label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-slate-600 dark:text-slate-400">ttf, otf, woff, woff2</span>
                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
              </label>
            </div>

            {/* Google Fonts */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Google Fonts URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                  value={googleFontUrl}
                  onChange={(e) => setGoogleFontUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm border-0"
                />
                <button
                  onClick={handleGoogleFontAdd}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 추가된 폰트 목록 */}
            {customFonts.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">추가된 폰트</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {customFonts.map((font) => (
                    <div key={font.name} className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                      <span className="text-sm" style={{ fontFamily: font.name }}>{font.name}</span>
                      <button
                        onClick={() => handleDeleteFont(font.name)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowFontModal(false)}
              className="w-full py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
