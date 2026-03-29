import React, { useState } from 'react';
import { StyleTemplate, TemplateCategory } from '../types/template';
import { SavedStyle } from '../types';
import { styleTemplates, templateCategories } from '../data/styleTemplates';

interface Props {
  selectedTemplate: StyleTemplate | null;
  onSelectTemplate: (template: StyleTemplate) => void;
  savedStyles?: SavedStyle[];
  onAddTemplate?: () => void;
}

export default function StyleTemplateSelector({ selectedTemplate, onSelectTemplate, savedStyles = [], onAddTemplate }: Props) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | '내 그림체' | '나만의 템플릿' | '즐겨찾기'>('애니메이션');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  // SavedStyle을 StyleTemplate 형식으로 변환
  const savedStyleTemplates: StyleTemplate[] = savedStyles.map(s => ({
    id: s.id,
    category: '내 그림체' as TemplateCategory,
    name: s.name,
    thumbnail: s.refImages[0] || '/templates/default.webp',
    imagePromptPrefix: s.description,
    negativePrompt: ''
  }));

  const filteredTemplates = activeCategory === '내 그림체'
    ? savedStyleTemplates
    : activeCategory === '나만의 템플릿'
    ? savedStyleTemplates
    : activeCategory === '즐겨찾기'
    ? [...savedStyleTemplates, ...styleTemplates].filter(t => favorites.includes(t.id))
    : styleTemplates.filter(t => t.category === activeCategory);

  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white">스타일 템플릿</h2>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {savedStyles.length > 0 && (
          <button
            onClick={() => setActiveCategory('내 그림체')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === '내 그림체'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            💾 내 그림체 ({savedStyles.length})
          </button>
        )}
        {templateCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm'
            }`}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => setActiveCategory('나만의 템플릿')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
            activeCategory === '나만의 템플릿'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm'
          }`}
        >
          나만의 템플릿
        </button>
        <button
          onClick={() => setActiveCategory('즐겨찾기')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
            activeCategory === '즐겨찾기'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm'
          }`}
        >
          ⭐ 즐겨찾기 ({favorites.length})
        </button>
      </div>

      {/* 나만의 템플릿 빈 상태 */}
      {activeCategory === '나만의 템플릿' && filteredTemplates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl">
          <button
            onClick={() => onAddTemplate?.()}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-all shadow-sm flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            나만의 템플릿 추가하기
          </button>
          <p className="text-sm text-slate-400 mt-3">첫 번째 템플릿을 추가해보세요</p>
        </div>
      )}

      {/* 템플릿 카드 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[800px] overflow-y-auto">
        {filteredTemplates.map((template) => {
          const isFavorite = favorites.includes(template.id);
          const isSelected = selectedTemplate?.id === template.id;
          return (
            <div key={template.id} className="relative group/card">
              <button
                onClick={() => onSelectTemplate(template)}
                className="w-full relative rounded-lg overflow-hidden transition-all hover:scale-103 hover:shadow-lg"
              >
                {/* 우측 상단 버튼들 */}
                <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFavorites(prev =>
                        isFavorite ? prev.filter(id => id !== template.id) : [...prev, template.id]
                      );
                    }}
                    className="w-7 h-7 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 transition-all"
                    title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
                  >
                    <svg className={`w-4 h-4 ${isFavorite ? 'text-yellow-500 fill-current' : 'text-slate-600 dark:text-slate-300'}`} fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedImage(template.thumbnail);
                    }}
                    className="w-7 h-7 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 transition-all"
                    title="전체화면"
                  >
                    <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                    </svg>
                  </button>
                </div>

                {/* 썸네일 이미지 */}
                <div className={`aspect-video relative ${isSelected ? 'blur-sm' : ''}`}>
                <img
                  src={template.thumbnail}
                  alt={template.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // 이미지 로드 실패 시 그라데이션 배경 표시
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.classList.add('bg-gradient-to-br', 'from-purple-900', 'via-blue-900', 'to-indigo-900', 'flex', 'items-center', 'justify-center', 'p-4');
                  }}
                />
                <div className="absolute inset-0 bg-black/20 pointer-events-none" />
              </div>

              {/* 하단 텍스트 오버레이 */}
              <div className={`absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 ${isSelected ? 'blur-sm' : ''}`}>
                <p className="text-white text-xs font-medium truncate">{template.name}</p>
              </div>

              {/* 선택 체크 아이콘 */}
              {isSelected && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl z-10">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              </button>
            </div>
          );
        })}
      </div>

      {selectedTemplate && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          선택됨: <span className="text-indigo-600 dark:text-indigo-400">{selectedTemplate.name}</span>
        </p>
      )}

      {/* 확대 이미지 모달 */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[400] flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded view"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
