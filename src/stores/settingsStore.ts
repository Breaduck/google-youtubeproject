import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SubtitleSettings, ElevenLabsSettings } from '../types';

const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  fontSize: 32,
  fontFamily: 'Pretendard',
  letterSpacing: 0,
  lineHeight: 1.2,
  opacity: 1.0,
  template: 'default-white',
  textColor: '#FFFFFF',
  strokeColor: 'transparent',
  strokeWidth: 0,
  backgroundColor: undefined,
  bgPadding: 12,
  bgOpacity: 0.8,
  position: 'bottom',
  yPosition: 680,
  lockPosition: true,
  lockFont: true,
};

interface SettingsStore {
  // Dark mode
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;

  // Gemini API
  geminiApiKey: string;
  geminiModel: string;
  geminiImageModel: string;
  isGeminiValid: boolean;
  isValidatingGemini: boolean;
  setGeminiApiKey: (key: string) => void;
  setGeminiModel: (model: string) => void;
  setGeminiImageModel: (model: string) => void;
  setIsGeminiValid: (valid: boolean) => void;
  setIsValidatingGemini: (validating: boolean) => void;

  // Google Cloud (Vertex AI)
  googleCloudProjectId: string;
  googleCloudLocation: string;
  setGoogleCloudProjectId: (id: string) => void;
  setGoogleCloudLocation: (location: string) => void;

  // Image Provider
  imageProvider: 'gemini' | 'runware';
  setImageProvider: (provider: 'gemini' | 'runware') => void;

  // Runware (for image)
  runwareApiKey: string;
  setRunwareApiKey: (key: string) => void;

  // Video Provider
  videoProvider: 'byteplus' | 'evolink' | 'runware';
  setVideoProvider: (provider: 'byteplus' | 'evolink' | 'runware') => void;

  // BytePlus/ByteDance
  bytedanceApiKey: string;
  bytedanceModel: string;
  isByteplusValid: boolean;
  isValidatingByteplus: boolean;
  setBytedanceApiKey: (key: string) => void;
  setBytedanceModel: (model: string) => void;
  setIsByteplusValid: (valid: boolean) => void;
  setIsValidatingByteplus: (validating: boolean) => void;

  // Evolink
  evolinkApiKey: string;
  evolinkResolution: string;
  evolinkDuration: number;
  isEvolinkValid: boolean;
  isValidatingEvolink: boolean;
  setEvolinkApiKey: (key: string) => void;
  setEvolinkResolution: (resolution: string) => void;
  setEvolinkDuration: (duration: number) => void;
  setIsEvolinkValid: (valid: boolean) => void;
  setIsValidatingEvolink: (validating: boolean) => void;

  // Runware (for video)
  runwareDuration: number;
  runwareResolution: string;
  isRunwareValid: boolean;
  isValidatingRunware: boolean;
  setRunwareDuration: (duration: number) => void;
  setRunwareResolution: (resolution: string) => void;
  setIsRunwareValid: (valid: boolean) => void;
  setIsValidatingRunware: (validating: boolean) => void;

  // Video Generation Range
  videoGenerationRange: number;
  setVideoGenerationRange: (range: number) => void;

  // Audio Provider
  audioProvider: 'google-chirp3' | 'google-neural2' | 'microsoft' | 'elevenlabs';
  setAudioProvider: (provider: 'google-chirp3' | 'google-neural2' | 'microsoft' | 'elevenlabs') => void;

  // Chirp (Google)
  chirpApiKey: string;
  chirpVoice: string;
  chirpSpeed: number;
  setChirpApiKey: (key: string) => void;
  setChirpVoice: (voice: string) => void;
  setChirpSpeed: (speed: number) => void;

  // Google TTS Voices
  neural2Voice: string;
  standardVoice: string;
  wavenetVoice: string;
  studioVoice: string;
  setNeural2Voice: (voice: string) => void;
  setStandardVoice: (voice: string) => void;
  setWavenetVoice: (voice: string) => void;
  setStudioVoice: (voice: string) => void;

  // Azure TTS
  azureApiKey: string;
  azureVoice: string;
  setAzureApiKey: (key: string) => void;
  setAzureVoice: (voice: string) => void;

  // ElevenLabs
  elSettings: ElevenLabsSettings;
  setElSettings: (settings: ElevenLabsSettings) => void;

  // Subtitle Settings
  subtitleSettings: SubtitleSettings;
  setSubtitleSettings: (settings: SubtitleSettings) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // Dark mode
      isDarkMode: false,
      setIsDarkMode: (value) => set({ isDarkMode: value }),

      // Gemini API
      geminiApiKey: '',
      geminiModel: 'gemini-3-flash-preview',
      geminiImageModel: 'gemini-2.5-flash-image',
      isGeminiValid: false,
      isValidatingGemini: false,
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setGeminiModel: (model) => set({ geminiModel: model }),
      setGeminiImageModel: (model) => set({ geminiImageModel: model }),
      setIsGeminiValid: (valid) => set({ isGeminiValid: valid }),
      setIsValidatingGemini: (validating) => set({ isValidatingGemini: validating }),

      // Google Cloud
      googleCloudProjectId: '',
      googleCloudLocation: 'us-central1',
      setGoogleCloudProjectId: (id) => set({ googleCloudProjectId: id }),
      setGoogleCloudLocation: (location) => set({ googleCloudLocation: location }),

