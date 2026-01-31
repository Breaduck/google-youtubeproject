import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { GoogleGenAI } from "@google/genai";
import { GeminiService } from './services/geminiService';
import { generateSceneVideo, generateBatchVideos } from './services/videoService';
import { StoryProject, CharacterProfile, Scene, AppStep, VisualStyle, ElevenLabsSettings, SavedStyle, SavedCharacter, SceneEffect } from './types';

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

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('dashboard');
  const [projects, setProjects] = useState<StoryProject[]>(() => {
    try {
      const stored = localStorage.getItem('user_projects_v1');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const project = useMemo(() => {
    return projects.find(p => p.id === currentProjectId) || null;
  }, [projects, currentProjectId]);

  const [script, setScript] = useState('');
  const [style, setStyle] = useState<VisualStyle>('2d-animation');
  const [refImages, setRefImages] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('준비 중...');
  const [targetProgress, setTargetProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  const [bgTask, setBgTask] = useState<{ type: 'style' | 'video' | 'analysis' | 'storyboard', message: string } | null>(null);
  const [bgProgress, setBgProgress] = useState(0);

  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [hasVisitedSetup, setHasVisitedSetup] = useState(false);

  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>(() => {
    try {
      const stored = localStorage.getItem('user_saved_styles');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleImages, setNewStyleImages] = useState<string[]>([]);
  const [newStyleDescription, setNewStyleDescription] = useState('');
  const [isStyleDescModalOpen, setIsStyleDescModalOpen] = useState(false);
  const [customStyleName, setCustomStyleName] = useState('');
  const [isStyleNameModalOpen, setIsStyleNameModalOpen] = useState(false);
  const styleLibraryInputRef = useRef<HTMLInputElement>(null);

  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>(() => {
    try {
      const stored = localStorage.getItem('user_saved_characters_v2');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [newCharLibName, setNewCharLibName] = useState('');
  const [newCharLibImages, setNewCharLibImages] = useState<string[]>([]);
  const [charLibSaveProgress, setCharLibSaveProgress] = useState<number | null>(null);
  const charLibInputRef = useRef<HTMLInputElement>(null);
  const [isLoadCharModalOpen, setIsLoadCharModalOpen] = useState(false);

  const [isManualCharAdding, setIsManualCharAdding] = useState(false);

  const [expandedSetting, setExpandedSetting] = useState<string | null>(null);
  const [geminiModel, setGeminiModel] = useState(localStorage.getItem('gemini_model') || 'gemini-3-flash');
  const [geminiImageModel, setGeminiImageModel] = useState(localStorage.getItem('gemini_image_model') || 'gemini-2.5-flash-image');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [isGeminiValid, setIsGeminiValid] = useState(false);
  const [isValidatingGemini, setIsValidatingGemini] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showElKey, setShowElKey] = useState(false);
  const [showChirpKey, setShowChirpKey] = useState(false);

  const [audioProvider, setAudioProvider] = useState<'elevenlabs' | 'google'>(
    (localStorage.getItem('audio_provider') as any) || 'google'
  );
  const [chirpApiKey, setChirpApiKey] = useState(localStorage.getItem('chirp_api_key') || '');
  const [chirpVoice, setChirpVoice] = useState(localStorage.getItem('chirp_voice') || 'Kore');

  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [isCharLoadModalOpen, setIsCharLoadModalOpen] = useState(false);
  const [newCharData, setNewCharData] = useState({ name: '', gender: '여성', age: '성인', traits: '' });

  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptEditType, setPromptEditType] = useState<'character' | 'scene'>('scene');
  const [promptEditId, setPromptEditId] = useState<string | null>(null);
  const [promptEditInput, setPromptEditInput] = useState('');

  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [regenerateType, setRegenerateType] = useState<'character' | 'scene'>('scene');
  const [regenerateId, setRegenerateId] = useState<string | null>(null);
  const [regenerateInput, setRegenerateInput] = useState('');

  const [isMyPageOpen, setIsMyPageOpen] = useState(false);

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
  const [elSettings, setElSettings] = useState<ElevenLabsSettings>({
    apiKey: localStorage.getItem('el_api_key') || '',
    voiceId: '21m00Tcm4llvDq8ikWAM',
    speed: parseFloat(localStorage.getItem('el_speed') || '1.0')
  });
  const [voices, setVoices] = useState<any[]>([]);
  const [isElConnected, setIsElConnected] = useState(false);
  const [isAssetMenuOpen, setIsAssetMenuOpen] = useState(false);
  const [isVoiceTesting, setIsVoiceTesting] = useState(false);

  const sceneImageUploadRef = useRef<HTMLInputElement>(null);
  const sceneAudioUploadRef = useRef<HTMLInputElement>(null);
  const styleRefImageInputRef = useRef<HTMLInputElement>(null);
  const charPortraitUploadRef = useRef<HTMLInputElement>(null);
  const activeCharId = useRef<string | null>(null);
  const activeSceneId = useRef<string | null>(null);

  // 기존 프로젝트 마이그레이션: videoUrl, videoStatus 필드 추가
  useEffect(() => {
    const stored = localStorage.getItem('user_projects_v1');
    if (!stored) return;

    try {
      const oldProjects = JSON.parse(stored);
      let needsMigration = false;

      const migratedProjects = oldProjects.map((p: any) => {
        const migratedScenes = p.scenes.map((s: any) => {
          if (!('videoUrl' in s) || !('videoStatus' in s)) {
            needsMigration = true;
            return { ...s, videoUrl: null, videoStatus: 'idle' };
          }
          return s;
        });
        return { ...p, scenes: migratedScenes };
      });

      if (needsMigration) {
        console.log('🔧 프로젝트 마이그레이션: videoUrl, videoStatus 필드 추가됨');
        setProjects(migratedProjects);
      }
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }, []); // 한 번만 실행

  useEffect(() => {
    try {
      // 이미지/오디오 데이터 완전 제외 (용량 문제 방지)
      const projectsToSave = projects.map(p => ({
        id: p.id,
        title: p.title,
        script: p.script,
        style: p.style,
        customStyleDescription: p.customStyleDescription,
        updatedAt: p.updatedAt,
        characters: p.characters.map(c => ({
          id: c.id,
          name: c.name,
          role: c.role,
          visualDescription: c.visualDescription,
          portraitUrl: null,
          status: 'idle'
        })),
        scenes: p.scenes.map(s => ({
          id: s.id,
          scriptSegment: s.scriptSegment,
          imagePrompt: s.imagePrompt,
          imageUrl: null,
          audioUrl: null,
          videoUrl: null,
          status: 'idle',
          audioStatus: 'idle',
          videoStatus: 'idle',
          effect: s.effect
        }))
      }));
      localStorage.setItem('user_projects_v1', JSON.stringify(projectsToSave));
    } catch (e) {
      console.error("Project Save Error", e);
      // 저장 실패 시 기존 데이터 삭제하고 재시도
      try {
        localStorage.removeItem('user_projects_v1');
      } catch {}
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem('user_saved_styles', JSON.stringify(savedStyles));
    } catch (e) { console.error("Style Save Error", e); }
  }, [savedStyles]);

  useEffect(() => {
    try {
      localStorage.setItem('user_saved_characters_v2', JSON.stringify(savedCharacters));
    } catch (e) { console.error("Character Save Error", e); }
  }, [savedCharacters]);

  useEffect(() => {
    localStorage.setItem('gemini_model', geminiModel);
  }, [geminiModel]);

  useEffect(() => {
    localStorage.setItem('gemini_image_model', geminiImageModel);
  }, [geminiImageModel]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', geminiApiKey);
    if (geminiApiKey.length > 20) {
      checkGeminiKey(geminiApiKey);
    } else {
      setIsGeminiValid(false);
    }
  }, [geminiApiKey]);

  useEffect(() => {
    localStorage.setItem('audio_provider', audioProvider);
    localStorage.setItem('chirp_api_key', chirpApiKey);
    localStorage.setItem('chirp_voice', chirpVoice);
  }, [audioProvider, chirpApiKey, chirpVoice]);

  useEffect(() => {
    localStorage.setItem('el_speed', elSettings.speed.toString());
  }, [elSettings.speed]);

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
      const ai = new GoogleGenAI({ apiKey: key });
      const model = localStorage.getItem('gemini_model') || 'gemini-3-flash';
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

  const updateCurrentProject = useCallback((updates: Partial<StoryProject>) => {
    if (!currentProjectId) return;
    setProjects(prev => {
      const updated = prev.map(p =>
        p.id === currentProjectId
          ? { ...p, ...updates, updatedAt: Date.now() }
          : p
      );
      return updated;
    });
  }, [currentProjectId]);

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
        localStorage.setItem('el_api_key', elSettings.apiKey);
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
    return true;
  };

  const handleVoiceTest = async () => {
    setIsVoiceTesting(true);
    try {
      if (audioProvider === 'elevenlabs') {
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
        new Audio(url).play();
      } else {
        const audioUrl = await gemini.generateGoogleTTS("안녕하세요, 테스트 목소리입니다.", chirpVoice, chirpApiKey);
        new Audio(audioUrl).play();
      }
    } catch (e) {
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
    const url = URL.createObjectURL(file);
    updateCurrentProject({
      scenes: project.scenes.map(s => s.id === activeSceneId.current ? { ...s, audioUrl: url, audioStatus: 'done' } : s)
    });
    activeSceneId.current = null;
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
      const description = await gemini.analyzeStyle(newStyleImages);
      clearInterval(progressTimer);
      setBgProgress(100);

      const newStyle: SavedStyle = {
        id: crypto.randomUUID(),
        name: newStyleName,
        refImages: newStyleImages,
        description
      };
      setSavedStyles(prev => [...prev, newStyle]);
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
      const description = await gemini.analyzeStyle(refImages);
      clearInterval(progressTimer);
      setBgProgress(100);

      const newStyle: SavedStyle = {
        id: crypto.randomUUID(),
        name: customStyleName,
        refImages: refImages,
        description
      };
      setSavedStyles(prev => [...prev, newStyle]);
      setCustomStyleName('');
      setRefImages([]);

      setTimeout(() => {
         setBgTask(null);
         setBgProgress(0);
         setStep('dashboard');
      }, 1500);
    } catch (err) {
      console.error(err);
      clearInterval(progressTimer);
      alert('화풍 학습에 실패했습니다.');
      setBgTask(null);
    }
  };

  const addNewCharToLib = async () => {
    if (!newCharLibName.trim()) { alert('인물 이름을 입력해주세요.'); return; }
    if (newCharLibImages.length === 0) { alert('이미지를 최소 1장 이상 등록해주세요.'); return; }
    if (savedCharacters.length >= 10) { alert('자주 사용하는 인물은 최대 10명까지 저장 가능합니다.'); return; }

    setCharLibSaveProgress(10);
    try {
      const description = await gemini.analyzeStyle(newCharLibImages);
      setCharLibSaveProgress(80);
      const newChar: SavedCharacter = {
        id: crypto.randomUUID(),
        name: newCharLibName,
        refImages: newCharLibImages,
        description,
        portraitUrl: newCharLibImages[0]
      };
      setSavedCharacters(prev => [...prev, newChar]);
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
      setStep('character_setup');
      setHasVisitedSetup(true);
      return;
    }

    // 먼저 화면 이동
    setStep('character_setup');
    setHasVisitedSetup(true);
    setBgTask({ type: 'analysis', message: '등장인물 분석 중...' });
    setBgProgress(10);

    try {
      let customStyleDesc = undefined;
      const saved = savedStyles.find(s => s.id === style);
      if (saved) {
        customStyleDesc = saved.description;
      } else if (style === 'custom') {
        setBgProgress(20);
        if (refImages.length > 0) {
          customStyleDesc = await gemini.analyzeStyle(refImages);
        } else {
          customStyleDesc = "Modern clean digital art style";
        }
      }

      setBgProgress(50);
      setBgTask({ type: 'analysis', message: '캐릭터 외형 프롬프트 생성 중...' });
      const data = await gemini.extractCharacters(script, style === 'custom' || saved ? 'custom' : style as VisualStyle, customStyleDesc);

      setBgProgress(80);
      const updatedProject: StoryProject = {
        ...activeProject,
        title: data.title,
        script,
        style,
        customStyleDescription: customStyleDesc,
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

    setProjects(prev => prev.map(p => p.id === activeProject.id ? {
      ...p, characters: p.characters.map(c => c.id === charId ? { ...c, status: 'loading', portraitUrl: null } : c)
    } : p));

    try {
      const char = activeProject.characters.find(c => c.id === charId);
      if (!char) return;

      // 학습된 그림체 스타일 100% 적용
      let finalPrompt = char.visualDescription;
      if (activeProject.customStyleDescription) {
        finalPrompt = `${char.visualDescription}, Art style: ${activeProject.customStyleDescription}`;
      }

      const url = await gemini.generateImage(finalPrompt, true, geminiImageModel);
      setProjects(prev => prev.map(p => p.id === activeProject.id ? {
        ...p, characters: p.characters.map(c => c.id === charId ? { ...c, portraitUrl: url, status: 'done' } : c)
      } : p));
    } catch {
      setProjects(prev => prev.map(p => p.id === activeProject.id ? {
        ...p, characters: p.characters.map(c => c.id === charId ? { ...c, status: 'error' } : c)
      } : p));
    }
  };

  const proceedToStoryboard = async (isRegen: boolean = true) => {
    if (!project) return;
    if (!isRegen && project.scenes?.length > 0) { setStep('storyboard'); return; }

    setBgTask({ type: 'storyboard', message: '장면별 스토리보드 구성 중...' });
    setBgProgress(10);

    try {
      setBgProgress(30);
      const scenes = await gemini.createStoryboard(project);
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

    setProjects(prev => prev.map(p => p.id === currentProjectId ? {
      ...p,
      scenes: p.scenes.map(s => s.id === sceneId ? { ...s, status: 'loading', imageUrl: null } : s)
    } : p));

    try {
      const activeProject = projects.find(p => p.id === currentProjectId);
      const scene = activeProject?.scenes.find(s => s.id === sceneId);
      if (!scene || !activeProject) return;

      // 학습된 그림체 스타일 100% 적용
      let finalPrompt = scene.imagePrompt;
      if (activeProject.customStyleDescription) {
        finalPrompt = `${scene.imagePrompt}, Art style: ${activeProject.customStyleDescription}`;
      }

      const url = await gemini.generateImage(finalPrompt, false, geminiImageModel);

      setProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p,
        scenes: p.scenes.map(s => s.id === sceneId ? { ...s, imageUrl: url, status: 'done' } : s)
      } : p));
    } catch {
      setProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p,
        scenes: p.scenes.map(s => s.id === sceneId ? { ...s, status: 'error' } : s)
      } : p));
    }
  };

  const handleRegeneratePrompt = async () => {
    if (!project || !promptEditId || !promptEditInput.trim() || !currentProjectId) return;

    if (promptEditType === 'character') {
      setProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p, characters: p.characters.map(c => c.id === promptEditId ? { ...c, status: 'loading', portraitUrl: null } : c)
      } : p));
    } else {
      setProjects(prev => prev.map(p => p.id === currentProjectId ? {
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
      if (project.customStyleDescription) {
        finalPrompt = `${newPrompt}, Art style: ${project.customStyleDescription}`;
      }

      const newImageUrl = await gemini.generateImage(finalPrompt, isPortrait, geminiImageModel);

      if (promptEditType === 'character') {
        setProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, characters: p.characters.map(c => c.id === promptEditId ? {
            ...c,
            visualDescription: newPrompt,
            portraitUrl: newImageUrl,
            status: 'done'
          } : c)
        } : p));
      } else {
        setProjects(prev => prev.map(p => p.id === currentProjectId ? {
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
        setProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, characters: p.characters.map(c => c.id === promptEditId ? { ...c, status: 'error' } : c)
        } : p));
      } else {
        setProjects(prev => prev.map(p => p.id === currentProjectId ? {
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
      setProjects(prev => prev.map(p => p.id === currentProjectId ? {
        ...p, characters: p.characters.map(c => c.id === regenerateId ? { ...c, status: 'loading', portraitUrl: null } : c)
      } : p));
    } else {
      setProjects(prev => prev.map(p => p.id === currentProjectId ? {
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
      if (project.customStyleDescription) {
        finalPrompt = `${newPrompt}, Art style: ${project.customStyleDescription}`;
      }

      const newImageUrl = await gemini.generateImage(finalPrompt, isPortrait, geminiImageModel);

      if (regenerateType === 'character') {
        setProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, characters: p.characters.map(c => c.id === regenerateId ? {
            ...c,
            visualDescription: newPrompt,
            portraitUrl: newImageUrl,
            status: 'done'
          } : c)
        } : p));
      } else {
        setProjects(prev => prev.map(p => p.id === currentProjectId ? {
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
        setProjects(prev => prev.map(p => p.id === currentProjectId ? {
          ...p, characters: p.characters.map(c => c.id === regenerateId ? { ...c, status: 'error' } : c)
        } : p));
      } else {
        setProjects(prev => prev.map(p => p.id === currentProjectId ? {
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

    updateCurrentProject({
      scenes: project.scenes.map(s => s.id === sceneId ? { ...s, audioStatus: 'loading' } : s)
    });
    try {
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene) return;

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
      } else {
        audioUrl = await gemini.generateGoogleTTS(scene.scriptSegment, chirpVoice, chirpApiKey);
      }

      updateCurrentProject({
        scenes: project.scenes.map(s => s.id === sceneId ? { ...s, audioUrl: audioUrl, audioStatus: 'done' } : s)
      });
    } catch {
      updateCurrentProject({
        scenes: project.scenes.map(s => s.id === sceneId ? { ...s, audioStatus: 'error' } : s)
      });
    }
  };

  const generateAllImages = async () => {
    if (!project) return;
    const scenesToGenerate = project.scenes.filter(s => !s.imageUrl);
    try {
      await Promise.all(scenesToGenerate.map(scene => generateSceneImage(scene.id)));
    } catch (err) {
      console.error("Batch image generation failed:", err);
      alert("이미지 일괄 생성 중 오류가 발생했습니다.");
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
        scene.scriptSegment, // Pass dialogue for motion generation
        characterDesc
      );

      const videoUrl = URL.createObjectURL(videoBlob);

      updateCurrentProject({
        scenes: project.scenes.map(s =>
          s.id === sceneId
            ? { ...s, videoUrl, videoStatus: 'done' }
            : s
        )
      });
    } catch (err) {
      console.error('Video generation failed:', err);
      updateCurrentProject({
        scenes: project.scenes.map(s => s.id === sceneId ? { ...s, videoStatus: 'error' } : s)
      });
      alert('비디오 생성에 실패했습니다.');
    }
  };

  const generateAllVideos = async () => {
    if (!project) return;

    const scenesNeedingVideo = project.scenes.filter(s => s.imageUrl && !s.videoUrl);

    if (scenesNeedingVideo.length === 0) {
      alert('생성할 비디오가 없습니다!');
      return;
    }

    // 5개씩 제한 (테스트용)
    const limitedScenes = scenesNeedingVideo.slice(0, 5);

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

        try {
          const videoBlob = await generateSceneVideo(
            scene.imageUrl!,
            scene.imagePrompt,
            scene.scriptSegment,
            characterDesc
          );

          const videoUrl = URL.createObjectURL(videoBlob);

          updateCurrentProject({
            scenes: project.scenes.map(s =>
              s.id === scene.id
                ? { ...s, videoUrl, videoStatus: 'done' }
                : s
            )
          });
        } catch (err) {
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

  const exportVideo = async () => {
    if (!project) return;

    // 이미지와 오디오 확인
    const missingAssets = project.scenes.some(s => !s.imageUrl || !s.audioUrl);
    if (missingAssets) {
      alert("모든 장면의 이미지와 오디오가 생성되어야 합니다.");
      return;
    }

    setBgTask({ type: 'video', message: 'LTX 비디오 생성 중...' });
    setBgProgress(0);

    try {
      // 1단계: 모든 씬의 LTX 비디오 생성
      const characterDesc = project.characters.length > 0 ? project.characters[0].visualDescription : '';
      const videoBlobs: Blob[] = [];

      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        console.log(`[DEBUG] Scene ${i + 1}/${project.scenes.length} - Starting LTX generation`);
        console.log(`[DEBUG] Image URL:`, scene.imageUrl?.substring(0, 50));
        console.log(`[DEBUG] Dialogue:`, scene.scriptSegment?.substring(0, 50));

        setBgTask({ type: 'video', message: `LTX 비디오 생성 중 (${i + 1}/${project.scenes.length})...` });
        setBgProgress(Math.round((i / project.scenes.length) * 50));

        const videoBlob = await generateSceneVideo(
          scene.imageUrl!,
          scene.imagePrompt,
          scene.scriptSegment,
          characterDesc
        );
        console.log(`[DEBUG] Scene ${i + 1} - Video blob size:`, (videoBlob.size / 1024 / 1024).toFixed(2), 'MB');
        videoBlobs.push(videoBlob);
      }
      console.log(`[DEBUG] Total videos generated:`, videoBlobs.length);

      // 2단계: Canvas 기반 최종 렌더링
      setBgTask({ type: 'video', message: '최종 동영상 렌더링 중...' });
      setBgProgress(50);

    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    const stream = canvas.captureStream(60);

    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    const recorder = new MediaRecorder(new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]), {
      mimeType: 'video/webm',
      videoBitsPerSecond: 20000000
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();

    const drawMultiLineText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
       const words = text.split(' ');
       let line = '';
       const lines: string[] = [];

       for(let n = 0; n < words.length; n++) {
         const testLine = line + words[n] + ' ';
         const metrics = ctx.measureText(testLine);
         const testWidth = metrics.width;
         if (testWidth > maxWidth && n > 0) {
           lines.push(line);
           line = words[n] + ' ';
         } else {
           line = testLine;
         }
       }
       lines.push(line);

       const boxPadding = 40;
       const totalHeight = lines.length * lineHeight + boxPadding * 2;
       const boxWidth = Math.min(maxWidth + 100, canvas.width - 100);
       const boxY = canvas.height - 100 - totalHeight;

       ctx.fillStyle = "black";
       ctx.fillRect(canvas.width/2 - boxWidth/2, boxY, boxWidth, totalHeight);

       ctx.fillStyle = "white";
       ctx.textAlign = "center";
       ctx.textBaseline = "middle";

       lines.forEach((l, i) => {
         ctx.fillText(l, x, boxY + boxPadding + (i * lineHeight) + lineHeight/2);
       });
    };

    // Easing function for smooth acceleration/deceleration
    const easeInOutCubic = (t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    // Calculate render parameters based on effect type
    const calculateEffectTransform = (
      effect: SceneEffect | undefined,
      progress: number,
      canvasWidth: number,
      canvasHeight: number
    ): { scale: number; offsetX: number; offsetY: number } => {
      const easedProgress = easeInOutCubic(progress);

      // Default effect if none specified
      if (!effect) {
        const scale = 1.0 + (easedProgress * 0.15);
        return { scale, offsetX: 0, offsetY: 0 };
      }

      const { effect_type, motion_params } = effect;
      const targetScale = motion_params?.scale || 1.2;
      const direction = motion_params?.direction || 'center';
      const speed = motion_params?.speed || 'medium';

      // Adjust progress based on speed
      let adjustedProgress = easedProgress;
      if (speed === 'slow') {
        adjustedProgress = easedProgress;
      } else if (speed === 'fast') {
        adjustedProgress = Math.min(easedProgress * 2, 1);
      }

      let scale = 1.0;
      let offsetX = 0;
      let offsetY = 0;
      const maxPanOffset = canvasWidth * 0.1; // 10% of canvas width for panning

      switch (effect_type) {
        case '3d_parallax':
          // Combine zoom with directional movement for depth effect
          scale = 1.0 + (adjustedProgress * (targetScale - 1) * 1.2);
          if (direction === 'left') {
            offsetX = adjustedProgress * maxPanOffset * 0.5;
          } else if (direction === 'right') {
            offsetX = -adjustedProgress * maxPanOffset * 0.5;
          }
          // Add subtle vertical movement for 3D feel
          offsetY = adjustedProgress * (canvasHeight * 0.02);
          break;

        case 'zoom_in_slow':
        case 'zoom_in_fast':
          scale = 1.0 + (adjustedProgress * (targetScale - 1));
          break;

        case 'zoom_out_slow':
          scale = targetScale - (adjustedProgress * (targetScale - 1));
          break;

        case 'pan_left':
          scale = 1.05;
          offsetX = adjustedProgress * maxPanOffset;
          break;

        case 'pan_right':
          scale = 1.05;
          offsetX = -adjustedProgress * maxPanOffset;
          break;

        case 'static_subtle':
          // Very subtle scale change
          scale = 1.0 + (adjustedProgress * 0.05);
          break;

        default:
          scale = 1.0 + (adjustedProgress * 0.15);
      }

      return { scale, offsetX, offsetY };
    };

    for (let i = 0; i < project.scenes.length; i++) {
      const scene = project.scenes[i];
      const videoBlob = videoBlobs[i];

      // 생성된 LTX 비디오 로드
      const videoElement = document.createElement('video');
      videoElement.src = URL.createObjectURL(videoBlob);
      videoElement.muted = true;
      await new Promise((resolve, reject) => {
        videoElement.onloadeddata = resolve;
        videoElement.onerror = reject;
      });
      await videoElement.play();
      const audio = new Audio(scene.audioUrl!);
      await new Promise(r => audio.oncanplaythrough = r);
      const duration = audio.duration;
      const startTime = audioCtx.currentTime;
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(dest);
      audio.play();
      const subtitleParts = splitSubtitles(scene.scriptSegment);

      // Log effect for debugging
      console.log(`Scene ${i + 1} effect:`, scene.effect);

      await new Promise<void>(resolve => {
        const renderFrame = () => {
          const elapsed = audioCtx.currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // LTX 비디오는 이미 모션이 있으므로 1:1로 그림 (추가 효과 없음)
          const w = canvas.width;
          const h = canvas.height;
          const x = 0;
          const y = 0;

          // LTX 비디오 프레임 그리기
          ctx.drawImage(videoElement, x, y, w, h);

          const partIndex = Math.min(Math.floor(progress * subtitleParts.length), subtitleParts.length - 1);
          const currentText = subtitleParts[partIndex];
          if (currentText) {
            ctx.font = "bold 60px Pretendard";
            drawMultiLineText(ctx, currentText, canvas.width/2, 0, 1400, 80);
          }
          if (progress < 1) requestAnimationFrame(renderFrame);
          else resolve();
        };
        requestAnimationFrame(renderFrame);
      });

      // 비디오 정리
      videoElement.pause();
      videoElement.src = '';
      URL.revokeObjectURL(videoElement.src);

      // 진행률 업데이트 (50% ~ 100%)
      const renderProgress = 50 + Math.round(((i + 1) / project.scenes.length) * 50);
      setBgProgress(renderProgress);
    }
    recorder.stop();
    await new Promise(r => recorder.onstop = r);
    const videoBlob = new Blob(chunks, { type: 'video/mp4' });
    const url = URL.createObjectURL(videoBlob);
      downloadAsset(url, `${project.title}.mp4`);
      setBgTask(null);
      setBgProgress(0);
      alert("동영상 저장이 완료되었습니다.");
    } catch (error) {
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
      setSavedCharacters(prev => [...prev, newSaved]);
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
      status: 'idle',
      audioStatus: 'idle'
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

    setBgTask({ type: 'storyboard', message: '씬을 병합하고 새 프롬프트 생성 중...' });
    setBgProgress(30);

    try {
      // Generate new image prompt using Gemini
      const characterDescriptions = project.characters
        .map(c => `- ${c.name}: ${c.visualDescription}`)
        .join('\n');

      const prompt = `Generate a detailed image generation prompt for this scene.

Characters:
${characterDescriptions}

Style: ${project.customStyleDescription || project.style}

Scene dialogue:
${combinedScript}

Generate a detailed English prompt for image generation including scene composition, character positions, background, lighting, mood. Return ONLY the prompt text, no explanation.`;

      const apiKey = localStorage.getItem('gemini_api_key') || '';
      const model = localStorage.getItem('gemini_model') || 'gemini-3-flash';
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt
      });

      const newImagePrompt = response.text || combinedScript;

      // Create merged scene
      const mergedScene: Scene = {
        id: crypto.randomUUID(),
        scriptSegment: combinedScript,
        imagePrompt: newImagePrompt,
        imageUrl: null,
        audioUrl: null,
        status: 'idle',
        audioStatus: 'idle',
        effect: selectedScenes[0].effect // Copy effect from first scene
      };

      // Remove selected scenes and insert merged scene at first position
      const newScenes = project.scenes.filter(s => !selectedSceneIds.includes(s.id));
      newScenes.splice(firstSceneIndex, 0, mergedScene);

      updateCurrentProject({ scenes: newScenes });
      setSelectedSceneIds([]);
      setIsSelectionMode(false);
      setBgTask(null);
      setBgProgress(0);
    } catch (err) {
      console.error('Merge failed:', err);
      setBgTask(null);
      setBgProgress(0);
      alert('씬 병합에 실패했습니다.');
    }
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
    setProjects(prev => [newProject, ...prev]);
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
      setProjects(prevProjects => {
        const updatedProjects = prevProjects.filter(p => p.id !== id);
        try {
          localStorage.setItem('user_projects_v1', JSON.stringify(updatedProjects));
        } catch (err) {
          console.error("Storage sync failed during delete", err);
        }
        return updatedProjects;
      });

      if (currentProjectId === id) {
        setCurrentProjectId(null);
        setStep('dashboard');
      }
    }
  };

  const handleBack = () => {
    if (step === 'storyboard') setStep('character_setup');
    else if (step === 'character_setup') setStep('input');
    else if (step === 'input') setStep('dashboard');
    else setStep('dashboard');
  };

  const currentSavedStyle = savedStyles.find(s => s.id === style);

  const getStyleDisplayName = (styleValue: string) => {
    if (styleValue === '2d-animation') return '2D 애니메이션';
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
    <div className={`min-h-screen bg-[#FDFDFD] text-slate-800 font-sans selection:bg-indigo-100 pb-20 transition-colors duration-500`}>
      <input type="file" className="hidden" ref={sceneImageUploadRef} accept="image/*" onChange={handleSceneImageUpload} />
      <input type="file" className="hidden" ref={sceneAudioUploadRef} accept="audio/*" onChange={handleSceneAudioUpload} />
      <input type="file" className="hidden" ref={styleRefImageInputRef} accept="image/*" multiple onChange={handleStyleRefImageUpload} />
      <input type="file" className="hidden" ref={styleLibraryInputRef} accept="image/*" multiple onChange={handleStyleLibraryImageUpload} />
      <input type="file" className="hidden" ref={charLibInputRef} accept="image/*" multiple onChange={handleCharLibraryImageUpload} />
      <input type="file" className="hidden" ref={charPortraitUploadRef} accept="image/*" onChange={handleCharPortraitUpload} />

      <div className="fixed top-4 right-4 sm:top-8 sm:right-8 z-[205]">
        <button onClick={() => setIsMyPageOpen(true)} className="w-12 h-12 sm:w-14 sm:h-14 bg-white shadow-xl rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:scale-105 transition-all group relative border border-slate-100">
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <div className="absolute top-full mt-2 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-semibold rounded-lg opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all whitespace-nowrap">내 페이지</div>
        </button>
      </div>

      {step !== 'dashboard' && (
        <div className="fixed top-4 left-4 sm:top-8 sm:left-8 z-[205]">
          <button onClick={handleBack} className="w-12 h-12 sm:w-14 sm:h-14 bg-white shadow-xl rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all border border-slate-100 group relative">
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
            <div className="absolute top-full mt-2 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-semibold rounded-lg opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all whitespace-nowrap">이전으로 돌아가기</div>
          </button>
        </div>
      )}

      {step === 'dashboard' && (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-10 sm:py-20 animate-in fade-in">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 sm:mb-16 gap-6">
            <div className="space-y-2 sm:space-y-4">
              <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900">내 프로젝트</h1>
              <p className="text-slate-400 font-medium text-sm sm:text-base">진행 중인 이야기들을 관리하세요</p>
            </div>
            <button onClick={addNewProject} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95">
              <span className="text-xl">+</span> 새 프로젝트 추가
            </button>
          </header>

          {projects.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-[32px] sm:rounded-[40px] py-20 sm:py-40 flex flex-col items-center justify-center space-y-8 shadow-sm">
               <button onClick={addNewProject} className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-full flex items-center justify-center text-4xl sm:text-5xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 border-2 border-dashed border-slate-200 transition-all active:scale-90">+</button>
               <p className="text-slate-400 font-semibold text-lg sm:text-xl px-6 text-center">첫 번째 프로젝트를 만들어보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-10">
               {projects.map(p => (
                 <div key={p.id} onClick={() => { setCurrentProjectId(p.id); setScript(p.script); setStyle(p.style as VisualStyle); setStep(p.scenes.length > 0 ? 'storyboard' : 'input'); }} className="bg-white border border-slate-100 p-6 sm:p-10 rounded-[36px] sm:rounded-[48px] group hover:border-indigo-400 hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[300px] sm:min-h-[350px] shadow-sm">
                    <button onClick={(e) => deleteProject(p.id, e)} className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-black/10 hover:bg-red-500 text-white rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-all backdrop-blur-sm">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="space-y-3">
                       <div className="flex justify-between items-start">
                         <h3 className="text-xl sm:text-2xl font-semibold text-slate-900 line-clamp-1 flex-1 pr-8">{p.title}</h3>
                       </div>
                       <p className="text-slate-400 text-xs sm:text-sm font-medium">최종 수정: {new Date(p.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex -space-x-3 sm:-space-x-4 mb-4 sm:mb-6">
                       {p.characters.slice(0, 5).map((c, idx) => (
                         <div key={idx} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-4 border-white bg-slate-100 overflow-hidden shadow-md">
                           {c.portraitUrl && <img src={c.portraitUrl} className="w-full h-full object-cover" />}
                         </div>
                       ))}
                       {p.characters.length > 5 && (
                         <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-4 border-white bg-indigo-50 flex items-center justify-center text-[10px] sm:text-xs font-semibold text-indigo-600 shadow-md">
                           +{p.characters.length - 5}
                         </div>
                       )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 gap-3">
                       <span className="px-3 py-1 sm:px-4 sm:py-2 bg-slate-50 border border-slate-100 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-semibold uppercase text-slate-500">장면 {p.scenes.length}개</span>
                       <span className="px-3 py-1 sm:px-4 sm:py-2 bg-indigo-50 border border-indigo-100 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-semibold uppercase text-indigo-600">{getStyleDisplayName(p.style)}</span>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      )}

      {step !== 'dashboard' && (
        <div className="max-w-[1700px] mx-auto px-4 sm:px-10 py-6 sm:py-10">
          {step === 'character_setup' && (
            <div className="w-full px-6 pt-6">
              {bgTask ? (
                <div className="text-center py-20">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-500">{bgTask.message}</p>
                  <p className="text-indigo-600 font-semibold mt-2">{bgProgress}%</p>
                </div>
              ) : (
              <>
              <div className="bg-white rounded-[24px] shadow-xl p-6 sm:p-8 py-12 sm:py-16 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">등장인물 외형 설정</h1>
                  <div className="flex gap-3">
                    <button onClick={() => setIsCharLoadModalOpen(true)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-base font-medium hover:bg-slate-50 transition-all">인물 불러오기</button>
                    <button onClick={() => proceedToStoryboard(true)} disabled={bgTask !== null} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-base font-medium shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">스토리보드 생성</button>
                    {project && project.scenes.length > 0 && (
                      <button onClick={() => proceedToStoryboard(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-base font-medium hover:bg-slate-50 transition-all">기존 스토리보드 보기</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(project?.characters || []).map(char => {
                  const isSaved = savedCharacters.some(sc => sc.id === char.id);
                  return (
                  <div key={char.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all p-6 flex gap-6 items-start relative group/card">
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
                        className={`p-1.5 border rounded-lg transition-all flex items-center gap-1 ${isSaved ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300'}`}
                        title={isSaved ? "저장됨 (클릭하여 해제)" : "저장"}
                      >
                        <svg className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                        {isSaved && <span className="text-xs font-medium">저장됨</span>}
                      </button>
                      <button onClick={() => updateCurrentProject({ characters: project!.characters.filter(c => c.id !== char.id) })} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-red-500 hover:border-red-300 transition-all" title="삭제"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                    <div
                      className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 relative group/portrait cursor-pointer flex items-center justify-center"
                      onClick={() => char.portraitUrl && setSelectedImage(char.portraitUrl)}
                    >
                      {char.status === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
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
                        <label className="p-2 bg-white rounded-full text-slate-600 hover:bg-slate-100 transition-all cursor-pointer" onClick={(e) => e.stopPropagation()}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg><input type="file" className="hidden" accept="image/*" onChange={(e) => { e.stopPropagation(); const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onload = (ev) => { updateCurrentProject({ characters: project!.characters.map(c => c.id === char.id ? { ...c, portraitUrl: ev.target?.result as string, status: 'done' } : c) }); }; reader.readAsDataURL(file); } }} /></label>
                        <button onClick={(e) => { e.stopPropagation(); openRegenerateModal('character', char.id); }} className="p-2 bg-white rounded-full text-indigo-600 hover:bg-indigo-50 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                        <button onClick={(e) => { e.stopPropagation(); if(char.portraitUrl) { const a = document.createElement('a'); a.href = char.portraitUrl; a.download = `${char.name}.png`; a.click(); }}} className="p-2 bg-white rounded-full text-slate-600 hover:bg-slate-100 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col h-48 sm:h-56">
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) => updateCurrentProject({ characters: project!.characters.map(c => c.id === char.id ? { ...c, name: e.target.value } : c) })}
                        className="font-bold text-slate-900 text-2xl sm:text-3xl mb-3 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-lg px-2 py-1 flex-shrink-0"
                        placeholder="이름을 입력하세요..."
                      />
                      <div className="relative flex-1">
                        <textarea
                          value={char.visualDescription || ''}
                          onChange={(e) => updateCurrentProject({ characters: project!.characters.map(c => c.id === char.id ? { ...c, visualDescription: e.target.value } : c) })}
                          className="text-sm text-gray-500 leading-relaxed bg-slate-50 rounded-lg p-3 pr-10 border-none resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 w-full h-full"
                          placeholder="캐릭터 외형 설명을 입력하세요..."
                        />
                        <button onClick={() => copyToClipboard(char.visualDescription)} className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-indigo-600 transition-all" title="프롬프트 복사">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
                <button onClick={() => setIsCharModalOpen(true)} className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all p-6 flex gap-6 items-center min-h-[240px]">
                  <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-all">
                    <span className="text-7xl text-slate-300">+</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-lg font-medium text-slate-400">등장인물 추가하기</span>
                  </div>
                </button>
              </div>
              </>
              )}
            </div>
          )}

          {step === 'storyboard' && (
            <div className="w-full px-4 sm:px-8 pt-6">
              {!project ? (
                <div className="text-center py-20">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : (
              <>
              {/* 상단바 - 토스 스타일 */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sm:p-10 mb-8">
                <div className="flex flex-col gap-6">
                  {/* 첫 번째 줄: 제목 & 버튼들 */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={project.title}
                        onChange={(e) => updateCurrentProject({ title: e.target.value })}
                        className="text-2xl sm:text-3xl font-bold text-slate-900 bg-transparent border-none focus:outline-none w-auto min-w-[250px]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-3 items-center">
                      <button onClick={generateAllImages} disabled={isBatchGenerating} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-base font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">이미지 전체 생성</button>
                      <button onClick={generateBatchAudio} disabled={isBatchGenerating} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl text-base font-medium hover:bg-slate-200 transition-all disabled:opacity-50">오디오 전체 생성</button>
                      <button onClick={generateAllVideos} disabled={isBatchGenerating || !project.scenes.some(s => s.imageUrl && !s.videoUrl)} className="px-6 py-3 bg-green-600 text-white rounded-xl text-base font-medium hover:bg-green-700 transition-all disabled:opacity-50">비디오 생성 (최대 5개)</button>
                      <button onClick={exportVideo} disabled={project.scenes.some(s => !s.imageUrl || !s.audioUrl)} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-base font-medium hover:bg-slate-800 transition-all disabled:opacity-50">동영상 추출</button>
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
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 overflow-hidden border-3 border-slate-200 shadow-md hover:shadow-xl hover:scale-105 transition-all">
                            {char.portraitUrl ? (
                              <img src={char.portraitUrl} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-600 transition-colors text-center max-w-[80px] truncate">{char.name}</span>
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
                    병합
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    if (isSelectionMode) setSelectedSceneIds([]);
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${isSelectionMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {isSelectionMode ? '취소' : '선택'}
                </button>
                <div className="relative group/download">
                  <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all flex items-center gap-1">
                    자산 다운로드
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl py-2 min-w-[200px] opacity-0 invisible group-hover/download:opacity-100 group-hover/download:visible transition-all z-50">
                    <button onClick={() => { project.scenes.forEach((s, i) => { if(s.imageUrl) { const a = document.createElement('a'); a.href = s.imageUrl; a.download = `scene-${i+1}.png`; a.click(); }}); }} className="w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 transition-all">이미지 전체 다운로드</button>
                    <button onClick={() => { project.scenes.forEach((s, i) => { if(s.audioUrl) { const a = document.createElement('a'); a.href = s.audioUrl; a.download = `audio-${i+1}.mp3`; a.click(); }}); }} className="w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 transition-all">오디오 전체 다운로드</button>
                  </div>
                </div>
              </div>

              {/* 씬 그리드 - 깔끔한 카드 스타일 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {project.scenes.map((scene, idx) => (
                  <div key={scene.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden hover:shadow-md transition-all group/card ${isSelectionMode && selectedSceneIds.includes(scene.id) ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-100 hover:border-slate-200'}`}>
                    {/* 이미지 영역 */}
                    <div className="aspect-video bg-slate-50 relative group/img">
                      <div className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-slate-900/70 backdrop-blur-sm rounded-lg flex items-center justify-center text-white text-xs font-semibold">#{idx + 1}</div>

                      {/* Selection checkbox */}
                      {isSelectionMode && (
                        <div className="absolute top-3 left-14 z-10">
                          <input
                            type="checkbox"
                            checked={selectedSceneIds.includes(scene.id)}
                            onChange={() => {
                              setSelectedSceneIds(prev =>
                                prev.includes(scene.id)
                                  ? prev.filter(id => id !== scene.id)
                                  : [...prev, scene.id]
                              );
                            }}
                            className="w-5 h-5 rounded border-2 border-white cursor-pointer"
                          />
                        </div>
                      )}

                      {/* 상단 우측 버튼들 */}
                      <div className="absolute top-3 right-3 z-30 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-all">
                        <label className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all cursor-pointer shadow-sm">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onload = (ev) => { updateCurrentProject({ scenes: project.scenes.map(s => s.id === scene.id ? { ...s, imageUrl: ev.target?.result as string, status: 'done' } : s) }); }; reader.readAsDataURL(file); } }} />
                        </label>
                        {scene.imageUrl ? (
                          <div className="relative group/delete">
                            <button className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-slate-500 hover:text-red-500 transition-all shadow-sm">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl py-1 min-w-[140px] opacity-0 invisible group-hover/delete:opacity-100 group-hover/delete:visible transition-all z-50">
                              <button onClick={() => deleteSceneImage(scene.id)} className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 transition-all">이미지만 삭제</button>
                              <button onClick={() => deleteScene(scene.id)} className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 transition-all">씬 삭제</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => deleteScene(scene.id)} className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-slate-500 hover:text-red-500 transition-all shadow-sm">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>

                      {scene.status === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-20">
                          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                      {scene.imageUrl ? (
                        <>
                          <img src={scene.imageUrl} className="w-full h-full object-cover cursor-pointer" onClick={() => setSelectedImage(scene.imageUrl)} />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center gap-3 z-10 cursor-pointer" onClick={() => setSelectedImage(scene.imageUrl)}>
                            <button onClick={(e) => { e.stopPropagation(); openRegenerateModal('scene', scene.id); }} className="w-10 h-10 bg-white/95 backdrop-blur-sm rounded-xl flex items-center justify-center text-indigo-600 hover:bg-white transition-all shadow-lg" title="재생성">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if(scene.imageUrl) { const a = document.createElement('a'); a.href = scene.imageUrl; a.download = `scene-${idx+1}.png`; a.click(); }}} className="w-10 h-10 bg-white/95 backdrop-blur-sm rounded-xl flex items-center justify-center text-slate-600 hover:bg-white transition-all shadow-lg" title="다운로드">
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
                      {/* 장면 대사 */}
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium mb-1.5 uppercase tracking-wide">Scene 대사</p>
                        <textarea
                          value={scene.scriptSegment}
                          onChange={(e) => updateCurrentProject({ scenes: project.scenes.map(s => s.id === scene.id ? { ...s, scriptSegment: e.target.value } : s) })}
                          className="w-full text-base font-semibold text-slate-800 leading-relaxed bg-transparent border-none resize-none focus:outline-none min-h-[52px] placeholder:text-slate-300"
                          placeholder="장면 대사..."
                        />
                      </div>

                      {/* 오디오 버튼 */}
                      <div className="flex items-center gap-2">
                        {scene.audioUrl ? (
                          <audio src={scene.audioUrl} controls className="flex-1 h-9 rounded-xl" />
                        ) : (
                          <button
                            onClick={() => generateAudio(scene.id)}
                            disabled={scene.audioStatus === 'loading'}
                            className="flex-1 py-2.5 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-xl hover:bg-indigo-100 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {scene.audioStatus === 'loading' ? (
                              <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                            )}
                            오디오 생성
                          </button>
                        )}
                        <label className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all cursor-pointer flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <input type="file" className="hidden" accept="audio/*" onChange={(e) => { const file = e.target.files?.[0]; if(file) { const url = URL.createObjectURL(file); updateCurrentProject({ scenes: project.scenes.map(s => s.id === scene.id ? { ...s, audioUrl: url, audioStatus: 'done' } : s) }); } }} />
                        </label>
                      </div>

                      {/* 비디오 버튼 (LTX Video) */}
                      <div className="flex items-center gap-2">
                        {scene.videoUrl ? (
                          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            <span className="text-xs font-medium text-green-600">비디오 생성됨 (720p)</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => generateVideo(scene.id)}
                            disabled={!scene.imageUrl || scene.videoStatus === 'loading'}
                            className="flex-1 py-2.5 bg-green-50 text-green-600 text-xs font-semibold rounded-xl hover:bg-green-100 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {scene.videoStatus === 'loading' ? (
                              <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            )}
                            비디오 생성
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
                              className="w-full text-[11px] text-slate-500 leading-relaxed bg-slate-50 rounded-xl p-3 pr-10 border-none resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[60px]"
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
                <button onClick={addSceneManually} className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-300 min-h-[320px] flex flex-col items-center justify-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group/add">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover/add:bg-indigo-100 flex items-center justify-center text-slate-400 group-hover/add:text-indigo-500 transition-all">
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
            <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12 pt-10 sm:pt-10 min-h-[calc(100vh-200px)] flex flex-col justify-center">
               <div className="text-center space-y-2 sm:space-y-4">
                  <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-tight">당신의 대본을 <span className="text-indigo-600">살아있는 영상</span>으로</h1>
                  <p className="text-slate-400 font-medium text-base sm:text-lg">캐릭터 일관성 유지 + AI 내레이션 + 자동 자막</p>
               </div>
               <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
                  {['realistic', '2d-animation', 'custom'].map(s => (
                    <button key={s} onClick={() => { setStyle(s as VisualStyle); updateCurrentProject({ style: s }); }} className={`px-6 py-4 sm:px-10 sm:py-8 rounded-[20px] sm:rounded-[32px] transition-all font-semibold text-sm sm:text-lg ${style === s ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}>{s === '2d-animation' ? '2D 애니메이션' : s === 'realistic' ? '실사화' : '맞춤형'}</button>
                  ))}
                  {savedStyles.length > 0 && (
                    <div className="relative group/styles">
                      <button className={`px-6 py-4 sm:px-10 sm:py-8 rounded-[20px] sm:rounded-[32px] transition-all font-semibold text-sm sm:text-lg flex items-center gap-2 ${savedStyles.some(s => s.id === style) ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                        자주 쓰는 그림체
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 min-w-[200px] opacity-0 invisible group-hover/styles:opacity-100 group-hover/styles:visible transition-all z-50">
                        {savedStyles.map(s => (
                          <button
                            key={s.id}
                            onClick={() => { setStyle(s.id as VisualStyle); updateCurrentProject({ style: s.id }); }}
                            className={`w-full px-4 py-3 text-left text-sm font-medium transition-all flex items-center gap-3 ${style === s.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            {s.refImages[0] && <img src={s.refImages[0]} className="w-8 h-8 rounded-lg object-cover" />}
                            <span>{s.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
               </div>
               {currentSavedStyle && (
                 <div className="animate-in fade-in slide-in-bottom bg-slate-50 border p-5 sm:p-8 rounded-[30px] sm:rounded-[40px] space-y-4">
                   <h4 className="text-lg sm:text-xl font-semibold text-slate-900">{currentSavedStyle.name} 상세 정보</h4>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">학습된 스타일 묘사</p>
                         <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium h-24 overflow-y-auto custom-scrollbar">{currentSavedStyle.description}</p>
                      </div>
                      <div className="flex gap-2 items-center overflow-x-auto">
                         {currentSavedStyle.refImages.map((img, i) => <img key={i} src={img} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl object-cover border-2 border-white shadow-sm shrink-0" />)}
                      </div>
                   </div>
                 </div>
               )}
               {style === 'custom' && (
                 <div className="animate-in fade-in slide-in-bottom bg-indigo-50/50 border border-indigo-100 p-5 sm:p-8 rounded-[30px] sm:rounded-[40px] space-y-6">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-lg sm:text-xl font-semibold text-slate-900">맞춤형 스타일 학습</h4>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">학습 레퍼런스 이미지 업로드 (최대 7장)</p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => styleRefImageInputRef.current?.click()} className="flex-1 sm:flex-none px-6 py-3 bg-white border border-indigo-200 rounded-2xl text-xs font-semibold text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all">이미지 업로드</button>
                        {refImages.length > 0 && (
                          <button onClick={saveCustomStyleFromInput} className="px-6 py-3 bg-indigo-600 border border-indigo-600 rounded-2xl text-xs font-semibold text-white hover:bg-indigo-700 transition-all">저장하기</button>
                        )}
                      </div>
                   </div>
                   <div className="flex gap-3 flex-wrap">
                      {refImages.map((img, idx) => (
                        <div key={idx} className="relative w-20 h-20 sm:w-32 sm:h-32 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-white shadow-md group">
                          <img src={img} className="w-full h-full object-cover" />
                          <button onClick={() => removeStyleRefImage(idx)} className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">삭제</button>
                        </div>
                      ))}
                   </div>
                 </div>
               )}
               <div className="bg-white p-2 sm:p-3 rounded-[32px] sm:rounded-[48px] shadow-2xl shadow-slate-200/50 border border-slate-200 relative">
                 <textarea className="w-full h-64 sm:h-80 bg-slate-50/50 border-none rounded-[24px] sm:rounded-[36px] p-6 sm:p-10 text-base sm:text-xl focus:ring-0 outline-none resize-none leading-relaxed placeholder:text-slate-300" placeholder="시나리오를 입력하세요..." value={script} onChange={(e) => setScript(e.target.value)} />
               </div>
               <div className="flex flex-col sm:flex-row gap-4">
                 <button onClick={startAnalysis} disabled={(bgTask && bgTask.type === 'analysis') || !script.trim()} className="flex-1 py-6 sm:py-8 bg-indigo-600 text-white rounded-[24px] sm:rounded-[32px] font-semibold text-lg sm:text-2xl shadow-2xl active:scale-[0.98] disabled:opacity-50 transition-all">프로젝트 시작하기</button>
                 {project && project.characters.length > 0 && (
                   <button onClick={() => setStep('character_setup')} className="px-8 py-6 sm:py-8 bg-white border border-slate-200 text-slate-600 rounded-[24px] sm:rounded-[32px] font-semibold text-base sm:text-xl hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-lg">
                     등장인물 설정 &gt;
                   </button>
                 )}
               </div>
            </div>
          )}
        </div>
      )}

      {selectedImage && <div className="fixed inset-0 bg-slate-900/95 z-[250] flex items-center justify-center p-2 sm:p-4 cursor-zoom-out animate-in fade-in" onClick={() => setSelectedImage(null)}><img src={selectedImage} className="max-w-full max-h-[90vh] object-contain rounded-2xl sm:rounded-[40px] shadow-2xl border-4 sm:border-8 border-white/10" /></div>}

      {isRegenerateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsRegenerateModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-slate-900">이미지 재생성</h2>
              <p className="text-sm text-slate-500 mt-1">변경하고 싶은 특징을 입력해주세요</p>
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
                <button onClick={() => setIsRegenerateModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all">
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
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-slate-900">고급 설정</h2>
              <p className="text-sm text-slate-500 mt-1">그림체의 특징을 상세히 설명해주세요</p>
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
                <button onClick={() => setIsStyleDescModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all">
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isMyPageOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsMyPageOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-3xl z-10">
              <h2 className="text-xl font-semibold text-slate-900">설정</h2>
              <button onClick={() => setIsMyPageOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              {/* 로그인/회원가입 섹션 */}
              {isLoggedIn ? (
                <div className="flex gap-3 items-center">
                  <div className="flex-1 py-3 bg-green-50 border border-green-200 text-green-700 text-center font-semibold rounded-xl text-sm">로그인됨</div>
                  <button onClick={handleLogout} className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-center font-semibold rounded-xl transition-all text-sm">로그아웃</button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setIsLoginModalOpen(true)} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-center font-semibold rounded-xl transition-all text-sm">로그인</button>
                  <button onClick={() => setIsSignupModalOpen(true)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-center font-semibold rounded-xl transition-all text-sm">회원가입</button>
                </div>
              )}

              {/* Gemini API 설정 - 아코디언 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'gemini' ? null : 'gemini')} className="w-full px-4 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">Gemini API 설정</span>
                    {isGeminiValid && (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'gemini' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'gemini' && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="space-y-2 pt-4">
                      <label className="text-sm font-medium text-slate-700">API 키</label>
                      <div className="relative">
                        <input type={showGeminiKey ? "text" : "password"} value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} onBlur={() => geminiApiKey.length > 20 && checkGeminiKey(geminiApiKey)} placeholder="API 키 입력" className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white" />
                        <button onClick={() => setShowGeminiKey(!showGeminiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                          {showGeminiKey ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          )}
                        </button>
                      </div>
                      {geminiApiKey.length > 20 && (
                        <div className="flex items-center gap-2 text-sm">
                          {isValidatingGemini ? (
                            <>
                              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-slate-600">검증 중...</span>
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
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Gemini 모델</label>
                      <select value={geminiModel} onChange={e => setGeminiModel(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm bg-white">
                        <option value="gemini-3-flash">Gemini 3 Flash (빠름)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro (고품질)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">이미지 생성 모델</label>
                      <select value={geminiImageModel} onChange={e => setGeminiImageModel(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm bg-white">
                        <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                        <option value="imagen-3.0-generate-002">Imagen 3.0</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 음성 설정 - 아코디언 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'voice' ? null : 'voice')} className="w-full px-4 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">음성 설정</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{audioProvider === 'google' ? 'Google Chirp' : 'ElevenLabs'}</span>
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'voice' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'voice' && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="space-y-2 pt-4">
                      <label className="text-sm font-medium text-slate-700">음성 제공자</label>
                      <div className="flex gap-2">
                        <button onClick={() => setAudioProvider('google')} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${audioProvider === 'google' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>Google Chirp</button>
                        <button onClick={() => setAudioProvider('elevenlabs')} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${audioProvider === 'elevenlabs' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>ElevenLabs</button>
                      </div>
                    </div>
                    {audioProvider === 'google' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Chirp API 키 (Gemini와 동일)</label>
                          <div className="relative">
                            <input type={showChirpKey ? "text" : "password"} value={chirpApiKey} onChange={e => setChirpApiKey(e.target.value)} placeholder="API 키 입력 (비워두면 Gemini 키 사용)" className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white" />
                            <button onClick={() => setShowChirpKey(!showChirpKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                              {showChirpKey ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Chirp 음성</label>
                          <select value={chirpVoice} onChange={e => setChirpVoice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm bg-white">
                            <option value="Kore">Kore (한국어 여성)</option>
                            <option value="Aoede">Aoede (영어 여성)</option>
                            <option value="Charon">Charon (영어 남성)</option>
                            <option value="Fenrir">Fenrir (영어 남성)</option>
                            <option value="Puck">Puck (영어 남성)</option>
                          </select>
                        </div>
                      </>
                    )}
                    {audioProvider === 'elevenlabs' && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-700">ElevenLabs API 키</label>
                            {isElConnected && (
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                            )}
                          </div>
                          <div className="relative">
                            <input type={showElKey ? "text" : "password"} value={elSettings.apiKey} onChange={e => setElSettings({...elSettings, apiKey: e.target.value})} placeholder="API 키 입력" className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white" />
                            <button onClick={() => setShowElKey(!showElKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
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
                            <label className="text-sm font-medium text-slate-700">음성 선택</label>
                            <select value={elSettings.voiceId} onChange={e => setElSettings({...elSettings, voiceId: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm bg-white">
                              {voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">음성 속도: {elSettings.speed.toFixed(1)}x</label>
                          <input type="range" min="0.5" max="2.0" step="0.1" value={elSettings.speed} onChange={e => setElSettings({...elSettings, speed: parseFloat(e.target.value)})} className="w-full accent-indigo-600" />
                        </div>
                      </>
                    )}
                    <button onClick={handleVoiceTest} disabled={isVoiceTesting} className="w-full py-3 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-50">
                      {isVoiceTesting ? '테스트 중...' : '음성 테스트'}
                    </button>
                  </div>
                )}
              </div>

              {/* 저장된 그림체 - 아코디언 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'styles' ? null : 'styles')} className="w-full px-4 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">저장된 그림체</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{savedStyles.length}/10</span>
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'styles' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'styles' && (
                  <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50 space-y-4">
                    {/* 새 그림체 추가 폼 */}
                    <div className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700">새 그림체 추가</h4>
                        <button
                          onClick={() => setIsStyleDescModalOpen(true)}
                          className="group relative p-1.5 hover:bg-slate-100 rounded-lg transition-all"
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
                        <label className="text-xs font-medium text-slate-600">제목</label>
                        <input
                          type="text"
                          value={newStyleName}
                          onChange={e => setNewStyleName(e.target.value)}
                          placeholder="예: 지브리 스타일, 수채화 풍경 등"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">레퍼런스 이미지 (최대 10장)</label>
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
                          className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                        >
                          + 이미지 선택
                        </button>
                        {newStyleImages.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {newStyleImages.map((img, idx) => (
                              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
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
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        그림체 저장
                      </button>
                    </div>

                    {/* 저장된 그림체 목록 */}
                    {savedStyles.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <h4 className="text-xs font-semibold text-slate-600">저장된 그림체 ({savedStyles.length}/10)</h4>
                        {savedStyles.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                              {s.refImages[0] && <img src={s.refImages[0]} className="w-10 h-10 rounded-lg object-cover" />}
                              <span className="text-sm font-medium text-slate-700">{s.name}</span>
                            </div>
                            <button onClick={() => setSavedStyles(prev => prev.filter(x => x.id !== s.id))} className="text-xs text-red-500 hover:text-red-600">삭제</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 저장된 인물 - 아코디언 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'characters' ? null : 'characters')} className="w-full px-4 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">저장된 인물</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{savedCharacters.length}/10</span>
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'characters' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'characters' && (
                  <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50 space-y-4">
                    {/* 새 인물 추가 폼 */}
                    <div className="pt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700">새 인물 추가</h4>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">이름</label>
                        <input
                          type="text"
                          value={newCharLibName}
                          onChange={e => setNewCharLibName(e.target.value)}
                          placeholder="이름을 입력해주세요"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">레퍼런스 이미지 (최대 10장)</label>
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
                          className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                        >
                          + 이미지 선택
                        </button>
                        {newCharLibImages.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {newCharLibImages.map((img, idx) => (
                              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
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
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {charLibSaveProgress !== null ? `저장 중... ${charLibSaveProgress}%` : '인물 저장'}
                      </button>
                    </div>

                    {/* 저장된 인물 목록 */}
                    {savedCharacters.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <h4 className="text-xs font-semibold text-slate-600">저장된 인물 ({savedCharacters.length}/10)</h4>
                        {savedCharacters.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                              {c.portraitUrl && <img src={c.portraitUrl} onClick={() => setSelectedImage(c.portraitUrl)} className="w-10 h-10 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform" />}
                              <span className="text-sm font-medium text-slate-700">{c.name}</span>
                            </div>
                            <button onClick={() => setSavedCharacters(prev => prev.filter(x => x.id !== c.id))} className="text-xs text-red-500 hover:text-red-600">삭제</button>
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
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-900 mb-6">새 캐릭터 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">이름</label>
                <input type="text" value={newCharData.name} onChange={e => setNewCharData({...newCharData, name: e.target.value})} placeholder="캐릭터 이름" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">성별</label>
                  <select value={newCharData.gender} onChange={e => setNewCharData({...newCharData, gender: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm bg-white">
                    <option value="여성">여성</option>
                    <option value="남성">남성</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">나이</label>
                  <select value={newCharData.age} onChange={e => setNewCharData({...newCharData, age: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm bg-white">
                    <option value="어린이">어린이</option>
                    <option value="청소년">청소년</option>
                    <option value="성인">성인</option>
                    <option value="중년">중년</option>
                    <option value="노인">노인</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">외형 특징</label>
                <textarea value={newCharData.traits} onChange={e => setNewCharData({...newCharData, traits: e.target.value})} placeholder="머리색, 옷차림, 특징 등" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm h-24 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsCharModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all">취소</button>
              <button onClick={addCharacterManually} disabled={loading || !newCharData.name.trim() || !newCharData.traits.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">
                {loading ? '생성 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 캐릭터 불러오기 모달 */}
      {isCharLoadModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsCharLoadModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 mb-4">저장된 캐릭터 불러오기</h3>
            {savedCharacters.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">저장된 캐릭터가 없습니다.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {savedCharacters.map(sc => (
                  <div key={sc.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all cursor-pointer" onClick={() => { if(project) { updateCurrentProject({ characters: [...project.characters, { id: crypto.randomUUID(), name: sc.name, role: '', visualDescription: sc.description, portraitUrl: sc.portraitUrl, status: sc.portraitUrl ? 'done' : 'idle' }] }); setIsCharLoadModalOpen(false); } }}>
                    <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                      {sc.portraitUrl ? <img src={sc.portraitUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{sc.name}</p>
                      <p className="text-xs text-slate-400 truncate">{sc.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setIsCharLoadModalOpen(false)} className="w-full mt-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all">닫기</button>
          </div>
        </div>
      )}

      {/* 프롬프트 수정 모달 */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsPromptModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 mb-2">수정 사항 입력</h3>
            <p className="text-sm text-slate-400 mb-6">변경하고 싶은 특징을 한국어로 입력해주세요. 캐릭터 일관성을 유지하며 새로 생성합니다.</p>
            <textarea value={promptEditInput} onChange={e => setPromptEditInput(e.target.value)} placeholder="예: 조금 더 밝은 조명으로 변경해주고 배경에 나무를 추가해줘" className="w-full px-4 py-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-200 outline-none text-sm h-28 resize-none" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsPromptModalOpen(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-all">취소</button>
              <button onClick={handleRegeneratePrompt} disabled={!promptEditInput.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">
                적용하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 맞춤형 스타일 이름 입력 모달 */}
      {isStyleNameModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsStyleNameModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 mb-2">그림체 제목을 입력해주세요</h3>
            <p className="text-sm text-slate-400 mb-6">저장할 맞춤형 스타일의 이름을 입력해주세요.</p>
            <input
              type="text"
              value={customStyleName}
              onChange={e => setCustomStyleName(e.target.value)}
              placeholder="예: 지브리 스타일"
              className="w-full px-4 py-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter' && customStyleName.trim()) {
                  confirmSaveCustomStyle();
                }
              }}
            />
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setIsStyleNameModalOpen(false); setCustomStyleName(''); }} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-all">취소</button>
              <button onClick={confirmSaveCustomStyle} disabled={!customStyleName.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">
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
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-900 mb-6">로그인</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">아이디</label>
                <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="아이디를 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">비밀번호</label>
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="비밀번호를 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsLoginModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all">취소</button>
              <button onClick={handleLogin} disabled={!loginUsername.trim() || !loginPassword.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">로그인</button>
            </div>
          </div>
        </div>
      )}

      {/* 회원가입 모달 */}
      {isSignupModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsSignupModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-900 mb-6">회원가입</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">아이디</label>
                <input type="text" value={signupUsername} onChange={e => setSignupUsername(e.target.value)} placeholder="아이디를 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">비밀번호</label>
                <input type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} placeholder="비밀번호를 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">이메일</label>
                <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="이메일을 입력하세요" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsSignupModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all">취소</button>
              <button onClick={handleSignup} disabled={!signupUsername.trim() || !signupPassword.trim() || !signupEmail.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">회원가입</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
