import { useState, useEffect } from 'react';
import { SubtitleStyle, DEFAULT_SUBTITLE_STYLE } from '../../types/subtitle';
import StyleTab from './StyleTab';

type MainTab = 'style' | 'effect' | 'title' | 'safe-area' | 'logo';

interface SubtitleEditorProps {
  initialStyle?: SubtitleStyle;
  onStyleChange?: (style: SubtitleStyle) => void;
  onClose?: () => void;
}

export default function SubtitleEditor({ initialStyle, onStyleChange, onClose }: SubtitleEditorProps) {
  const [activeTab, setActiveTab] = useState<MainTab>('style');
  const [currentStyle, setCurrentStyle] = useState<SubtitleStyle>(
    initialStyle || DEFAULT_SUBTITLE_STYLE
  );

  useEffect(() => {
    onStyleChange?.(currentStyle);
  }, [currentStyle, onStyleChange]);

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'style', label: '스타일' },
    { id: 'effect', label: '효과' },
    { id: 'title', label: '제목' },
    { id: 'safe-area', label: '안전영역' },
    { id: 'logo', label: '로고' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">자막 편집</h1>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
            >
              닫기
            </button>
          )}
        </div>

        {/* Main Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-all ${
                  activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="h-[calc(100vh-140px)] overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {activeTab === 'style' && (
            <StyleTab currentStyle={currentStyle} onStyleChange={setCurrentStyle} />
          )}
          {activeTab === 'effect' && (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
              효과 탭 (개발 예정)
            </div>
          )}
          {activeTab === 'title' && (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
              제목 탭 (개발 예정)
            </div>
          )}
          {activeTab === 'safe-area' && (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
              안전영역 탭 (개발 예정)
            </div>
          )}
          {activeTab === 'logo' && (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
              로고 탭 (개발 예정)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