      // Image Provider
      imageProvider: 'gemini',
      setImageProvider: (provider) => set({ imageProvider: provider }),

      // Runware (for image)
      runwareApiKey: '',
      setRunwareApiKey: (key) => set({ runwareApiKey: key }),

      // Video Provider
      videoProvider: 'byteplus',
      setVideoProvider: (provider) => set({ videoProvider: provider }),

      // BytePlus
      bytedanceApiKey: '',
      bytedanceModel: 'seedance-1.0-pro-fast',
      isByteplusValid: false,
      isValidatingByteplus: false,
      setBytedanceApiKey: (key) => set({ bytedanceApiKey: key }),
      setBytedanceModel: (model) => set({ bytedanceModel: model }),
      setIsByteplusValid: (valid) => set({ isByteplusValid: valid }),
      setIsValidatingByteplus: (validating) => set({ isValidatingByteplus: validating }),

      // Evolink
      evolinkApiKey: '',
      evolinkResolution: '720p',
      evolinkDuration: 5,
      isEvolinkValid: false,
      isValidatingEvolink: false,
      setEvolinkApiKey: (key) => set({ evolinkApiKey: key }),
      setEvolinkResolution: (resolution) => set({ evolinkResolution: resolution }),
      setEvolinkDuration: (duration) => set({ evolinkDuration: duration }),
      setIsEvolinkValid: (valid) => set({ isEvolinkValid: valid }),
      setIsValidatingEvolink: (validating) => set({ isValidatingEvolink: validating }),

      // Runware (for video)
      runwareDuration: 5,
      runwareResolution: '720p',
      isRunwareValid: false,
      isValidatingRunware: false,
      setRunwareDuration: (duration) => set({ runwareDuration: duration }),
      setRunwareResolution: (resolution) => set({ runwareResolution: resolution }),
      setIsRunwareValid: (valid) => set({ isRunwareValid: valid }),
      setIsValidatingRunware: (validating) => set({ isValidatingRunware: validating }),

      // Video Generation Range
      videoGenerationRange: 300,
      setVideoGenerationRange: (range) => set({ videoGenerationRange: range }),

      // Audio Provider
      audioProvider: 'google-chirp3',
      setAudioProvider: (provider) => set({ audioProvider: provider }),

      // Chirp
      chirpApiKey: '',
      chirpVoice: 'Kore',
      chirpSpeed: 1.0,
      setChirpApiKey: (key) => set({ chirpApiKey: key }),
      setChirpVoice: (voice) => set({ chirpVoice: voice }),
      setChirpSpeed: (speed) => set({ chirpSpeed: speed }),

      // Google TTS Voices
      neural2Voice: 'ko-KR-Neural2-A',
      standardVoice: 'ko-KR-Standard-A',
      wavenetVoice: 'ko-KR-Wavenet-A',
      studioVoice: 'ko-KR-Studio-A',
      setNeural2Voice: (voice) => set({ neural2Voice: voice }),
      setStandardVoice: (voice) => set({ standardVoice: voice }),
      setWavenetVoice: (voice) => set({ wavenetVoice: voice }),
      setStudioVoice: (voice) => set({ studioVoice: voice }),

      // Azure TTS
      azureApiKey: '',
      azureVoice: 'ko-KR-SunHiNeural',
      setAzureApiKey: (key) => set({ azureApiKey: key }),
      setAzureVoice: (voice) => set({ azureVoice: voice }),

      // ElevenLabs
      elSettings: {
        apiKey: '',
        voiceId: '',
        speed: 1.0,
      },
      setElSettings: (settings) => set({ elSettings: settings }),

      // Subtitle Settings
      subtitleSettings: DEFAULT_SUBTITLE_SETTINGS,
      setSubtitleSettings: (settings) => set({ subtitleSettings: settings }),
    }),
    {
      name: 'app-settings-storage',
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        geminiApiKey: state.geminiApiKey,
        geminiModel: state.geminiModel,
        geminiImageModel: state.geminiImageModel,
        googleCloudProjectId: state.googleCloudProjectId,
        googleCloudLocation: state.googleCloudLocation,
        imageProvider: state.imageProvider,
        runwareApiKey: state.runwareApiKey,
        videoProvider: state.videoProvider,
        bytedanceApiKey: state.bytedanceApiKey,
        bytedanceModel: state.bytedanceModel,
        evolinkApiKey: state.evolinkApiKey,
        evolinkResolution: state.evolinkResolution,
        evolinkDuration: state.evolinkDuration,
        runwareDuration: state.runwareDuration,
        runwareResolution: state.runwareResolution,
        videoGenerationRange: state.videoGenerationRange,
        audioProvider: state.audioProvider,
        chirpApiKey: state.chirpApiKey,
        chirpVoice: state.chirpVoice,
        chirpSpeed: state.chirpSpeed,
        neural2Voice: state.neural2Voice,
        standardVoice: state.standardVoice,
        wavenetVoice: state.wavenetVoice,
        studioVoice: state.studioVoice,
        azureApiKey: state.azureApiKey,
        azureVoice: state.azureVoice,
        elSettings: state.elSettings,
        subtitleSettings: state.subtitleSettings,
      }),
    }
  )
);
