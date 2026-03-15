export type AppStep = 'dashboard' | 'input' | 'character_setup' | 'storyboard';

export type VisualStyle = '2d-animation' | 'realistic' | 'animation' | 'custom';

export interface CharacterProfile {
  id: string;
  name: string;
  role: string;
  visualDescription: string;
  portraitUrl: string | null;
  status: 'idle' | 'loading' | 'done' | 'error';
}

export interface SceneEffect {
  effect_type: '3d_parallax' | 'zoom_in_slow' | 'zoom_in_fast' | 'zoom_out_slow' | 'pan_left' | 'pan_right' | 'static_subtle';
  intensity: number; // 1-10
  motion_params: {
    scale: number; // 1.1 ~ 1.3
    direction: 'center' | 'left' | 'right';
    speed: 'slow' | 'medium' | 'fast';
  };
}

export interface Scene {
  id: string;
  scriptSegment: string;
  imagePrompt: string;
  imageUrl: string | null;
  audioUrl: string | null;
  videoUrl: string | null;  // LTX Video generated video
  status: 'idle' | 'loading' | 'done' | 'error';
  audioStatus: 'idle' | 'loading' | 'done' | 'error';
  videoStatus: 'idle' | 'loading' | 'done' | 'error';  // Video generation status
  effect?: SceneEffect;
}

export interface StoryProject {
  id: string;
  title: string;
  script: string;
  style: string;
  customStyleDescription?: string;
  characters: CharacterProfile[];
  scenes: Scene[];
  updatedAt: number;
}

export interface ElevenLabsSettings {
  apiKey: string;
  voiceId: string;
  speed: number;
}

export interface SavedStyle {
  id: string;
  name: string;
  refImages: string[];
  description: string;
}

export interface SavedCharacter {
  id: string;
  name: string;
  refImages: string[];
  description: string;
  portraitUrl: string | null;
}

export type SubtitleTemplate =
  | 'default-white'      // 기본(흰색) - 흰색 텍스트 + 검은 외곽선
  | 'black-bg'           // 검정 배경 - 반투명 검정 박스 + 흰색 텍스트
  | 'transparent-black'  // 반투명 검정 - 반투명 검정 텍스트 + 흰색 외곽선
  | 'yellow'             // 노란 자막
  | 'neon-green'         // 네온 그린
  | 'youtube'            // 유튜브 스타일 - 검은 반투명 배경
  | 'youtube-shorts'     // 유튜브 쇼츠 - 큰 텍스트 + 굵은 외곽선
  | 'custom';            // 커스텀 색상

export type SubtitlePosition = 'top' | 'center' | 'bottom';

export interface SubtitleSettings {
  fontSize: number;           // 16~80px
  fontFamily: string;         // 글씨체
  letterSpacing: number;      // -2~10px (Phase 2)
  lineHeight: number;         // 0.8~2.0 (Phase 2)
  opacity: number;            // 0~1

  template: SubtitleTemplate;

  // 실제 사용되는 색상 (템플릿 선택 시 자동 설정, 이후 수동 조정 가능)
  textColor: string;          // 자막 글씨 색
  strokeColor: string;        // 외곽선 색
  strokeWidth: number;        // 외곽선 두께
  backgroundColor?: string;   // 자막 배경 색 (선택)
  bgPadding: number;          // 배경 여백
  bgOpacity: number;          // 배경 불투명도

  position: SubtitlePosition; // 프리셋
  yPosition: number;          // 0~720px

  lockPosition: boolean;      // 모든 장면 동일 위치
  lockFont: boolean;          // 모든 장면 동일 폰트
}
