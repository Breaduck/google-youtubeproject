import React from 'react';
import type { Scene } from '../../types';

interface ExportPopupProps {
  scenes: Scene[];
  previewExportMode: 'full' | 'sample';
  setPreviewExportMode: (mode: 'full' | 'sample') => void;
  sampleDuration: 30 | 60;
  setSampleDuration: (duration: 30 | 60) => void;
  sampleSceneRange: string;
  setSampleSceneRange: (range: string) => void;
  includeSubtitles: boolean;
  setIncludeSubtitles: (include: boolean) => void;
  onExport: (sampleIndices?: number[], sampleDuration?: 30 | 60) => void;
  onClose: () => void;
}

export const ExportPopup: React.FC<ExportPopupProps> = ({
  scenes,
  previewExportMode,
  setPreviewExportMode,
  sampleDuration,
  setSampleDuration,
  sampleSceneRange,
  setSampleSceneRange,
  includeSubtitles,
  setIncludeSubtitles,
  onExport,
  onClose,
}) => {
  const videoCount = scenes.filter(s => s.videoUrl).length;
  const imageCount = scenes.filter(s => s.imageUrl && !s.videoUrl).length;
  const totalScenes = scenes.length;
  const estimatedLength = scenes.reduce((acc, s) => {
    const textLen = s.scriptSegment?.length || 0;
    return acc + Math.max(5, Math.min(12, textLen / 3));
  }, 0);
  const estimatedTime = Math.ceil((videoCount * 3 + imageCount * 8 + totalScenes * 2) / 60);

  const parseSampleRange = (text: string): number[] => {
    if (!text.trim()) return [];
    const result: number[] = [];
    const parts = text.split(',').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('~') || part.includes('-')) {
        const [start, end] = part.split(/[~-]/).map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= totalScenes && !result.includes(i)) result.push(i);
          }
        }
      } else {
        const num = parseInt(part);
        if (!isNaN(num) && num >= 1 && num <= totalScenes && !result.includes(num)) result.push(num);
      }
    }
    return result.sort((a, b) => a - b);
  };

  const sampleIndices = parseSampleRange(sampleSceneRange);
  const isSampleValid = sampleIndices.length >= 3 && sampleIndices.length <= 6;

  const handleExport = () => {
    onClose();
    if (previewExportMode === 'full') {
      onExport();
    } else {
      onExport(sampleIndices, sampleDuration);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">최종 영상 추출</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">전체 영상 또는 예시 영상을 추출합니다</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setPreviewExportMode('full')} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${previewExportMode === 'full' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
              전체 영상
            </button>
            <button onClick={() => setPreviewExportMode('sample')} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${previewExportMode === 'sample' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
              예시 영상 추출
            </button>
          </div>

          {previewExportMode === 'full' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-purple-600">{videoCount}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">AI 비디오</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-blue-600">{imageCount}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">이미지 (줌효과)</div>
                </div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">예상 영상 길이</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{Math.floor(estimatedLength / 60)}분 {Math.round(estimatedLength % 60)}초</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">예상 소요 시간</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">약 {estimatedTime}분</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">총 씬 개수</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{totalScenes}개</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">영상 길이</label>
                  <div className="flex gap-2">
                    <button onClick={() => setSampleDuration(30)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${sampleDuration === 30 ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                      30초
                    </button>
                    <button onClick={() => setSampleDuration(60)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${sampleDuration === 60 ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                      1분
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">씬 번호 (3~6개)</label>
                  <input
                    type="text"
                    value={sampleSceneRange}
                    onChange={(e) => setSampleSceneRange(e.target.value)}
                    placeholder="예: 1~3 또는 1, 5, 8"
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:bg-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700 outline-none"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    {sampleIndices.length > 0
                      ? `선택된 씬: ${sampleIndices.join(', ')}번 (${sampleIndices.length}개)${sampleIndices.length < 3 ? ' - 최소 3개 필요' : sampleIndices.length > 6 ? ' - 최대 6개까지' : ''}`
                      : '쉼표(,)로 구분, 범위는 물결(~) 또는 하이픈(-) 사용'}
                  </p>
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-400">선택한 씬들로 {sampleDuration}초 예시 영상을 빠르게 추출해 미리 확인해보세요.</p>
              </div>
            </>
          )}

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">자막 표시</span>
            </div>
            <button
              onClick={() => setIncludeSubtitles(!includeSubtitles)}
              className={`relative w-12 h-6 rounded-full transition-all ${
                includeSubtitles ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  includeSubtitles ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center">자막과 오디오가 싱크에 맞춰 자동으로 합성됩니다</p>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">취소</button>
          <button
            onClick={handleExport}
            disabled={previewExportMode === 'sample' && !isSampleValid}
            className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {previewExportMode === 'full' ? '추출 시작' : `${sampleDuration}초 예시 추출`}
          </button>
        </div>
      </div>
    </div>
  );
};
