import React from 'react';

interface VideoGenerationPopupProps {
  videoGenerationRange: number;
  setVideoGenerationRange: (value: number) => void;
  videoProvider: string;
  onClose: () => void;
}

export const VideoGenerationPopup: React.FC<VideoGenerationPopupProps> = ({
  videoGenerationRange,
  setVideoGenerationRange,
  videoProvider,
  onClose,
}) => {
  const costPerScene = videoProvider === 'byteplus' ? 307 :
                      videoProvider === 'evolink' ? 190 :
                      videoProvider === 'runware' ? 195 : 307;

  const numScenes = Math.floor(videoGenerationRange / 10);
  const totalCost = numScenes * costPerScene;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[310] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI 영상 생성 설정</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            설정에서 <span className="font-bold text-indigo-600 dark:text-indigo-400">{numScenes}개</span>의 이미지를 비디오로 만든다고 설정되어있습니다
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              영상 생성할 장면 수 (최대 180장)
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="range"
                min="0"
                max="180"
                value={numScenes}
                onChange={(e) => setVideoGenerationRange(parseInt(e.target.value) * 10)}
                className="flex-1 accent-indigo-600"
              />
              <input
                type="number"
                min="0"
                max="180"
                value={numScenes}
                onChange={(e) => setVideoGenerationRange(Math.max(0, Math.min(180, parseInt(e.target.value) || 0)) * 10)}
                className="w-20 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">장</span>
            </div>
          </div>

          <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
                💰 {numScenes}장 영상화 예정
              </p>
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                ₩{totalCost.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-indigo-600 dark:text-indigo-400">
                1장당 ₩{costPerScene.toLocaleString()} (10초 기준)
              </span>
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
                총 시간: {Math.floor(videoGenerationRange / 60)}분 {videoGenerationRange % 60}초
              </span>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
          >
            취소
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
};
