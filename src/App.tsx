import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { GoogleGenAI } from "@google/genai";
import { GeminiService } from './services/geminiService';
import { generateSceneVideo, generateBatchVideos, VideoEngine, mergeVideos, generateSimpleZoomVideo, addAudioToVideo } from './services/videoService';
import { StoryProject, CharacterProfile, Scene, AppStep, VisualStyle, ElevenLabsSettings, SavedStyle, SavedCharacter, SceneEffect, SubtitleSettings } from './types';
import { StyleTemplate } from './types/template';
import StyleTemplateModal from './components/StyleTemplateModal';
import StyleTemplateSelector from './components/StyleTemplateSelector';
import SubtitleTemplateModal from './components/SubtitleTemplateModal';
import FullscreenSettings from './components/FullscreenSettings';
import ProgressSteps from './components/ProgressSteps';
import { styleTemplates } from './data/styleTemplates';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useSettingsStore } from './stores/settingsStore';
import { useProjectStore } from './stores/projectStore';

const BUILD_VERSION = 'v1.5-dual-download-buttons';

// 특징(태그) 한국어 번역 맵 (확장됨)
const TAG_MAP: Record<string, string> = {
  'male': '남성', 'female': '여성', 'young': '어린', 'middle aged': '중년',
  'old': '중후한', 'calm': '차분한', 'deep': '깊은', 'energetic': '활기찬',
  'professional': '전문적인', 'friendly': '친근한', 'soft': '부드러운',
  'warm': '따뜻한', 'relaxed': '편안한', 'resonant': '울림있는',
  'casual': '캐주얼', 'narrative': '내레이션', 'news': '뉴스',
  'gentle': '다정한', 'authoritative': '권위있는', 'confident': '신뢰감있는',
  'bright': '밝은', 'dark': '어두운', 'clear': '선명한', 'raspy': '허스키한'
};

const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  fontSize: 32,
  fontFamily: 'Pretendard',
  fontWeight: 700,
  fontStyle: 'normal',
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
  bgRadius: 8,
  position: 'bottom',
  yPosition: 650,
  lockPosition: true,
  lockFont: true,
};

const EXP_TEST_PROJECT_ID = 'exp-official-sdk-test-pid';
const EXP_TEST_PROJECT: StoryProject = {
  id: EXP_TEST_PROJECT_ID,
  title: '소금 장인의 숨겨진 진실',
  script: '노년의 소금 장인 박씨가 평생 지켜온 비밀이 밝혀지는 이야기.',
  style: 'realistic',
  characters: [],
  scenes: [
    {
      id: 'exp-scene-1',
      scriptSegment: '아버님! 그건 아버님이 만든 소금이 아니잖아요!',
      imagePrompt: '한국 드라마 실내 장면, 감정적인 대화',
      imageUrl: null,
      audioUrl: null,
      videoUrl: null,
      status: 'idle',
      audioStatus: 'idle',
      videoStatus: 'idle',
    },
  ],
  updatedAt: Date.now(),
};

