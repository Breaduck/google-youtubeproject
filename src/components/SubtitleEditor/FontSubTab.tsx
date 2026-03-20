import { SubtitleStyle } from '../../types/subtitle';
import { FONT_OPTIONS } from '../../data/subtitleTemplates';

interface FontSubTabProps {
  currentStyle: SubtitleStyle;
  onStyleChange: (style: SubtitleStyle) => void;
}

export default function FontSubTab({ currentStyle, onStyleChange }: FontSubTabProps) {
  const updateStyle = (updates: Partial<SubtitleStyle>) => {
    onStyleChange({ ...currentStyle, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* 폰트 선택 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          폰트
        </label>
        <select
          value={currentStyle.fontFamily}
          onChange={(e) => updateStyle({ fontFamily: e.target.value })}
          className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      {/* 글자 크기 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            글자 크기
          </label>
          <span className="text-sm text-slate-600 dark:text-slate-400">{currentStyle.fontSize}px</span>
        </div>
        <input
          type="range"
          min="12"
          max="120"
          value={currentStyle.fontSize}
          onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* 자간 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            자간 (Letter Spacing)
          </label>
          <span className="text-sm text-slate-600 dark:text-slate-400">{currentStyle.letterSpacing}px</span>
        </div>
        <input
          type="range"
          min="-10"
          max="20"
          value={currentStyle.letterSpacing}
          onChange={(e) => updateStyle({ letterSpacing: parseInt(e.target.value) })}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* 줄 높이 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            줄 높이 (Line Height)
          </label>
          <span className="text-sm text-slate-600 dark:text-slate-400">{currentStyle.lineHeight.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0.8"
          max="3.0"
          step="0.1"
          value={currentStyle.lineHeight}
          onChange={(e) => updateStyle({ lineHeight: parseFloat(e.target.value) })}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* 미리보기 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          미리보기
        </label>
        <div className="bg-slate-800 dark:bg-slate-900 rounded-lg p-8 flex items-center justify-center min-h-[120px]">
          <p
            style={{
              fontFamily: currentStyle.fontFamily,
              fontSize: `${currentStyle.fontSize}px`,
              letterSpacing: `${currentStyle.letterSpacing}px`,
              lineHeight: currentStyle.lineHeight,
              color: currentStyle.color,
            }}
            className="text-center"
          >
            가나다라마바사 ABCD 1234
          </p>
        </div>
      </div>
    </div>
  );
}
