import { useState } from 'react';
import { SubtitleSettings } from '../types';

interface SubtitleTemplateModalProps {
  current: SubtitleSettings;
  onApply: (settings: SubtitleSettings) => void;
  onClose: () => void;
}

const TEMPLATES: { id: string; name: string; settings: Partial<SubtitleSettings> }[] = [
  { id: 'white', name: '흰색 + 검은 외곽선', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2, backgroundColor: undefined } },
  { id: 'black-bg', name: '검정 배경', settings: { textColor: '#FFFFFF', strokeColor: 'transparent', strokeWidth: 0, backgroundColor: '#000000', bgOpacity: 0.8 } },
  { id: 'yellow', name: '노란 자막', settings: { textColor: '#FFD700', strokeColor: '#000000', strokeWidth: 3, backgroundColor: undefined } },
  { id: 'youtube', name: '유튜브', settings: { textColor: '#FFFFFF', backgroundColor: '#000000', bgOpacity: 0.7, strokeColor: 'transparent', strokeWidth: 0 } },
  { id: 'shorts', name: '유튜브 쇼츠', settings: { textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 8, fontSize: 64, backgroundColor: undefined } },
  { id: 'neon', name: '네온 그린', settings: { textColor: '#39FF14', strokeColor: '#FFFFFF', strokeWidth: 3, backgroundColor: undefined } },
  { id: 'pink', name: '핑크', settings: { textColor: '#FF69B4', strokeColor: '#8B008B', strokeWidth: 3, backgroundColor: undefined } },
  { id: 'netflix', name: '넷플릭스', settings: { textColor: '#FFFFFF', backgroundColor: '#000000', bgOpacity: 0.85, strokeColor: 'transparent', strokeWidth: 0 } },
  { id: 'red', name: '빨강 강조', settings: { textColor: '#FF0000', strokeColor: '#FFFFFF', strokeWidth: 4, fontSize: 62, backgroundColor: undefined } },
  { id: 'gold', name: '골드', settings: { textColor: '#FFD700', strokeColor: '#8B4513', strokeWidth: 3, fontSize: 60, backgroundColor: undefined } },
];

export default function SubtitleTemplateModal({ current, onApply, onClose }: SubtitleTemplateModalProps) {
  const [selected, setSelected] = useState<SubtitleSettings>(current);

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setSelected({ ...current, ...template.settings });
  };

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

          {/* 템플릿 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {TEMPLATES.map((tmpl) => (
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
