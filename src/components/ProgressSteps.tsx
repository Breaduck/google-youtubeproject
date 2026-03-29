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
  onStepClick?: (stepIndex: number) => void;
  // 상세 정보
  characterCount?: number;
  sceneCount?: number;
  imageCount?: number;
  audioCount?: number;
  videoCount?: number;
}

interface Step {
  label: string;
  icon: string;
}

const steps: Step[] = [
  { label: '대본 업로드', icon: '1' },
  { label: '그림체 설정', icon: '2' },
  { label: '등장인물 설정', icon: '3' },
  { label: '스크립트 분할', icon: '4' },
  { label: '이미지 생성', icon: '5' },
  { label: '나레이션 생성', icon: '6' },
  { label: 'AI 영상 생성', icon: '7' },
  { label: '영상 합치기', icon: '8' },
];

const getCurrentStepIndex = (
  currentStep: AppStep,
  hasScript: boolean,
  hasCharacters: boolean,
  hasScenes: boolean,
  hasImages: boolean,
  hasAudios: boolean,
  hasVideos: boolean,
  isGeneratingVideo: boolean,
  characterCount: number,
  sceneCount: number,
  imageCount: number,
  audioCount: number,
  videoCount: number
): number => {
  if (currentStep === 'input') return 0;
  else if (currentStep === 'style_selection') return 1;
  else if (currentStep === 'character_setup') return 2;
  else if (currentStep === 'storyboard') {
    if (hasVideos && videoCount > 0) return 6;
    if (hasAudios && audioCount > 0) return 5;
    if (hasImages && imageCount > 0) return 4;
    if (hasScenes && sceneCount > 0) return 3;
    if (hasCharacters && characterCount > 0) return 2;
    if (hasScript) return 1;
    return 0;
  }
  return 0;
};

const getStepStatus = (
  stepIndex: number,
  currentStepIndex: number,
  hasScript: boolean,
  hasCharacters: boolean,
  hasScenes: boolean,
  hasImages: boolean,
  hasAudios: boolean,
  hasVideos: boolean,
  characterCount: number,
  sceneCount: number,
  imageCount: number,
  audioCount: number,
  videoCount: number
): 'completed' | 'current' | 'upcoming' => {
  // 각 단계별 실제 완료 여부 체크
  const isStepCompleted = (index: number): boolean => {
    switch (index) {
      case 0: return hasScript;
      case 1: return hasScript; // 그림체 설정 - 대본 업로드되면 완료
      case 2: return characterCount > 0; // 등장인물 1명 이상일 때만 완료
      case 3: return hasScenes && sceneCount > 0;
      case 4: return hasImages && imageCount > 0;
      case 5: return hasAudios && audioCount > 0;
      case 6: return hasVideos && videoCount > 0;
      case 7: return hasImages && hasAudios; // 영상 합치기
      default: return false;
    }
  };

  if (isStepCompleted(stepIndex)) return 'completed';
  if (stepIndex === currentStepIndex) return 'current';
  return 'upcoming';
};

