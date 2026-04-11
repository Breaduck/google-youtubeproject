import React from 'react';

interface StyleDescModalProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export const StyleDescModal: React.FC<StyleDescModalProps> = ({
  value,
  onChange,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">고급 설정</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">그림체의 특징을 상세히 설명해주세요</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">특징 설명 (선택사항)</label>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-32 px-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none text-sm"
              placeholder="이 그림체의 특징을 간단히 설명해주세요..."
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
