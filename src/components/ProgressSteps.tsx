import React from 'react';
import { AppStep } from '../types';

interface ProgressStepsProps {
  currentStep: AppStep;
  hasProject: boolean;
  hasCharacters: boolean;
  hasScenes: boolean;
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
  hasProject: boolean,
  hasCharacters: boolean,
  hasScenes: boolean,
  hasVideos: boolean
): 'completed' | 'current' | 'upcoming' => {
  // Dashboard는 진행사항에 포함하지 않음
  if (currentStep === 'dashboard') {
    return 'upcoming';
  }

  // 단계별 완료 체크
  if (stepIndex === 0) {
    // 스크립트 작성
    return hasProject ? 'completed' : currentStep === 'input' ? 'current' : 'upcoming';
  } else if (stepIndex === 1) {
    // 등장인물 설정
    if (hasCharacters) return 'completed';
    return currentStep === 'character_setup' ? 'current' : hasProject ? 'upcoming' : 'upcoming';
  } else if (stepIndex === 2) {
    // 스토리보드 설정
    if (hasScenes) return 'completed';
    return currentStep === 'storyboard' && !hasVideos ? 'current' : hasCharacters ? 'upcoming' : 'upcoming';
  } else {
    // 영상 생성
    if (hasVideos) return 'completed';
    return currentStep === 'storyboard' && hasScenes ? 'current' : 'upcoming';
  }
};

export default function ProgressSteps({
  currentStep,
  hasProject,
  hasCharacters,
  hasScenes,
  hasVideos,
}: ProgressStepsProps) {
  // Dashboard에서는 진행사항 바 숨김
  if (currentStep === 'dashboard') {
    return null;
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center gap-2 sm:gap-3">
          {steps.map((step, index) => {
            const status = getStepStatus(
              index,
              currentStep,
              hasProject,
              hasCharacters,
              hasScenes,
              hasVideos
            );

            return (
              <React.Fragment key={`${step.id}-${index}`}>
                {/* Step */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Icon Circle */}
                  <div
                    className={`
                      flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
                      transition-all duration-300 font-semibold text-sm
                      ${
                        status === 'completed'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/50'
                          : status === 'current'
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-3 ring-blue-200 dark:ring-blue-800/50'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                      }
                    `}
                  >
                    {status === 'completed' ? (
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-base sm:text-lg">{step.icon}</span>
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className={`
                        text-[11px] sm:text-xs font-medium truncate transition-colors
                        ${
                          status === 'completed'
                            ? 'text-blue-600 dark:text-blue-400'
                            : status === 'current'
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-slate-400 dark:text-slate-600'
                        }
                      `}
                    >
                      {step.label}
                    </span>
                    {status === 'current' && (
                      <span className="text-[9px] sm:text-[10px] text-blue-500 dark:text-blue-400 font-medium">
                        진행 중
                      </span>
                    )}
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`
                      flex-shrink-0 h-0.5 w-8 sm:w-12 transition-all duration-300
                      ${
                        status === 'completed'
                          ? 'bg-blue-600'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
