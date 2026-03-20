import { useState } from 'react';
import { SubtitleSettings } from '../types';

interface SubtitleTemplateModalProps {
  current: SubtitleSettings;
  onApply: (settings: SubtitleSettings) => void;
  onClose: () => void;
}

export const TEMPLATES: { id: string; name: string; category: string; settings: Partial<SubtitleSettings> }[] = [
  // 기본 (5개)
  { id: 'white-clean', name: '깔끔한 흰색', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2, backgroundColor: undefined, fontSize: 48 } },
  { id: 'black-box', name: '검정 박스', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#000000', bgOpacity: 0.75, bgPadding: 12, fontSize: 44 } },
  { id: 'semi-transparent', name: '반투명 회색', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#333333', bgOpacity: 0.6, bgPadding: 10, fontSize: 42 } },
  { id: 'yellow-classic', name: '클래식 노란색', category: '기본', settings: { textColor: '#FFD700', strokeColor: '#000000', strokeWidth: 3, backgroundColor: undefined, fontSize: 46 } },
  { id: 'white-blue-outline', name: '파란 외곽선', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: '#1E90FF', strokeWidth: 3, backgroundColor: undefined, fontSize: 48 } },

  // 유튜브 스타일 (6개)
  { id: 'youtube-standard', name: '유튜브 기본', category: '유튜브', settings: { textColor: '#FFFFFF', backgroundColor: '#000000', bgOpacity: 0.7, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 8, fontSize: 40 } },
  { id: 'shorts-bold', name: '쇼츠 굵은체', category: '유튜브', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 8, fontSize: 68, backgroundColor: undefined } },
  { id: 'vlog-minimal', name: '브이로그', category: '유튜브', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 1, fontSize: 38, backgroundColor: undefined, opacity: 0.95 } },
  { id: 'tutorial', name: '강의/튜토리얼', category: '유튜브', settings: { textColor: '#000000', backgroundColor: '#FFFFFF', bgOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 14, fontSize: 42 } },
  { id: 'youtube-red', name: '유튜브 레드', category: '유튜브', settings: { textColor: '#FFFFFF', backgroundColor: '#FF0000', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 10, fontSize: 44 } },
  { id: 'news-breaking', name: '뉴스 속보', category: '유튜브', settings: { textColor: '#FFFFFF', backgroundColor: '#CC0000', bgOpacity: 1.0, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 12, fontSize: 52 } },

  // 컬러풀 (5개)
  { id: 'red-pop', name: '빨강 팝', category: '컬러', settings: { textColor: '#FF0000', strokeColor: '#FFFFFF', strokeWidth: 4, fontSize: 56, backgroundColor: undefined } },
  { id: 'pink-cute', name: '핑크 큐트', category: '컬러', settings: { textColor: '#FF69B4', strokeColor: '#8B008B', strokeWidth: 3, fontSize: 50, backgroundColor: undefined } },
  { id: 'neon-green', name: '네온 그린', category: '컬러', settings: { textColor: '#39FF14', strokeColor: '#000000', strokeWidth: 2, fontSize: 48, backgroundColor: undefined } },
  { id: 'mint-fresh', name: '민트 프레시', category: '컬러', settings: { textColor: '#00FFA3', strokeColor: '#006644', strokeWidth: 2, fontSize: 46, backgroundColor: undefined } },
  { id: 'purple-royal', name: '로얄 퍼플', category: '컬러', settings: { textColor: '#9370DB', strokeColor: '#4B0082', strokeWidth: 3, fontSize: 50, backgroundColor: undefined } },

  // 프리미엄 (5개)
  { id: 'gold-luxury', name: '골드 럭셔리', category: '프리미엄', settings: { textColor: '#FFD700', strokeColor: '#8B4513', strokeWidth: 3, fontSize: 58, backgroundColor: undefined } },
  { id: 'silver-shine', name: '실버 샤인', category: '프리미엄', settings: { textColor: '#C0C0C0', strokeColor: '#000000', strokeWidth: 2, fontSize: 54, backgroundColor: undefined } },
  { id: 'rose-gold', name: '로즈 골드', category: '프리미엄', settings: { textColor: '#E0BFB8', strokeColor: '#8B4513', strokeWidth: 2, fontSize: 52, backgroundColor: undefined } },
  { id: 'neon-sign', name: '네온 사인', category: '프리미엄', settings: { textColor: '#FF1493', strokeColor: '#FF69B4', strokeWidth: 1, fontSize: 50, backgroundColor: undefined, opacity: 0.95 } },
  { id: 'gradient-box', name: '그라데이션', category: '프리미엄', settings: { textColor: '#FFFFFF', backgroundColor: '#8B00FF', bgOpacity: 0.8, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 12, fontSize: 48 } },

  // 미니멀 (5개)
  { id: 'thin-outline', name: '얇은 외곽선', category: '미니멀', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 1, fontSize: 40, backgroundColor: undefined } },
  { id: 'thick-bold', name: '두꺼운 볼드', category: '미니멀', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 6, fontSize: 56, backgroundColor: undefined } },
  { id: 'transparent-light', name: '투명 배경', category: '미니멀', settings: { textColor: '#FFFFFF', backgroundColor: '#000000', bgOpacity: 0.4, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 8, fontSize: 38 } },
  { id: 'bottom-bar', name: '하단 바', category: '미니멀', settings: { textColor: '#FFFFFF', backgroundColor: '#1a1a1a', bgOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 16, fontSize: 40, yPosition: 680 } },
  { id: 'simple-white', name: '심플 화이트', category: '미니멀', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, fontSize: 42, backgroundColor: undefined, opacity: 0.9 } },

  // 감성/시네마틱 (4개)
  { id: 'movie-subtitle', name: '영화 자막', category: '감성', settings: { textColor: '#F5F5F5', strokeColor: '#000000', strokeWidth: 1, fontSize: 36, backgroundColor: undefined, yPosition: 650 } },
  { id: 'documentary', name: '다큐멘터리', category: '감성', settings: { textColor: '#E8E8E8', backgroundColor: '#000000', bgOpacity: 0.5, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 6, fontSize: 38 } },
  { id: 'drama-style', name: '드라마틱', category: '감성', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2, fontSize: 44, backgroundColor: undefined, opacity: 0.95 } },
  { id: 'asmr-soft', name: 'ASMR 소프트', category: '감성', settings: { textColor: '#F0F0F0', strokeColor: 'transparent', strokeWidth: 0, fontSize: 32, backgroundColor: undefined, opacity: 0.85 } },
];

