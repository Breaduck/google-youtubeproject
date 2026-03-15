import React, { useEffect } from 'react';
import { StyleTemplate } from '../types/template';
import StyleTemplateSelector from './StyleTemplateSelector';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedTemplate: StyleTemplate | null;
  onSelectTemplate: (template: StyleTemplate) => void;
  onApply: () => void;
}

export default function StyleTemplateModal({ isOpen, onClose, selectedTemplate, onSelectTemplate, onApply }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#16213e] rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl animate-in slide-in-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">스타일 템플릿</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 text-slate-400 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)] custom-scrollbar">
          <StyleTemplateSelector
            selectedTemplate={selectedTemplate}
            onSelectTemplate={onSelectTemplate}
          />
        </div>

        {/* 하단 */}
        <div className="p-6 border-t border-slate-700 flex items-center justify-between bg-[#1a1a2e]">
          <div className="text-sm text-gray-400">
            {selectedTemplate ? (
              <span>선택됨: <span className="text-purple-400 font-medium">{selectedTemplate.name}</span></span>
            ) : (
              <span>템플릿을 선택하세요</span>
            )}
          </div>
          <button
            onClick={onApply}
            disabled={!selectedTemplate}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            적용하기
          </button>
        </div>
      </div>
    </div>
  );
}
