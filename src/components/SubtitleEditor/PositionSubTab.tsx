import { SubtitleStyle } from '../../types/subtitle';

interface PositionSubTabProps {
  currentStyle: SubtitleStyle;
  onStyleChange: (style: SubtitleStyle) => void;
}

export default function PositionSubTab({ currentStyle, onStyleChange }: PositionSubTabProps) {
  const updatePosition = (updates: Partial<SubtitleStyle['position']>) => {
    onStyleChange({
      ...currentStyle,
      position: { ...currentStyle.position, ...updates },
    });
  };

  const presets = [
    { id: 'top-center', label: '상단 중앙', x: 50, y: 15 },
    { id: 'center', label: '중앙', x: 50, y: 50 },
    { id: 'bottom-center', label: '하단 중앙', x: 50, y: 85 },
    { id: 'bottom-left', label: '하단 좌측', x: 15, y: 85 },
    { id: 'bottom-right', label: '하단 우측', x: 85, y: 85 },
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    updatePosition({ x: preset.x, y: preset.y, preset: preset.id as any });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    updatePosition({ x: Math.round(x), y: Math.round(y), preset: 'custom' });
  };

  return (
    <div className="space-y-6">
      {/* 프리셋 버튼 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          프리셋 위치
        </label>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                currentStyle.position.preset === preset.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 시각적 조정 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          클릭하여 위치 조정 (16:9 비율)
        </label>
        <div
          onClick={handleCanvasClick}
          className="relative bg-slate-800 dark:bg-slate-900 rounded-lg overflow-hidden cursor-crosshair"
          style={{ aspectRatio: '16 / 9' }}
        >
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/3 left-0 right-0 h-px bg-slate-400" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-slate-400" />
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-slate-400" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-slate-400" />
          </div>

          {/* Subtitle indicator */}
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${currentStyle.position.x}%`,
              top: `${currentStyle.position.y}%`,
            }}
          >
            <div className="bg-blue-600 rounded-full w-3 h-3 ring-4 ring-blue-400 ring-opacity-50" />
            <div
              className="mt-2 px-3 py-1 bg-white dark:bg-slate-700 rounded text-xs font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap"
              style={{
                fontFamily: currentStyle.fontFamily,
                fontSize: `${Math.max(12, currentStyle.fontSize / 3)}px`,
              }}
            >
              자막 위치
            </div>
          </div>
        </div>
      </div>

      {/* 좌표 직접 입력 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            X 좌표 (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(currentStyle.position.x)}
            onChange={(e) =>
              updatePosition({ x: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })
            }
            className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Y 좌표 (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(currentStyle.position.y)}
            onChange={(e) =>
              updatePosition({ y: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })
            }
            className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
