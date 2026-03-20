import { useState } from 'react';
import { SubtitleStyle } from '../../types/subtitle';
import FontSubTab from './FontSubTab';
import PositionSubTab from './PositionSubTab';
import ColorSubTab from './ColorSubTab';
import TemplateGallery from './TemplateGallery';

type SubTab = 'font' | 'position' | 'color';

interface StyleTabProps {
  currentStyle: SubtitleStyle;
  onStyleChange: (style: SubtitleStyle) => void;
}

export default function StyleTab({ currentStyle, onStyleChange }: StyleTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('font');
  const [lockFont, setLockFont] = useState(false);
  const [lockPosition, setLockPosition] = useState(false);

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'font', label: '폰트' },
    { id: 'position', label: '위치' },
    { id: 'color', label: '색상' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex gap-2">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeSubTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub Tab Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        {activeSubTab === 'font' && (
          <FontSubTab currentStyle={currentStyle} onStyleChange={onStyleChange} />
        )}
        {activeSubTab === 'position' && (
          <PositionSubTab currentStyle={currentStyle} onStyleChange={onStyleChange} />
        )}
        {activeSubTab === 'color' && (
          <ColorSubTab currentStyle={currentStyle} onStyleChange={onStyleChange} />
        )}
      </div>

      {/* Template Gallery */}
      <TemplateGallery
        currentStyle={currentStyle}
        onTemplateSelect={onStyleChange}
        lockFont={lockFont}
        lockPosition={lockPosition}
        onLockFontChange={setLockFont}
        onLockPositionChange={setLockPosition}
      />
    </div>
  );
}
