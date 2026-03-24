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
  isGeneratingVideo?: boolean; // 동영상 추출 버튼 눌렀는지 여부
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

// 현재 활성 단계 인덱스 계산 (0-based)
const getCurrentStepIndex = (
  hasScript: boolean,
  hasCharacters: boolean,
  hasScenes: boolean,
  hasImages: boolean,
  hasAudios: boolean,
  hasVideos: boolean,
  isGeneratingVideo: boolean
): number => {
  if (hasVideos) return 6; // 모든 단계 완료
  if (isGeneratingVideo && hasAudios) return 5; // 6단계 진행 중
  if (hasAudios) return 5; // 5단계 완료, 6단계 대기
  if (hasImages) return 4; // 4단계 완료, 5단계 진행 중
  if (hasScenes) return 3; // 3단계 완료, 4단계 진행 중
  if (hasCharacters) return 2; // 2단계 완료, 3단계 진행 중
  if (hasScript) return 1; // 1단계 완료, 2단계 진행 중
  return 0; // 1단계 진행 중
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
  // Dashboard에서는 진행사항 바 숨김
  if (currentStep === 'dashboard') {
    return null;
  }

  // 현재 활성 단계 인덱스 계산
  const currentStepIndex = getCurrentStepIndex(
    hasScript,
    hasCharacters,
    hasScenes,
    hasImages,
    hasAudios,
    hasVideos,
    isGeneratingVideo
  );

  // 진행률 계산: 현재 단계까지 선 채움
  // 6단계 = 5개 구간, currentStepIndex / 5 * 100
  const progressPercentage = Math.min((currentStepIndex / (steps.length - 1)) * 100, 100);

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
                left: `calc((100% / ${steps.length - 1}) / 2)`,
                right: `calc((100% / ${steps.length - 1}) / 2)`
              }}
            />

            {/* Progress line (현재 단계까지 선 채움 - 그라데이션) */}
            <div
              className="absolute top-[14px] h-[2px] bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
              style={{
                left: `calc((100% / ${steps.length - 1}) / 2)`,
                width: `calc(${progressPercentage}% - (100% / ${steps.length - 1}) / 2)`
              }}
            />

            {steps.map((step, index) => {
              const status = getStepStatus(index, currentStepIndex);

              return (
                <div key={index} className="flex flex-col items-center" style={{ flex: '0 0 auto' }}>
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
