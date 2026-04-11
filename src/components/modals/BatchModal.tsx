import React from 'react';
import type { Scene } from '../../types';

interface BatchModalProps {
  type: 'image' | 'audio' | 'video';
  scenes: Scene[];
  batchRange: { mode: 'all' | 'missing' | 'custom'; start: number; end: number; customText: string };
  setBatchRange: React.Dispatch<React.SetStateAction<{ mode: 'all' | 'missing' | 'custom'; start: number; end: number; customText: string }>>;
  videoProvider: string;
  onClose: () => void;
  onGenerate: (type: 'image' | 'audio' | 'video', indices: number[] | null) => void;
}

export const BatchModal: React.FC<BatchModalProps> = ({
  type,
  scenes,
  batchRange,
  setBatchRange,
  videoProvider,
  onClose,
  onGenerate,
}) => {
  const missingIdx = type === 'image'
    ? scenes.map((s, i) => !s.imageUrl ? i + 1 : 0).filter(Boolean)
    : type === 'audio'
    ? scenes.map((s, i) => !s.audioUrl ? i + 1 : 0).filter(Boolean)
    : scenes.map((s, i) => s.imageUrl && !s.videoUrl ? i + 1 : 0).filter(Boolean);

  const parseRangeText = (text: string): number[] => {
    if (!text.trim()) return [];
    const result: number[] = [];
    const parts = text.split(',').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('~') || part.includes('-')) {
        const [start, end] = part.split(/[~-]/).map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= scenes.length && !result.includes(i)) result.push(i);
          }
        }
      } else {
        const num = parseInt(part);
        if (!isNaN(num) && num >= 1 && num <= scenes.length && !result.includes(num)) result.push(num);
      }
    }
    return result.sort((a, b) => a - b);
  };

  const customIndices = parseRangeText(batchRange.customText);
  const targetScenes = batchRange.mode === 'all'
    ? scenes
    : batchRange.mode === 'missing'
    ? scenes.filter((_, i) => missingIdx.includes(i + 1))
    : scenes.filter((_, i) => customIndices.includes(i + 1));

  const cost = type === 'image'
    ? targetScenes.length * 29
    : type === 'audio'
    ? 0
    : targetScenes.length * (videoProvider === 'byteplus' ? 307 : videoProvider === 'evolink' ? 190 : 195);

  const title = type === 'image' ? '이미지 생성' : type === 'audio' ? '오디오 생성' : 'AI 영상 생성';

  const handleGenerate = () => {
    const indices = batchRange.mode === 'all'
      ? null
      : batchRange.mode === 'missing'
      ? missingIdx
      : customIndices;
    onGenerate(type, indices);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[400] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">생성 범위</label>
            <div className="flex gap-2">
              <button onClick={() => setBatchRange({ ...batchRange, mode: 'all' })} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${batchRange.mode === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                전체 ({scenes.length}개)
              </button>
              {missingIdx.length > 0 && missingIdx.length < scenes.length && (
                <button onClick={() => setBatchRange({ ...batchRange, mode: 'missing' })} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${batchRange.mode === 'missing' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                  미생성 ({missingIdx.length}개)
                </button>
              )}
              <button onClick={() => setBatchRange({ ...batchRange, mode: 'custom' })} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${batchRange.mode === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                직접 지정
              </button>
            </div>
            {batchRange.mode === 'custom' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={batchRange.customText}
                  onChange={(e) => setBatchRange({ ...batchRange, customText: e.target.value })}
                  placeholder="예: 1~4, 6, 8~10"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:bg-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700 outline-none"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {customIndices.length > 0 ? `선택된 씬: ${customIndices.join(', ')}번 (${customIndices.length}개)` : '쉼표(,)로 구분, 범위는 물결(~) 또는 하이픈(-) 사용'}
                </p>
              </div>
            )}
            {batchRange.mode === 'missing' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">선택된 씬: {missingIdx.join(', ')}번</p>
            )}
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400">예상 비용: <span className="font-bold text-indigo-600 dark:text-indigo-400">{type === 'audio' ? '무료 (100만자까지)' : `₩${cost.toLocaleString()}`}</span></p>
            <p className="text-xs text-slate-500 mt-1">{type === 'image' ? 'IMAGEN4 ₩29/장' : type === 'audio' ? 'Chirp3/Neural2 100만자 무료' : `${videoProvider === 'byteplus' ? 'BytePlus ₩307' : videoProvider === 'evolink' ? 'Evolink ₩190' : 'Runware ₩195'}/10초`} × {targetScenes.length}개</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">취소</button>
          <button
            onClick={handleGenerate}
            disabled={batchRange.mode === 'custom' && customIndices.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            생성 시작
          </button>
        </div>
      </div>
    </div>
  );
};
