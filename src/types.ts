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
