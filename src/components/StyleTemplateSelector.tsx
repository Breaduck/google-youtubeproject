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
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | '내 그림체'>('애니메이션');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

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
    : styleTemplates.filter(t => t.category === activeCategory);

  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white">스타일 템플릿</h2>
        <button
          onClick={() => onAddTemplate?.()}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          템플릿 추가
        </button>
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
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 템플릿 카드 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[800px] overflow-y-auto">
        {filteredTemplates.map((template) => {
          const isSelected = selectedTemplate?.id === template.id;
          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className="relative group rounded-lg overflow-hidden transition-all hover:scale-103 hover:shadow-lg"
            >
              {/* 썸네일 이미지 */}
              <div
                className={`aspect-video relative ${isSelected ? 'blur-sm' : ''}`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setExpandedImage(template.thumbnail);
                }}
              >
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