// 초를 "0분 0초" 형식으로 변환하는 헬퍼 함수
const formatSecondsToTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}분 ${remainingSeconds}초`;
};

const App: React.FC = () => {
  // Zustand stores
  const {
    isDarkMode,
    setIsDarkMode,
    geminiApiKey,
    setGeminiApiKey,
    geminiModel,
    setGeminiModel,
    geminiImageModel,
    setGeminiImageModel,
    isGeminiValid,
    setIsGeminiValid,
    isValidatingGemini,
    setIsValidatingGemini,
    googleCloudProjectId,
    setGoogleCloudProjectId,
    googleCloudLocation,
    setGoogleCloudLocation,
    imageProvider,
    setImageProvider,
    runwareApiKey,
    setRunwareApiKey,
    videoProvider,
    setVideoProvider,
    bytedanceApiKey,
    setBytedanceApiKey,
    bytedanceModel,
    setBytedanceModel,
    isByteplusValid,
    setIsByteplusValid,
    isValidatingByteplus,
    setIsValidatingByteplus,
    evolinkApiKey,
    setEvolinkApiKey,
    evolinkResolution,
    setEvolinkResolution,
    evolinkDuration,
    setEvolinkDuration,
    isEvolinkValid,
    setIsEvolinkValid,
    isValidatingEvolink,
    setIsValidatingEvolink,
    runwareDuration,
    setRunwareDuration,
    runwareResolution,
    setRunwareResolution,
    isRunwareValid,
    setIsRunwareValid,
    isValidatingRunware,
    setIsValidatingRunware,
    videoGenerationRange,
    setVideoGenerationRange,
    audioProvider,
    setAudioProvider,
    chirpApiKey,
    setChirpApiKey,
    chirpVoice,
    setChirpVoice,
    chirpSpeed,
    setChirpSpeed,
    neural2Voice,
    setNeural2Voice,
    standardVoice,
    setStandardVoice,
    wavenetVoice,
    setWavenetVoice,
    studioVoice,
    setStudioVoice,
    azureApiKey,
    setAzureApiKey,
    azureVoice,
    setAzureVoice,
    elSettings,
    setElSettings,
    subtitleSettings,
    setSubtitleSettings,
  } = useSettingsStore();

  const {
    projects,
    setProjects,
    currentProjectId,
    setCurrentProjectId,
    updateProject,
    savedStyles,
    setSavedStyles,
    addSavedStyle,
    deleteSavedStyle,
    savedCharacters,
    setSavedCharacters,
    addSavedCharacter,
    deleteSavedCharacter,
  } = useProjectStore();

  const [step, setStep] = useState<AppStep>('dashboard'); // 첫 화면: 프로젝트 목록
  // 브랜치2: 비디오 API 전용
  const [videoEngine, setVideoEngine] = useState<VideoEngine>('bytedance');

  const project = useMemo(() => {
    return projects.find(p => p.id === currentProjectId) || null;
  }, [projects, currentProjectId]);

  // 현재 페이지 상태에 따라 step 자동 동기화 (프로젝트 ID 변경 시에만)
  useEffect(() => {
    if (!currentProjectId) {
      setStep('dashboard');
    } else if (project) {
      // 프로젝트 ID가 변경될 때만 자동 step 설정 (캐릭터 추가 시 step 유지)
      if (project.scenes && project.scenes.length > 0) {
        setStep('storyboard');
      } else if (project.characters && project.characters.length > 0) {
        setStep('character_setup');
      } else if (project.script) {
        setStep('input');
      } else {
        setStep('input');
      }
    }
  }, [currentProjectId]); // 의존성에서 characters/scenes length 제거 → step 유지

  // Wrappers to keep functional update pattern working
  const updateProjects = (updater: (prev: StoryProject[]) => StoryProject[]) => {
    setProjects(updater(projects));
  };

  const updateSavedStyles = (updater: (prev: SavedStyle[]) => SavedStyle[]) => {
    setSavedStyles(updater(savedStyles));
  };

  const updateSavedCharacters = (updater: (prev: SavedCharacter[]) => SavedCharacter[]) => {
    setSavedCharacters(updater(savedCharacters));
  };

  const [script, setScript] = useState('');
  const [style, setStyle] = useState<VisualStyle>('2d-animation');
  const [refImages, setRefImages] = useState<string[]>([]);
  const [selectedStyleTemplate, setSelectedStyleTemplate] = useState<StyleTemplate | null>(
    styleTemplates.find(t => t.id === 'modern-anime') || null
  );
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isTemplateAddMode, setIsTemplateAddMode] = useState(false);
  const [tempSelectedTemplate, setTempSelectedTemplate] = useState<StyleTemplate | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('준비 중...');
  const [targetProgress, setTargetProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  const [bgTask, setBgTask] = useState<{ type: 'style' | 'video' | 'analysis' | 'storyboard', message: string } | null>(null);
  const [bgProgress, setBgProgress] = useState(0);

  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [hasVisitedSetup, setHasVisitedSetup] = useState(false);

  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleImages, setNewStyleImages] = useState<string[]>([]);
  const [newStyleDescription, setNewStyleDescription] = useState('');
  const [isStyleDescModalOpen, setIsStyleDescModalOpen] = useState(false);
  const [customStyleName, setCustomStyleName] = useState('');
  const [isStyleNameModalOpen, setIsStyleNameModalOpen] = useState(false);
  const styleLibraryInputRef = useRef<HTMLInputElement>(null);
  const [newCharLibName, setNewCharLibName] = useState('');
  const [newCharLibImages, setNewCharLibImages] = useState<string[]>([]);
  const [charLibSaveProgress, setCharLibSaveProgress] = useState<number | null>(null);
  const charLibInputRef = useRef<HTMLInputElement>(null);
  const [isLoadCharModalOpen, setIsLoadCharModalOpen] = useState(false);

  const [isManualCharAdding, setIsManualCharAdding] = useState(false);

  const [expandedSetting, setExpandedSetting] = useState<string | null>(null);
  const [showSubtitleEditor, setShowSubtitleEditor] = useState(false);

  const [showRunwareKey, setShowRunwareKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showElKey, setShowElKey] = useState(false);
  const [showChirpKey, setShowChirpKey] = useState(false);

  // 비디오 API 설정
  const [showBytedanceKey, setShowBytedanceKey] = useState(false);
  const [showEvolinkKey, setShowEvolinkKey] = useState(false);
  const [bytedanceDuration] = useState(10); // 10초 고정
  const [bytedanceResolution] = useState('720p'); // 720p 고정

  // 분/초 별도 입력을 위한 계산
  const videoRangeMinutes = Math.floor(videoGenerationRange / 60);
  const videoRangeSeconds = videoGenerationRange % 60;

  const updateVideoRange = (minutes: number, seconds: number) => {
    const totalSeconds = Math.max(0, Math.min(1800, minutes * 60 + seconds));
    setVideoGenerationRange(totalSeconds);
  };

  // 비용 계산 함수 (Provider별 차등 적용)
  const calculateVideoCost = () => {
    const numScenes = Math.floor(videoGenerationRange / 10);

    // Provider별 비용 (10초당 1장 기준)
    // BytePlus: ₩307/10초 (1장)
    // Evolink: ₩190/10초 (1장)
    // Runware: ₩195/10초 (1장)
    const costPerScene = videoProvider === 'byteplus' ? 307 :
                        videoProvider === 'evolink' ? 190 :
                        videoProvider === 'runware' ? 195 : 307;

    const totalCost = numScenes * costPerScene;

    return {
      numScenes,
      costPerScene,
      totalCost,
    };
  };

  // 업로드된 WAV 파일 상태
  const [uploadedWavFile, setUploadedWavFile] = useState<{ file: File; url: string } | null>(null);
  const azureRegion = 'koreacentral'; // 한국 고정
  const [showAzureKey, setShowAzureKey] = useState(false);

  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [isCharLoadModalOpen, setIsCharLoadModalOpen] = useState(false);
  const [charLoadModalMode, setCharLoadModalMode] = useState<'list' | 'add'>('list');
  const [newCharData, setNewCharData] = useState({ name: '', gender: '여성', age: '성인', traits: '' });
  const [newSavedCharData, setNewSavedCharData] = useState<{ name: string; refImages: string[] }>({ name: '', refImages: [] });
  const [isSavingChar, setIsSavingChar] = useState(false);

  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptEditType, setPromptEditType] = useState<'character' | 'scene'>('scene');
  const [promptEditId, setPromptEditId] = useState<string | null>(null);
  const [promptEditInput, setPromptEditInput] = useState('');

  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [regenerateType, setRegenerateType] = useState<'character' | 'scene'>('scene');
  const [regenerateId, setRegenerateId] = useState<string | null>(null);
  const [regenerateInput, setRegenerateInput] = useState('');

  const [isMyPageOpen, setIsMyPageOpen] = useState(false);
  const [showCostDetails, setShowCostDetails] = useState(false);
  const [isSettingsFullscreen, setIsSettingsFullscreen] = useState(false);
  const [costPeriod, setCostPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Login/Signup states
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');

  // Storyboard selection mode for merging
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [voices, setVoices] = useState<any[]>([]);
  const [isElConnected, setIsElConnected] = useState(false);
  const [isAssetMenuOpen, setIsAssetMenuOpen] = useState(false);
  const [isVoiceTesting, setIsVoiceTesting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isMergedView, setIsMergedView] = useState(false);
  const [expandedSceneIndex, setExpandedSceneIndex] = useState<number | null>(null);
  const [videoRegenerateSceneId, setVideoRegenerateSceneId] = useState<string | null>(null);
  const [videoRegeneratePrompt, setVideoRegeneratePrompt] = useState('');
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [showSubtitlePrompt, setShowSubtitlePrompt] = useState(false);
  const [includeSubtitles, setIncludeSubtitles] = useState(false);
  const [showScriptCharPrompt, setShowScriptCharPrompt] = useState(false);
  const [scriptCharacters, setScriptCharacters] = useState<string[]>([]);

  const sceneImageUploadRef = useRef<HTMLInputElement>(null);
  const sceneAudioUploadRef = useRef<HTMLInputElement>(null);
  const styleRefImageInputRef = useRef<HTMLInputElement>(null);
  const charPortraitUploadRef = useRef<HTMLInputElement>(null);
  const wavUploadRef = useRef<HTMLInputElement>(null);
  const activeCharId = useRef<string | null>(null);
  const activeSceneId = useRef<string | null>(null);

  // 프로젝트 마이그레이션은 projectStore persist가 자동 처리
  useEffect(() => {
    // Zustand persist가 자동으로 user_projects_v1에서 로드함
  }, []); // 한 번만 실행

  // 다크모드 토글 핸들러
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // 그림체 설정 페이지 진입 시 처리 (삭제됨 - 템플릿 추가 모달 허용)

  // Build version log
  useEffect(() => {
    console.log(`[APP] BUILD_VERSION: ${BUILD_VERSION}`);
  }, []);

  // Gemini API validation
  useEffect(() => {
    if (geminiApiKey.length > 20) {
      checkGeminiKey(geminiApiKey);
    } else {
      setIsGeminiValid(false);
    }
  }, [geminiApiKey]);

  // 자막 미리보기 렌더링
  useEffect(() => {
    const canvas = document.getElementById('subtitle-preview-canvas') as HTMLCanvasElement;
    if (!canvas || expandedSetting !== 'subtitle') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 배경
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 1280, 720);

    ctx.font = `bold ${subtitleSettings.fontSize}px "${subtitleSettings.fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const text = '미리보기 자막 텍스트';
    const textY = subtitleSettings.yPosition;

    // 배경 박스
    if (subtitleSettings.backgroundColor) {
      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const bgPadding = subtitleSettings.bgPadding || 8;
      const bgHeight = subtitleSettings.fontSize + bgPadding * 2;

      const hex = subtitleSettings.backgroundColor;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const a = subtitleSettings.bgOpacity || 0.8;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
      ctx.fillRect(
        1280 / 2 - textWidth / 2 - bgPadding,
        textY - subtitleSettings.fontSize - bgPadding,
        textWidth + bgPadding * 2,
        bgHeight
      );
    }

    ctx.globalAlpha = subtitleSettings.opacity;

    // 외곽선
    if (subtitleSettings.strokeWidth > 0 && subtitleSettings.strokeColor !== 'transparent') {
      ctx.strokeStyle = subtitleSettings.strokeColor;
      ctx.lineWidth = subtitleSettings.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(text, 1280 / 2, textY);
    }

    // 텍스트
    ctx.fillStyle = subtitleSettings.textColor;
    ctx.fillText(text, 1280 / 2, textY);

    ctx.globalAlpha = 1.0;

    // Y축 가이드라인
    ctx.strokeStyle = '#FF0000';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, subtitleSettings.yPosition);
    ctx.lineTo(1280, subtitleSettings.yPosition);
    ctx.stroke();
  }, [subtitleSettings, expandedSetting]);

  // el_speed는 settingsStore persist가 자동 저장

  useEffect(() => {
    if (elSettings.apiKey.length > 10) {
      checkElevenLabs();
    } else {
      setIsElConnected(false);
    }
  }, [elSettings.apiKey]);

  useEffect(() => {
    let frame: number;
    const animate = () => {
      setDisplayProgress(prev => {
        if (prev < targetProgress) {
          const diff = targetProgress - prev;
          const move = Math.max(0.1, diff * 0.05);
          return Math.min(prev + move, targetProgress);
        }
        return prev;
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [targetProgress]);

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      setIsLoggedIn(true);
    }
  }, []);

  const gemini = useMemo(() => new GeminiService(), []);

  const checkGeminiKey = async (key: string) => {
    setIsValidatingGemini(true);
    try {
      // Google Cloud (Vertex AI) 설정 확인 (store에서 읽기)
      const projectId = googleCloudProjectId || '';
      const location = googleCloudLocation || 'us-central1';

      // Project ID가 있으면 Vertex AI 모드
      const ai = projectId && projectId.trim().length > 0
        ? new GoogleGenAI({ apiKey: key, vertexai: true, project: projectId, location, apiVersion: 'v1' })
        : new GoogleGenAI({ apiKey: key });

      const model = geminiModel;
      const response = await ai.models.generateContent({
        model: model,
        contents: 'test'
      });

      // If we get here without error, the key is valid
      if (response) {
        setIsGeminiValid(true);
      } else {
        setIsGeminiValid(false);
      }
    } catch (error) {
      console.error('API key validation error:', error);
      setIsGeminiValid(false);
    } finally {
      setIsValidatingGemini(false);
    }
  };

  const checkByteplusKey = async (key: string) => {
    console.log('[checkByteplusKey] 검증 시작:', key.substring(0, 10) + '...');
    if (!key || key.length < 10) {
      setIsByteplusValid(false);
      console.log('[checkByteplusKey] 키가 너무 짧음');
      return;
    }
    setIsValidatingByteplus(true);
    try {
      const BYTEPLUS_API = 'https://hiyoonsh1--byteplus-proxy-web.modal.run';
      console.log('[checkByteplusKey] API 호출:', BYTEPLUS_API);
      const response = await fetch(`${BYTEPLUS_API}/api/v3/byteplus/models`, {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      console.log('[checkByteplusKey] 응답:', response.status, response.ok);

      // 200-299 또는 401/403이 아니면 일단 유효로 간주 (서버 오류 가능성)
      if (response.ok) {
        setIsByteplusValid(true);
      } else if (response.status === 401 || response.status === 403) {
        setIsByteplusValid(false);
      } else {
        // 서버 오류 등의 경우 키 길이로 판단
        setIsByteplusValid(key.length >= 20);
      }
    } catch (error) {
      console.error('[checkByteplusKey] 에러:', error);
      // 네트워크 에러 등의 경우 키 길이로 판단
      setIsByteplusValid(key.length >= 20);
    } finally {
      setIsValidatingByteplus(false);
    }
  };

  const checkEvolinkKey = async (key: string) => {
    if (!key || key.length < 10) {
      setIsEvolinkValid(false);
      return;
    }
    setIsValidatingEvolink(true);
    try {
      // Evolink API 테스트 (간단한 모델 조회)
      const response = await fetch('https://api.evolink.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      setIsEvolinkValid(response.ok);
    } catch (error) {
      console.error('Evolink API key validation error:', error);
      setIsEvolinkValid(false);
    } finally {
      setIsValidatingEvolink(false);
    }
  };

  const checkRunwareKey = async (key: string) => {
    if (!key || key.length < 10) {
      setIsRunwareValid(false);
      return;
    }
    setIsValidatingRunware(true);
    try {
      // Runware API 간단 테스트 (연결 확인)
      const response = await fetch('https://api.runware.ai/v1/health', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      setIsRunwareValid(response.ok);
    } catch (error) {
      console.error('Runware API key validation error:', error);
      setIsRunwareValid(false);
    } finally {
      setIsValidatingRunware(false);
    }
  };

  const handleLogin = () => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find((u: any) => u.username === loginUsername && u.password === loginPassword);
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      setIsLoggedIn(true);
      setIsLoginModalOpen(false);
      setLoginUsername('');
      setLoginPassword('');
      alert('로그인 성공!');
    } else {
      alert('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  const handleSignup = () => {
    if (!signupUsername || !signupPassword || !signupEmail) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find((u: any) => u.username === signupUsername)) {
      alert('이미 존재하는 아이디입니다.');
      return;
    }
    users.push({ username: signupUsername, password: signupPassword, email: signupEmail });
    localStorage.setItem('users', JSON.stringify(users));
    setIsSignupModalOpen(false);
    setSignupUsername('');
    setSignupPassword('');
    setSignupEmail('');
    alert('회원가입 성공! 로그인해주세요.');
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setIsLoggedIn(false);
    alert('로그아웃되었습니다.');
  };

  // [EXP] 빠른 테스트: 이미지 URL 받아 씬 1개짜리 프로젝트 생성 → 스토리보드 직행
  const quickTestStart = (imageUrl: string) => {
    const pid = crypto.randomUUID();
    const testProject: StoryProject = {
      id: pid,
      title: '[EXP] 빠른 테스트',
      script: '테스트 씬',
      style: 'realistic',
      characters: [],
      scenes: [{
        id: crypto.randomUUID(),
        scriptSegment: '테스트',
        imagePrompt: 'test',
        imageUrl,
        audioUrl: null,
        videoUrl: null,
        status: 'done',
        audioStatus: 'idle',
        videoStatus: 'idle',
      }],
      updatedAt: Date.now(),
    };
    updateProjects(prev => [testProject, ...prev]);
    setCurrentProjectId(pid);
    setStep('storyboard');
  };

  const updateCurrentProject = useCallback((updates: Partial<StoryProject>) => {
    if (!currentProjectId) return;
    updateProject(currentProjectId, updates);
  }, [currentProjectId, updateProject]);

  const checkElevenLabs = async () => {
    if (!elSettings.apiKey) {
      setIsElConnected(false);
      return;
    }
    try {
      const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': elSettings.apiKey }
      });
      if (resp.ok) {
        const data = await resp.json();
        setVoices(data.voices);
        setIsElConnected(true);
        // el_api_key는 settingsStore persist가 자동 저장
      } else {
        setIsElConnected(false);
      }
    } catch {
      setIsElConnected(false);
    }
  };

  const checkAndOpenAudioSettings = () => {
    if (audioProvider === 'elevenlabs' && !elSettings.apiKey) {
      alert('일레븐랩스 API키를 입력해주세요.');
      setIsMyPageOpen(true);
      setExpandedSetting('audio');
      return false;
    }
    if (audioProvider === 'microsoft' && !azureApiKey) {
      alert('Azure Speech API 키를 입력해주세요.');
      setIsMyPageOpen(true);
      setExpandedSetting('audio');
      return false;
    }
    return true;
  };

  const handleVoiceTest = async () => {
    setIsVoiceTesting(true);
    try {
      if (audioProvider === 'microsoft') {
        // Azure TTS 테스트
        if (!azureApiKey) throw new Error('Azure API key required');
        const response = await fetch(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureApiKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
          },
          body: `<speak version='1.0' xml:lang='ko-KR'>
            <voice xml:lang='ko-KR' name='${azureVoice}'>
              <prosody rate='${chirpSpeed}'>
                안녕하세요, 테스트 목소리입니다.
              </prosody>
            </voice>
          </speak>`
        });
        if (!response.ok) throw new Error(`Azure TTS failed: ${response.status}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        audio.play();
      } else if (audioProvider === 'elevenlabs') {
        if (!elSettings.apiKey) throw new Error("API Key required");
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elSettings.voiceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': elSettings.apiKey },
          body: JSON.stringify({
            text: "안녕하세요, 테스트 목소리입니다.",
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: elSettings.speed }
          })
        });
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        audio.play();
      } else if (audioProvider === 'google-neural2') {
        // Neural2 테스트
        const audioUrl = await gemini.generateGoogleTTS("안녕하세요, 테스트 목소리입니다.", neural2Voice, chirpSpeed, chirpApiKey);
        new Audio(audioUrl).play();
      } else {
        // Chirp3 테스트
        const audioUrl = await gemini.generateGoogleTTS("안녕하세요, 테스트 목소리입니다.", chirpVoice, chirpSpeed, chirpApiKey);
        new Audio(audioUrl).play();
      }
    } catch (e) {
      console.error('Voice test error:', e);
      alert("목소리 테스트 실패. 설정을 확인해주세요.");
    } finally {
      setIsVoiceTesting(false);
    }
  };

  const handleSceneImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSceneId.current || !project) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result as string;
      updateCurrentProject({
        scenes: project.scenes.map(s => s.id === activeSceneId.current ? { ...s, imageUrl: url, status: 'done' } : s)
      });
      activeSceneId.current = null;
      if (e.target) e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleSceneAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSceneId.current || !project) return;
    // 이전 오디오 URL 정리
    const prevScene = project.scenes.find(s => s.id === activeSceneId.current);
    if (prevScene?.audioUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(prevScene.audioUrl);
    }
    const url = URL.createObjectURL(file);
    updateCurrentProject({
      scenes: project.scenes.map(s => s.id === activeSceneId.current ? { ...s, audioUrl: url, audioStatus: 'done' } : s)
    });
    activeSceneId.current = null;
    if (e.target) e.target.value = '';
  };

  const handleWavUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    // 오디오 파일을 데이터 URL로 변환하여 저장
    const reader = new FileReader();
    reader.onload = (ev) => {
      const audioDataUrl = ev.target?.result as string;
      setUploadedWavFile({ file, url: audioDataUrl });
      alert('WAV 파일이 업로드되었습니다. 이제 오디오 생성 버튼을 눌러 자동 분할하거나 새로 생성할 수 있습니다.');
    };
    reader.readAsDataURL(file);

    if (e.target) e.target.value = '';
  };

  const handleCharPortraitUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCharId.current || !project) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result as string;
      updateCurrentProject({
        characters: project.characters.map(c => c.id === activeCharId.current ? { ...c, portraitUrl: url, status: 'done' } : c)
      });
      activeCharId.current = null;
      if (e.target) e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleStyleLibraryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (newStyleImages.length + files.length > 10) {
      alert("자주 쓰는 그림체 레퍼런스는 최대 10장까지 가능합니다.");
      return;
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewStyleImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCharLibraryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (newCharLibImages.length + files.length > 10) {
      alert("인물 레퍼런스는 최대 10장까지 가능합니다.");
      return;
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCharLibImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleStyleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refImages.length + files.length > 7) {
      alert("맞춤형 스타일 레퍼런스는 최대 7장까지 가능합니다.");
      return;
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeStyleRefImage = (index: number) => {
    setRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const addNewStyle = async () => {
    if (!newStyleName.trim()) { alert('그림체 이름을 입력해주세요.'); return; }
    if (newStyleImages.length === 0) { alert('이미지를 최소 1장 이상 등록해주세요.'); return; }
    if (savedStyles.length >= 10) { alert('자주 쓰는 그림체은 최대 10개까지 저장 가능합니다.'); return; }

    setBgTask({ type: 'style', message: '참고 이미지를 바탕으로 화풍을 학습중입니다' });
    setBgProgress(0);

    const progressTimer = setInterval(() => {
       setBgProgress(prev => Math.min(prev + 2, 90));
    }, 200);

    try {
      const analysis = await gemini.analyzeStyle(newStyleImages);
      clearInterval(progressTimer);
      setBgProgress(100);

      const newStyle: SavedStyle = {
        id: crypto.randomUUID(),
        name: newStyleName,
        refImages: newStyleImages,
        description: analysis.style,
        characterAppearance: analysis.characterAppearance
      };
      updateSavedStyles(prev => [...prev, newStyle]);
      setNewStyleName('');
      setNewStyleImages([]);

      setTimeout(() => {
         setBgTask(null);
         setBgProgress(0);
      }, 1500);
    } catch (err) {
      console.error(err);
      clearInterval(progressTimer);
      alert('화풍 학습에 실패했습니다.');
      setBgTask(null);
    }
  };

  const saveCustomStyleFromInput = async () => {
    if (refImages.length === 0) { alert('이미지를 최소 1장 이상 등록해주세요.'); return; }
    if (refImages.length < 3) {
      if (!confirm('명확한 그림체 학습을 위해 3개 이상 권장합니다. 계속 진행하시겠습니까?')) return;
    }
    if (savedStyles.length >= 10) { alert('자주 쓰는 그림체은 최대 10개까지 저장 가능합니다.'); return; }

    // Show modal to get style name
    setIsStyleNameModalOpen(true);
  };

  const confirmSaveCustomStyle = async () => {
    if (!customStyleName.trim()) { alert('그림체 이름을 입력해주세요.'); return; }
    setIsStyleNameModalOpen(false);

    setBgTask({ type: 'style', message: '참고 이미지를 바탕으로 화풍을 학습중입니다' });
    setBgProgress(0);

    const progressTimer = setInterval(() => {
       setBgProgress(prev => Math.min(prev + 2, 90));
    }, 200);

    try {
      const analysis = await gemini.analyzeStyle(refImages);
      clearInterval(progressTimer);
      setBgProgress(100);

      const newStyle: SavedStyle = {
        id: crypto.randomUUID(),
        name: customStyleName,
        refImages: refImages,
        description: analysis.style,
        characterAppearance: analysis.characterAppearance
      };
      updateSavedStyles(prev => [...prev, newStyle]);
      setCustomStyleName('');
      setRefImages([]);

      setTimeout(() => {
         setBgTask(null);
         setBgProgress(0);
         setStep('dashboard');
      }, 1500);
    } catch (err) {
      console.error('화풍 학습 에러:', err);
      clearInterval(progressTimer);
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      alert(`화풍 학습에 실패했습니다.\n\n에러: ${errorMessage}\n\nGemini API 키를 확인해주세요.`);
      setBgTask(null);
    }
  };

  const addNewCharToLib = async () => {
    if (!newCharLibName.trim()) { alert('인물 이름을 입력해주세요.'); return; }
    if (newCharLibImages.length === 0) { alert('이미지를 최소 1장 이상 등록해주세요.'); return; }
    if (savedCharacters.length >= 10) { alert('자주 사용하는 인물은 최대 10명까지 저장 가능합니다.'); return; }

    setCharLibSaveProgress(10);
    try {
      const analysis = await gemini.analyzeStyle(newCharLibImages);
      setCharLibSaveProgress(80);
      const newChar: SavedCharacter = {
        id: crypto.randomUUID(),
        name: newCharLibName,
        refImages: newCharLibImages,
        description: analysis.characterAppearance || analysis.style,  // 인물 외형 정보 우선
        portraitUrl: newCharLibImages[0]
      };
      updateSavedCharacters(prev => [...prev, newChar]);
      setNewCharLibName('');
      setNewCharLibImages([]);
      setCharLibSaveProgress(100);
      setTimeout(() => setCharLibSaveProgress(null), 1000);
      return newChar;
    } catch (err) {
      console.error(err);
      alert('인물 학습에 실패했습니다.');
      setCharLibSaveProgress(null);
      return null;
    }
  };

  const addNewCharToLibFromSidebar = async () => {
    const newChar = await addNewCharToLib();
    if (newChar) {
      alert(`${newChar.name} 인물이 저장소에 추가되었습니다.`);
    }
  };

  const startAnalysis = async () => {
    if (!script.trim()) {
      alert('대본을 입력해주세요.');
      return;
    }
    if (!geminiApiKey) {
      alert('Gemini API 키를 설정해주세요.');
      setIsMyPageOpen(true);
      return;
    }
    const activeProject = projects.find(p => p.id === currentProjectId);
    if (!activeProject) {
      alert('프로젝트를 선택해주세요.');
      return;
    }

    if (activeProject.characters.length > 0 && activeProject.script === script) {
      setStep('style_selection');
      setHasVisitedSetup(true);
      return;
    }

    // 먼저 화면 이동
    setStep('style_selection');
    setHasVisitedSetup(true);
    setBgTask({ type: 'analysis', message: '등장인물 분석 중...' });
    setBgProgress(10);

    try {
      let customStyleDesc: string | undefined = undefined;
      let charAppearance: string | undefined = undefined;
      const saved = savedStyles.find(s => s.id === style);
      if (saved) {
        customStyleDesc = saved.description;
        charAppearance = saved.characterAppearance;  // 레퍼런스 이미지 속 캐릭터 외형도 포함
      } else if (style === 'custom') {
        setBgProgress(20);
        if (refImages.length > 0) {
          const analysis = await gemini.analyzeStyle(refImages);
          customStyleDesc = analysis.style;
          charAppearance = analysis.characterAppearance;
        } else {
          customStyleDesc = "Modern clean digital art style";
        }
      }

      setBgProgress(50);
      setBgTask({ type: 'analysis', message: '캐릭터 외형 프롬프트 생성 중...' });
      // 캐릭터 외형 정보도 스타일 설명에 포함
      const fullStyleDesc = charAppearance
        ? `${customStyleDesc || ''}. Character reference: ${charAppearance}`
        : customStyleDesc;
      const data = await gemini.extractCharacters(script, style === 'custom' || saved ? 'custom' : style as VisualStyle, fullStyleDesc);

      setBgProgress(80);
      const updatedProject: StoryProject = {
        ...activeProject,
        title: data.title,
        script,
        style,
        customStyleDescription: customStyleDesc,
        characterAppearance: charAppearance,
        characters: data.characters
      };

      updateCurrentProject(updatedProject);
      setBgProgress(100);
      setBgTask(null);

      // 이미지 자동 생성
      data.characters.forEach(char => generatePortrait(char.id, updatedProject));

    } catch (err: any) {
      console.error(err);
      alert("API 오류: " + (err?.message || "연결에 실패했습니다. 다시 시도해주세요."));
      setBgTask(null);
      setBgProgress(0);
    }
  };

  const generatePortrait = async (charId: string, specificProject?: StoryProject) => {
    const activeProject = specificProject || project;
    if (!activeProject || !currentProjectId) return;

    updateProjects(prev => prev.map(p => p.id === activeProject.id ? {
      ...p, characters: p.characters.map(c => c.id === charId ? { ...c, status: 'loading', portraitUrl: null } : c)
    } : p));

    try {
      const char = activeProject.characters.find(c => c.id === charId);
      if (!char) return;

      // 학습된 그림체 스타일 100% 적용
      let finalPrompt = char.visualDescription;

      // 스타일 템플릿 프리픽스 추가 (씬과 동일하게 적용)
      if (selectedStyleTemplate) {
        finalPrompt = `${selectedStyleTemplate.imagePromptPrefix} ${finalPrompt}`;
      }

      if (activeProject.customStyleDescription) {
        finalPrompt = `${finalPrompt}, Art style: ${activeProject.customStyleDescription}`;
      }

      // 레퍼런스 이미지 속 캐릭터 외형 정보 추가
      if (activeProject.characterAppearance) {
        finalPrompt = `${finalPrompt}, Character appearance reference: ${activeProject.characterAppearance}`;
      }

      // 저장된 인물(savedCharacters)에서 매칭되는 캐릭터의 레퍼런스 이미지 찾기
      const referenceImages: string[] = [];
      const matchingSavedChar = savedCharacters.find(
        sc => sc.name.toLowerCase().includes(char.name.toLowerCase()) ||
              char.name.toLowerCase().includes(sc.name.toLowerCase())
      );
      if (matchingSavedChar && matchingSavedChar.refImages.length > 0) {
        referenceImages.push(...matchingSavedChar.refImages.slice(0, 3)); // 최대 3장
      }

      const url = await gemini.generateImage(
        finalPrompt,
        true,
        geminiImageModel,
        referenceImages.length > 0 ? referenceImages : undefined
      );
      updateProjects(prev => prev.map(p => p.id === activeProject.id ? {
        ...p, characters: p.characters.map(c => c.id === charId ? { ...c, portraitUrl: url, status: 'done' } : c)
      } : p));
    } catch (err: any) {
      console.error('Portrait generation failed:', err);
      const errorMsg = err?.message || '알 수 없는 오류';
      // 사용자 친화적 에러 메시지
      let userMessage = '캐릭터 초상화 생성 실패: ';
      if (errorMsg.includes('API key')) {
        userMessage += 'API 키를 확인해주세요.';
      } else if (errorMsg.includes('quota') || errorMsg.includes('429')) {
        userMessage += 'API 사용량 한도 초과. 잠시 후 다시 시도해주세요.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        userMessage += '네트워크 연결을 확인해주세요.';
      } else {
        userMessage += errorMsg;
      }
      alert(userMessage);
      updateProjects(prev => prev.map(p => p.id === activeProject.id ? {
        ...p, characters: p.characters.map(c => c.id === charId ? { ...c, status: 'error' } : c)
      } : p));
    }
  };

  const proceedToStoryboard = async (isRegen: boolean = true, retryCount: number = 0) => {
    if (!project) return;
    if (!isRegen && project.scenes?.length > 0) { setStep('storyboard'); return; }

    // 빈 스크립트 체크
    if (!project.script || project.script.trim().length === 0) {
      alert('스크립트를 입력해주세요.');
      return;
    }

    setBgTask({ type: 'storyboard', message: retryCount > 0 ? `재시도 중... (${retryCount}회)` : '장면별 스토리보드 구성 중...' });
    setBgProgress(10);

    try {
      setBgProgress(30);
      const scenes = await gemini.createStoryboard(project);

      // 빈 결과 체크
      if (!scenes || scenes.length === 0) {
        throw new Error('장면 생성 실패: Gemini가 빈 결과를 반환했습니다.');
      }

      // 1단계: 전체 검증 (공백 제거 후 비교)
      const reconstructed = scenes.map(s => s.scriptSegment).join('').replace(/\s+/g, '');
      const original = project.script.replace(/\s+/g, '');

      if (reconstructed !== original) {
        console.warn('⚠️ Script modification detected');
        console.log('Original:', original.length, 'chars');
        console.log('Reconstructed:', reconstructed.length, 'chars');

        // 2단계: 문제 장면 식별
        const originalNormalized = project.script.replace(/\s+/g, '');
        const problematicScenes: number[] = [];

        scenes.forEach((scene, idx) => {
          const segmentNormalized = scene.scriptSegment.replace(/\s+/g, '');
          // 원본에 없는 텍스트가 있으면 문제
          if (!originalNormalized.includes(segmentNormalized)) {
            problematicScenes.push(idx + 1);
          }
        });

        // 3단계: 사용자에게 알림
        if (retryCount >= 3) {
          alert(
            '⚠️ 3회 재시도했지만 계속 수정됩니다.\n\n' +
            (problematicScenes.length > 0
              ? `문제 장면: ${problematicScenes.join(', ')}번\n\n`
              : '') +
            '수정된 버전으로 진행합니다.\n\n' +
            '스토리보드 화면에서 개별 장면을 수정할 수 있습니다.'
          );
          console.log('⚠️ Max retries reached, continuing with modifications');
        } else {
          const message =
            '⚠️ Gemini가 스크립트를 일부 수정했습니다.\n\n' +
            `원본: ${original.length}자\n` +
            `결과: ${reconstructed.length}자\n` +
            (problematicScenes.length > 0
              ? `\n문제 장면: ${problematicScenes.slice(0, 5).join(', ')}번${problematicScenes.length > 5 ? ' 외 ' + (problematicScenes.length - 5) + '개' : ''}\n`
              : '') +
            (retryCount > 0 ? `재시도: ${retryCount}회\n\n` : '\n') +
            '확인 = 그대로 진행 (스토리보드에서 수정 가능)\n' +
            '취소 = 자동 재시도';

          const choice = window.confirm(message);

          if (!choice) {
            // 자동 재시도
            console.log(`🔄 Auto-retry triggered (attempt ${retryCount + 1})`);
            await proceedToStoryboard(true, retryCount + 1);
            return;
          }

          console.log('⚠️ User chose to continue with modifications');
          console.log('Problematic scenes:', problematicScenes);
        }
      }

      updateCurrentProject({ scenes });
      setBgProgress(100);
      setTimeout(() => {
        setStep('storyboard');
        setBgTask(null);
        setBgProgress(0);
      }, 500);
    } catch (err) {
      console.error(err);
      setBgTask(null);
      setBgProgress(0);
      alert("스토리보드 생성 중 오류가 발생했습니다.");
    }
  };

  const generateSceneImage = async (sceneId: string) => {
    if (!currentProjectId) return;

    updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
      ...p,
      scenes: p.scenes.map(s => s.id === sceneId ? { ...s, status: 'loading', imageUrl: null } : s)
    } : p));

    try {
      const activeProject = projects.find(p => p.id === currentProjectId);
      const scene = activeProject?.scenes.find(s => s.id === sceneId);
      if (!scene || !activeProject) return;

      // 학습된 그림체 스타일 100% 적용
      let finalPrompt = scene.imagePrompt;

      // 스타일 템플릿 프리픽스 추가
      if (selectedStyleTemplate) {
        finalPrompt = `${selectedStyleTemplate.imagePromptPrefix} ${finalPrompt}`;
      }

      if (activeProject.customStyleDescription) {
        finalPrompt = `${finalPrompt}, Art style: ${activeProject.customStyleDescription}`;
      }

      // 레퍼런스 이미지 속 캐릭터 외형 정보 추가
      if (activeProject.characterAppearance) {
        finalPrompt = `${finalPrompt}, Character appearance reference: ${activeProject.characterAppearance}`;
      }

      // 캐릭터 일관성: portrait + 저장된 인물 이미지를 레퍼런스로 전달
      const referenceImages: string[] = [];

      // 1. 프로젝트 캐릭터 초상화
      activeProject.characters.forEach(char => {
        if (char.portraitUrl) referenceImages.push(char.portraitUrl);
      });

      // 2. 저장된 인물(savedCharacters)의 레퍼런스 이미지 추가
      savedCharacters.forEach(savedChar => {
        // 프로젝트 캐릭터와 이름이 매칭되는 저장된 인물의 이미지 사용
        const matchingProjectChar = activeProject.characters.find(
          pc => pc.name.toLowerCase().includes(savedChar.name.toLowerCase()) ||
                savedChar.name.toLowerCase().includes(pc.name.toLowerCase())
        );
        if (matchingProjectChar && savedChar.refImages.length > 0) {
          // 저장된 인물의 첫 번째 레퍼런스 이미지 추가
          referenceImages.push(savedChar.refImages[0]);
        }
      });

      const url = await gemini.generateImage(
        finalPrompt,
        false,
        geminiImageModel,
        referenceImages.length > 0 ? referenceImages : undefined
      );

      updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p,
        scenes: p.scenes.map(s => s.id === sceneId ? { ...s, imageUrl: url, status: 'done' } : s)
      } : p));
    } catch (err: any) {
      console.error('Scene image generation failed:', err);
      const errorMsg = err?.message || '알 수 없는 오류';
      // 사용자 친화적 에러 메시지
      let userMessage = '이미지 생성 실패: ';
      if (errorMsg.includes('API key') || errorMsg.includes('401')) {
        userMessage += 'Gemini API 키를 확인해주세요.';
      } else if (errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        userMessage += 'API 사용량 한도 초과. 잠시 후 다시 시도해주세요.';
      } else if (errorMsg.includes('SAFETY') || errorMsg.includes('blocked')) {
        userMessage += '안전 필터에 의해 차단됨. 프롬프트를 수정해주세요.';
      } else {
        userMessage += errorMsg;
      }
      alert(userMessage);
      updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p,
        scenes: p.scenes.map(s => s.id === sceneId ? { ...s, status: 'error' } : s)
      } : p));
    }
  };

  const handleRegeneratePrompt = async () => {
    if (!project || !promptEditId || !promptEditInput.trim() || !currentProjectId) return;

    if (promptEditType === 'character') {
      updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p, characters: p.characters.map(c => c.id === promptEditId ? { ...c, status: 'loading', portraitUrl: null } : c)
      } : p));
    } else {
      updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p, scenes: p.scenes.map(s => s.id === promptEditId ? { ...s, status: 'loading', imageUrl: null } : s)
      } : p));
    }

    setIsPromptModalOpen(false);

    try {
      let currentPrompt = '';
      if (promptEditType === 'character') {
        currentPrompt = project.characters.find(c => c.id === promptEditId)?.visualDescription || '';
      } else {
        currentPrompt = project.scenes.find(s => s.id === promptEditId)?.imagePrompt || '';
      }

      const newPrompt = await gemini.regeneratePrompt(currentPrompt, promptEditInput, project);

      const isPortrait = promptEditType === 'character';

      // 학습된 그림체 스타일 100% 적용
      let finalPrompt = newPrompt;

      // 스타일 템플릿 프리픽스 추가 (캐릭터/씬 모두 동일 적용)
      if (selectedStyleTemplate) {
        finalPrompt = `${selectedStyleTemplate.imagePromptPrefix} ${finalPrompt}`;
      }

      if (project.customStyleDescription) {
        finalPrompt = `${finalPrompt}, Art style: ${project.customStyleDescription}`;
      }

      // 레퍼런스 이미지 속 캐릭터 외형 정보 추가
      if (project.characterAppearance) {
        finalPrompt = `${finalPrompt}, Character appearance reference: ${project.characterAppearance}`;
      }

      // 저장된 인물의 레퍼런스 이미지 수집
      const referenceImages: string[] = [];
      if (isPortrait) {
        const char = project.characters.find(c => c.id === promptEditId);
        if (char) {
          const matchingSavedChar = savedCharacters.find(
            sc => sc.name.toLowerCase().includes(char.name.toLowerCase()) ||
                  char.name.toLowerCase().includes(sc.name.toLowerCase())
          );
          if (matchingSavedChar?.refImages.length) {
            referenceImages.push(...matchingSavedChar.refImages.slice(0, 3));
          }
        }
      } else {
        // 씬 이미지: 모든 프로젝트 캐릭터 + 매칭되는 저장된 인물
        project.characters.forEach(char => {
          if (char.portraitUrl) referenceImages.push(char.portraitUrl);
        });
        savedCharacters.forEach(sc => {
          const matching = project.characters.find(
            pc => pc.name.toLowerCase().includes(sc.name.toLowerCase()) ||
                  sc.name.toLowerCase().includes(pc.name.toLowerCase())
          );
          if (matching && sc.refImages.length > 0) {
            referenceImages.push(sc.refImages[0]);
          }
        });
      }

      const newImageUrl = await gemini.generateImage(
        finalPrompt,
        isPortrait,
        geminiImageModel,
        referenceImages.length > 0 ? referenceImages : undefined
      );

      if (promptEditType === 'character') {
        updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, characters: p.characters.map(c => c.id === promptEditId ? {
            ...c,
            visualDescription: newPrompt,
            portraitUrl: newImageUrl,
            status: 'done'
          } : c)
        } : p));
      } else {
        updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, scenes: p.scenes.map(s => s.id === promptEditId ? {
            ...s,
            imagePrompt: newPrompt,
            imageUrl: newImageUrl,
            status: 'done'
          } : s)
        } : p));
      }
      setPromptEditInput('');
    } catch (err) {
      console.error(err);
      alert("재생성에 실패했습니다.");
      if (promptEditType === 'character') {
        updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, characters: p.characters.map(c => c.id === promptEditId ? { ...c, status: 'error' } : c)
        } : p));
      } else {
        updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, scenes: p.scenes.map(s => s.id === promptEditId ? { ...s, status: 'error' } : s)
        } : p));
      }
    }
  };

  const openRegenerateModal = (type: 'character' | 'scene', id: string) => {
    setRegenerateType(type);
    setRegenerateId(id);
    setRegenerateInput('');
    setIsRegenerateModalOpen(true);
  };

  const handleRegenerateWithModification = async () => {
    if (!project || !regenerateId || !regenerateInput.trim() || !currentProjectId) return;

    if (regenerateType === 'character') {
      updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p, characters: p.characters.map(c => c.id === regenerateId ? { ...c, status: 'loading', portraitUrl: null } : c)
      } : p));
    } else {
      updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p, scenes: p.scenes.map(s => s.id === regenerateId ? { ...s, status: 'loading', imageUrl: null } : s)
      } : p));
    }

    setIsRegenerateModalOpen(false);

    try {
      let currentPrompt = '';
      if (regenerateType === 'character') {
        currentPrompt = project.characters.find(c => c.id === regenerateId)?.visualDescription || '';
      } else {
        currentPrompt = project.scenes.find(s => s.id === regenerateId)?.imagePrompt || '';
      }

      const newPrompt = await gemini.regeneratePrompt(currentPrompt, regenerateInput, project);

      const isPortrait = regenerateType === 'character';

      // 학습된 그림체 스타일 100% 적용
      let finalPrompt = newPrompt;

      // 스타일 템플릿 프리픽스 추가 (캐릭터/씬 모두 동일 적용)
      if (selectedStyleTemplate) {
        finalPrompt = `${selectedStyleTemplate.imagePromptPrefix} ${finalPrompt}`;
      }

      if (project.customStyleDescription) {
        finalPrompt = `${finalPrompt}, Art style: ${project.customStyleDescription}`;
      }

      // 레퍼런스 이미지 속 캐릭터 외형 정보 추가
      if (project.characterAppearance) {
        finalPrompt = `${finalPrompt}, Character appearance reference: ${project.characterAppearance}`;
      }

      // 저장된 인물의 레퍼런스 이미지 수집
      const referenceImages: string[] = [];
      if (isPortrait) {
        const char = project.characters.find(c => c.id === regenerateId);
        if (char) {
          const matchingSavedChar = savedCharacters.find(
            sc => sc.name.toLowerCase().includes(char.name.toLowerCase()) ||
                  char.name.toLowerCase().includes(sc.name.toLowerCase())
          );
          if (matchingSavedChar?.refImages.length) {
            referenceImages.push(...matchingSavedChar.refImages.slice(0, 3));
          }
        }
      } else {
        // 씬 이미지: 모든 프로젝트 캐릭터 + 매칭되는 저장된 인물
        project.characters.forEach(char => {
          if (char.portraitUrl) referenceImages.push(char.portraitUrl);
        });
        savedCharacters.forEach(sc => {
          const matching = project.characters.find(
            pc => pc.name.toLowerCase().includes(sc.name.toLowerCase()) ||
                  sc.name.toLowerCase().includes(pc.name.toLowerCase())
          );
          if (matching && sc.refImages.length > 0) {
            referenceImages.push(sc.refImages[0]);
          }
        });
      }

      const newImageUrl = await gemini.generateImage(
        finalPrompt,
        isPortrait,
        geminiImageModel,
        referenceImages.length > 0 ? referenceImages : undefined
      );

      if (regenerateType === 'character') {
        updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, characters: p.characters.map(c => c.id === regenerateId ? {
            ...c,
            visualDescription: newPrompt,
            portraitUrl: newImageUrl,
            status: 'done'
          } : c)
        } : p));
      } else {
        updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, scenes: p.scenes.map(s => s.id === regenerateId ? {
            ...s,
            imagePrompt: newPrompt,
            imageUrl: newImageUrl,
            status: 'done'
          } : s)
        } : p));
      }
      setRegenerateInput('');
    } catch (err) {
      console.error(err);
      alert("재생성에 실패했습니다.");
      if (regenerateType === 'character') {
        updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, characters: p.characters.map(c => c.id === regenerateId ? { ...c, status: 'error' } : c)
        } : p));
      } else {
        updateProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, scenes: p.scenes.map(s => s.id === regenerateId ? { ...s, status: 'error' } : s)
        } : p));
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('클립보드에 복사되었습니다!');
    }).catch(() => {
      alert('복사에 실패했습니다.');
    });
  };

  const generateAudio = async (sceneId: string) => {
    if (!checkAndOpenAudioSettings()) return;
    if (!project) return;

    // WAV 파일이 업로드되어 있으면 분할 옵션 제공
    if (uploadedWavFile) {
      const useUploaded = window.confirm('업로드된 WAV 파일을 장면에 맞게 자동 분할할까요?');

      if (useUploaded) {
        // Gemini API 키 체크
        if (!geminiApiKey) {
          alert('자동 분할을 위해 Gemini API 키를 입력해주세요.\n\n설정 > Gemini API 설정에서 API 키를 등록하세요.');
          setExpandedSetting('gemini');
          return;
        }

        // TODO: 자동 분할 로직 구현 (Gemini 타임스탬프 생성 + FFmpeg 분할)
        alert('Gemini API 키를 입력해주세요.\n\n설정 > Gemini API 설정에서 API 키를 등록하세요.');
        setExpandedSetting('gemini');
        return;
      } else {
        const generateNew = window.confirm('새로 생성하시겠습니까?');
        if (!generateNew) return;
        // 새로 생성하는 경우 아래 기존 로직 실행
      }
    }

    updateCurrentProject({
      scenes: project.scenes.map(s => s.id === sceneId ? { ...s, audioStatus: 'loading' } : s)
    });
    try {
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene) return;

      // 이전 오디오 URL 정리
      if (scene.audioUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(scene.audioUrl);
      }

      let audioUrl = '';
      if (audioProvider === 'elevenlabs') {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elSettings.voiceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': elSettings.apiKey },
          body: JSON.stringify({
            text: scene.scriptSegment,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: elSettings.speed }
          })
        });
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        audioUrl = URL.createObjectURL(blob);
      } else if (audioProvider === 'microsoft') {
        // Azure TTS
        if (!azureApiKey) throw new Error('Azure API key required');
        const response = await fetch(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureApiKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
          },
          body: `<speak version='1.0' xml:lang='ko-KR'>
            <voice xml:lang='ko-KR' name='${azureVoice}'>
              <prosody rate='${chirpSpeed}'>
                ${scene.scriptSegment}
              </prosody>
            </voice>
          </speak>`
        });
        if (!response.ok) {
          const error = await response.text();
          console.error('Azure TTS error:', error);
          throw new Error(`Azure TTS failed: ${response.status}`);
        }
        const blob = await response.blob();
        audioUrl = URL.createObjectURL(blob);
      } else if (audioProvider === 'google-neural2') {
        audioUrl = await gemini.generateGoogleTTS(scene.scriptSegment, neural2Voice, chirpSpeed, chirpApiKey);
      } else {
        // Google Chirp3 (기본)
        audioUrl = await gemini.generateGoogleTTS(scene.scriptSegment, chirpVoice, chirpSpeed, chirpApiKey);
      }

      updateCurrentProject({
        scenes: project.scenes.map(s => s.id === sceneId ? { ...s, audioUrl: audioUrl, audioStatus: 'done' } : s)
      });
    } catch (err: any) {
      console.error('TTS generation failed:', err);
      const errorMsg = err?.message || '알 수 없는 오류';
      // 사용자 친화적 에러 메시지
      let userMessage = '오디오 생성 실패: ';
      if (errorMsg.includes('API key') || errorMsg.includes('401')) {
        userMessage += 'API 키를 확인해주세요.';
      } else if (errorMsg.includes('quota') || errorMsg.includes('429')) {
        userMessage += 'API 사용량 한도 초과. 잠시 후 다시 시도해주세요.';
      } else if (errorMsg.includes('Azure')) {
        userMessage += 'Azure TTS 설정을 확인해주세요.';
      } else if (errorMsg.includes('ElevenLabs') || errorMsg.includes('elevenlabs')) {
        userMessage += 'ElevenLabs 설정을 확인해주세요.';
      } else {
        userMessage += errorMsg;
      }
      alert(userMessage);
      updateCurrentProject({
        scenes: project.scenes.map(s => s.id === sceneId ? { ...s, audioStatus: 'error' } : s)
      });
    }
  };

  const generateAllImages = async () => {
    if (!project) return;
    const scenesToGenerate = project.scenes.filter(s => !s.imageUrl);

    // 60장씩 배치 분할 (Rate Limit 회피)
    const batchSize = 60;
    for (let i = 0; i < scenesToGenerate.length; i += batchSize) {
      const batch = scenesToGenerate.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(scenesToGenerate.length / batchSize);

      console.log(`[Batch ${batchNumber}/${totalBatches}] Generating ${batch.length} images...`);

      try {
        await Promise.all(batch.map(scene => generateSceneImage(scene.id)));
        console.log(`[Batch ${batchNumber}/${totalBatches}] Completed ✓`);
      } catch (err) {
        console.error(`[Batch ${batchNumber}/${totalBatches}] Failed:`, err);
        alert(`배치 ${batchNumber}/${totalBatches} 이미지 생성 중 오류가 발생했습니다.`);
        break; // 에러 발생 시 중단
      }
    }
  };

  const generateBatchAudio = async () => {
    if (!checkAndOpenAudioSettings()) return;
    if (!project) return;

    setIsBatchGenerating(true);
    setLoadingText('오디오 일괄 생성 중...');
    setTargetProgress(0);
    try {
      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        if (!scene.audioUrl) {
          setTargetProgress(Math.round((i / project.scenes.length) * 100));
          await generateAudio(scene.id);
        }
      }
      setTargetProgress(100);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Video generation functions
  const generateVideo = async (sceneId: string) => {
    if (!project) return;

    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene || !scene.imageUrl) {
      alert('이미지를 먼저 생성해주세요!');
      return;
    }

    // API 키 체크
    let hasApiKey = false;
    if (videoProvider === 'byteplus') {
      hasApiKey = !!(bytedanceApiKey && bytedanceApiKey.length >= 10);
    } else if (videoProvider === 'evolink') {
      hasApiKey = !!(evolinkApiKey && evolinkApiKey.length >= 10);
    } else if (videoProvider === 'runware') {
      hasApiKey = !!(runwareApiKey && runwareApiKey.length >= 10);
    }

    // API 키가 없으면 사용자에게 확인
    if (!hasApiKey) {
      const proceed = confirm(
        `API 키가 입력되지 않아 줌인-줌아웃 효과로만 영상이 출력될 예정입니다.\n자막과 함께 간단한 애니메이션 영상이 생성됩니다.\n\n괜찮습니까?`
      );
      if (!proceed) return;
    }

    // 영상 생성 범위 체크 (경고만 표시)
    const sceneIndex = project.scenes.findIndex(s => s.id === sceneId);
    const sceneStartTime = sceneIndex * 10;
    if (sceneStartTime >= videoGenerationRange && hasApiKey) {
      const proceed = confirm(
        `이 장면은 영상 생성 범위(${formatSecondsToTime(videoGenerationRange)}) 밖에 있습니다.\n줌인-줌아웃 효과만 사용하는 것이 비용 절감에 도움이 됩니다.\n\n그래도 API를 사용하여 영상을 생성하시겠습니까?`
      );
      if (!proceed) return;
    }

    // 이전 비디오 URL 정리
    if (scene.videoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(scene.videoUrl);
    }

    updateCurrentProject({
      scenes: project.scenes.map(s => s.id === sceneId ? { ...s, videoStatus: 'loading' } : s)
    });

    try {
      const characterDesc = project.characters.length > 0
        ? project.characters[0].visualDescription
        : '';

      const videoBlob = await generateSceneVideo(
        scene.imageUrl,
        scene.imagePrompt,
        scene.scriptSegment,
        characterDesc,
        project.characters.length > 1,
        undefined,
        videoEngine,
        subtitleSettings,
        (progress, message) => {
          setTargetProgress(progress);
          setLoadingText(message);
        }
      );

      // 오디오가 있으면 비디오에 합치기
      let finalVideoBlob = videoBlob;
      if (scene.audioUrl) {
        console.log('[VIDEO] Adding audio to video...');
        setLoadingText('오디오 통합 중...');
        finalVideoBlob = await addAudioToVideo(
          videoBlob,
          scene.audioUrl,
          (progress, message) => {
            setTargetProgress(90 + (progress / 100) * 10);
            setLoadingText(message);
          }
        );
      }

      const videoUrl = URL.createObjectURL(finalVideoBlob);

      updateCurrentProject({
        scenes: project.scenes.map(s =>
          s.id === sceneId
            ? { ...s, videoUrl, videoStatus: 'done' }
            : s
        )
      });
    } catch (err: any) {
      console.error('Video generation failed:', err);
      const errorMsg = err?.message || '알 수 없는 오류';
      // 사용자 친화적 에러 메시지
      let userMessage = '비디오 생성 실패: ';
      if (errorMsg.includes('API key') || errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        userMessage += 'BytePlus API 키를 확인해주세요.';
      } else if (errorMsg.includes('402') || errorMsg.includes('insufficient') || errorMsg.includes('credit')) {
        userMessage += '크레딧 부족. BytePlus 콘솔에서 충전해주세요.';
      } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        userMessage += 'API 사용량 한도 초과. 잠시 후 다시 시도해주세요.';
      } else if (errorMsg.includes('timeout')) {
        userMessage += '요청 시간 초과. 네트워크 상태를 확인해주세요.';
      } else if (errorMsg.includes('ModelNotOpen') || errorMsg.includes('404')) {
        userMessage += '모델이 활성화되지 않았습니다. BytePlus 콘솔에서 모델을 활성화해주세요.';
      } else {
        userMessage += errorMsg;
      }
      alert(userMessage);
      updateCurrentProject({
        scenes: project.scenes.map(s => s.id === sceneId ? { ...s, videoStatus: 'error' } : s)
      });
    }
  };

  const generateAllVideos = async () => {
    if (!project) return;

    // videoGenerationRange 이내의 장면만 필터링 (각 장면은 10초)
    const scenesNeedingVideo = project.scenes.filter((s, index) => {
      const sceneStartTime = index * 10; // 각 scene은 10초
      return s.imageUrl && !s.videoUrl && sceneStartTime < videoGenerationRange;
    });

    if (scenesNeedingVideo.length === 0) {
      const totalScenes = project.scenes.filter(s => s.imageUrl && !s.videoUrl).length;
      if (totalScenes > 0) {
        alert(`영상 생성 범위(${videoGenerationRange}초) 이내에 생성할 비디오가 없습니다.\n범위를 늘려보세요.`);
      } else {
        alert('생성할 비디오가 없습니다!');
      }
      return;
    }

    // 영상 생성 범위 외의 장면 개수 계산
    const skippedScenes = project.scenes.filter((s, index) => {
      const sceneStartTime = index * 10;
      return s.imageUrl && !s.videoUrl && sceneStartTime >= videoGenerationRange;
    }).length;

    if (skippedScenes > 0) {
      const proceed = confirm(
        `${scenesNeedingVideo.length}개 장면을 영상으로 생성하고,\n${skippedScenes}개 장면은 줌인-줌아웃 효과만 적용합니다.\n\n계속하시겠습니까?`
      );
      if (!proceed) return;
    }

    // 5개씩 제한 제거 (전체 범위 생성)
    const limitedScenes = scenesNeedingVideo;

    setIsBatchGenerating(true);
    setLoadingText(`비디오 생성 중 (${limitedScenes.length}개)...`);

    // Mark all as loading
    updateCurrentProject({
      scenes: project.scenes.map(s =>
        limitedScenes.some(ls => ls.id === s.id)
          ? { ...s, videoStatus: 'loading' }
          : s
      )
    });

    try {
      const characterDesc = project.characters.length > 0
        ? project.characters[0].visualDescription
        : '';

      // Generate videos one by one to use Gemini motion prompts
      for (let i = 0; i < limitedScenes.length; i++) {
        const scene = limitedScenes[i];
        setLoadingText(`비디오 생성 중 (${i + 1}/${limitedScenes.length})...`);

        // 이전 비디오 URL 정리
        if (scene.videoUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(scene.videoUrl);
        }

        try {
          const videoBlob = await generateSceneVideo(
            scene.imageUrl!,
            scene.imagePrompt,
            scene.scriptSegment,
            characterDesc,
            project.characters.length > 1,
            undefined,
            videoEngine,
            subtitleSettings,
            (progress: number, message: string) => {
              const overallProgress = ((i / limitedScenes.length) * 100) + (progress / limitedScenes.length);
              setTargetProgress(overallProgress);
              setLoadingText(`${message} (${i + 1}/${limitedScenes.length})`);
            }
          );

          const videoUrl = URL.createObjectURL(videoBlob);

          updateCurrentProject({
            scenes: project.scenes.map(s =>
              s.id === scene.id
                ? { ...s, videoUrl, videoStatus: 'done' }
                : s
            )
          });
        } catch (err: any) {
          console.error(`Video generation failed for scene ${i + 1}:`, err);

          updateCurrentProject({
            scenes: project.scenes.map(s =>
              s.id === scene.id
                ? { ...s, videoStatus: 'error' }
                : s
            )
          });
        }
      }

      alert(`${limitedScenes.length}개 비디오 생성 완료!`);
    } catch (err) {
      console.error('Batch video generation failed:', err);
      alert('비디오 일괄 생성에 실패했습니다.');
      setIsBatchGenerating(false);
    }
  };

  const deleteAudio = (sceneId: string) => {
    if (!project) return;
    // blob URL 정리
    const scene = project.scenes.find(s => s.id === sceneId);
    if (scene?.audioUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(scene.audioUrl);
    }
    updateCurrentProject({
      scenes: project.scenes.map(s => s.id === sceneId ? { ...s, audioUrl: null, audioStatus: 'idle' } : s)
    });
  };

  const downloadAsset = (url: string, filename: string) => {
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const splitSubtitles = (text: string): string[] => {
    const parts = text.split(/([.?!,])\s*/).filter(p => p && p.trim().length > 0);
    const result: string[] = [];

    for (let i = 0; i < parts.length; i += 2) {
      let segment = parts[i] + (parts[i+1] || "");
      segment = segment.trim();

      if (segment.length > 25) {
        const words = segment.split(' ');
        let currentChunk = '';
        words.forEach(word => {
            if ((currentChunk + word).length > 25) {
                result.push(currentChunk.trim());
                currentChunk = word + ' ';
            } else {
                currentChunk += word + ' ';
            }
        });
        if (currentChunk.trim()) result.push(currentChunk.trim());
      } else if (segment) {
        result.push(segment);
      }
    }
    return result.length > 0 ? result : [text];
  };

  // 맥락 기반 줌/패닝 설정 결정
  const determineZoomSettings = (dialogue: string, index: number): {
    direction: 'in' | 'out',
    pan: 'left' | 'right' | 'up' | 'down' | 'center',
    intensity: number
  } => {
    const text = dialogue.toLowerCase();

    // 긴박도 감지 (1-10)
    let intensity = 5; // 기본값
    if (text.includes('!') || text.includes('?!')) intensity = 8; // 강한 감정
    else if (text.includes('?')) intensity = 6; // 질문
    else if (text.length > 100) intensity = 3; // 긴 설명 = 차분함

    // 방향 감지 (패턴 기반)
    const hasLeft = /왼쪽|좌|서쪽|떠나|사라|나가/.test(text);
    const hasRight = /오른쪽|우|동쪽|들어오|나타|다가/.test(text);
    const hasUp = /위|하늘|날|올라|높/.test(text);
    const hasDown = /아래|바닥|떨어|내려/.test(text);

    let pan: 'left' | 'right' | 'up' | 'down' | 'center' = 'center';
    if (hasLeft) pan = 'left';
    else if (hasRight) pan = 'right';
    else if (hasUp) pan = 'up';
    else if (hasDown) pan = 'down';
    else {
      // 랜덤 방향 (자연스러운 다양성)
      const directions: ('left' | 'right' | 'center')[] = ['left', 'right', 'center', 'center']; // center 비중 높게
      pan = directions[index % directions.length];
    }

    // 줌 방향 (교차)
    const direction = index % 2 === 0 ? 'in' : 'out';

    return { direction, pan, intensity };
  };

  const exportVideo = async () => {
    if (!project) return;

    // 이미지와 오디오 확인
    const missingAssets = project.scenes.some(s => !s.imageUrl || !s.audioUrl);
    if (missingAssets) {
      alert("모든 장면의 이미지와 오디오가 생성되어야 합니다.");
      return;
    }

    // API 키 체크
    let hasApiKey = false;
    if (videoProvider === 'byteplus') {
      hasApiKey = !!(bytedanceApiKey && bytedanceApiKey.length >= 10);
    } else if (videoProvider === 'evolink') {
      hasApiKey = !!(evolinkApiKey && evolinkApiKey.length >= 10);
    } else if (videoProvider === 'runware') {
      hasApiKey = !!(runwareApiKey && runwareApiKey.length >= 10);
    }

    const engineName = hasApiKey ? 'BytePlus' : '줌인-줌아웃';
    setBgTask({ type: 'video', message: `${engineName} 비디오 생성 중...` });
    setBgProgress(0);

    try {
      // 1단계: 모든 씬의 비디오 생성
      const characterDesc = project.characters.length > 0 ? project.characters[0].visualDescription : '';
      const videoBlobs: Blob[] = [];

      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        console.log(`[DEBUG] Scene ${i + 1}/${project.scenes.length} - Starting ${engineName} generation`);
        console.log(`[DEBUG] Image URL:`, scene.imageUrl?.substring(0, 50));
        console.log(`[DEBUG] Dialogue:`, scene.scriptSegment?.substring(0, 50));

        setBgTask({ type: 'video', message: `${engineName} 비디오 생성 중 (${i + 1}/${project.scenes.length})...` });
        setBgProgress(Math.round((i / project.scenes.length) * 50));

        // 영상 생성 범위 체크
        const sceneStartTime = i * 10;
        const useApiGeneration = hasApiKey && sceneStartTime < videoGenerationRange;

        let videoBlob: Blob;
        if (useApiGeneration) {
          // 범위 내 → API로 비디오 생성
          videoBlob = await generateSceneVideo(
            scene.imageUrl!,
            scene.imagePrompt,
            scene.scriptSegment,
            characterDesc,
            project.characters.length > 1,
            undefined,
            videoEngine,
            subtitleSettings,
            (progress, message) => {
              const baseProgress = Math.round((i / project.scenes.length) * 50);
              const sceneProgress = Math.round((progress / 100) * (50 / project.scenes.length));
              setBgProgress(baseProgress + sceneProgress);
              setBgTask({ type: 'video', message: `${message} (${i + 1}/${project.scenes.length})` });
            }
          );
        } else {
          // 범위 밖 or API 키 없음 → 맥락 기반 줌인/줌아웃
          const zoomSettings = determineZoomSettings(scene.scriptSegment, i);
          videoBlob = await generateSimpleZoomVideo(
            scene.imageUrl!,
            scene.scriptSegment, // 자막
            zoomSettings.direction,
            subtitleSettings,
            (progress, message) => {
              const baseProgress = Math.round((i / project.scenes.length) * 50);
              const sceneProgress = Math.round((progress / 100) * (50 / project.scenes.length));
              setBgProgress(baseProgress + sceneProgress);
              setBgTask({ type: 'video', message: `${message} (${i + 1}/${project.scenes.length})` });
            },
            zoomSettings.pan,
            zoomSettings.intensity
          );
        }

        console.log(`[DEBUG] Scene ${i + 1} - Video blob size:`, (videoBlob.size / 1024 / 1024).toFixed(2), 'MB');

        // 오디오 병합
        let finalVideoBlob = videoBlob;
        if (scene.audioUrl) {
          setBgTask({ type: 'video', message: `오디오 통합 중 (${i + 1}/${project.scenes.length})...` });
          finalVideoBlob = await addAudioToVideo(
            videoBlob,
            scene.audioUrl,
            (progress, message) => {
              const baseProgress = Math.round((i / project.scenes.length) * 50);
              const audioProgress = Math.round((progress / 100) * (10 / project.scenes.length));
              setBgProgress(baseProgress + audioProgress);
            }
          );
          console.log(`[DEBUG] Scene ${i + 1} - Final blob with audio:`, (finalVideoBlob.size / 1024 / 1024).toFixed(2), 'MB');
        }

        videoBlobs.push(finalVideoBlob);
      }
      console.log(`[DEBUG] Total videos generated:`, videoBlobs.length);

      // 2단계: 비디오 병합 및 다운로드
      setBgTask({ type: 'video', message: '비디오 병합 중...' });

      let finalBlob: Blob;
      if (videoBlobs.length === 1) {
        // 1개 씬 → 바로 다운로드
        finalBlob = videoBlobs[0];
      } else {
        // 여러 씬 → 하나로 합치기
        finalBlob = await mergeVideos(videoBlobs, (progress, message) => {
          setBgProgress(50 + Math.round(progress * 0.5));
          setBgTask({ type: 'video', message });
        });
      }

      // 통합 비디오 다운로드
      setBgTask({ type: 'video', message: '비디오 다운로드 중...' });
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title}_complete.mp4`;
      a.click();
      URL.revokeObjectURL(url);

      setBgTask(null);
      setBgProgress(0);
      alert(`통합 비디오 다운로드 완료!`);
    } catch (error: any) {
      console.error('Export failed:', error);
      setBgTask(null);
      setBgProgress(0);

      alert(`동영상 생성 중 오류가 발생했습니다: ${error}`);
    }
  };

  const addCharacterManually = async () => {
    if (!project || !newCharData.name.trim() || !newCharData.traits.trim()) return;
    setLoading(true);
    setLoadingText(`${newCharData.name} 생성 중...`);
    try {
      const fullPrompt = `${newCharData.gender}, ${newCharData.age}, ${newCharData.traits}`;
      const portraitUrl = await gemini.generateImage(fullPrompt, true, geminiImageModel);
      const newChar: CharacterProfile = {
        id: crypto.randomUUID(),
        name: newCharData.name,
        role: '추가 인물',
        visualDescription: fullPrompt,
        portraitUrl,
        status: 'done'
      };
      updateCurrentProject({ characters: [...project.characters, newChar] });
      setIsCharModalOpen(false);
      setNewCharData({ name: '', gender: '여성', age: '성인', traits: '' });
    } catch (err) {
      console.error(err);
      alert("캐릭터 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const saveCharacterToLibrary = async (char: CharacterProfile) => {
    try {
      if (savedCharacters.some(c => c.id === char.id)) {
        alert("이미 저장된 인물입니다.");
        return;
      }
      const newSaved: SavedCharacter = {
        id: char.id,
        name: char.name,
        refImages: char.portraitUrl ? [char.portraitUrl] : [],
        description: char.visualDescription,
        portraitUrl: char.portraitUrl
      };
      updateSavedCharacters(prev => [...prev, newSaved]);
      alert(`${char.name} 인물이 저장되었습니다.`);
    } catch (e) {
      console.error(e);
      alert("인물 저장 중 오류가 발생했습니다.");
    }
  };

  const deleteCharacter = (id: string) => {
    if (!project) return;
    updateCurrentProject({ characters: project.characters.filter(c => c.id !== id) });
  };

  const addSceneManually = () => {
    if (!project) return;
    const newScene: Scene = {
      id: crypto.randomUUID(),
      scriptSegment: '새로운 장면 내용',
      imagePrompt: 'new scene prompt',
      imageUrl: null,
      audioUrl: null,
      videoUrl: null,
      status: 'idle',
      audioStatus: 'idle',
      videoStatus: 'idle'
    };
    updateCurrentProject({ scenes: [...project.scenes, newScene] });
  };

  const deleteScene = (id: string) => {
    if (!project) return;
    updateCurrentProject({ scenes: project.scenes.filter(s => s.id !== id) });
  };

  const deleteSceneImage = (id: string) => {
    if (!project) return;
    updateCurrentProject({ scenes: project.scenes.map(s => s.id === id ? { ...s, imageUrl: null, status: 'idle' } : s) });
  };

  const mergeSelectedScenes = async () => {
    if (!project || selectedSceneIds.length < 2) return;

    // Get selected scenes in order
    const selectedScenes = project.scenes
      .filter(s => selectedSceneIds.includes(s.id))
      .sort((a, b) => project.scenes.indexOf(a) - project.scenes.indexOf(b));

    // Combine script segments
    const combinedScript = selectedScenes.map(s => s.scriptSegment).join(' ');

    // Find position of first selected scene
    const firstSceneIndex = project.scenes.findIndex(s => s.id === selectedScenes[0].id);

    // 단순히 대본 합치기 (Gemini API 호출 제거)
    const mergedScene: Scene = {
      id: crypto.randomUUID(),
      scriptSegment: combinedScript,
      imagePrompt: selectedScenes[0].imagePrompt, // 첫 번째 씬의 프롬프트 사용
      imageUrl: null,
      audioUrl: null,
      videoUrl: null,
      status: 'idle',
      audioStatus: 'idle',
      videoStatus: 'idle',
      effect: selectedScenes[0].effect
    };

    // Remove selected scenes and insert merged scene at first position
    const newScenes = project.scenes.filter(s => !selectedSceneIds.includes(s.id));
    newScenes.splice(firstSceneIndex, 0, mergedScene);

    updateCurrentProject({ scenes: newScenes });
    setSelectedSceneIds([]);
    setIsSelectionMode(false);
  };

  const addNewProject = () => {
    const newId = crypto.randomUUID();
    const newProject: StoryProject = {
      id: newId,
      title: '새로운 이야기 ' + (projects.length + 1),
      script: '',
      style: '2d-animation',
      characters: [],
      scenes: [],
      updatedAt: Date.now()
    };
    updateProjects(prev => [newProject, ...prev]);
    setCurrentProjectId(newId);
    setScript('');
    setStyle('2d-animation');
    setRefImages([]);
    setStep('input');
    setHasVisitedSetup(false);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.confirm("정말로 이 프로젝트를 삭제하시겠습니까?")) {
      const updatedProjects = projects.filter((p: StoryProject) => p.id !== id);
      setProjects(updatedProjects);
      // projectStore persist가 자동 저장

      if (currentProjectId === id) {
        setCurrentProjectId(null);
        setStep('dashboard');
      }
    }
  };

  const handleBack = () => {
    // 설정 전체화면이 열려있으면 설정 완전히 닫기 (원래 페이지로)
    if (isSettingsFullscreen) {
      setIsSettingsFullscreen(false);
      setIsMyPageOpen(false);
      return;
    }
    // 일반 단계 네비게이션
    if (step === 'storyboard') setStep('character_setup');
    else if (step === 'character_setup') setStep('style_selection');
    else if (step === 'style_selection') setStep('input');
    else if (step === 'input') setStep('dashboard');
    else setStep('dashboard');
  };

  const currentSavedStyle = savedStyles.find(s => s.id === style);

  const getStyleDisplayName = (styleValue: string) => {
    if (styleValue === '2d-animation') return '애니메이션';
    if (styleValue === 'realistic') return '실사화';
    if (styleValue === 'animation') return '3D 애니메이션';
    if (styleValue === 'custom') return '맞춤형';
    const saved = savedStyles.find(s => s.id === styleValue);
    if (saved) return saved.name;
    return styleValue;
  };

  const formatVoiceOption = (v: any) => {
    const name = v.name.toUpperCase();
    if (!v.labels) return name;

    const translatedFeatures = Object.values(v.labels)
      .map((tag: any) => TAG_MAP[tag.toLowerCase()] || tag)
      .slice(0, 2)
      .join(', ');

    const finalDesc = translatedFeatures.includes('남성') ? `${translatedFeatures.replace('남성', '')} 남자 목소리` :
                      translatedFeatures.includes('여성') ? `${translatedFeatures.replace('여성', '')} 여자 목소리` :
                      `${translatedFeatures} 목소리`;

    return finalDesc ? `${name}(${finalDesc.trim()})` : name;
  };

  return (
    <div className={`min-h-screen bg-[#FDFDFD] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 pb-40 transition-colors duration-500`}>
      <input type="file" className="hidden" ref={sceneImageUploadRef} accept="image/*" onChange={handleSceneImageUpload} />
      <input type="file" className="hidden" ref={sceneAudioUploadRef} accept="audio/*" onChange={handleSceneAudioUpload} />
      <input type="file" className="hidden" ref={styleRefImageInputRef} accept="image/*" multiple onChange={handleStyleRefImageUpload} />
      <input type="file" className="hidden" ref={styleLibraryInputRef} accept="image/*" multiple onChange={handleStyleLibraryImageUpload} />
      <input type="file" className="hidden" ref={charLibInputRef} accept="image/*" multiple onChange={handleCharLibraryImageUpload} />
      <input type="file" className="hidden" ref={charPortraitUploadRef} accept="image/*" onChange={handleCharPortraitUpload} />

      {/* Progress Steps */}
      <ProgressSteps
        currentStep={step}
        hasScript={!!project && !!project.script}
        hasCharacters={!!project && project.characters.length > 0}
        hasScenes={!!project && project.scenes.length > 0}
        hasImages={!!project && project.scenes.length > 0 && project.scenes.every(s => s.imageUrl)}
        hasAudios={!!project && project.scenes.length > 0 && project.scenes.every(s => s.audioUrl)}
        hasVideos={!!project && project.scenes.some(s => s.videoUrl)}
      />

      <div className="fixed top-4 right-4 sm:top-8 sm:right-8 z-[205] flex gap-2 sm:gap-3">
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-slate-800 shadow-xl rounded-full flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-105 transition-all group relative border border-slate-100 dark:border-slate-700">
          {isDarkMode ? (
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
          <div className="absolute top-full mt-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-semibold rounded-lg opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all whitespace-nowrap">{isDarkMode ? '라이트 모드' : '다크 모드'}</div>
        </button>
        <button onClick={() => {
          if (isMyPageOpen) {
            setIsMyPageOpen(false);
            setIsSettingsFullscreen(false);
          } else {
            setIsMyPageOpen(true);
            setIsSettingsFullscreen(false);
          }
        }} className="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-slate-800 shadow-xl rounded-full flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-105 transition-all group relative border border-slate-100 dark:border-slate-700">
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <div className="absolute top-full mt-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-semibold rounded-lg opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all whitespace-nowrap">내 페이지</div>
        </button>
        {isMyPageOpen && !isSettingsFullscreen && (
          <button onClick={() => setIsSettingsFullscreen(true)} className="w-10 h-10 bg-white dark:bg-slate-800 shadow-lg rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all border border-slate-100 dark:border-slate-700" title="전체화면">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </button>
        )}
      </div>

      {(step !== 'dashboard' || isSettingsFullscreen) && (
        <div className="fixed top-4 left-4 sm:top-8 sm:left-8 z-[205]">
          <button onClick={handleBack} className="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-slate-800 shadow-xl rounded-full flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-100 dark:border-slate-700">
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          </button>
        </div>
      )}

      {step === 'dashboard' && (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-10 sm:py-20 animate-in fade-in">


          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 sm:mb-16 gap-6">
            <div className="space-y-2 sm:space-y-4">
              <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-slate-100">내 프로젝트</h1>
              <p className="text-slate-400 dark:text-slate-500 font-medium text-sm sm:text-base">진행 중인 이야기들을 관리하세요</p>
            </div>
            <button onClick={addNewProject} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 flex items-center justify-center gap-2 transition-all active:scale-95">
              <span className="text-xl">+</span> 새 프로젝트 추가
            </button>
          </header>

          {projects.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[32px] sm:rounded-[40px] py-20 sm:py-40 flex flex-col items-center justify-center space-y-8 shadow-sm">
               <button onClick={addNewProject} className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center text-4xl sm:text-5xl text-slate-300 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-2 border-dashed border-slate-200 dark:border-slate-600 transition-all active:scale-90">+</button>
               <p className="text-slate-400 dark:text-slate-500 font-semibold text-lg sm:text-xl px-6 text-center">첫 번째 프로젝트를 만들어보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-10">
               {projects.map(p => (
                 <div key={p.id} onClick={() => { setCurrentProjectId(p.id); setScript(p.script); setStyle(p.style as VisualStyle); setStep(p.scenes.length > 0 ? 'storyboard' : 'input'); }} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-6 sm:p-10 rounded-[36px] sm:rounded-[48px] group hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-2xl dark:hover:shadow-indigo-900/20 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[300px] sm:min-h-[350px] shadow-sm">
                    <button onClick={(e) => deleteProject(p.id, e)} className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-black/10 dark:bg-white/10 hover:bg-red-500 text-white rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-all backdrop-blur-sm">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="space-y-3">
                       <div className="flex justify-between items-start">
                         <h3 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 flex-1 pr-8">{p.title}</h3>
                       </div>
                       <p className="text-slate-400 dark:text-slate-500 text-xs sm:text-sm font-medium">최종 수정: {new Date(p.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex -space-x-3 sm:-space-x-4 mb-4 sm:mb-6">
                       {p.characters.slice(0, 5).map((c, idx) => (
                         <div key={idx} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-md">
                           {c.portraitUrl && <img src={c.portraitUrl} className="w-full h-full object-cover" />}
                         </div>
                       ))}
                       {p.characters.length > 5 && (
                         <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-4 border-white dark:border-slate-800 bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] sm:text-xs font-semibold text-indigo-600 dark:text-indigo-400 shadow-md">
                           +{p.characters.length - 5}
                         </div>
                       )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 gap-3">
                       <span className="px-3 py-1 sm:px-4 sm:py-2 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">장면 {p.scenes.length}개</span>
                       <span className="px-3 py-1 sm:px-4 sm:py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-semibold uppercase text-indigo-600 dark:text-indigo-400">{getStyleDisplayName(p.style)}</span>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      )}

      {step !== 'dashboard' && (
        <div className="max-w-[1700px] mx-auto px-4 sm:px-10 py-6 sm:py-10">
          {step === 'style_selection' && (
            <div className="w-full px-6 pt-0">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
                <StyleTemplateSelector
                  selectedTemplate={tempSelectedTemplate}
                  onSelectTemplate={setTempSelectedTemplate}
                  savedStyles={savedStyles}
                  onAddTemplate={() => {
                    setIsTemplateAddMode(true);
                    setIsTemplateModalOpen(true);
                  }}
                />

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedStyleTemplate(tempSelectedTemplate);
                      if (project && tempSelectedTemplate) {
                        updateCurrentProject({
                          customStyleDescription: tempSelectedTemplate.imagePromptPrefix,
                          style: tempSelectedTemplate.id
                        });
                      }
                      setStep('character_setup');
                    }}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg"
                  >
                    적용하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'character_setup' && (
            <div className="w-full px-6 pt-0">
              {bgTask ? (
                <div className="text-center py-16">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-slate-500 text-sm">{bgTask.message}</p>
                  <p className="text-indigo-600 font-semibold mt-1">{bgProgress}%</p>
                </div>
              ) : (
              <>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg py-8 px-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">등장인물 외형 설정</h1>
                  <div className="flex gap-2">
                    <button onClick={() => { setCharLoadModalMode('list'); setIsCharLoadModalOpen(true); }} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">인물 불러오기</button>
                    <button onClick={() => proceedToStoryboard(true)} disabled={bgTask !== null} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow hover:bg-indigo-700 transition-all disabled:opacity-50">스토리보드 생성</button>
                    {project && project.scenes.length > 0 && (
                      <button onClick={() => proceedToStoryboard(false)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">기존 스토리보드 보기</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                {(project?.characters || []).map(char => {
                  const isSaved = savedCharacters.some(sc => sc.id === char.id);
                  return (
                  <div key={char.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all p-5 flex gap-5 items-start relative group/card">
                    <div className="absolute top-4 right-4 flex gap-2 items-center opacity-0 group-hover/card:opacity-100 transition-all z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if(isSaved) {
                            setSavedCharacters(savedCharacters.filter(sc => sc.id !== char.id));
                          } else {
                            if(savedCharacters.length >= 10) { alert('최대 10명까지 저장 가능합니다.'); return; }
                            setSavedCharacters([...savedCharacters, { id: char.id, name: char.name, refImages: [], description: char.visualDescription, portraitUrl: char.portraitUrl }]);
                          }
                        }}
                        className={`p-1.5 border rounded-lg transition-all flex items-center gap-1 ${isSaved ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600'}`}
                        title={isSaved ? "저장됨 (클릭하여 해제)" : "저장"}
                      >
                        <svg className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                        {isSaved && <span className="text-xs font-medium">저장됨</span>}
                      </button>
                      <button onClick={() => updateCurrentProject({ characters: project!.characters.filter(c => c.id !== char.id) })} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-500 hover:border-red-300 transition-all" title="삭제"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                    <div
                      className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0 relative group/portrait cursor-pointer flex items-center justify-center"
                      onClick={() => char.portraitUrl && setSelectedImage(char.portraitUrl)}
                    >
                      {char.status === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-700 z-10">
                          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                      {char.portraitUrl ? (
                        <img src={char.portraitUrl} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                      ) : char.status !== 'loading' && (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                      )}
                      {char.portraitUrl && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateCurrentProject({ characters: project!.characters.map(c => c.id === char.id ? { ...c, portraitUrl: null, status: 'idle' } : c) }); }}
                          className="absolute top-2 right-2 z-30 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover/portrait:opacity-100 transition-all hover:bg-red-600"
                          title="이미지 삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/portrait:opacity-100 transition-all flex items-center justify-center gap-2 z-20">
                        <label className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer" onClick={(e) => e.stopPropagation()}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg><input type="file" className="hidden" accept="image/*" onChange={(e) => { e.stopPropagation(); const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onload = (ev) => { updateCurrentProject({ characters: project!.characters.map(c => c.id === char.id ? { ...c, portraitUrl: ev.target?.result as string, status: 'done' } : c) }); }; reader.readAsDataURL(file); } }} /></label>
                        <button onClick={(e) => { e.stopPropagation(); openRegenerateModal('character', char.id); }} className="p-2 bg-white dark:bg-slate-800 rounded-full text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                        <button onClick={(e) => { e.stopPropagation(); if(char.portraitUrl) { const a = document.createElement('a'); a.href = char.portraitUrl; a.download = `${char.name}.png`; a.click(); }}} className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col h-36 sm:h-44">
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) => updateCurrentProject({ characters: project!.characters.map(c => c.id === char.id ? { ...c, name: e.target.value } : c) })}
                        className="font-bold text-slate-900 dark:text-slate-100 text-2xl sm:text-3xl mb-2 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700 rounded-lg px-2 py-0.5 flex-shrink-0"
                        placeholder="이름을 입력하세요..."
                      />
                      <div className="relative flex-1">
                        <textarea
                          value={char.visualDescription || ''}
                          onChange={(e) => updateCurrentProject({ characters: project!.characters.map(c => c.id === char.id ? { ...c, visualDescription: e.target.value } : c) })}
                          className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-700 rounded-lg p-2 pr-8 border-none resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700 w-full h-full"
                          placeholder="캐릭터 외형 설명을 입력하세요..."
                        />
                        <button onClick={() => copyToClipboard(char.visualDescription)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-indigo-600 transition-all" title="프롬프트 복사">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
                <button onClick={() => setShowScriptCharPrompt(true)} className="bg-slate-50 dark:bg-slate-700 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all p-5 flex gap-5 items-center">
                  <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl bg-slate-100 dark:bg-slate-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-all">
                    <span className="text-6xl text-slate-300">+</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-base font-medium text-slate-400">등장인물 추가하기</span>
                  </div>
                </button>
              </div>
              </>
              )}
            </div>
          )}

          {step === 'storyboard' && (
            <div className="w-full px-4 sm:px-8 pt-0">
              {!project ? (
                <div className="text-center py-20">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : (
              <>
              {/* 상단바 - 토스 스타일 */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 py-4 px-5 mb-4">
                <div className="flex flex-col gap-3">
                  {/* 첫 번째 줄: 제목 & 버튼들 */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={project.title}
                        onChange={(e) => updateCurrentProject({ title: e.target.value })}
                        className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 bg-transparent border-none focus:outline-none w-auto min-w-[200px]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button onClick={generateAllImages} disabled={isBatchGenerating} className="px-4 py-2 bg-transparent text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-all disabled:opacity-50">이미지 전체 생성</button>
                      <button onClick={generateBatchAudio} disabled={isBatchGenerating} className="px-4 py-2 bg-transparent text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-all disabled:opacity-50">오디오 전체 생성</button>
                      <button onClick={generateAllVideos} disabled={isBatchGenerating || !project.scenes.some(s => s.imageUrl && !s.videoUrl)} className="px-4 py-2 bg-transparent text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-all disabled:opacity-50">비디오 전체 생성</button>
                      <button onClick={() => { setIsMergedView(false); setExpandedSceneIndex(null); setShowPreviewModal(true); }} disabled={project.scenes.every(s => !s.imageUrl || !s.audioUrl)} className="px-5 py-2 bg-blue-500 text-white rounded-full text-sm font-semibold hover:bg-blue-600 transition-all disabled:opacity-50">동영상 합치기</button>
                    </div>
                  </div>

                  {/* 두 번째 줄: 캐릭터 썸네일들 */}
                  {project.characters.length > 0 && (
                    <div className="flex items-center gap-4 overflow-x-auto pb-2">
                      {project.characters.map(char => (
                        <div
                          key={char.id}
                          className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group"
                          onClick={() => char.portraitUrl && setSelectedImage(char.portraitUrl)}
                        >
                          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden border-2 border-slate-200 dark:border-slate-600 shadow-md hover:shadow-xl hover:scale-105 transition-all">
                            {char.portraitUrl ? (
                              <img src={char.portraitUrl} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-center max-w-[60px] truncate">{char.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 선택 버튼 영역 */}
              <div className="mb-4 flex justify-end gap-3">
                {selectedSceneIds.length >= 2 && (
                  <button
                    onClick={mergeSelectedScenes}
                    className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-all"
                  >
                    씬 합치기 ({selectedSceneIds.length}개)
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    if (isSelectionMode) setSelectedSceneIds([]);
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${isSelectionMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                >
                  {isSelectionMode ? '취소' : '선택'}
                </button>
                <div className="relative group/download">
                  <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center gap-1">
                    자산 다운로드
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <div className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl py-2 min-w-[200px] opacity-0 invisible group-hover/download:opacity-100 group-hover/download:visible transition-all z-50">
                    <button onClick={async () => {
                      try {
                        // @ts-ignore - File System Access API
                        const dirHandle = await window.showDirectoryPicker();
                        for (let i = 0; i < project.scenes.length; i++) {
                          if (project.scenes[i].imageUrl) {
                            const res = await fetch(project.scenes[i].imageUrl!);
                            const blob = await res.blob();
                            const fileHandle = await dirHandle.getFileHandle(`${i+1}_scene.png`, { create: true });
                            const writable = await fileHandle.createWritable();
                            await writable.write(blob);
                            await writable.close();
                          }
                        }
                        alert('이미지 다운로드 완료!');
                      } catch (e: any) {
                        if (e.name !== 'AbortError') alert('다운로드 실패: ' + e.message);
                      }
                    }} className="w-full px-4 py-2.5 text-left text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">이미지 전체 다운로드</button>
                    <button onClick={async () => {
                      try {
                        // @ts-ignore - File System Access API
                        const dirHandle = await window.showDirectoryPicker();
                        for (let i = 0; i < project.scenes.length; i++) {
                          if (project.scenes[i].audioUrl) {
                            const res = await fetch(project.scenes[i].audioUrl!);
                            const blob = await res.blob();
                            const fileHandle = await dirHandle.getFileHandle(`${i+1}_audio.mp3`, { create: true });
                            const writable = await fileHandle.createWritable();
                            await writable.write(blob);
                            await writable.close();
                          }
                        }
                        alert('오디오 다운로드 완료!');
                      } catch (e: any) {
                        if (e.name !== 'AbortError') alert('다운로드 실패: ' + e.message);
                      }
                    }} className="w-full px-4 py-2.5 text-left text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">오디오 전체 다운로드</button>
                  </div>
                </div>
              </div>

              {/* 씬 그리드 - 깔끔한 카드 스타일 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {project.scenes.map((scene, idx) => (
                  <div key={scene.id} className={`bg-white dark:bg-slate-800 rounded-3xl shadow-sm border overflow-hidden hover:shadow-md transition-all group/card ${isSelectionMode && selectedSceneIds.includes(scene.id) ? 'border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-700' : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'}`}>
                    {/* 이미지 영역 */}
                    <div
                      className={`aspect-video bg-slate-50 dark:bg-slate-700 relative group/img ${isSelectionMode ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (isSelectionMode) {
                          setSelectedSceneIds(prev =>
                            prev.includes(scene.id)
                              ? prev.filter(id => id !== scene.id)
                              : [...prev, scene.id]
                          );
                        }
                      }}
                    >
                      <div className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-slate-900/70 backdrop-blur-sm rounded-lg flex items-center justify-center text-white text-xs font-semibold">#{idx + 1}</div>

                      {/* 아이폰 스타일 선택 오버레이 */}
                      {isSelectionMode && (
                        <>
                          {selectedSceneIds.includes(scene.id) ? (
                            <>
                              {/* 선택된 카드: 블러 + 연두색 체크 */}
                              <div className="absolute inset-0 z-5 backdrop-blur-sm bg-black/30 pointer-events-none" />
                              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                <div className="w-20 h-20 bg-lime-500 rounded-full flex items-center justify-center shadow-2xl animate-scale-in">
                                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            </>
                          ) : (
                            /* 선택 안 된 카드: hover 시 선택 가능 표시 */
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity group-hover/card:opacity-100">
                              <div className="w-20 h-20 bg-white/80 dark:bg-slate-800/80 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-300 dark:border-slate-600">
                                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* 상단 우측 버튼들 */}
                      <div className="absolute top-3 right-3 z-30 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-all">
                        <label className="w-7 h-7 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer shadow-sm">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onload = (ev) => { updateCurrentProject({ scenes: project.scenes.map(s => s.id === scene.id ? { ...s, imageUrl: ev.target?.result as string, status: 'done' } : s) }); }; reader.readAsDataURL(file); } }} />
                        </label>
                        {scene.imageUrl ? (
                          <div className="relative group/delete">
                            <button className="w-7 h-7 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-red-500 transition-all shadow-sm">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl py-1 min-w-[140px] opacity-0 invisible group-hover/delete:opacity-100 group-hover/delete:visible transition-all z-50">
                              <button onClick={() => deleteSceneImage(scene.id)} className="w-full px-3 py-2 text-left text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">이미지만 삭제</button>
                              <button onClick={() => deleteScene(scene.id)} className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 transition-all">씬 삭제</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => deleteScene(scene.id)} className="w-7 h-7 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-red-500 transition-all shadow-sm">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>

                      {scene.status === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm z-20">
                          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                      {scene.imageUrl ? (
                        <>
                          <img src={scene.imageUrl} className="w-full h-full object-cover cursor-pointer" onClick={() => setSelectedImage(scene.imageUrl)} />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center gap-3 z-10 cursor-pointer" onClick={() => setSelectedImage(scene.imageUrl)}>
                            <button onClick={(e) => { e.stopPropagation(); openRegenerateModal('scene', scene.id); }} className="w-10 h-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-lg" title="재생성">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if(scene.imageUrl) { const a = document.createElement('a'); a.href = scene.imageUrl; a.download = `scene-${idx+1}.png`; a.click(); }}} className="w-10 h-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-lg" title="다운로드">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <button onClick={() => generateSceneImage(scene.id)} disabled={scene.status === 'loading'} className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg">
                            이미지 생성
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 컨텐츠 영역 */}
                    <div className="p-4 space-y-3">
                      {/* 장면 대사 - 항상 표시 */}
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium mb-1.5 uppercase tracking-wide">Scene 대사</p>
                        <textarea
                          value={scene.scriptSegment}
                          onChange={(e) => updateCurrentProject({ scenes: project.scenes.map(s => s.id === scene.id ? { ...s, scriptSegment: e.target.value } : s) })}
                          className="w-full text-lg font-semibold text-slate-800 dark:text-slate-200 leading-relaxed bg-transparent border-none resize-none focus:outline-none min-h-[52px] placeholder:text-slate-300 dark:placeholder:text-slate-600"
                          placeholder="장면 대사..."
                        />
                      </div>

                      {/* 오디오 플레이어 */}
                      {scene.audioUrl && (
                        <div className="flex items-center gap-2">
                          <audio src={scene.audioUrl} controls className="flex-1 h-9 rounded-lg" />
                          <div className="relative group">
                            <button className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition-all">
                              <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="5" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="12" cy="19" r="1.5" />
                              </svg>
                            </button>
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl py-1 min-w-[120px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 border border-slate-200 dark:border-slate-700">
                              <button
                                onClick={() => {
                                  if (!scene.audioUrl) return;
                                  const a = document.createElement('a');
                                  a.href = scene.audioUrl;
                                  a.download = `scene-${idx+1}_audio.mp3`;
                                  a.click();
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                              >
                                다운로드
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 아이콘 버튼 row - 항상 표시 */}
                      <div className="flex items-center justify-center gap-3 pt-2">
                            {/* 오디오 생성 */}
                            <button
                              onClick={() => !scene.audioUrl && generateAudio(scene.id)}
                              disabled={scene.audioStatus === 'loading'}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all group relative ${
                                scene.audioUrl
                                  ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-600 dark:text-white'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-indigo-100 dark:hover:bg-indigo-600 hover:text-indigo-600 dark:hover:text-white'
                              } disabled:opacity-50`}
                            >
                              {scene.audioStatus === 'loading' ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                  </svg>
                                  {scene.audioUrl && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </>
                              )}
                              <div className="absolute top-full mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                                개별 오디오 생성
                              </div>
                            </button>

                            {/* 오디오 업로드 */}
                            <label className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center transition-all cursor-pointer group relative">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              <input type="file" className="hidden" accept="audio/*" onChange={(e) => { const file = e.target.files?.[0]; if(file) { if(scene.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(scene.audioUrl); const url = URL.createObjectURL(file); updateCurrentProject({ scenes: project.scenes.map(s => s.id === scene.id ? { ...s, audioUrl: url, audioStatus: 'done' } : s) }); } }} />
                              <div className="absolute top-full mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                                개별 오디오 업로드
                              </div>
                            </label>

                            {/* 비디오 생성 */}
                            <button
                              onClick={() => !scene.videoUrl && generateVideo(scene.id)}
                              disabled={!scene.imageUrl || scene.videoStatus === 'loading'}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all group relative ${
                                scene.videoUrl
                                  ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-600 dark:text-white'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-indigo-100 dark:hover:bg-indigo-600 hover:text-indigo-600 dark:hover:text-white'
                              } disabled:opacity-50`}
                            >
                              {scene.videoStatus === 'loading' ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {scene.videoUrl && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </>
                              )}
                              <div className="absolute top-full mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                                개별 동영상 생성
                              </div>
                            </button>

                            {/* 다운로드 */}
                            {scene.videoUrl && (
                              <button
                                onClick={() => {
                                  if (!scene.videoUrl) return;
                                  const a = document.createElement('a');
                                  a.href = scene.videoUrl.includes('?') ? `${scene.videoUrl}&export=1080` : `${scene.videoUrl}?export=1080`;
                                  a.download = `scene-${idx+1}_1080p.mp4`;
                                  a.click();
                                }}
                                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-indigo-100 dark:hover:bg-indigo-600 hover:text-indigo-600 dark:hover:text-white flex items-center justify-center transition-all group relative"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <div className="absolute top-full mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                                  1080p 다운로드
                                </div>
                              </button>
                            )}
                          </div>

                      {/* 프롬프트 - 접힌 스타일 */}
                      <details className="group/prompt">
                        <summary className="flex items-center justify-between cursor-pointer text-[10px] text-slate-400 font-medium uppercase tracking-wide py-1">
                          <span>이미지 프롬프트</span>
                          <svg className="w-3.5 h-3.5 transform group-open/prompt:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div className="relative">
                            <textarea
                              value={scene.imagePrompt}
                              onChange={(e) => updateCurrentProject({ scenes: project.scenes.map(s => s.id === scene.id ? { ...s, imagePrompt: e.target.value } : s) })}
                              className="w-full text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-700 rounded-xl p-3 pr-10 border-none resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-700 min-h-[60px]"
                              placeholder="이미지 프롬프트..."
                            />
                            <button onClick={() => copyToClipboard(scene.imagePrompt)} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-indigo-600 transition-all" title="프롬프트 복사">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </button>
                          </div>
                          <button onClick={() => updateCurrentProject({ scenes: project.scenes })} className="w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-all">
                            저장하기
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                ))}

                {/* 추가 버튼 */}
                <button onClick={addSceneManually} className="bg-slate-50 dark:bg-slate-700 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[320px] flex flex-col items-center justify-center gap-3 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-all group/add">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-600 group-hover/add:bg-indigo-100 dark:group-hover/add:bg-indigo-900/30 flex items-center justify-center text-slate-400 group-hover/add:text-indigo-500 dark:group-hover/add:text-indigo-400 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <span className="text-sm text-slate-400 group-hover/add:text-indigo-500 font-medium transition-all">스토리보드 추가</span>
                </button>
              </div>
              </>
              )}
            </div>
          )}

          {step === 'input' && (
            <div className="max-w-5xl mx-auto space-y-4 pt-0 pb-2">
               <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg py-8 px-4 mb-6">
                 <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">대본을 입력해주세요</h1>
               </div>
               <div className="bg-white dark:bg-slate-800 p-3 rounded-[24px] sm:rounded-[32px] shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-700 relative">
                 <textarea className="w-full h-80 sm:h-96 bg-slate-50/50 dark:bg-slate-700/50 border-none rounded-[18px] sm:rounded-[24px] p-5 sm:p-7 text-base sm:text-xl text-slate-900 dark:text-slate-100 focus:ring-0 outline-none resize-none leading-relaxed placeholder:text-slate-300 dark:placeholder:text-slate-500" placeholder="시나리오를 입력하세요..." value={script} onChange={(e) => setScript(e.target.value)} />
               </div>
               <div className="flex flex-col sm:flex-row gap-3">
                 <button onClick={startAnalysis} disabled={(bgTask && bgTask.type === 'analysis') || !script.trim()} className="flex-1 py-4 sm:py-5 bg-indigo-600 text-white rounded-[18px] sm:rounded-[24px] font-semibold text-base sm:text-xl shadow-xl active:scale-[0.98] disabled:opacity-50 transition-all">프로젝트 시작하기</button>
                 {project && (project.characters.length > 0 || project.scenes.length > 0) && (
                   <button onClick={() => setStep('style_selection')} className="px-6 py-4 sm:py-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-[18px] sm:rounded-[24px] font-semibold text-sm sm:text-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-lg">
                     그림체 설정으로 이동 &gt;
                   </button>
                 )}
               </div>
            </div>
          )}
        </div>
      )}

      {selectedImage && <div className="fixed inset-0 bg-slate-900/95 z-[350] flex items-center justify-center p-2 sm:p-4 cursor-zoom-out animate-in fade-in" onClick={() => setSelectedImage(null)}><img src={selectedImage} className="max-w-full max-h-[90vh] object-contain rounded-2xl sm:rounded-[40px] shadow-2xl border-4 sm:border-8 border-white/10" /></div>}

      {/* 전체 미리보기 모달 */}
      {showPreviewModal && project && (() => {
        const successCount = project.scenes.filter(s => s.videoUrl).length;
        const totalCount = project.scenes.length;
        const successScenes = project.scenes.filter(s => s.videoUrl);

        return (
          <div className="fixed inset-0 bg-gray-900/95 z-[300] flex flex-col" onClick={() => { setShowPreviewModal(false); setIsMergedView(false); setExpandedSceneIndex(null); }}>
            <div className="flex-shrink-0 p-4 border-b border-gray-700" onClick={e => e.stopPropagation()}>
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-100">
                  영상 미리보기 <span className="text-indigo-400">({successCount}개 / 전체 {totalCount}개)</span>
                </h2>
                <div className="flex items-center gap-3">
                  {successScenes.length > 0 && expandedSceneIndex === null && (
                    <button
                      onClick={() => setIsMergedView(!isMergedView)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all"
                    >
                      {isMergedView ? '그리드로 돌아가기' : '합쳐서 보기'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowSubtitlePrompt(true)}
                    disabled={project.scenes.every(s => !s.imageUrl || !s.audioUrl)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  >
                    영상 합치기
                  </button>
                  <button
                    onClick={() => { setShowPreviewModal(false); setIsMergedView(false); setExpandedSceneIndex(null); }}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="max-w-7xl mx-auto">
                {expandedSceneIndex !== null ? (
                  /* 확대 재생 모드 */
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
                      {project.scenes[expandedSceneIndex]?.videoUrl ? (
                        <video
                          key={expandedSceneIndex}
                          src={project.scenes[expandedSceneIndex].videoUrl}
                          className="w-full h-full object-contain"
                          controls
                          autoPlay
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">영상 없음</div>
                      )}
                      <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/70 rounded-lg text-white text-sm font-medium">
                        #{expandedSceneIndex + 1}
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedSceneIndex(null)}
                      className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-xl font-medium transition-all"
                    >
                      그리드로 돌아가기
                    </button>
                  </div>
                ) : isMergedView ? (
                  /* 합쳐서 보기 모드 */
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
                      <video
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        onEnded={(e) => {
                          const videoEl = e.currentTarget;
                          const currentSrc = videoEl.src;
                          const currentIdx = successScenes.findIndex(s => s.videoUrl === currentSrc);
                          if (currentIdx < successScenes.length - 1) {
                            videoEl.src = successScenes[currentIdx + 1].videoUrl!;
                            videoEl.play();
                          }
                        }}
                        src={successScenes[0]?.videoUrl || ''}
                      />
                    </div>
                    <div className="w-full max-w-5xl">
                      <p className="text-sm text-gray-400 mb-2">타임라인 (씬 순서)</p>
                      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-800">
                        {successScenes.map((scene, idx) => (
                          <div
                            key={scene.id}
                            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500"
                            style={{ opacity: 0.7 + (idx * 0.3 / successScenes.length) }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 그리드 모드 - 영상 생성된 씬만 표시 */
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {successScenes.map((scene, idx) => {
                      const originalIdx = project.scenes.findIndex(s => s.id === scene.id);
                      return (
                        <div
                          key={scene.id}
                          className="group relative aspect-video rounded-xl overflow-hidden bg-gray-800 border border-gray-700 hover:border-indigo-500 transition-all"
                        >
                          <video
                            src={scene.videoUrl!}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setExpandedSceneIndex(originalIdx)}
                          />
                          {/* 호버 시 버튼 */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSceneIndex(originalIdx);
                              }}
                              className="p-3 bg-white/90 hover:bg-white rounded-full transition-colors"
                              title="재생"
                            >
                              <svg className="w-6 h-6 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const a = document.createElement('a');
                                a.href = scene.videoUrl!;
                                a.download = `scene-${originalIdx + 1}.mp4`;
                                a.click();
                              }}
                              className="p-3 bg-white/90 hover:bg-white rounded-full transition-colors"
                              title="다운로드"
                            >
                              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setVideoRegenerateSceneId(scene.id);
                                setVideoRegeneratePrompt('');
                              }}
                              className="p-3 bg-white/90 hover:bg-white rounded-full transition-colors"
                              title="재생성"
                            >
                              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          </div>
                          {/* 씬 번호 */}
                          <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-white text-xs font-medium">
                            #{originalIdx + 1}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 p-4 border-t border-gray-700 flex justify-center" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { setShowPreviewModal(false); setIsMergedView(false); setExpandedSceneIndex(null); }}
                className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-xl font-medium transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        );
      })()}

      {/* 영상 재생성 프롬프트 팝업 */}
      {videoRegenerateSceneId && project && (() => {
        const scene = project.scenes.find(s => s.id === videoRegenerateSceneId);
        if (!scene) return null;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[310] flex items-center justify-center p-4" onClick={() => { setVideoRegenerateSceneId(null); setVideoRegeneratePrompt(''); }}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">영상 재생성</h3>
              <p className="text-sm text-slate-400 mb-6">변경하고 싶은 부분을 입력해주세요. (선택사항)</p>
              <textarea
                value={videoRegeneratePrompt}
                onChange={e => setVideoRegeneratePrompt(e.target.value)}
                placeholder="예: 조명을 더 밝게, 배경을 바다로 변경"
                className="w-full px-4 py-4 rounded-xl bg-gray-50 dark:bg-slate-700 border-none focus:ring-2 focus:ring-indigo-200 outline-none text-sm h-28 resize-none dark:text-slate-100"
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setVideoRegenerateSceneId(null); setVideoRegeneratePrompt(''); }}
                  className="flex-1 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    const sceneId = videoRegenerateSceneId;
                    setVideoRegenerateSceneId(null);
                    setVideoRegeneratePrompt('');
                    setShowPreviewModal(false);

                    // 영상 재생성
                    updateProjects(prev => prev.map(p => p.id === project.id ? {
                      ...p,
                      scenes: p.scenes.map(s => s.id === sceneId ? { ...s, videoUrl: null, videoStatus: 'loading' } : s)
                    } : p));

                    try {
                      let finalPrompt = scene.imagePrompt;
                      if (videoRegeneratePrompt.trim()) {
                        finalPrompt = `${scene.imagePrompt}\n\n수정사항: ${videoRegeneratePrompt}`;
                      }

                      const videoBlob = await generateSceneVideo(
                        scene.imageUrl!,
                        finalPrompt,
                        scene.scriptSegment || '',
                        '',
                        false
                      );
                      const videoUrl = URL.createObjectURL(videoBlob);

                      updateProjects(prev => prev.map(p => p.id === project.id ? {
                        ...p,
                        scenes: p.scenes.map(s => s.id === sceneId ? { ...s, videoUrl, videoStatus: 'done' } : s)
                      } : p));
                    } catch (err: any) {
                      alert('영상 재생성 실패: ' + (err.message || '알 수 없는 오류'));
                      updateProjects(prev => prev.map(p => p.id === project.id ? {
                        ...p,
                        scenes: p.scenes.map(s => s.id === sceneId ? { ...s, videoStatus: 'error' } : s)
                      } : p));
                    }
                  }}
                  className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all"
                >
                  재생성
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 대본 인물 추가 팝업 */}
      {showScriptCharPrompt && project && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[310] flex items-center justify-center p-4" onClick={() => setShowScriptCharPrompt(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">등장인물 추가</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">대본에서 추가할까요?</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (!project || !project.script) { alert('대본이 없습니다'); return; }
                    setShowScriptCharPrompt(false);
                    const prompt = `다음 대본을 분석하여 등장하는 인물의 이름만 JSON 배열로 추출해주세요. 예시: ["철수", "영희"]\n\n대본:\n${project.script}`;
                    try {
                      const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
                      const response = await genAI.models.generateContent({
                        model: geminiModel,
                        contents: prompt
                      });
                      const text = response.text || '';
                      const match = text.match(/\[.*\]/);
                      if (match) {
                        const chars = JSON.parse(match[0]);
                        setScriptCharacters(chars);
                      }
                    } catch (err) {
                      console.error(err);
                      alert('GEMINI API키를 입력해주세요');
                    }
                  }}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all"
                >
                  네
                </button>
                <button
                  onClick={() => {
                    setShowScriptCharPrompt(false);
                    setCharLoadModalMode('add');
                    setIsCharLoadModalOpen(true);
                  }}
                  className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  아니오
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 대본 인물 목록 팝업 */}
      {scriptCharacters.length > 0 && project && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[310] flex items-center justify-center p-4" onClick={() => setScriptCharacters([])}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">대본 속 등장인물</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">이름을 클릭하면 추가됩니다</p>
            </div>
            <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
              {scriptCharacters.map((name, idx) => (
                <button
                  key={idx}
                  onClick={async () => {
                    if (!project) return;
                    const prompt = `대본 맥락을 분석하여 "${name}"의 외형을 상세히 묘사해주세요. 대본:\n${project.script}`;
                    try {
                      const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
                      const response = await genAI.models.generateContent({
                        model: geminiModel,
                        contents: prompt
                      });
                      const desc = (response.text || '').trim();
                      updateCurrentProject({
                        characters: [...project.characters, {
                          id: crypto.randomUUID(),
                          name,
                          role: '',
                          visualDescription: desc,
                          portraitUrl: null,
                          status: 'idle'
                        }]
                      });
                      setScriptCharacters(prev => prev.filter(n => n !== name));
                    } catch (err) {
                      console.error(err);
                      alert('외형 생성 실패');
                    }
                  }}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl text-left transition-all"
                >
                  <p className="font-medium text-slate-900 dark:text-slate-100">{name}</p>
                  <p className="text-xs text-slate-400 mt-1">클릭하여 추가</p>
                </button>
              ))}
            </div>
            <div className="p-6 pt-0">
              <button onClick={() => setScriptCharacters([])} className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 동영상 추출 팝업 */}
      {showExportPopup && project && (() => {
        const videoCount = project.scenes.filter(s => s.videoUrl).length;
        const imageCount = project.scenes.filter(s => s.imageUrl && !s.videoUrl).length;
        const totalScenes = project.scenes.length;
        const estimatedLength = project.scenes.reduce((acc, s) => {
          const textLen = s.scriptSegment?.length || 0;
          return acc + Math.max(5, Math.min(12, textLen / 3));
        }, 0);
        const estimatedTime = Math.ceil((videoCount * 3 + imageCount * 8 + totalScenes * 2) / 60);
        return (
          <>
            {/* 자막 팝업 */}
            {showSubtitlePrompt && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[310] flex items-center justify-center p-4" onClick={() => setShowSubtitlePrompt(false)}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">자막 설정</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">자막을 표시할까요?</p>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* 예시 이미지 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-12 h-12 bg-white/20 rounded-full mx-auto mb-2"></div>
                              <div className="text-xs text-white/60">영상</div>
                            </div>
                          </div>
                          <div className="absolute bottom-3 left-3 right-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded">
                            안녕하세요
                          </div>
                        </div>
                        <p className="text-xs text-center font-medium text-slate-700 dark:text-slate-300">자막 ON</p>
                      </div>
                      <div className="space-y-2">
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-12 h-12 bg-white/20 rounded-full mx-auto mb-2"></div>
                              <div className="text-xs text-white/60">영상</div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-center font-medium text-slate-700 dark:text-slate-300">자막 OFF</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setIncludeSubtitles(true);
                          setShowSubtitlePrompt(false);
                          setShowExportPopup(true);
                        }}
                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all"
                      >
                        자막 ON
                      </button>
                      <button
                        onClick={() => {
                          setIncludeSubtitles(false);
                          setShowSubtitlePrompt(false);
                          setShowExportPopup(true);
                        }}
                        className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                      >
                        자막 OFF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setShowExportPopup(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">동영상 합치기</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">최종 영상을 생성합니다</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl text-center">
                    <div className="text-2xl font-bold text-purple-600">{videoCount}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">AI 비디오</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl text-center">
                    <div className="text-2xl font-bold text-blue-600">{imageCount}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">이미지 (줌효과)</div>
                  </div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">예상 영상 길이</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{Math.floor(estimatedLength / 60)}분 {Math.round(estimatedLength % 60)}초</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">예상 소요 시간</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">약 {estimatedTime}분</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">총 씬 개수</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{totalScenes}개</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 text-center">자막과 오디오가 싱크에 맞춰 자동으로 합성됩니다</p>
              </div>
              <div className="p-6 pt-0 flex gap-3">
                <button onClick={() => setShowExportPopup(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">취소</button>
                <button onClick={() => { setShowExportPopup(false); exportVideo(); }} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">추출 시작</button>
              </div>
            </div>
          </div>
          </>
        );
      })()}

      {isRegenerateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsRegenerateModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">이미지 재생성</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">변경하고 싶은 특징을 입력해주세요</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">수정사항 입력</label>
                <textarea
                  value={regenerateInput}
                  onChange={(e) => setRegenerateInput(e.target.value)}
                  className="w-full h-32 px-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none text-sm"
                  placeholder="예: 배경을 더 밝게 해주세요, 인물을 더 젊게 그려주세요..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsRegenerateModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
                  취소
                </button>
                <button onClick={handleRegenerateWithModification} disabled={!regenerateInput.trim()} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  적용하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStyleDescModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsStyleDescModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">고급 설정</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">그림체의 특징을 상세히 설명해주세요</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">특징 설명 (선택사항)</label>
                <textarea
                  value={newStyleDescription}
                  onChange={(e) => setNewStyleDescription(e.target.value)}
                  className="w-full h-32 px-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none text-sm"
                  placeholder="이 그림체의 특징을 간단히 설명해주세요..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsStyleDescModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 전체 화면 설정 */}
      {isMyPageOpen && isSettingsFullscreen && (
        <FullscreenSettings
          onClose={() => setIsSettingsFullscreen(false)}
          isLoggedIn={isLoggedIn}
          onLoginStateChange={setIsLoggedIn}
          onCheckGeminiKey={checkGeminiKey}
          calculateVideoCost={calculateVideoCost}
          totalScenes={project?.scenes.length || 0}
          onCheckByteplusKey={checkByteplusKey}
          onCheckEvolinkKey={checkEvolinkKey}
          onCheckRunwareKey={checkRunwareKey}
          isElConnected={isElConnected}
          voices={voices}
          onVoiceTest={handleVoiceTest}
          isVoiceTesting={isVoiceTesting}
          onWavUpload={handleWavUpload}
          uploadedWavFile={uploadedWavFile}
          savedStyles={savedStyles}
          savedCharacters={savedCharacters}
          onAddStyleWithAnalysis={async (name: string, images: string[]) => {
            if (!geminiApiKey) {
              throw new Error('Gemini API 키를 설정해주세요.');
            }
            const analysis = await gemini.analyzeStyle(images);
            const newStyle: SavedStyle = {
              id: crypto.randomUUID(),
              name,
              refImages: images,
              description: analysis.style,
              characterAppearance: analysis.characterAppearance
            };
            addSavedStyle(newStyle);
          }}
          onAddCharacterWithAnalysis={async (name: string, images: string[]) => {
            if (!geminiApiKey) {
              throw new Error('Gemini API 키를 설정해주세요.');
            }
            const analysis = await gemini.analyzeStyle(images);
            const newChar: SavedCharacter = {
              id: crypto.randomUUID(),
              name,
              refImages: images,
              description: analysis.characterAppearance || analysis.style,
              portraitUrl: images[0] || null
            };
            addSavedCharacter(newChar);
          }}
          onDeleteStyle={deleteSavedStyle}
          onDeleteCharacter={deleteSavedCharacter}
        />
      )}

      {/* 기존 축소 모달 */}
      {isMyPageOpen && !isSettingsFullscreen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsMyPageOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 rounded-t-3xl z-10">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">설정</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSettingsFullscreen(!isSettingsFullscreen);
                  }}
                  className="px-3 py-1.5 flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-sm font-medium transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                  {isSettingsFullscreen ? '축소' : '전체 화면'}
                </button>
                <button onClick={() => setIsMyPageOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {/* 로그인/회원가입 섹션 */}
              {isLoggedIn ? (
                <div className="flex gap-3 items-center">
                  <div className="flex-1 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 text-center font-semibold rounded-xl text-sm">로그인됨</div>
                  <button onClick={handleLogout} className="px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-center font-semibold rounded-xl transition-all text-sm">로그아웃</button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setIsLoginModalOpen(true)} className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white text-center font-semibold rounded-xl transition-all text-sm">로그인</button>
                  <button onClick={() => setIsSignupModalOpen(true)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-center font-semibold rounded-xl transition-all text-sm">회원가입</button>
                </div>
              )}

              {/* Gemini API 설정 - 아코디언 */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'gemini' ? null : 'gemini')} className="w-full px-4 py-4 flex items-center justify-between bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gemini API 설정</span>
                    {isGeminiValid && (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'gemini' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'gemini' && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900">
                    <div className="space-y-2 pt-4">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">API 키</label>
                      <div className="relative">
                        <input type={showGeminiKey ? "text" : "password"} value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} onBlur={() => geminiApiKey.length > 20 && checkGeminiKey(geminiApiKey)} placeholder="API 키 입력" className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
                        <button onClick={() => setShowGeminiKey(!showGeminiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                          {showGeminiKey ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          )}
                        </button>
                      </div>
                      {!geminiApiKey && (
                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            💡 google.ai studio에서 발급가능합니다
                          </p>
                        </div>
                      )}
                      {geminiApiKey.length > 20 && (
                        <div className="flex items-center gap-2 text-sm">
                          {isValidatingGemini ? (
                            <>
                              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-slate-600 dark:text-slate-400">검증 중...</span>
                            </>
                          ) : isGeminiValid ? (
                            <>
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                              <span className="text-green-600 font-medium">유효함</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                              <span className="text-red-600 font-medium">유효하지 않음</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 기본 Gemini 엔진 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">기본 Gemini 엔진 (대본/프롬프트 생성)</label>
                      <select value={geminiModel} onChange={e => setGeminiModel(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
                        <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                      </select>
                    </div>

                    {/* 이미지 모델 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">이미지 모델</label>
                      <select value={geminiImageModel} onChange={e => setGeminiImageModel(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
                        <option value="imagen-4.0-generate-001">Imagen 4 Fast (29원)</option>
                        <option value="imagen-3.0-generate-002">Imagen 3 Fast (29원)</option>
                        <option value="gemini-3.1-flash-image-preview">Nano Banana 2 (98원)</option>
                        <option value="gemini-3-pro-image-preview">Nano Banana Pro (196원)</option>
                      </select>
                    </div>

                    {/* 예상 비용 표시 */}
                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-emerald-900 dark:text-emerald-300">예상 비용 (누적)</span>
                          <button
                            onClick={() => setShowCostDetails(!showCostDetails)}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 font-medium underline"
                          >
                            {showCostDetails ? '간단히 보기' : '자세히 보기'}
                          </button>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                          {(() => {
                            const stored = JSON.parse(localStorage.getItem('gemini_usage') || '{"input":0,"output":0,"images":0}');
                            const EXCHANGE_RATE = 1460;
                            const inputCost = (stored.input / 1000000) * 0.50;
                            const outputCost = (stored.output / 1000000) * 3.00;
                            const imageCost = stored.images * 0.02;
                            const totalUSD = inputCost + outputCost + imageCost;
                            const totalKRW = Math.ceil(totalUSD * EXCHANGE_RATE);
                            return `₩${totalKRW.toLocaleString()}`;
                          })()}
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">환율 1,460원 기준</p>

                        {showCostDetails && (
                          <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700 space-y-3">
                            {/* 기간 선택 */}
                            <div className="flex gap-2">
                              {[
                                { value: 'daily', label: '일별' },
                                { value: 'weekly', label: '주별' },
                                { value: 'monthly', label: '월별' }
                              ].map(period => (
                                <button
                                  key={period.value}
                                  onClick={() => setCostPeriod(period.value as any)}
                                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    costPeriod === period.value
                                      ? 'bg-emerald-600 dark:bg-emerald-700 text-white'
                                      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                  }`}
                                >
                                  {period.label}
                                </button>
                              ))}
                            </div>

                            {/* 그래프 & 통계 */}
                            {(() => {
                              const logs = JSON.parse(localStorage.getItem('gemini_usage_log') || '[]');
                              const EXCHANGE_RATE = 1460;

                              // 기간별로 그룹핑
                              const groupedData: Record<string, { input: number; output: number; images: number; cost: number }> = {};
                              const now = Date.now();
                              const msPerDay = 24 * 60 * 60 * 1000;

                              logs.forEach((log: any) => {
                                let key = '';
                                const date = new Date(log.timestamp);

                                if (costPeriod === 'daily') {
                                  key = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                                } else if (costPeriod === 'weekly') {
                                  const weekStart = new Date(date);
                                  weekStart.setDate(date.getDate() - date.getDay());
                                  key = weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                                } else {
                                  key = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' });
                                }

                                if (!groupedData[key]) {
                                  groupedData[key] = { input: 0, output: 0, images: 0, cost: 0 };
                                }

                                groupedData[key].input += log.input || 0;
                                groupedData[key].output += log.output || 0;
                                groupedData[key].images += log.images || 0;
                              });

                              // 비용 계산
                              Object.keys(groupedData).forEach(key => {
                                const data = groupedData[key];
                                const inputCost = (data.input / 1000000) * 0.50 * EXCHANGE_RATE;
                                const outputCost = (data.output / 1000000) * 3.00 * EXCHANGE_RATE;
                                const imageCost = data.images * 0.02 * EXCHANGE_RATE;
                                data.cost = Math.ceil(inputCost + outputCost + imageCost);
                              });

                              const entries = Object.entries(groupedData).slice(-7); // 최근 7개
                              const maxCost = Math.max(...entries.map(([, d]) => d.cost), 1);

                              return (
                                <>
                                  {/* 간단한 바 그래프 */}
                                  <div className="space-y-1.5">
                                    {entries.length > 0 ? entries.map(([key, data]) => (
                                      <div key={key} className="flex items-center gap-2">
                                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 w-16 text-right">{key}</span>
                                        <div className="flex-1 h-5 bg-emerald-100 dark:bg-emerald-900/20 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-full transition-all"
                                            style={{ width: `${(data.cost / maxCost) * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] font-semibold text-emerald-900 dark:text-emerald-200 w-16">₩{data.cost.toLocaleString()}</span>
                                      </div>
                                    )) : (
                                      <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center py-2">사용 기록이 없습니다</p>
                                    )}
                                  </div>

                                  {/* 세부 내역 */}
                                  <div className="pt-2 border-t border-emerald-200 dark:border-emerald-700 space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-emerald-700 dark:text-emerald-300">총 이미지 생성</span>
                                      <span className="font-medium text-emerald-900 dark:text-emerald-200">{entries.reduce((sum, [, d]) => sum + d.images, 0)}장</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-emerald-700 dark:text-emerald-300">총 입력 토큰</span>
                                      <span className="font-medium text-emerald-900 dark:text-emerald-200">{(entries.reduce((sum, [, d]) => sum + d.input, 0) / 1000).toFixed(1)}K</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-emerald-700 dark:text-emerald-300">총 출력 토큰</span>
                                      <span className="font-medium text-emerald-900 dark:text-emerald-200">{(entries.reduce((sum, [, d]) => sum + d.output, 0) / 1000).toFixed(1)}K</span>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 영상화 API 설정 - 아코디언 */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'bytedance' ? null : 'bytedance')} className="w-full px-4 py-4 flex items-center justify-between bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">영상화 API 설정</span>
                    {isByteplusValid && (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'bytedance' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'bytedance' && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900">
                    <div className="space-y-2 pt-4">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">비디오 모델</label>
                      <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                        <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">SeeDance 1.0 Pro Fast</p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">BytePlus ModelArk (10초 영상, 720p)</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">BytePlus API 키</label>
                        {isByteplusValid && (
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showBytedanceKey ? "text" : "password"}
                          value={bytedanceApiKey}
                          onChange={e => setBytedanceApiKey(e.target.value)}
                          onBlur={() => bytedanceApiKey.length > 10 && checkByteplusKey(bytedanceApiKey)}
                          placeholder="ARK_API_KEY"
                          className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                        />
                        <button onClick={() => setShowBytedanceKey(!showBytedanceKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                          {showBytedanceKey ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          )}
                        </button>
                      </div>
                      {bytedanceApiKey.length > 10 && (
                        <div className="flex items-center gap-2 text-sm mt-2">
                          {isValidatingByteplus ? (
                            <>
                              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-slate-600 dark:text-slate-400">검증 중...</span>
                            </>
                          ) : isByteplusValid ? (
                            <>
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-green-600 font-medium">유효함</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span className="text-red-600 font-medium">유효하지 않음</span>
                            </>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400">BytePlus ModelArk에서 API 키를 발급받으세요</p>
                    </div>

                    {/* 영상 생성할 장면 수 설정 (최대 180장) */}
                    <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">영상 생성할 장면 수 (최대 180장)</label>
                      <div className="flex gap-3 items-center">
                        <input
                          type="range"
                          min="0"
                          max="180"
                          value={Math.floor(videoGenerationRange / 10)}
                          onChange={e => setVideoGenerationRange(parseInt(e.target.value) * 10)}
                          className="flex-1 h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="180"
                          value={Math.floor(videoGenerationRange / 10)}
                          onChange={e => setVideoGenerationRange(Math.max(0, Math.min(180, parseInt(e.target.value) || 0)) * 10)}
                          className="w-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-center focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-slate-800 dark:text-slate-100"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400">장</span>
                      </div>
                      {(() => {
                        const { numScenes, costPerScene, totalCost } = calculateVideoCost();
                        const totalScenes = project?.scenes.length || 0;
                        return (
                          <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg space-y-2">
                            <div className="flex items-baseline justify-between">
                              <p className="text-sm font-semibold text-indigo-900">
                                💰 {numScenes}장 영상화 예정
                              </p>
                              <p className="text-lg font-bold text-indigo-700">
                                ₩{totalCost.toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-indigo-600">10초 영상 생성에 1장당 ₩{costPerScene.toLocaleString()}</span>
                              <span className="text-xs font-medium text-indigo-700">총 시간: {Math.floor(videoGenerationRange / 60)}분 {videoGenerationRange % 60}초</span>
                            </div>
                            {totalScenes > numScenes && (
                              <p className="text-xs text-purple-600 mt-1">
                                📌 나머지 {totalScenes - numScenes}장은 정적 효과(무료)로 처리됩니다
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* 자막 설정 - 아코디언 */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="w-full px-4 py-4 flex items-center justify-between bg-white dark:bg-slate-800">
                  <button onClick={() => setExpandedSetting(expandedSetting === 'subtitle' ? null : 'subtitle')} className="flex-1 flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">자막 설정</span>
                  </button>
                  <button onClick={() => setExpandedSetting(expandedSetting === 'subtitle' ? null : 'subtitle')} className="p-1">
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'subtitle' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
                {expandedSetting === 'subtitle' && (
                  <div className="px-4 pt-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900">
                    {/* 템플릿 선택 - 상단 */}
                    <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <button
                        onClick={() => setShowSubtitleEditor(true)}
                        className="w-full px-4 py-2.5 text-sm font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
                      >
                        템플릿 선택하기
                      </button>
                    </div>

                    {/* 위치 설정 - 컴팩트 */}
                    <div className="space-y-2 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">위치</label>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setSubtitleSettings({...subtitleSettings, position: 'top', yPosition: 80})}
                          className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-all ${subtitleSettings.position === 'top' ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                        >
                          상단
                        </button>
                        <button
                          onClick={() => setSubtitleSettings({...subtitleSettings, position: 'center', yPosition: 400})}
                          className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-all ${subtitleSettings.position === 'center' ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                        >
                          중앙
                        </button>
                        <button
                          onClick={() => setSubtitleSettings({...subtitleSettings, position: 'bottom', yPosition: 650})}
                          className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-all ${subtitleSettings.position === 'bottom' ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                        >
                          하단
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Y축 미세 조정</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="40"
                            max="720"
                            value={subtitleSettings.yPosition}
                            onChange={(e) => setSubtitleSettings({...subtitleSettings, yPosition: Math.max(40, Math.min(720, parseInt(e.target.value) || 680))})}
                            className="w-24 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded text-center dark:bg-slate-700 dark:text-slate-100"
                          />
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => setSubtitleSettings({...subtitleSettings, yPosition: Math.max(40, subtitleSettings.yPosition - 1)})}
                              className="w-5 h-3 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-700 rounded-sm text-slate-600 dark:text-slate-400 text-xs"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => setSubtitleSettings({...subtitleSettings, yPosition: Math.min(720, subtitleSettings.yPosition + 1)})}
                              className="w-5 h-3 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-700 rounded-sm text-slate-600 dark:text-slate-400 text-xs"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 색상 설정 - 애플 스타일 */}
                    <div className="space-y-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">색상</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-sm text-slate-700 dark:text-slate-300 min-w-[80px]">자막</label>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="color"
                              value={subtitleSettings.textColor}
                              onChange={(e) => setSubtitleSettings({...subtitleSettings, textColor: e.target.value})}
                              className="w-10 h-8 rounded border-2 border-slate-300 dark:border-slate-600 cursor-pointer appearance-none p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded"
                              style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                            />
                            <input
                              type="text"
                              value={subtitleSettings.textColor}
                              onChange={(e) => setSubtitleSettings({...subtitleSettings, textColor: e.target.value})}
                              className="flex-1 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded text-center font-mono bg-slate-50 dark:bg-slate-700 dark:text-slate-100"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-sm text-slate-700 dark:text-slate-300 min-w-[80px]">배경</label>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="color"
                              value={subtitleSettings.backgroundColor || '#000000'}
                              onChange={(e) => setSubtitleSettings({...subtitleSettings, backgroundColor: e.target.value})}
                              className="w-10 h-8 rounded border-2 border-slate-300 dark:border-slate-600 cursor-pointer appearance-none p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded"
                              style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                            />
                            <input
                              type="text"
                              value={subtitleSettings.backgroundColor || '#000000'}
                              onChange={(e) => setSubtitleSettings({...subtitleSettings, backgroundColor: e.target.value})}
                              className="flex-1 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded text-center font-mono bg-slate-50 dark:bg-slate-700 dark:text-slate-100"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 미리보기 Canvas */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">미리보기</label>
                        <span className="text-xs text-slate-500 dark:text-slate-400">클릭하여 Y축 위치 조정</span>
                      </div>
                      <div className="relative border-2 border-slate-300 rounded-lg overflow-hidden bg-slate-900">
                        <canvas
                          id="subtitle-preview-canvas"
                          width="1280"
                          height="720"
                          className="w-full cursor-crosshair"
                          onClick={(e) => {
                            const canvas = e.currentTarget;
                            const rect = canvas.getBoundingClientRect();
                            const scaleY = 720 / rect.height;
                            const clickY = (e.clientY - rect.top) * scaleY;
                            setSubtitleSettings({...subtitleSettings, yPosition: Math.round(clickY)});
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 나레이션 설정 - 아코디언 */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'voice' ? null : 'voice')} className="w-full px-4 py-4 flex items-center justify-between bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">나레이션 설정</span>
                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                      {audioProvider === 'google-chirp3' && 'Chirp3 HD'}
                      {audioProvider === 'google-neural2' && 'Neural2'}
                      {audioProvider === 'microsoft' && 'Azure TTS'}
                      {audioProvider === 'elevenlabs' && 'ElevenLabs'}
                    </span>
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'voice' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'voice' && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900">
                    <div className="space-y-2 pt-4">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">목소리 모델</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setAudioProvider('google-chirp3')} className={`py-3 rounded-xl text-sm font-medium transition-all ${audioProvider === 'google-chirp3' ? 'bg-indigo-600 dark:bg-indigo-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Chirp3 HD</button>
                        <button onClick={() => setAudioProvider('google-neural2')} className={`py-3 rounded-xl text-sm font-medium transition-all ${audioProvider === 'google-neural2' ? 'bg-indigo-600 dark:bg-indigo-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Neural2</button>
                        <button onClick={() => setAudioProvider('microsoft')} className={`py-3 rounded-xl text-sm font-medium transition-all ${audioProvider === 'microsoft' ? 'bg-indigo-600 dark:bg-indigo-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Azure TTS</button>
                        <button onClick={() => setAudioProvider('elevenlabs')} className={`py-3 rounded-xl text-sm font-medium transition-all ${audioProvider === 'elevenlabs' ? 'bg-indigo-600 dark:bg-indigo-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>ElevenLabs</button>
                      </div>
                    </div>
                    {audioProvider === 'google-chirp3' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Chirp 음성</label>
                          <select value={chirpVoice} onChange={e => setChirpVoice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
                            <option value="Kore">Kore - 활기찬, 명랑한, 자연스러운 (여성)</option>
                            <option value="Aoede">Aoede - 차분한, 우아한, 부드러운 (여성)</option>
                            <option value="Leda">Leda - 중립적, 안정적, 명확한 (여성)</option>
                            <option value="Zephyr">Zephyr - 경쾌한, 산뜻한, 상쾌한 (여성)</option>
                            <option value="Charon">Charon - 중후한, 깊은, 신뢰감 있는 (남성)</option>
                            <option value="Fenrir">Fenrir - 힘찬, 강렬한, 역동적인 (남성)</option>
                            <option value="Puck">Puck - 경쾌한, 활발한, 친근한 (남성)</option>
                            <option value="Orus">Orus - 차분한, 부드러운, 따뜻한 (남성)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">목소리 속도</label>
                          <div className="flex gap-3 items-center">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.1"
                              value={chirpSpeed}
                              onChange={e => setChirpSpeed(parseFloat(e.target.value))}
                              className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:cursor-pointer"
                            />
                            <input
                              type="number"
                              min="0.5"
                              max="2.0"
                              step="0.1"
                              value={chirpSpeed}
                              onChange={e => setChirpSpeed(Math.max(0.5, Math.min(2.0, parseFloat(e.target.value) || 1.0)))}
                              className="w-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-center focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-slate-800 dark:text-slate-100"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-400 min-w-[12px]">×</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">0.5 (느리게) ~ 2.0 (빠르게)</p>
                        </div>
                      </>
                    )}
                    {audioProvider === 'google-neural2' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Neural2 음성</label>
                          <select value={neural2Voice} onChange={e => setNeural2Voice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
                            <option value="ko-KR-Neural2-A">Neural2-A - 표준 여성</option>
                            <option value="ko-KR-Neural2-B">Neural2-B - 부드러운 여성</option>
                            <option value="ko-KR-Neural2-C">Neural2-C - 자연스러운 남성</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">목소리 속도</label>
                          <div className="flex gap-3 items-center">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.1"
                              value={chirpSpeed}
                              onChange={e => setChirpSpeed(parseFloat(e.target.value))}
                              className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:cursor-pointer"
                            />
                            <input
                              type="number"
                              min="0.5"
                              max="2.0"
                              step="0.1"
                              value={chirpSpeed}
                              onChange={e => setChirpSpeed(Math.max(0.5, Math.min(2.0, parseFloat(e.target.value) || 1.0)))}
                              className="w-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-center focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-slate-800 dark:text-slate-100"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-400 min-w-[12px]">×</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">0.5 (느리게) ~ 2.0 (빠르게)</p>
                        </div>
                      </>
                    )}
                    {audioProvider === 'microsoft' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Azure API 키</label>
                          <div className="relative">
                            <input type={showAzureKey ? "text" : "password"} value={azureApiKey} onChange={e => setAzureApiKey(e.target.value)} placeholder="Azure Speech API 키 입력" className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
                            <button onClick={() => setShowAzureKey(!showAzureKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                              {showAzureKey ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">무료 티어: 월 500만 글자 (한국 서버)</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">음성 선택</label>
                          <select value={azureVoice} onChange={e => setAzureVoice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
                            <optgroup label="한국어 Neural">
                              <option value="ko-KR-SunHiNeural">선희 (여성, 밝고 친근함)</option>
                              <option value="ko-KR-InJoonNeural">인준 (남성, 차분하고 안정적)</option>
                              <option value="ko-KR-BongJinNeural">봉진 (남성, 중후하고 신뢰감)</option>
                              <option value="ko-KR-GookMinNeural">국민 (남성, 명확하고 자연스러움)</option>
                            </optgroup>
                          </select>
                        </div>
                      </>
                    )}
                    {audioProvider === 'elevenlabs' && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">ElevenLabs API 키</label>
                            {isElConnected && (
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                            )}
                          </div>
                          <div className="relative">
                            <input type={showElKey ? "text" : "password"} value={elSettings.apiKey} onChange={e => setElSettings({...elSettings, apiKey: e.target.value})} placeholder="API 키 입력" className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
                            <button onClick={() => setShowElKey(!showElKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                              {showElKey ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                        {voices.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">음성 선택</label>
                            <select value={elSettings.voiceId} onChange={e => setElSettings({...elSettings, voiceId: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
                              {voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">음성 속도: {elSettings.speed.toFixed(1)}x</label>
                          <input type="range" min="0.5" max="2.0" step="0.1" value={elSettings.speed} onChange={e => setElSettings({...elSettings, speed: parseFloat(e.target.value)})} className="w-full accent-indigo-600" />
                        </div>
                      </>
                    )}
                    <button onClick={handleVoiceTest} disabled={isVoiceTesting} className="w-full py-3 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                      {isVoiceTesting ? '테스트 중...' : '음성 테스트'}
                    </button>
                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <input type="file" ref={wavUploadRef} accept=".wav,.mp3" className="hidden" onChange={handleWavUpload} />
                      <button onClick={() => wavUploadRef.current?.click()} className="w-full py-3 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                        WAV파일 업로드
                      </button>
                      {uploadedWavFile && (
                        <p className="text-xs text-green-600 dark:text-green-400">✓ {uploadedWavFile.file.name}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 저장된 그림체 - 아코디언 */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'styles' ? null : 'styles')} className="w-full px-4 py-4 flex items-center justify-between bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">저장된 그림체</span>
                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">{savedStyles.length}/10</span>
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'styles' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'styles' && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 space-y-4">
                    {/* 새 그림체 추가 폼 */}
                    <div className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">새 그림체 추가</h4>
                        <button
                          onClick={() => setIsStyleDescModalOpen(true)}
                          className="group relative p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                          title="고급 설정"
                        >
                          <svg className="w-4 h-4 text-slate-500 hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="absolute -top-8 right-0 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            고급 설정
                          </span>
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">제목</label>
                        <input
                          type="text"
                          value={newStyleName}
                          onChange={e => setNewStyleName(e.target.value)}
                          placeholder="예: 지브리 스타일, 수채화 풍경 등"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">레퍼런스 이미지 (최대 10장)</label>
                        <input
                          ref={styleLibraryInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleStyleLibraryImageUpload}
                        />
                        <button
                          onClick={() => styleLibraryInputRef.current?.click()}
                          className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                        >
                          + 이미지 선택
                        </button>
                        {newStyleImages.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {newStyleImages.map((img, idx) => (
                              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                <img src={img} className="w-full h-full object-cover" />
                                <button
                                  onClick={() => setNewStyleImages(prev => prev.filter((_, i) => i !== idx))}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                                >
                                  삭제
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={addNewStyle}
                        disabled={!newStyleName.trim() || newStyleImages.length === 0}
                        className="w-full py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        그림체 저장
                      </button>
                    </div>

                    {/* 저장된 그림체 목록 */}
                    {savedStyles.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">저장된 그림체 ({savedStyles.length}/10)</h4>
                        {savedStyles.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                              {s.refImages[0] && <img src={s.refImages[0]} className="w-10 h-10 rounded-lg object-cover" />}
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{s.name}</span>
                            </div>
                            <button onClick={() => updateSavedStyles(prev => prev.filter(x => x.id !== s.id))} className="text-xs text-red-500 hover:text-red-600">삭제</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 저장된 인물 - 아코디언 */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'characters' ? null : 'characters')} className="w-full px-4 py-4 flex items-center justify-between bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">저장된 인물</span>
                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">{savedCharacters.length}/10</span>
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'characters' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'characters' && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 space-y-4">
                    {/* 새 인물 추가 폼 */}
                    <div className="pt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">새 인물 추가</h4>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">이름</label>
                        <input
                          type="text"
                          value={newCharLibName}
                          onChange={e => setNewCharLibName(e.target.value)}
                          placeholder="이름을 입력해주세요"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">레퍼런스 이미지 (최대 10장)</label>
                        <input
                          ref={charLibInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleCharLibraryImageUpload}
                        />
                        <button
                          onClick={() => charLibInputRef.current?.click()}
                          className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                        >
                          + 이미지 선택
                        </button>
                        {newCharLibImages.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {newCharLibImages.map((img, idx) => (
                              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                <img src={img} className="w-full h-full object-cover" />
                                <button
                                  onClick={() => setNewCharLibImages(prev => prev.filter((_, i) => i !== idx))}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                                >
                                  삭제
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={addNewCharToLibFromSidebar}
                        disabled={!newCharLibName.trim() || newCharLibImages.length === 0 || charLibSaveProgress !== null}
                        className="w-full py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {charLibSaveProgress !== null ? `저장 중... ${charLibSaveProgress}%` : '인물 저장'}
                      </button>
                    </div>

                    {/* 저장된 인물 목록 */}
                    {savedCharacters.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">저장된 인물 ({savedCharacters.length}/10)</h4>
                        {savedCharacters.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                              {c.portraitUrl && <img src={c.portraitUrl} onClick={() => setSelectedImage(c.portraitUrl)} className="w-10 h-10 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform" />}
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.name}</span>
                            </div>
                            <button onClick={() => updateSavedCharacters(prev => prev.filter(x => x.id !== c.id))} className="text-xs text-red-500 hover:text-red-600">삭제</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 캐릭터 추가 모달 */}
      {isCharModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsCharModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">새 캐릭터 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">이름</label>
                <input type="text" value={newCharData.name} onChange={e => setNewCharData({...newCharData, name: e.target.value})} placeholder="캐릭터 이름" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">성별</label>
                  <select value={newCharData.gender} onChange={e => setNewCharData({...newCharData, gender: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm bg-white dark:bg-slate-700 dark:text-slate-100">
                    <option value="여성">여성</option>
                    <option value="남성">남성</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">나이</label>
                  <select value={newCharData.age} onChange={e => setNewCharData({...newCharData, age: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm bg-white dark:bg-slate-700 dark:text-slate-100">
                    <option value="어린이">어린이</option>
                    <option value="청소년">청소년</option>
                    <option value="성인">성인</option>
                    <option value="중년">중년</option>
                    <option value="노인">노인</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">외형 특징</label>
                <textarea value={newCharData.traits} onChange={e => setNewCharData({...newCharData, traits: e.target.value})} placeholder="머리색, 옷차림, 특징 등" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm h-24 resize-none dark:bg-slate-700 dark:text-slate-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsCharModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">취소</button>
              <button onClick={addCharacterManually} disabled={loading || !newCharData.name.trim() || !newCharData.traits.trim()} className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50">
                {loading ? '생성 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 캐릭터 불러오기/추가 모달 */}
      {isCharLoadModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => { setIsCharLoadModalOpen(false); setCharLoadModalMode('list'); setNewSavedCharData({ name: '', refImages: [] }); }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            {charLoadModalMode === 'list' ? (
              <>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">저장된 캐릭터 불러오기</h3>
                <button
                  onClick={() => setCharLoadModalMode('add')}
                  className="w-full mb-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  새 인물 추가하기
                </button>
                {savedCharacters.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">저장된 캐릭터가 없습니다.</p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {savedCharacters.map(sc => (
                      <div key={sc.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30 transition-all cursor-pointer" onClick={() => { if(project) { updateCurrentProject({ characters: [...project.characters, { id: crypto.randomUUID(), name: sc.name, role: '', visualDescription: sc.description, portraitUrl: sc.portraitUrl, status: sc.portraitUrl ? 'done' : 'idle' }] }); setIsCharLoadModalOpen(false); } }}>
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                          {sc.portraitUrl ? <img src={sc.portraitUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{sc.name}</p>
                          <p className="text-xs text-slate-400 truncate">{sc.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => { setIsCharLoadModalOpen(false); setCharLoadModalMode('list'); }} className="w-full mt-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">닫기</button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setCharLoadModalMode('list')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">새 인물 추가</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">이름</label>
                    <input
                      type="text"
                      value={newSavedCharData.name}
                      onChange={e => setNewSavedCharData({ ...newSavedCharData, name: e.target.value })}
                      placeholder="이름을 입력해주세요"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">레퍼런스 이미지 (최대 10장)</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newSavedCharData.refImages.map((img, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                          <img src={img} className="w-full h-full object-cover" />
                          <button
                            onClick={() => setNewSavedCharData({ ...newSavedCharData, refImages: newSavedCharData.refImages.filter((_, i) => i !== idx) })}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                          >삭제</button>
                        </div>
                      ))}
                      {newSavedCharData.refImages.length < 10 && (
                        <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                          <span className="text-2xl text-slate-400">+</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              const remaining = 10 - newSavedCharData.refImages.length;
                              files.slice(0, remaining).forEach(file => {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  if (ev.target?.result) {
                                    setNewSavedCharData(prev => ({ ...prev, refImages: [...prev.refImages, ev.target!.result as string] }));
                                  }
                                };
                                reader.readAsDataURL(file);
                              });
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{newSavedCharData.refImages.length}/10장</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!newSavedCharData.name.trim()) { alert('이름을 입력해주세요'); return; }
                    if (savedCharacters.length >= 10) { alert('최대 10명까지 저장 가능합니다'); return; }

                    const newChar = {
                      id: crypto.randomUUID(),
                      name: newSavedCharData.name,
                      refImages: [...newSavedCharData.refImages],
                      description: '',
                      portraitUrl: newSavedCharData.refImages[0] || ''
                    };

                    setSavedCharacters([...savedCharacters, newChar]);
                    alert('저장이 완료되었습니다.');
                    setNewSavedCharData({ name: '', refImages: [] });
                    setIsCharLoadModalOpen(false);
                    setCharLoadModalMode('list');
                  }}
                  disabled={!newSavedCharData.name.trim()}
                  className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  인물 저장
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 프롬프트 수정 모달 */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsPromptModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">수정 사항 입력</h3>
            <p className="text-sm text-slate-400 mb-6">변경하고 싶은 특징을 한국어로 입력해주세요. 캐릭터 일관성을 유지하며 새로 생성합니다.</p>
            <textarea value={promptEditInput} onChange={e => setPromptEditInput(e.target.value)} placeholder="예: 조금 더 밝은 조명으로 변경해주고 배경에 나무를 추가해줘" className="w-full px-4 py-4 rounded-xl bg-gray-50 dark:bg-slate-700 border-none focus:ring-2 focus:ring-indigo-200 outline-none text-sm h-28 resize-none dark:text-slate-100" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsPromptModalOpen(false)} className="flex-1 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-all">취소</button>
              <button onClick={handleRegeneratePrompt} disabled={!promptEditInput.trim()} className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50">
                적용하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 맞춤형 스타일 이름 입력 모달 */}
      {isStyleNameModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsStyleNameModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">그림체 제목을 입력해주세요</h3>
            <p className="text-sm text-slate-400 mb-6">저장할 맞춤형 스타일의 이름을 입력해주세요.</p>
            <input
              type="text"
              value={customStyleName}
              onChange={e => setCustomStyleName(e.target.value)}
              placeholder="예: 지브리 스타일"
              className="w-full px-4 py-4 rounded-xl bg-gray-50 dark:bg-slate-700 border-none focus:ring-2 focus:ring-indigo-200 outline-none text-sm dark:text-slate-100"
              onKeyDown={e => {
                if (e.key === 'Enter' && customStyleName.trim()) {
                  confirmSaveCustomStyle();
                }
              }}
            />
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setIsStyleNameModalOpen(false); setCustomStyleName(''); }} className="flex-1 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-all">취소</button>
              <button onClick={confirmSaveCustomStyle} disabled={!customStyleName.trim()} className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50">
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 백그라운드 작업 표시 */}
      {bgTask && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[400] flex items-center gap-4">
          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
          <div>
            <p className="font-medium">{bgTask.message}</p>
            {bgProgress > 0 && <p className="text-sm text-slate-400">{bgProgress}%</p>}
          </div>
        </div>
      )}

      {/* 로그인 모달 */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsLoginModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">로그인</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">아이디</label>
                <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="아이디를 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">비밀번호</label>
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="비밀번호를 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm dark:bg-slate-700 dark:text-slate-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsLoginModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">취소</button>
              <button onClick={handleLogin} disabled={!loginUsername.trim() || !loginPassword.trim()} className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50">로그인</button>
            </div>
          </div>
        </div>
      )}

      {/* 회원가입 모달 */}
      {isSignupModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsSignupModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">회원가입</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">아이디</label>
                <input type="text" value={signupUsername} onChange={e => setSignupUsername(e.target.value)} placeholder="아이디를 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">비밀번호</label>
                <input type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} placeholder="비밀번호를 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">이메일</label>
                <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="이메일을 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-400 outline-none text-sm dark:bg-slate-700 dark:text-slate-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsSignupModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">취소</button>
              <button onClick={handleSignup} disabled={!signupUsername.trim() || !signupPassword.trim() || !signupEmail.trim()} className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50">회원가입</button>
            </div>
          </div>
        </div>
      )}


      <StyleTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false);
          setIsTemplateAddMode(false);
        }}
        selectedTemplate={tempSelectedTemplate}
        onSelectTemplate={setTempSelectedTemplate}
        onApply={() => {
          setSelectedStyleTemplate(tempSelectedTemplate);
          setIsTemplateModalOpen(false);
          setIsTemplateAddMode(false);
          if (step === 'style_selection') {
            setStep('character_setup');
          }
        }}
        savedStyles={savedStyles}
        initialAddMode={isTemplateAddMode}
        onSaveNewStyle={async (name, images) => {
          setBgTask({ type: 'style', message: '참고 이미지를 바탕으로 화풍을 학습중입니다' });
          setBgProgress(0);
          const progressTimer = setInterval(() => {
            setBgProgress(prev => Math.min(prev + 2, 90));
          }, 200);
          try {
            const analysis = await gemini.analyzeStyle(images);
            clearInterval(progressTimer);
            setBgProgress(100);
            const newStyle: SavedStyle = {
              id: crypto.randomUUID(),
              name: name,
              refImages: images,
              description: analysis.style,
              characterAppearance: analysis.characterAppearance,
            };
            setSavedStyles([...savedStyles, newStyle]);
            setStyle(newStyle.id as VisualStyle);
            updateCurrentProject({ style: newStyle.id });
            setTimeout(() => {
              setBgTask(null);
              setBgProgress(0);
            }, 500);
          } catch (err) {
            clearInterval(progressTimer);
            setBgTask(null);
            setBgProgress(0);
            throw err;
          }
        }}
      />

      {/* 자막 템플릿 선택 */}
      {showSubtitleEditor && (
        <SubtitleTemplateModal
          current={subtitleSettings}
          onApply={(newSettings) => {
            setSubtitleSettings(newSettings);
            setShowSubtitleEditor(false);
          }}
          onClose={() => setShowSubtitleEditor(false)}
        />
      )}
    </div>
  );
};

export default App;
