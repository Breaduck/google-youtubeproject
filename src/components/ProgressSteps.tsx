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
  { id: 'input', label: '스크립트 작성', icon: '📝' },
  { id: 'character_setup', label: '등장인물 설정', icon: '👥' },
  { id: 'storyboard', label: '스토리보드 설정', icon: '🖼️' },
  { id: 'storyboard', label: '영상 생성', icon: '🎬' },
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

// 그라데이션 색상 계산 (indigo -> blue -> cyan)
const getStepColor = (index: number, total: number) => {
  const colors = [
    'from-indigo-500 to-indigo-600',
    'from-blue-500 to-blue-600',
    'from-blue-400 to-blue-500',
    'from-cyan-400 to-cyan-500',
  ];
  return colors[index] || colors[0];
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
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-2 sm:py-3">
        <div className="relative">
          {/* Background line (전체 선) */}
          <div className="absolute top-[18px] sm:top-[20px] left-0 right-0 h-[2px] bg-slate-200 dark:bg-slate-700 rounded-full" />

          {/* Progress line (완료된 구간 - 그라데이션) */}
          <div
            className="absolute top-[18px] sm:top-[20px] left-0 h-[2px] bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 rounded-full transition-all duration-500"
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
                <div key={`${step.id}-${index}`} className="flex flex-col items-center flex-1">
                  {/* Icon Circle */}
                  <div
                    className={`
                      w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                      transition-all duration-300 z-10 relative
                      ${
                        status === 'completed'
                          ? `bg-gradient-to-br ${getStepColor(index, steps.length)} text-white shadow-md`
                          : status === 'current'
                          ? 'bg-white dark:bg-slate-800 border-2 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                      }
                    `}
                  >
                    {status === 'completed' ? (
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-xs sm:text-sm">{step.icon}</span>
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex flex-col items-center mt-1.5 sm:mt-2 min-w-0 max-w-full">
                    <span
                      className={`
                        text-[10px] sm:text-xs font-medium text-center transition-colors px-1
                        ${
                          status === 'completed'
                            ? 'text-blue-600 dark:text-blue-400'
                            : status === 'current'
                            ? 'text-slate-900 dark:text-slate-100 font-semibold'
                            : 'text-slate-400 dark:text-slate-600'
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
