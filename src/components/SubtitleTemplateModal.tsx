import { useState, useEffect, useRef } from 'react';
import { SubtitleSettings } from '../types';
import { useSettingsStore, SavedSubtitleTemplate } from '../stores/settingsStore';

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

export const DEFAULT_FONTS = [
  'Pretendard', 'Noto Sans KR', 'Noto Serif KR', 'IBM Plex Sans KR',
  'Black Han Sans', 'Jua', 'Do Hyeon', 'Gothic A1',
  'Nanum Gothic', 'Nanum Myeongjo', 'Gowun Dodum', 'Gowun Batang',
  'Sunflower', 'Gaegu', 'Hi Melody', 'Poor Story', 'Single Day',
  'Stylish', 'Gamja Flower', 'Hahmlet', 'Orbit', 'Dongle',
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
    fontSize: 42, fontFamily: 'Noto Sans KR', letterSpacing: 1
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
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  // Store 연결
  const {
    savedSubtitleTemplates,
    addSubtitleTemplate,
    deleteSubtitleTemplate,
    favoriteTemplateIds,
    toggleFavoriteTemplate,
  } = useSettingsStore();

  useEffect(() => {
    loadFonts().then((fonts) => {
      setCustomFonts(fonts);
      fonts.forEach(registerFont);
    });
  }, []);

  // 현재 설정 저장
  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }
    if (savedSubtitleTemplates.length >= 50) {
      alert('나만의 템플릿은 최대 50개까지 저장 가능합니다.');
      return;
    }
    const newTemplate: SavedSubtitleTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplateName.trim(),
      settings: {
        fontSize: selected.fontSize,
        fontFamily: selected.fontFamily,
        fontWeight: selected.fontWeight,
        textColor: selected.textColor,
        backgroundColor: selected.backgroundColor,
        bgOpacity: selected.bgOpacity,
        bgPadding: selected.bgPadding,
        bgPaddingX: selected.bgPaddingX,
        bgPaddingY: selected.bgPaddingY,
        bgRadius: selected.bgRadius,
        yPosition: selected.yPosition,
        maxLineChars: selected.maxLineChars,
      },
      createdAt: Date.now(),
    };
    addSubtitleTemplate(newTemplate);
    setNewTemplateName('');
    setShowSaveModal(false);
  };

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    const baseSettings: SubtitleSettings = {
      fontSize: 44, fontFamily: 'Noto Sans KR', fontWeight: 700, fontStyle: 'normal',
      letterSpacing: 0, lineHeight: 1.2,
      opacity: 1, template: 'custom', textColor: '#FFFFFF',
      strokeColor: 'transparent', strokeWidth: 0,
      backgroundColor: undefined, bgPadding: 12, bgPaddingX: undefined, bgPaddingY: undefined, bgOpacity: 0.8, bgRadius: 8,
      position: 'bottom', yPosition: 650, lockPosition: false, lockFont: false,
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

  // 즐겨찾기 템플릿 (기본 + 나만의)
  const favoriteTemplates = [
    ...TEMPLATES.filter(t => favoriteTemplateIds.includes(t.id)),
    ...savedSubtitleTemplates.filter(t => favoriteTemplateIds.includes(t.id)).map(t => ({
      id: t.id,
      name: t.name,
      category: '나만의',
      settings: t.settings
    }))
  ];

  // 나만의 템플릿을 TEMPLATES 형식으로 변환
  const myTemplates = savedSubtitleTemplates.map(t => ({
    id: t.id,
    name: t.name,
    category: '나만의',
    settings: t.settings
  }));

  const categories = ['전체', '즐겨찾기', '나만의', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];

  const getFilteredTemplates = () => {
    if (category === '전체') return [...myTemplates, ...TEMPLATES];
    if (category === '즐겨찾기') return favoriteTemplates;
    if (category === '나만의') return myTemplates;
    return TEMPLATES.filter(t => t.category === category);
  };
  const filteredTemplates = getFilteredTemplates();

  // ========== 템플릿 카드 렌더링 ==========
  const renderTemplateCard = (tmpl: typeof TEMPLATES[0]) => {
    const s = tmpl.settings;
    const hasBg = !!s.backgroundColor;
    const textShadow = getTextShadow(s.textColor || '#FFFFFF', hasBg);
    const isFavorite = favoriteTemplateIds.includes(tmpl.id);
    const isCustom = tmpl.id.startsWith('custom-');

    return (
      <div key={tmpl.id} className="flex flex-col gap-1 relative group/card">
        {/* 카드: 가로로 긴 직사각형 (자막 모양) */}
        <button
          onClick={() => applyTemplate(tmpl)}
          className="w-full h-14 rounded-lg bg-gray-950 flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition-all relative"
        >
          {/* 샘플 텍스트에 실제 스타일 적용 */}
          <span
            style={{
              fontFamily: `"${s.fontFamily || 'Noto Sans KR'}", sans-serif`,
              fontSize: '15px',
              fontWeight: 'bold',
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              color: s.textColor,
              backgroundColor: hasBg ? s.backgroundColor : undefined,
              padding: hasBg ? '8px 14px' : undefined,
              borderRadius: hasBg ? '4px' : undefined,
              opacity: hasBg ? (s.bgOpacity || 0.85) : 1,
              textShadow: textShadow,
            }}
          >
            가나다라 ABC
          </span>
          {/* 즐겨찾기/삭제 버튼 */}
          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavoriteTemplate(tmpl.id); }}
              className={`p-1 rounded ${isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
              title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
            >
              <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            {isCustom && (
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`"${tmpl.name}" 삭제?`)) deleteSubtitleTemplate(tmpl.id); }}
                className="p-1 rounded text-gray-400 hover:text-red-400"
                title="삭제"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </button>
        {/* 템플릿 이름 */}
        <p className="text-xs text-slate-500 dark:text-gray-500 text-center">{tmpl.name}</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[350] bg-black/60 dark:bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">자막 스타일</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              현재 설정 저장
            </button>
            <button
              onClick={() => setShowFontModal(true)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg text-sm"
            >
              + 폰트
            </button>
            <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex overflow-hidden">
          {/* 좌측: 미리보기 + 설정 */}
          <div className="w-[340px] flex-shrink-0 p-4 border-r border-slate-200 dark:border-gray-800 flex flex-col bg-slate-50 dark:bg-transparent">
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
              {/* 우측 상단 전체화면 버튼 */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/preview:opacity-100 transition-opacity z-30">
                <button
                  onClick={() => setShowFullscreen(true)}
                  className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all"
                  title="전체화면"
                >
                  <svg className="w-4 h-4 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
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
                style={{ top: `${((selected.yPosition || 650) / 720) * 100}%`, transform: 'translateY(-50%)' }}
              >
                <span
                  style={{
                    fontFamily: `"${selected.fontFamily}", sans-serif`,
                    fontSize: `${selected.fontSize * 0.265}px`,
                    fontWeight: selected.fontWeight || 700,
                    color: selected.textColor,
                    backgroundColor: selected.backgroundColor || undefined,
                    padding: selected.backgroundColor
                      ? `${(selected.bgPaddingY ?? selected.bgPadding ?? 12) * 0.265}px ${(selected.bgPaddingX ?? selected.bgPadding ?? 12) * 0.265}px`
                      : undefined,
                    borderRadius: selected.backgroundColor ? `${(selected.bgRadius ?? 8) * 0.265}px` : undefined,
                    opacity: selected.backgroundColor ? (selected.bgOpacity || 0.8) : 1,
                    textShadow: getTextShadow(selected.textColor, !!selected.backgroundColor),
                  }}
                >
                  자막 미리보기
                </span>
              </div>
            </div>

            {/* 피그마 스타일 설정 패널 */}
            <div ref={settingsPanelRef} className="mt-3 flex-1 overflow-y-auto bg-white dark:bg-gray-900">
              {/* 숫자 입력 컴포넌트 */}
              {(() => {
                const NumberInput = ({ value, onChange, min = 0, max = 100, step = 1, unit = '' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string }) => (
                  <div className="flex items-center h-8 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                    <button onClick={() => onChange(Math.max(min, value - step))} className="w-7 h-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium">−</button>
                    <span className="flex-1 text-center text-xs text-gray-700 dark:text-gray-300 min-w-[40px]">{value}{unit}</span>
                    <button onClick={() => onChange(Math.min(max, value + step))} className="w-7 h-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium">+</button>
                  </div>
                );
                const ColorInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
                  <div className="flex items-center gap-2 h-8">
                    <div className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 overflow-hidden flex-shrink-0" style={{ backgroundColor: value }}>
                      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 -ml-1.5 -mt-1.5 cursor-pointer opacity-0" />
                    </div>
                    <input type="text" value={value.toUpperCase()} onChange={(e) => onChange(e.target.value)} className="flex-1 h-full px-2 text-xs text-center font-mono border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                );
                const Section = ({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) => {
                  const [open, setOpen] = useState(defaultOpen);
                  return (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="px-4 pb-3 space-y-3">{children}</div>
                      </div>
                    </div>
                  );
                };
                const FONT_WEIGHTS = [
                  { label: 'Thin', value: 100 },
                  { label: 'ExtraLight', value: 200 },
                  { label: 'Light', value: 300 },
                  { label: 'Regular', value: 400 },
                  { label: 'Medium', value: 500 },
                  { label: 'SemiBold', value: 600 },
                  { label: 'Bold', value: 700 },
                  { label: 'ExtraBold', value: 800 },
                  { label: 'Black', value: 900 },
                ];
                return (
                  <>
                    {/* 1. 글씨체 */}
                    <Section title="글씨체" defaultOpen={true}>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">폰트</label>
                          <select value={selected.fontFamily} onChange={(e) => setSelected({ ...selected, fontFamily: e.target.value })} className="w-full h-8 px-2 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-indigo-500" style={{ fontFamily: selected.fontFamily }}>
                            {allFonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                          </select>
                        </div>
                        <div className="w-[110px]">
                          <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">굵기</label>
                          <select value={selected.fontWeight || 700} onChange={(e) => setSelected({ ...selected, fontWeight: Number(e.target.value) })} className="w-full h-8 px-2 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-indigo-500">
                            {FONT_WEIGHTS.map((fw) => <option key={fw.value} value={fw.value}>{fw.label} {selected.fontWeight === fw.value ? '✓' : ''}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">크기 (px)</label>
                        <NumberInput value={selected.fontSize} onChange={(v) => setSelected({ ...selected, fontSize: v })} min={16} max={120} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">글자 색상</label>
                        <ColorInput value={selected.textColor} onChange={(v) => setSelected({ ...selected, textColor: v })} />
                      </div>
                    </Section>

                    {/* 2. 자막 배경 */}
                    <Section title="자막 배경" defaultOpen={true}>
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-500 dark:text-gray-400">배경 사용</label>
                        <button onClick={() => setSelected({ ...selected, backgroundColor: selected.backgroundColor ? undefined : '#000000' })} className={`w-8 h-4 rounded-full transition-colors ${selected.backgroundColor ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                          <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${selected.backgroundColor ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      {selected.backgroundColor && (
                        <>
                          <div>
                            <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">배경 색상</label>
                            <ColorInput value={selected.backgroundColor} onChange={(v) => setSelected({ ...selected, backgroundColor: v })} />
                          </div>
                          <div>
                            <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">투명도 (%)</label>
                            <NumberInput value={Math.round((selected.bgOpacity || 0.8) * 100)} onChange={(v) => setSelected({ ...selected, bgOpacity: v / 100 })} min={30} max={100} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">가로 패딩 (px)</label>
                              <NumberInput value={selected.bgPaddingX ?? selected.bgPadding ?? 12} onChange={(v) => setSelected({ ...selected, bgPaddingX: v })} min={0} max={60} />
                            </div>
                            <div>
                              <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">세로 패딩 (px)</label>
                              <NumberInput value={selected.bgPaddingY ?? selected.bgPadding ?? 12} onChange={(v) => setSelected({ ...selected, bgPaddingY: v })} min={0} max={40} />
                            </div>
                          </div>
                        </>
                      )}
                    </Section>

                    {/* 3. 모서리 */}
                    <Section title="모서리" defaultOpen={false}>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">둥글기 (px)</label>
                        <NumberInput value={selected.bgRadius ?? 8} onChange={(v) => setSelected({ ...selected, bgRadius: v })} min={0} max={50} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">외곽선 두께 (px)</label>
                        <NumberInput value={selected.strokeWidth || 0} onChange={(v) => setSelected({ ...selected, strokeWidth: v })} min={0} max={10} />
                      </div>
                      {(selected.strokeWidth || 0) > 0 && (
                        <div>
                          <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">외곽선 색상</label>
                          <ColorInput value={selected.strokeColor || '#000000'} onChange={(v) => setSelected({ ...selected, strokeColor: v })} />
                        </div>
                      )}
                    </Section>

                    {/* 4. 자막 줄 설정 */}
                    <Section title="자막 줄 설정" defaultOpen={true}>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">한 줄 글자수</label>
                        <NumberInput value={selected.maxLineChars ?? 15} onChange={(v) => setSelected({ ...selected, maxLineChars: v })} min={5} max={30} />
                      </div>
                      <p className="text-sm text-indigo-500 dark:text-indigo-400">자막이 무조건 1줄로 표시됩니다</p>
                    </Section>

                    {/* 5. 위치 */}
                    <Section title="위치" defaultOpen={true}>
                      <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Y 위치 (px)</label>
                        <NumberInput value={selected.yPosition || 650} onChange={(v) => setSelected({ ...selected, yPosition: v })} min={50} max={700} />
                      </div>
                    </Section>
                  </>
                );
              })()}
            </div>

            <button
              onClick={() => onApply(selected)}
              className="mt-3 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
            >
              적용하기
            </button>
          </div>

          {/* 우측: 템플릿 그리드 */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-transparent">
            {/* 카테고리 */}
            <div className="flex gap-2 p-4 pb-2 overflow-x-auto flex-shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                    category === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700 border border-slate-200 dark:border-transparent'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 템플릿 그리드: 2열 */}
            <div className="flex-1 overflow-y-auto p-4 pt-2">
              {filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  {category === '즐겨찾기' ? (
                    <>
                      <svg className="w-12 h-12 text-slate-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      <p className="text-slate-500 dark:text-gray-400 text-sm">즐겨찾기한 템플릿이 없습니다.</p>
                      <p className="text-slate-400 dark:text-gray-500 text-xs mt-1">템플릿 카드의 별 아이콘을 클릭하세요.</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-slate-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                      </svg>
                      <p className="text-slate-500 dark:text-gray-400 text-sm">저장된 템플릿이 없습니다.</p>
                      <p className="text-slate-400 dark:text-gray-500 text-xs mt-1">"현재 설정 저장" 버튼을 눌러 추가하세요.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredTemplates.map(renderTemplateCard)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 전체화면 모달 */}
      {showFullscreen && (
        <div
          className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center p-4"
          onClick={() => setShowFullscreen(false)}
        >
          <button
            onClick={() => setShowFullscreen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="relative w-[80vw] max-w-[1280px] rounded-lg overflow-hidden"
            style={{
              aspectRatio: '16/9',
              background: (tempPreviewImage || previewImage)
                ? `url(${tempPreviewImage || previewImage}) center/cover`
                : 'linear-gradient(135deg, #374151 0%, #1f2937 50%, #111827 100%)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 자막 오버레이 */}
            <div
              className="absolute left-0 right-0 flex justify-center pointer-events-none"
              style={{ top: `${((selected.yPosition || 650) / 720) * 100}%`, transform: 'translateY(-50%)' }}
            >
              <span
                style={{
                  fontFamily: `"${selected.fontFamily}", sans-serif`,
                  fontSize: `${selected.fontSize}px`,
                  fontWeight: selected.fontWeight || 700,
                  color: selected.textColor,
                  backgroundColor: selected.backgroundColor || undefined,
                  padding: selected.backgroundColor
                    ? `${selected.bgPaddingY ?? selected.bgPadding ?? 12}px ${selected.bgPaddingX ?? selected.bgPadding ?? 12}px`
                    : undefined,
                  borderRadius: selected.backgroundColor ? `${selected.bgRadius ?? 8}px` : undefined,
                  opacity: selected.backgroundColor ? (selected.bgOpacity || 0.8) : 1,
                  textShadow: getTextShadow(selected.textColor, !!selected.backgroundColor),
                }}
              >
                자막 미리보기
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 폰트 모달 */}
      {showFontModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">폰트 추가</h3>

            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">파일 업로드</label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-gray-700">
                <svg className="w-5 h-5 text-slate-400 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-slate-600 dark:text-gray-300">ttf, otf, woff, woff2</span>
                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
              </label>
            </div>

            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Google Fonts URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                  value={googleFontUrl}
                  onChange={(e) => setGoogleFontUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-100 dark:bg-gray-800 rounded-lg text-sm text-slate-900 dark:text-white border-0"
                />
                <button onClick={handleGoogleFontAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">추가</button>
              </div>
            </div>

            {customFonts.length > 0 && (
              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">추가된 폰트</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {customFonts.map((f) => (
                    <div key={f.name} className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-gray-800 rounded-lg">
                      <span className="text-sm text-slate-900 dark:text-white" style={{ fontFamily: f.name }}>{f.name}</span>
                      <button onClick={() => handleDeleteFont(f.name)} className="text-red-500 dark:text-red-400 text-xs">삭제</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setShowFontModal(false)} className="w-full py-2 bg-slate-200 dark:bg-gray-800 rounded-lg text-slate-700 dark:text-gray-300">닫기</button>
          </div>
        </div>
      )}

      {/* 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">나만의 템플릿 저장</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400">현재 자막 설정을 템플릿으로 저장합니다. ({savedSubtitleTemplates.length}/50)</p>
            <input
              type="text"
              placeholder="템플릿 이름"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-100 dark:bg-gray-800 rounded-lg text-slate-900 dark:text-white border-0 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSaveModal(false); setNewTemplateName(''); }}
                className="flex-1 py-2.5 bg-slate-200 dark:bg-gray-800 rounded-lg text-slate-700 dark:text-gray-300"
              >
                취소
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!newTemplateName.trim() || savedSubtitleTemplates.length >= 10}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
