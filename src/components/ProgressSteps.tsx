import React from 'react';
import { AppStep } from '../types';

interface ProgressStepsProps {
  currentStep: AppStep;
  hasScript: boolean;
  hasCharacters: boolean;
  hasStoryboard: boolean;
  hasVideos: boolean;
}

interface Step {
  id: AppStep;
  label: string;
  icon: string;
}

const steps: Step[] = [
  { id: 'input', label: '대본 업로드', icon: '1' },
  { id: 'character_setup', label: '등장인물 설정', icon: '2' },
  { id: 'storyboard', label: '스토리보드 설정', icon: '3' },
  { id: 'storyboard', label: '영상 설정', icon: '4' },
];

const getStepStatus = (
  stepIndex: number,
  currentStep: AppStep,
  hasScript: boolean,
  hasCharacters: boolean,
  hasStoryboard: boolean,
  hasVideos: boolean
): 'completed' | 'current' | 'upcoming' => {
  // Dashboard는 진행사항에 포함하지 않음
  if (currentStep === 'dashboard') {
    return 'upcoming';
  }

  // 단계별 완료 체크 (실제 완료 여부 기준)
  if (stepIndex === 0) {
    // 스크립트 작성: script 텍스트 존재 && scenes.length >= 1
    return hasScript ? 'completed' : currentStep === 'input' ? 'current' : 'upcoming';
  } else if (stepIndex === 1) {
    // 등장인물 설정: characters.length >= 1 (선택사항)
    if (hasCharacters) return 'completed';
    return currentStep === 'character_setup' ? 'current' : hasScript ? 'upcoming' : 'upcoming';
  } else if (stepIndex === 2) {
    // 스토리보드 설정: scenes 중 imageUrl이 1개 이상
    if (hasStoryboard) return 'completed';
    return currentStep === 'storyboard' && !hasVideos ? 'current' : 'upcoming';
  } else {
    // 영상 생성: 최종 영상 URL 존재
    if (hasVideos) return 'completed';
    return currentStep === 'storyboard' && hasStoryboard ? 'current' : 'upcoming';
  }
};

export default function ProgressSteps({
  currentStep,
  hasScript,
  hasCharacters,
  hasStoryboard,
  hasVideos,
}: ProgressStepsProps) {
  // Dashboard에서는 진행사항 바 숨김
  if (currentStep === 'dashboard') {
    return null;
  }

  // 완료된 단계 수 계산
  const completedSteps = [hasScript, hasCharacters, hasStoryboard, hasVideos].filter(Boolean).length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-8 sm:px-12 py-3">
        <div className="relative">
          {/* Background line (전체 선) */}
          <div className="absolute top-[14px] left-0 right-0 h-[2px] bg-slate-300 dark:bg-slate-600 rounded-full" />

          {/* Progress line (완료된 구간 - 그라데이션) */}
          <div
            className="absolute top-[14px] left-0 h-[2px] bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />

          {/* Steps */}
          <div className="relative flex justify-between items-start">
            {steps.map((step, index) => {
              const status = getStepStatus(
                index,
                currentStep,
                hasScript,
                hasCharacters,
                hasStoryboard,
                hasVideos
              );

              return (
                <div key={`${step.id}-${index}`} className="flex flex-col items-center" style={{ flex: '0 0 auto' }}>
                  {/* Circle with number or check */}
                  <div
                    className={`
                      w-7 h-7 rounded-full flex items-center justify-center
                      transition-all duration-300 z-10 relative text-xs font-semibold
                      ${
                        status === 'completed'
                          ? 'bg-indigo-500 text-white'
                          : status === 'current'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-transparent border-2 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'
                      }
                    `}
                  >
                    {status === 'completed' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{step.icon}</span>
                    )}
                  </div>

                  {/* Label */}
                  <div className="mt-2">
                    <span
                      className={`
                        text-xs text-center transition-colors whitespace-nowrap
                        ${
                          status === 'completed'
                            ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                            : status === 'current'
                            ? 'text-slate-900 dark:text-slate-100 font-bold'
                            : 'text-slate-400 dark:text-slate-500'
                        }
                      `}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
