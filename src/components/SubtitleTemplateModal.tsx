import { useState } from 'react';
import { SubtitleSettings } from '../types';

interface SubtitleTemplateModalProps {
  current: SubtitleSettings;
  onApply: (settings: SubtitleSettings) => void;
  onClose: () => void;
}

export const TEMPLATES: { id: string; name: string; category: string; settings: Partial<SubtitleSettings> }[] = [
  // 쇼츠 전용 (7개) - 세로형 최적화
  { id: 'shorts-impact', name: '쇼츠 임팩트', category: '쇼츠', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 10, fontSize: 72, backgroundColor: undefined, fontFamily: 'Black Han Sans' } },
  { id: 'shorts-neon', name: '쇼츠 네온', category: '쇼츠', settings: { textColor: '#00FF41', strokeColor: '#000000', strokeWidth: 8, fontSize: 68, backgroundColor: undefined, fontFamily: 'Jua' } },
  { id: 'shorts-yellow', name: '쇼츠 노란색', category: '쇼츠', settings: { textColor: '#FFD700', strokeColor: '#000000', strokeWidth: 9, fontSize: 70, backgroundColor: undefined, fontFamily: 'Do Hyeon' } },
  { id: 'shorts-box', name: '쇼츠 박스', category: '쇼츠', settings: { textColor: '#FFFFFF', backgroundColor: '#000000', bgOpacity: 0.85, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 16, fontSize: 66, fontFamily: 'Black Han Sans' } },
  { id: 'shorts-gradient', name: '쇼츠 그라데', category: '쇼츠', settings: { textColor: '#FFFFFF', backgroundColor: '#FF0080', bgOpacity: 0.9, strokeColor: '#FFFFFF', strokeWidth: 3, bgPadding: 14, fontSize: 64, fontFamily: 'Jua' } },
  { id: 'shorts-shadow', name: '쇼츠 그림자', category: '쇼츠', settings: { textColor: '#FFFFFF', strokeColor: '#FF0000', strokeWidth: 6, fontSize: 68, backgroundColor: undefined, fontFamily: 'Black Han Sans' } },
  { id: 'shorts-double', name: '쇼츠 이중선', category: '쇼츠', settings: { textColor: '#FFFF00', strokeColor: '#FF00FF', strokeWidth: 7, fontSize: 66, backgroundColor: undefined, fontFamily: 'Do Hyeon' } },

  // 기본 (5개)
  { id: 'white-clean', name: '깔끔한 흰색', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3, backgroundColor: undefined, fontSize: 50, fontFamily: 'Noto Sans KR' } },
  { id: 'black-box', name: '검정 박스', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#000000', bgOpacity: 0.8, bgPadding: 14, fontSize: 48, fontFamily: 'Noto Sans KR' } },
  { id: 'semi-transparent', name: '반투명 회색', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#1a1a1a', bgOpacity: 0.7, bgPadding: 12, fontSize: 46, fontFamily: 'Noto Sans KR' } },
  { id: 'yellow-bold', name: '노란색 볼드', category: '기본', settings: { textColor: '#FFD700', strokeColor: '#000000', strokeWidth: 5, backgroundColor: undefined, fontSize: 52, fontFamily: 'Black Han Sans' } },
  { id: 'white-shadow', name: '흰색 그림자', category: '기본', settings: { textColor: '#FFFFFF', strokeColor: '#0066FF', strokeWidth: 4, backgroundColor: undefined, fontSize: 50, fontFamily: 'Do Hyeon' } },

  // 인기 유튜버 스타일 (8개) - 실제 자주 쓰이는 스타일
  { id: 'popular-news', name: '뉴스/리뷰', category: '인기', settings: { textColor: '#FFFFFF', backgroundColor: '#2563EB', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 16, fontSize: 46, fontFamily: 'Noto Sans KR' } },
  { id: 'popular-gaming', name: '게임 실황', category: '인기', settings: { textColor: '#00FF00', strokeColor: '#000000', strokeWidth: 6, fontSize: 54, backgroundColor: undefined, fontFamily: 'Nanum Gothic Coding' } },
  { id: 'popular-vlog', name: '일상 브이로그', category: '인기', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2, fontSize: 42, backgroundColor: undefined, opacity: 0.95, fontFamily: 'Noto Sans KR' } },
  { id: 'popular-mukbang', name: '먹방', category: '인기', settings: { textColor: '#FFD700', strokeColor: '#FF0000', strokeWidth: 5, fontSize: 56, backgroundColor: undefined, fontFamily: 'Jua' } },
  { id: 'popular-tutorial', name: '강의/설명', category: '인기', settings: { textColor: '#1F2937', backgroundColor: '#FFFFFF', bgOpacity: 0.95, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 18, fontSize: 44, fontFamily: 'Noto Sans KR' } },
  { id: 'popular-reaction', name: '리액션', category: '인기', settings: { textColor: '#FF1493', strokeColor: '#FFFFFF', strokeWidth: 6, fontSize: 58, backgroundColor: undefined, fontFamily: 'Black Han Sans' } },
  { id: 'popular-asmr', name: 'ASMR', category: '인기', settings: { textColor: '#E8E8E8', strokeColor: 'transparent', strokeWidth: 0, fontSize: 36, backgroundColor: undefined, opacity: 0.85, fontFamily: 'Noto Serif KR' } },
  { id: 'popular-challenge', name: '챌린지', category: '인기', settings: { textColor: '#FFFFFF', backgroundColor: '#FF0000', bgOpacity: 0.9, strokeColor: '#FFFF00', strokeWidth: 3, bgPadding: 14, fontSize: 54, fontFamily: 'Black Han Sans' } },

  // 컬러풀 (6개)
  { id: 'red-pop', name: '빨강 팝', category: '컬러', settings: { textColor: '#FF0000', strokeColor: '#FFFFFF', strokeWidth: 5, fontSize: 58, backgroundColor: undefined, fontFamily: 'Black Han Sans' } },
  { id: 'pink-cute', name: '핑크 큐트', category: '컬러', settings: { textColor: '#FF69B4', strokeColor: '#8B008B', strokeWidth: 4, fontSize: 52, backgroundColor: undefined, fontFamily: 'Jua' } },
  { id: 'neon-green', name: '네온 그린', category: '컬러', settings: { textColor: '#39FF14', strokeColor: '#000000', strokeWidth: 4, fontSize: 50, backgroundColor: undefined, fontFamily: 'Do Hyeon' } },
  { id: 'mint-fresh', name: '민트 프레시', category: '컬러', settings: { textColor: '#00FFA3', strokeColor: '#006644', strokeWidth: 3, fontSize: 48, backgroundColor: undefined, fontFamily: 'Noto Sans KR' } },
  { id: 'purple-royal', name: '로얄 퍼플', category: '컬러', settings: { textColor: '#9370DB', strokeColor: '#4B0082', strokeWidth: 4, fontSize: 52, backgroundColor: undefined, fontFamily: 'Gothic A1' } },
  { id: 'orange-energy', name: '오렌지 에너지', category: '컬러', settings: { textColor: '#FF6B00', strokeColor: '#FFFFFF', strokeWidth: 5, fontSize: 54, backgroundColor: undefined, fontFamily: 'Black Han Sans' } },

  // 프리미엄 (5개)
  { id: 'gold-luxury', name: '골드 럭셔리', category: '프리미엄', settings: { textColor: '#FFD700', strokeColor: '#8B4513', strokeWidth: 4, fontSize: 60, backgroundColor: undefined, fontFamily: 'Noto Serif KR' } },
  { id: 'silver-shine', name: '실버 샤인', category: '프리미엄', settings: { textColor: '#C0C0C0', strokeColor: '#000000', strokeWidth: 3, fontSize: 56, backgroundColor: undefined, fontFamily: 'Gothic A1' } },
  { id: 'rose-gold', name: '로즈 골드', category: '프리미엄', settings: { textColor: '#E0BFB8', strokeColor: '#8B4513', strokeWidth: 3, fontSize: 54, backgroundColor: undefined, fontFamily: 'Noto Serif KR' } },
  { id: 'neon-sign', name: '네온 사인', category: '프리미엄', settings: { textColor: '#FF1493', strokeColor: '#FF69B4', strokeWidth: 2, fontSize: 52, backgroundColor: undefined, opacity: 0.95, fontFamily: 'Jua' } },
  { id: 'gradient-box', name: '그라데이션', category: '프리미엄', settings: { textColor: '#FFFFFF', backgroundColor: '#8B00FF', bgOpacity: 0.85, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 14, fontSize: 50, fontFamily: 'Black Han Sans' } },

  // 미니멀 (4개)
  { id: 'thin-outline', name: '얇은 외곽선', category: '미니멀', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 1, fontSize: 42, backgroundColor: undefined, fontFamily: 'Noto Sans KR' } },
  { id: 'thick-bold', name: '두꺼운 볼드', category: '미니멀', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 7, fontSize: 58, backgroundColor: undefined, fontFamily: 'Black Han Sans' } },
  { id: 'transparent-light', name: '투명 배경', category: '미니멀', settings: { textColor: '#FFFFFF', backgroundColor: '#000000', bgOpacity: 0.5, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 10, fontSize: 40, fontFamily: 'Noto Sans KR' } },
  { id: 'bottom-bar', name: '하단 바', category: '미니멀', settings: { textColor: '#FFFFFF', backgroundColor: '#1a1a1a', bgOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 18, fontSize: 44, yPosition: 680, fontFamily: 'Noto Sans KR' } },

  // 감성/시네마틱 (4개)
  { id: 'movie-subtitle', name: '영화 자막', category: '감성', settings: { textColor: '#F5F5F5', strokeColor: '#000000', strokeWidth: 1, fontSize: 38, backgroundColor: undefined, yPosition: 650, fontFamily: 'Noto Serif KR' } },
  { id: 'documentary', name: '다큐멘터리', category: '감성', settings: { textColor: '#E8E8E8', backgroundColor: '#000000', bgOpacity: 0.6, strokeColor: 'transparent', strokeWidth: 0, bgPadding: 8, fontSize: 40, fontFamily: 'Noto Sans KR' } },
  { id: 'drama-style', name: '드라마틱', category: '감성', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3, fontSize: 46, backgroundColor: undefined, opacity: 0.95, fontFamily: 'Noto Serif KR' } },
  { id: 'asmr-soft', name: 'ASMR 소프트', category: '감성', settings: { textColor: '#F0F0F0', strokeColor: 'transparent', strokeWidth: 0, fontSize: 34, backgroundColor: undefined, opacity: 0.85, fontFamily: 'Noto Serif KR' } },
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
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">자막 템플릿</h2>
        </div>

        {/* 미리보기 - 상단 고정 */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div className="bg-slate-900 rounded-lg p-6 flex items-center justify-center" style={{ height: '160px' }}>
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
        </div>

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
