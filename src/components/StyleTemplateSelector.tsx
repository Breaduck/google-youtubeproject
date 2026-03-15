import React, { useState } from 'react';
import { StyleTemplate, TemplateCategory } from '../types/template';
import { styleTemplates, templateCategories } from '../data/styleTemplates';

interface Props {
  selectedTemplate: StyleTemplate | null;
  onSelectTemplate: (template: StyleTemplate) => void;
}

export default function StyleTemplateSelector({ selectedTemplate, onSelectTemplate }: Props) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('애니메이션');

  const filteredTemplates = styleTemplates.filter(t => t.category === activeCategory);

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">스타일 템플릿</h2>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {templateCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-purple-600 text-white'
                : 'bg-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 템플릿 카드 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {filteredTemplates.map((template) => {
          const isSelected = selectedTemplate?.id === template.id;
          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className={`relative group rounded-lg overflow-hidden transition-all hover:scale-103 hover:shadow-lg ${
                isSelected ? 'ring-2 ring-purple-600' : ''
              }`}
            >
              {/* Placeholder 썸네일 (그라데이션) */}
              <div className={`aspect-video bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 ${isSelected ? 'blur-sm' : ''}`}>
                <p className="text-white text-xs font-medium text-center">{template.name}</p>
              </div>

              {/* 하단 텍스트 오버레이 */}
              <div className={`absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 ${isSelected ? 'blur-sm' : ''}`}>
                <p className="text-white text-xs font-medium truncate">{template.name}</p>
              </div>

              {/* 선택 체크 아이콘 */}
              {isSelected && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center shadow-2xl z-10">
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
        <p className="text-sm text-gray-400">
          선택됨: <span className="text-purple-400">{selectedTemplate.name}</span>
        </p>
      )}
    </div>
  );
}
