import React, { useEffect, useState, useRef } from 'react';
import { StyleTemplate } from '../types/template';
import { SavedStyle } from '../types';
import StyleTemplateSelector from './StyleTemplateSelector';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedTemplate: StyleTemplate | null;
  onSelectTemplate: (template: StyleTemplate) => void;
  onApply: () => void;
  savedStyles?: SavedStyle[];
  onAddTemplate?: () => void;
  onSaveNewStyle?: (name: string, images: string[]) => Promise<void>;
}

export default function StyleTemplateModal({ isOpen, onClose, selectedTemplate, onSelectTemplate, onApply, savedStyles = [], onAddTemplate, onSaveNewStyle }: Props) {
  const [isAddMode, setIsAddMode] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleImages, setNewStyleImages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddMode) {
          setIsAddMode(false);
          setNewStyleName('');
          setNewStyleImages([]);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, isAddMode, onClose]);

  // Reset add mode when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsAddMode(false);
      setNewStyleName('');
      setNewStyleImages([]);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (newStyleImages.length + files.length > 7) {
      alert('레퍼런스 이미지는 최대 7장까지 가능합니다.');
      return;
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setNewStyleImages(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setNewStyleImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (newStyleImages.length === 0) {
      alert('이미지를 최소 1장 이상 등록해주세요.');
      return;
    }
    if (newStyleImages.length < 3) {
      if (!confirm('명확한 그림체 학습을 위해 3개 이상 권장합니다. 계속 진행하시겠습니까?')) return;
    }
    if (!newStyleName.trim()) {
      alert('그림체 이름을 입력해주세요.');
      return;
    }
    if (savedStyles.length >= 10) {
      alert('자주 쓰는 그림체는 최대 10개까지 저장 가능합니다.');
      return;
    }

    setIsSaving(true);
    try {
      if (onSaveNewStyle) {
        await onSaveNewStyle(newStyleName.trim(), newStyleImages);
      }
      setIsAddMode(false);
      setNewStyleName('');
      setNewStyleImages([]);
    } catch (err) {
      console.error('Failed to save style:', err);
      alert('그림체 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTemplateClick = () => {
    setIsAddMode(true);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[350] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden shadow-2xl animate-in slide-in-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {isAddMode && (
              <button
                onClick={() => {
                  setIsAddMode(false);
                  setNewStyleName('');
                  setNewStyleImages([]);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-semibold text-slate-900">
              {isAddMode ? '맞춤형 스타일 학습' : '스타일 템플릿'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)] custom-scrollbar">
          {isAddMode ? (
            /* 맞춤형 스타일 학습 UI */
            <div className="space-y-6">
              {/* 스타일 이름 입력 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">그림체 이름</label>
                <input
                  type="text"
                  value={newStyleName}
                  onChange={(e) => setNewStyleName(e.target.value)}
                  placeholder="예: 지브리풍, 디즈니 스타일..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>

              {/* 이미지 업로드 안내 */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-indigo-700 font-medium">레퍼런스 이미지 업로드</span>
                </div>
                <p className="text-sm text-slate-600">
                  최대 7장, 최소 3장 권장. AI가 이미지들을 분석하여 그림체 특징을 학습합니다.
                </p>
              </div>

              {/* 업로드 버튼 */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={newStyleImages.length >= 7}
                className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                이미지 업로드 ({newStyleImages.length}/7)
              </button>

              {/* 업로드된 이미지 그리드 */}
              {newStyleImages.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                  {newStyleImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={img} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 안내 텍스트 */}
              <p className="text-xs text-slate-400 text-center">
                비슷한 화풍의 이미지를 여러 장 업로드하면 더 정확한 스타일 학습이 가능합니다.
              </p>
            </div>
          ) : (
            /* 기존 템플릿 선택 UI */
            <StyleTemplateSelector
              selectedTemplate={selectedTemplate}
              onSelectTemplate={onSelectTemplate}
              savedStyles={savedStyles}
              onAddTemplate={handleAddTemplateClick}
            />
          )}
        </div>

        {/* 하단 */}
        <div className="p-6 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          {isAddMode ? (
            <>
              <div className="text-sm text-slate-500">
                {newStyleImages.length > 0 ? (
                  <span>{newStyleImages.length}장의 이미지가 준비됨</span>
                ) : (
                  <span>레퍼런스 이미지를 업로드하세요</span>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={newStyleImages.length === 0 || !newStyleName.trim() || isSaving}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    학습 중...
                  </>
                ) : (
                  '저장하기'
                )}
              </button>
            </>
          ) : (
            <>
              <div className="text-sm text-slate-500">
                {selectedTemplate ? (
                  <span>선택됨: <span className="text-purple-600 font-medium">{selectedTemplate.name}</span></span>
                ) : (
                  <span>템플릿을 선택하세요</span>
                )}
              </div>
              <button
                onClick={onApply}
                disabled={!selectedTemplate}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                적용하기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
