import React from 'react';
import { AppStep } from '../types';

interface ProgressStepsProps {
  currentStep: AppStep;
  hasScript: boolean;
  hasCharacters: boolean;
  hasScenes: boolean;
  hasImages: boolean;
  hasAudios: boolean;
  hasVideos: boolean;
  isGeneratingVideo?: boolean;
}

interface Step {
  label: string;
  icon: string;
}

const steps: Step[] = [
  { label: '대본 업로드', icon: '1' },
  { label: '등장인물 설정', icon: '2' },
  { label: '스크립트 분할', icon: '3' },
  { label: '이미지 생성', icon: '4' },
  { label: '나레이션 생성', icon: '5' },
  { label: '영상 생성', icon: '6' },
];

const getCurrentStepIndex = (
  currentStep: AppStep,
  hasScript: boolean,
  hasCharacters: boolean,
  hasScenes: boolean,
  hasImages: boolean,
  hasAudios: boolean,
  hasVideos: boolean,
  isGeneratingVideo: boolean
): number => {
  if (currentStep === 'input') return 0;
  else if (currentStep === 'character_setup') return 1;
  else if (currentStep === 'storyboard') {
    if (hasVideos) return 5;
    if (hasAudios) return 4;
    if (hasImages) return 3;
    if (hasScenes) return 2;
    if (hasCharacters) return 1;
    if (hasScript) return 0;
    return 0;
  }
  return 0;
};

const getStepStatus = (
  stepIndex: number,
  currentStepIndex: number
): 'completed' | 'current' | 'upcoming' => {
  if (stepIndex < currentStepIndex) return 'completed';
  if (stepIndex === currentStepIndex) return 'current';
  return 'upcoming';
};

export default function ProgressSteps({
  currentStep,
  hasScript,
  hasCharacters,
  hasScenes,
  hasImages,
  hasAudios,
  hasVideos,
  isGeneratingVideo = false,
}: ProgressStepsProps) {
  if (currentStep === 'dashboard') return null;

  const currentStepIndex = getCurrentStepIndex(
    currentStep,
    hasScript,
    hasCharacters,
    hasScenes,
    hasImages,
    hasAudios,
    hasVideos,
    isGeneratingVideo
  );

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-8 sm:px-12 py-3">
        <div className="flex items-center gap-0">
          {steps.map((step, index) => {
            const status = getStepStatus(index, currentStepIndex);
            const isLastStep = index === steps.length - 1;
            const isLineCompleted = index < currentStepIndex;

            return (
              <React.Fragment key={index}>
                {/* 원과 라벨 */}
                <div className="flex flex-col items-center" style={{ margin: 0, padding: 0 }}>
                  <div
                    className={`
                      w-7 h-7 rounded-full flex items-center justify-center
                      transition-all duration-300 z-10 text-xs font-semibold
                      ${
                        status === 'completed'
                          ? 'bg-indigo-500 text-white'
                          : status === 'current'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'
                      }
                    `}
                    style={{ margin: 0 }}
                  >
                    {status === 'completed' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{step.icon}</span>
                    )}
                  </div>
                  <div className="mt-2" style={{ margin: 0, marginTop: '8px' }}>
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

                {/* 선 (마지막 원 제외) */}
                {!isLastStep && (
                  <div
                    className={`
                      h-[2px] rounded-full transition-all duration-500
                      ${
                        isLineCompleted
                          ? 'bg-gradient-to-r from-indigo-500 to-blue-500'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }
                    `}
                    style={{
                      flex: 1,
                      margin: 0,
                      marginTop: '-24px'
                    }}
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
