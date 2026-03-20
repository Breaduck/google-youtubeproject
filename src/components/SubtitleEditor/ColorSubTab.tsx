import { SubtitleStyle } from '../../types/subtitle';

interface ColorSubTabProps {
  currentStyle: SubtitleStyle;
  onStyleChange: (style: SubtitleStyle) => void;
}

export default function ColorSubTab({ currentStyle, onStyleChange }: ColorSubTabProps) {
  const updateStyle = (updates: Partial<SubtitleStyle>) => {
    onStyleChange({ ...currentStyle, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* 글자 색상 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          글자 색상
        </label>
        <div className="flex gap-3">
          <input
            type="color"
            value={currentStyle.color}
            onChange={(e) => updateStyle({ color: e.target.value })}
            className="w-16 h-10 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
          />
          <input
            type="text"
            value={currentStyle.color}
            onChange={(e) => updateStyle({ color: e.target.value })}
            placeholder="#FFFFFF"
            className="flex-1 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 글자 외곽선 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            글자 외곽선 (Stroke)
          </label>
          <button
            onClick={() =>
              updateStyle({ stroke: { ...currentStyle.stroke, enabled: !currentStyle.stroke.enabled } })
            }
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              currentStyle.stroke.enabled
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {currentStyle.stroke.enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {currentStyle.stroke.enabled && (
          <>
            <div className="flex gap-3">
              <input
                type="color"
                value={currentStyle.stroke.color}
                onChange={(e) =>
                  updateStyle({ stroke: { ...currentStyle.stroke, color: e.target.value } })
                }
                className="w-16 h-10 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <input
                type="text"
                value={currentStyle.stroke.color}
                onChange={(e) =>
                  updateStyle({ stroke: { ...currentStyle.stroke, color: e.target.value } })
                }
                placeholder="#000000"
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">두께</span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {currentStyle.stroke.width}px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={currentStyle.stroke.width}
                onChange={(e) =>
                  updateStyle({ stroke: { ...currentStyle.stroke, width: parseInt(e.target.value) } })
                }
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </>
        )}
      </div>

      {/* 글자 그림자 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            글자 그림자 (Shadow)
          </label>
          <button
            onClick={() =>
              updateStyle({ shadow: { ...currentStyle.shadow, enabled: !currentStyle.shadow.enabled } })
            }
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              currentStyle.shadow.enabled
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {currentStyle.shadow.enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {currentStyle.shadow.enabled && (
          <>
            <div className="flex gap-3">
              <input
                type="color"
                value={currentStyle.shadow.color}
                onChange={(e) =>
                  updateStyle({ shadow: { ...currentStyle.shadow, color: e.target.value } })
                }
                className="w-16 h-10 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <input
                type="text"
                value={currentStyle.shadow.color}
                onChange={(e) =>
                  updateStyle({ shadow: { ...currentStyle.shadow, color: e.target.value } })
                }
                placeholder="#000000"
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">X: {currentStyle.shadow.x}px</span>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={currentStyle.shadow.x}
                  onChange={(e) =>
                    updateStyle({ shadow: { ...currentStyle.shadow, x: parseInt(e.target.value) } })
                  }
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">Y: {currentStyle.shadow.y}px</span>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={currentStyle.shadow.y}
                  onChange={(e) =>
                    updateStyle({ shadow: { ...currentStyle.shadow, y: parseInt(e.target.value) } })
                  }
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Blur: {currentStyle.shadow.blur}px
                </span>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={currentStyle.shadow.blur}
                  onChange={(e) =>
                    updateStyle({ shadow: { ...currentStyle.shadow, blur: parseInt(e.target.value) } })
                  }
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 배경 박스 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            배경 박스
          </label>
          <button
            onClick={() =>
              updateStyle({
                background: { ...currentStyle.background, enabled: !currentStyle.background.enabled },
              })
            }
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              currentStyle.background.enabled
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {currentStyle.background.enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {currentStyle.background.enabled && (
          <>
            <div className="flex gap-3">
              <input
                type="color"
                value={currentStyle.background.color}
                onChange={(e) =>
                  updateStyle({ background: { ...currentStyle.background, color: e.target.value } })
                }
                className="w-16 h-10 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <input
                type="text"
                value={currentStyle.background.color}
                onChange={(e) =>
                  updateStyle({ background: { ...currentStyle.background, color: e.target.value } })
                }
                placeholder="#000000"
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  투명도: {Math.round(currentStyle.background.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={currentStyle.background.opacity * 100}
                  onChange={(e) =>
                    updateStyle({
                      background: { ...currentStyle.background, opacity: parseInt(e.target.value) / 100 },
                    })
                  }
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  라운드: {currentStyle.background.borderRadius}px
                </span>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={currentStyle.background.borderRadius}
                  onChange={(e) =>
                    updateStyle({
                      background: { ...currentStyle.background, borderRadius: parseInt(e.target.value) },
                    })
                  }
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 미리보기 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          미리보기
        </label>
        <div className="bg-slate-800 dark:bg-slate-900 rounded-lg p-8 flex items-center justify-center min-h-[120px]">
          <div className="relative inline-block">
            {currentStyle.background.enabled && (
              <div
                className="absolute inset-0 -m-3"
                style={{
                  backgroundColor: currentStyle.background.color,
                  opacity: currentStyle.background.opacity,
                  borderRadius: `${currentStyle.background.borderRadius}px`,
                  padding: `${currentStyle.background.padding}px`,
                }}
              />
            )}
            <p
              className="relative"
              style={{
                fontFamily: currentStyle.fontFamily,
                fontSize: `${currentStyle.fontSize}px`,
                color: currentStyle.color,
                WebkitTextStroke: currentStyle.stroke.enabled
                  ? `${currentStyle.stroke.width}px ${currentStyle.stroke.color}`
                  : undefined,
                textShadow: currentStyle.shadow.enabled
                  ? `${currentStyle.shadow.x}px ${currentStyle.shadow.y}px ${currentStyle.shadow.blur}px ${currentStyle.shadow.color}`
                  : undefined,
              }}
            >
              자막 미리보기
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
