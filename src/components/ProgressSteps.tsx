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
  { id: 'storyboard', label: '스토리보드 생성', icon: '🖼️' },
];

const getStepStatus = (
  stepId: AppStep,
  currentStep: AppStep,
  hasProject: boolean,
  hasCharacters: boolean,
  hasScenes: boolean,
  hasVideos: boolean
): 'completed' | 'current' | 'upcoming' => {
  const stepOrder: AppStep[] = ['input', 'character_setup', 'storyboard'];
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepId);

  // Dashboard는 진행사항에 포함하지 않음
  if (currentStep === 'dashboard') {
    return 'upcoming';
  }

  // 완료 체크
  if (stepId === 'input' && hasProject) return currentIndex > 0 ? 'completed' : 'current';
  if (stepId === 'character_setup' && hasCharacters) return currentIndex > 1 ? 'completed' : 'current';
  if (stepId === 'storyboard' && hasScenes) return 'completed';

  // 현재 단계
  if (stepId === currentStep) return 'current';

  // 이전 단계면 완료, 이후 단계면 예정
  return stepIndex < currentIndex ? 'completed' : 'upcoming';
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
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {steps.map((step, index) => {
            const status = getStepStatus(
              step.id,
              currentStep,
              hasProject,
              hasCharacters,
              hasScenes,
              hasVideos
            );

            return (
              <React.Fragment key={step.id}>
                {/* Step */}
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  {/* Icon Circle */}
                  <div
                    className={`
                      flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center
                      transition-all duration-300 font-semibold text-sm sm:text-base
                      ${
                        status === 'completed'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50'
                          : status === 'current'
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-4 ring-indigo-100 dark:ring-indigo-900/50'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                      }
                    `}
                  >
                    {status === 'completed' ? (
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-lg sm:text-xl">{step.icon}</span>
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className={`
                        text-xs sm:text-sm font-medium truncate transition-colors
                        ${
                          status === 'completed'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : status === 'current'
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-slate-400 dark:text-slate-600'
                        }
                      `}
                    >
                      {step.label}
                    </span>
                    {status === 'current' && (
                      <span className="text-[10px] sm:text-xs text-indigo-500 dark:text-indigo-400 font-medium">
                        진행 중
                      </span>
                    )}
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`
                      hidden sm:block flex-shrink-0 h-0.5 w-12 lg:w-20 transition-all duration-300
                      ${
                        status === 'completed'
                          ? 'bg-indigo-600'
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