export default function SubtitleTemplateModal({ current, onApply, onClose }: SubtitleTemplateModalProps) {
  const [selected, setSelected] = useState<SubtitleSettings>(current);
  const [category, setCategory] = useState<string>('전체');

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setSelected({ ...current, ...template.settings });
  };

  const categories = ['전체', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];
  const filteredTemplates = category === '전체' ? TEMPLATES : TEMPLATES.filter(t => t.category === category);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">자막 템플릿</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 미리보기 */}
          <div className="bg-slate-900 rounded-lg p-8 flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
            <div className="relative inline-block">
              {selected.backgroundColor && (
                <div
                  className="absolute inset-0 -m-3"
                  style={{
                    backgroundColor: selected.backgroundColor,
                    opacity: selected.bgOpacity,
                    borderRadius: '8px',
                  }}
                />
              )}
              <p
                className="relative"
                style={{
                  fontFamily: selected.fontFamily,
                  fontSize: `${Math.min(selected.fontSize, 48)}px`,
                  color: selected.textColor,
                  WebkitTextStroke: selected.strokeWidth > 0 && selected.strokeColor !== 'transparent'
                    ? `${selected.strokeWidth}px ${selected.strokeColor}`
                    : undefined,
                }}
              >
                자막 미리보기
              </p>
            </div>
          </div>

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

          {/* 템플릿 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {filteredTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => applyTemplate(tmpl)}
                className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center p-3 hover:ring-2 hover:ring-blue-500 transition-all"
              >
                <span
                  className="text-sm font-bold text-center"
                  style={{
                    color: tmpl.settings.textColor,
                    WebkitTextStroke: tmpl.settings.strokeWidth && tmpl.settings.strokeWidth > 0
                      ? `${Math.max(1, tmpl.settings.strokeWidth / 2)}px ${tmpl.settings.strokeColor}`
                      : undefined,
                  }}
                >
                  {tmpl.name}
                </span>
              </button>
            ))}
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