const getStepTooltip = (
  stepIndex: number,
  hasScript: boolean,
  hasCharacters: boolean,
  hasScenes: boolean,
  hasImages: boolean,
  hasAudios: boolean,
  hasVideos: boolean,
  characterCount: number,
  sceneCount: number,
  imageCount: number,
  audioCount: number,
  videoCount: number
): string => {
  switch (stepIndex) {
    case 0: return hasScript ? '대본 업로드 완료' : '대본을 업로드해주세요';
    case 1: return '그림체 설정';
    case 2:
      if (!hasCharacters || characterCount === 0) return '등장인물이 0명입니다';
      return `등장인물 ${characterCount}명`;
    case 3:
      if (!hasScenes || sceneCount === 0) return '씬이 0개입니다';
      return `씬 ${sceneCount}개`;
    case 4:
      if (!hasScenes || sceneCount === 0) return '씬이 없습니다';
      if (!hasImages) return `이미지 ${imageCount}/${sceneCount}개 생성됨`;
      return `이미지 생성 완료 (${imageCount}개)`;
    case 5:
      if (!hasScenes || sceneCount === 0) return '씬이 없습니다';
      if (!hasAudios) return `오디오 ${audioCount}/${sceneCount}개 생성됨`;
      return `오디오 생성 완료 (${audioCount}개)`;
    case 6:
      if (!hasScenes || sceneCount === 0) return '씬이 없습니다';
      if (videoCount === 0) return '영상을 생성해주세요';
      return `영상 ${videoCount}/${sceneCount}개 생성됨`;
    case 7:
      if (!hasAudios || !hasImages) return '이미지와 오디오를 먼저 생성해주세요';
      return '영상 합치기 준비 완료';
    default: return '';
  }
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
  onStepClick,
  characterCount = 0,
  sceneCount = 0,
  imageCount = 0,
  audioCount = 0,
  videoCount = 0,
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
    isGeneratingVideo,
    characterCount,
    sceneCount,
    imageCount,
    audioCount,
    videoCount
  );

  return (
    <div className="w-full relative z-0 mt-4 sm:mt-8 mb-2">
      <div className="max-w-[1400px] mx-auto px-20 sm:px-24 py-2">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const status = getStepStatus(
              index,
              currentStepIndex,
              hasScript,
              hasCharacters,
              hasScenes,
              hasImages,
              hasAudios,
              hasVideos,
              characterCount,
              sceneCount,
              imageCount,
              audioCount,
              videoCount
            );
            const isLastStep = index === steps.length - 1;
            // 선 완료 여부: 가장 마지막으로 완료된 단계까지 모두 연결
            let lastCompletedIndex = -1;
            for (let i = steps.length - 1; i >= 0; i--) {
              const stepStatus = getStepStatus(i, currentStepIndex, hasScript, hasCharacters, hasScenes, hasImages, hasAudios, hasVideos, characterCount, sceneCount, imageCount, audioCount, videoCount);
              if (stepStatus === 'completed') {
                lastCompletedIndex = i;
                break;
              }
            }
            const isLineCompleted = index < lastCompletedIndex;

            return (
              <React.Fragment key={index}>
                <div className="flex flex-col items-center relative group" style={{ minWidth: '80px' }}>
                  <button
                    onClick={() => onStepClick?.(index)}
                    title={getStepTooltip(
                      index,
                      hasScript,
                      hasCharacters,
                      hasScenes,
                      hasImages,
                      hasAudios,
                      hasVideos,
                      characterCount,
                      sceneCount,
                      imageCount,
                      audioCount,
                      videoCount
                    )}
                    className={`
                      w-7 h-7 rounded-full flex items-center justify-center
                      transition-all duration-300 text-xs font-semibold z-10
                      ${onStepClick ? 'cursor-pointer hover:scale-110' : ''}
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
                    ) : status === 'current' ? (
                      <span>{step.icon}</span>
                    ) : (
                      // upcoming 상태인데 뒤에 completed 단계가 있으면 경고 표시
                      lastCompletedIndex > index ? (
                        <span className="text-lg">⚠️</span>
                      ) : (
                        <span>{step.icon}</span>
                      )
                    )}
                  </button>
                  {/* 커스텀 툴팁 */}
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                    {getStepTooltip(
                      index,
                      hasScript,
                      hasCharacters,
                      hasScenes,
                      hasImages,
                      hasAudios,
                      hasVideos,
                      characterCount,
                      sceneCount,
                      imageCount,
                      audioCount,
                      videoCount
                    )}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45" />
                  </div>
                  <span
                    className={`
                      text-xs text-center transition-colors whitespace-nowrap mt-2
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
                {!isLastStep && (
                  <div className="flex-1 h-[2px] -mx-10" style={{ marginTop: '-30px' }}>
                    <div
                      className={`
                        w-full h-full transition-all duration-500
                        ${
                          isLineCompleted
                            ? 'bg-gradient-to-r from-indigo-500 to-blue-500'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }
                      `}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
