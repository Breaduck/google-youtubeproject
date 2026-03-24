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

  // 단계별 완료 여부 체크
  const isCompleted =
    (stepIndex === 0 && hasScript) ||
    (stepIndex === 1 && hasCharacters) ||
    (stepIndex === 2 && hasStoryboard) ||
    (stepIndex === 3 && hasVideos);

  if (isCompleted) return 'completed';

  // 현재 단계 체크 (딱 1개만 활성화)
  if (stepIndex === 0) {
    return currentStep === 'input' ? 'current' : 'upcoming';
  } else if (stepIndex === 1) {
    return currentStep === 'character_setup' ? 'current' : 'upcoming';
  } else if (stepIndex === 2) {
    // 스토리보드 설정: storyboard 단계이면서 아직 이미지 생성 전
    return currentStep === 'storyboard' && !hasStoryboard ? 'current' : 'upcoming';
  } else {
    // 영상 설정: storyboard 단계이면서 이미지는 완료된 후
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
          {/* Steps */}
          <div className="relative flex justify-between items-start">
            {/* Background line (첫 원 중심 ~ 마지막 원 중심) */}
            <div
              className="absolute top-[14px] h-[2px] bg-slate-300 dark:bg-slate-600 rounded-full"
              style={{
                left: 'calc(0% + 14px)',
                right: 'calc(0% + 14px)'
              }}
            />

            {/* Progress line (완료된 구간 - 그라데이션) */}
            <div
              className="absolute top-[14px] h-[2px] bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
              style={{
                left: 'calc(0% + 14px)',
                width: `calc(${progressPercentage}% - 14px)`
              }}
            />

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
                          : 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'
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
