import { useState, useEffect } from 'react';
import { SubtitleSettings } from '../types';

interface SubtitleTemplateModalProps {
  current: SubtitleSettings;
  onApply: (settings: SubtitleSettings) => void;
  onClose: () => void;
}

export const TEMPLATES: { id: string; name: string; category: string; settings: Partial<SubtitleSettings> }[] = [
  // ===== 기본 (가장 많이 쓰이는 스타일) =====
  { id: 'white-outline', name: '흰색 외곽선', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 4, backgroundColor: undefined, fontSize: 48, fontFamily: 'Noto Sans KR' } },
  { id: 'white-thick', name: '흰색 두꺼운', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 6, backgroundColor: undefined, fontSize: 52, fontFamily: 'Noto Sans KR' } },
  { id: 'black-box', name: '검정 박스', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#000000', bgOpacity: 0.8, bgPadding: 12, fontSize: 46, fontFamily: 'Noto Sans KR' } },
  { id: 'semi-box', name: '반투명 박스', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#000000', bgOpacity: 0.6, bgPadding: 10, fontSize: 44, fontFamily: 'Noto Sans KR' } },
  { id: 'yellow-basic', name: '노란색', category: '기본', settings: { textColor: '#FFDD00', strokeColor: '#000000', strokeWidth: 4, backgroundColor: undefined, fontSize: 48, fontFamily: 'Noto Sans KR' } },

  // ===== 강조 (중요한 부분용) =====
  { id: 'yellow-bold', name: '노란색 강조', category: '강조', settings: { textColor: '#FFD700', strokeColor: '#000000', strokeWidth: 5, backgroundColor: undefined, fontSize: 52, fontFamily: 'Black Han Sans' } },
  { id: 'red-alert', name: '빨간색 강조', category: '강조', settings: { textColor: '#FF3333', strokeColor: '#FFFFFF', strokeWidth: 4, backgroundColor: undefined, fontSize: 50, fontFamily: 'Black Han Sans' } },
  { id: 'red-box', name: '빨간 박스', category: '강조', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#E53935', bgOpacity: 0.95, bgPadding: 12, fontSize: 48, fontFamily: 'Noto Sans KR' } },
  { id: 'impact', name: '임팩트', category: '강조', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 7, fontSize: 56, backgroundColor: undefined, fontFamily: 'Black Han Sans' } },
  { id: 'highlight', name: '하이라이트', category: '강조', settings: { textColor: '#000000', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#FFEB3B', bgOpacity: 0.95, bgPadding: 10, fontSize: 46, fontFamily: 'Noto Sans KR' } },

  // ===== 정보형 (뉴스/설명/강의) =====
  { id: 'news-blue', name: '뉴스 파란색', category: '정보', settings: { textColor: '#FFFFFF', backgroundColor: '#1976D2', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 14, fontSize: 44, fontFamily: 'Noto Sans KR' } },
  { id: 'news-dark', name: '뉴스 어두운', category: '정보', settings: { textColor: '#FFFFFF', backgroundColor: '#263238', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 14, fontSize: 44, fontFamily: 'Noto Sans KR' } },
  { id: 'lecture-white', name: '강의 흰색', category: '정보', settings: { textColor: '#212121', backgroundColor: '#FFFFFF', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 14, fontSize: 42, fontFamily: 'Noto Sans KR' } },
  { id: 'info-green', name: '정보 초록', category: '정보', settings: { textColor: '#FFFFFF', backgroundColor: '#2E7D32', bgOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 12, fontSize: 44, fontFamily: 'Noto Sans KR' } },
  { id: 'tip-orange', name: '팁 주황색', category: '정보', settings: { textColor: '#FFFFFF', backgroundColor: '#F57C00', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 12, fontSize: 44, fontFamily: 'Noto Sans KR' } },

  // ===== 예능/재미 =====
  { id: 'fun-yellow', name: '예능 노랑', category: '예능', settings: { textColor: '#FFEB3B', strokeColor: '#000000', strokeWidth: 5, backgroundColor: undefined, fontSize: 54, fontFamily: 'Jua' } },
  { id: 'fun-white', name: '예능 흰색', category: '예능', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 6, backgroundColor: undefined, fontSize: 54, fontFamily: 'Jua' } },
  { id: 'comic', name: '코믹', category: '예능', settings: { textColor: '#FFFFFF', strokeColor: '#E91E63', strokeWidth: 5, backgroundColor: undefined, fontSize: 52, fontFamily: 'Black Han Sans' } },
  { id: 'shock', name: '충격', category: '예능', settings: { textColor: '#FF1744', strokeColor: '#FFFFFF', strokeWidth: 5, backgroundColor: undefined, fontSize: 56, fontFamily: 'Black Han Sans' } },
  { id: 'cute-pink', name: '귀여운 핑크', category: '예능', settings: { textColor: '#FF80AB', strokeColor: '#FFFFFF', strokeWidth: 3, backgroundColor: undefined, fontSize: 48, fontFamily: 'Jua' } },

  // ===== 감성/브이로그 =====
  { id: 'vlog-clean', name: '브이로그', category: '감성', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2, backgroundColor: undefined, fontSize: 40, fontFamily: 'Noto Sans KR' } },
  { id: 'minimal', name: '미니멀', category: '감성', settings: { textColor: '#FFFFFF', strokeColor: '#333333', strokeWidth: 1, backgroundColor: undefined, fontSize: 38, fontFamily: 'Noto Sans KR' } },
  { id: 'movie', name: '영화', category: '감성', settings: { textColor: '#F5F5F5', strokeColor: '#000000', strokeWidth: 1, backgroundColor: undefined, fontSize: 36, yPosition: 650, fontFamily: 'Noto Serif KR' } },
  { id: 'soft-box', name: '부드러운 박스', category: '감성', settings: { textColor: '#FFFFFF', backgroundColor: '#000000', bgOpacity: 0.5, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 10, fontSize: 40, fontFamily: 'Noto Sans KR' } },
  { id: 'elegant', name: '우아한', category: '감성', settings: { textColor: '#FFFFFF', strokeColor: '#555555', strokeWidth: 2, backgroundColor: undefined, fontSize: 42, fontFamily: 'Noto Serif KR' } },
];

export default function SubtitleTemplateModal({ current, onApply, onClose }: SubtitleTemplateModalProps) {
  const [selected, setSelected] = useState<SubtitleSettings>(current);
  const [category, setCategory] = useState<string>('전체');
  const [previewBg, setPreviewBg] = useState<string>('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [savedPresets, setSavedPresets] = useState<Array<{ name: string; settings: Partial<SubtitleSettings> }>>([]);

  // Load saved presets from localStorage
  useEffect(() => {
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
    console.log('템플릿 적용:', template.name, template.settings);

    // 기본값 설정
    const baseSettings: SubtitleSettings = {
      fontSize: 48,
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

    // 템플릿 설정을 우선 적용
    const newSettings = { ...baseSettings, ...template.settings };
    console.log('적용된 설정:', newSettings);
    setSelected(newSettings);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.target.files?.[0];

    if (!file) {
      console.log('파일 없음');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      e.target.value = '';
      return;
    }

    console.log('파일 선택됨:', file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result && typeof result === 'string') {
        console.log('이미지 로드 완료, 길이:', result.length);
        setPreviewBg(result);
      }
    };
    reader.onerror = () => {
      console.error('이미지 로드 실패');
      alert('이미지 로드 실패');
    };
    reader.readAsDataURL(file);

    setShowContextMenu(false);
  };

  const categories = ['전체', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];
  const filteredTemplates = category === '전체' ? TEMPLATES : TEMPLATES.filter(t => t.category === category);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4" onClick={() => setShowContextMenu(false)}>
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">자막 템플릿</h2>
        </div>

        {/* 미리보기 - 상단 고정 */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div
            className="bg-slate-900 rounded-lg p-6 flex items-center justify-center relative cursor-context-menu group"
            style={{
              height: '160px',
              backgroundImage: previewBg ? `url(${previewBg})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
            onContextMenu={handleContextMenu}
          >
            {/* 호버 시 이미지 업로드 버튼 */}
            <label className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <div className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <div className="relative inline-block">
              {selected.backgroundColor && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: selected.backgroundColor,
                    opacity: selected.bgOpacity || 0.8,
                    borderRadius: '8px',
                    margin: `-${selected.bgPadding || 0}px`,
                  }}
                />
              )}
              <p
                className="relative z-10"
                style={{
                  fontFamily: selected.fontFamily,
                  fontSize: `${Math.min(selected.fontSize, 48)}px`,
                  color: selected.textColor,
                  WebkitTextStroke: selected.strokeWidth > 0 && selected.strokeColor && selected.strokeColor !== 'transparent'
                    ? `${selected.strokeWidth}px ${selected.strokeColor}`
                    : undefined,
                  paintOrder: 'stroke fill',
                  textShadow: selected.strokeWidth > 0 && selected.strokeColor && selected.strokeColor !== 'transparent'
                    ? `0 0 ${selected.strokeWidth * 2}px ${selected.strokeColor}`
                    : undefined,
                }}
              >
                자막 미리보기
              </p>
            </div>
          </div>
        </div>

        {/* 우클릭 메뉴 */}
        {showContextMenu && (
          <div
            className="fixed z-[60] bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 py-1 min-w-[180px]"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <label className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
              📷 배경 이미지 업로드
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {previewBg && (
              <button
                onClick={() => { setPreviewBg(''); setShowContextMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                🗑️ 배경 제거
              </button>
            )}
          </div>
        )}

        {/* Content - 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 카테고리 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 저장된 설정 */}
          {savedPresets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">⭐ 내가 저장한 설정</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {savedPresets.map((preset, index) => (
                  <button
                    key={`preset-${index}`}
                    onClick={() => applyTemplate({ id: `saved-${index}`, name: preset.name, category: '저장됨', settings: preset.settings })}
                    className="p-3 bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-400 dark:border-indigo-600 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all"
                  >
                    <div className="text-center space-y-1">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{preset.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 템플릿 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {filteredTemplates.map((tmpl) => {
              const hasBg = !!tmpl.settings.backgroundColor;
              const hasStroke = tmpl.settings.strokeWidth && tmpl.settings.strokeWidth > 0 && tmpl.settings.strokeColor !== 'transparent';
              // 외곽선 두께 비율 유지 (원본의 1/3 정도)
              const strokeW = hasStroke ? Math.max(1, Math.round((tmpl.settings.strokeWidth || 0) / 3)) : 0;

              return (
                <button
                  key={tmpl.id}
                  onClick={() => applyTemplate(tmpl)}
                  className="bg-slate-900 rounded-lg p-2 hover:ring-2 hover:ring-blue-500 transition-all flex flex-col gap-1.5"
                >
                  {/* 미리보기 영역 */}
                  <div className="h-10 flex items-center justify-center overflow-visible">
                    <span
                      style={{
                        fontFamily: `"${tmpl.settings.fontFamily || 'Noto Sans KR'}", sans-serif`,
                        fontSize: '15px',
                        fontWeight: 'bold',
                        color: tmpl.settings.textColor,
                        backgroundColor: hasBg ? tmpl.settings.backgroundColor : undefined,
                        padding: hasBg ? '4px 8px' : undefined,
                        borderRadius: hasBg ? '4px' : undefined,
                        opacity: hasBg ? (tmpl.settings.bgOpacity || 0.8) : 1,
                        WebkitTextStroke: hasStroke ? `${strokeW}px ${tmpl.settings.strokeColor}` : undefined,
                        paintOrder: 'stroke fill',
                        textShadow: hasStroke ? `0 0 ${strokeW}px ${tmpl.settings.strokeColor}` : undefined,
                      }}
                    >
                      가나다
                    </span>
                  </div>
                  {/* 템플릿 이름 */}
                  <p className="text-[10px] text-slate-500 text-center truncate leading-tight">{tmpl.name}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onApply(selected)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
