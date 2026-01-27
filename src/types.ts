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

export interface Scene {
  id: string;
  scriptSegment: string;
  imagePrompt: string;
  imageUrl: string | null;
  audioUrl: string | null;
  status: 'idle' | 'loading' | 'done' | 'error';
  audioStatus: 'idle' | 'loading' | 'done' | 'error';
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
