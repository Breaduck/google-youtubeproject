import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { GoogleGenAI } from "@google/genai";
import { GeminiService } from './services/geminiService';
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
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showElKey, setShowElKey] = useState(false);
  const [showChirpKey, setShowChirpKey] = useState(false);

  const [audioProvider, setAudioProvider] = useState<'elevenlabs' | 'google'>(
    (localStorage.getItem('audio_provider') as any) || 'google'
  );
  const [chirpApiKey, setChirpApiKey] = useState(localStorage.getItem('chirp_api_key') || '');
  const [chirpVoice, setChirpVoice] = useState(localStorage.getItem('chirp_voice') || 'Kore');

  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [newCharData, setNewCharData] = useState({ name: '', gender: '여성', age: '성인', traits: '' });

  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptEditType, setPromptEditType] = useState<'character' | 'scene'>('scene');
  const [promptEditId, setPromptEditId] = useState<string | null>(null);
  const [promptEditInput, setPromptEditInput] = useState('');

  const [isMyPageOpen, setIsMyPageOpen] = useState(false);
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
          status: 'idle',
          audioStatus: 'idle',
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

  const gemini = useMemo(() => new GeminiService(), []);

  const checkGeminiKey = async (key: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      await ai.models.generateContent({
        model: 'gemini-3-flash',
        contents: 'ping',
        config: { maxOutputTokens: 1, thinkingConfig: { thinkingBudget: 0 } }
      });
      setIsGeminiValid(true);
    } catch {
      setIsGeminiValid(false);
    }
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
      alert("자주 쓰는 화풍 레퍼런스는 최대 10장까지 가능합니다.");
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
    if (!newStyleName.trim()) { alert('화풍 이름을 입력해주세요.'); return; }
    if (newStyleImages.length === 0) { alert('이미지를 최소 1장 이상 등록해주세요.'); return; }
    if (savedStyles.length >= 10) { alert('자주 쓰는 화풍은 최대 10개까지 저장 가능합니다.'); return; }

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
      const url = await gemini.generateImage(char.visualDescription, true, geminiImageModel);
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
      if (!scene) return;

      const url = await gemini.generateImage(scene.imagePrompt, false, geminiImageModel);

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
      const newImageUrl = await gemini.generateImage(newPrompt, isPortrait, geminiImageModel);

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
    const missingAssets = project.scenes.some(s => !s.imageUrl || !s.audioUrl);
    if (missingAssets) { alert("모든 장면의 이미지와 오디오가 생성되어야 합니다."); return; }

    setBgTask({ type: 'video', message: '동영상 렌더링 중' });
    setBgProgress(0);

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
      const img = new Image(); img.crossOrigin = "anonymous"; img.src = scene.imageUrl!;
      await new Promise(r => img.onload = r);
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

          // Calculate transform based on scene effect
          const { scale, offsetX, offsetY } = calculateEffectTransform(
            scene.effect,
            progress,
            canvas.width,
            canvas.height
          );

          const w = canvas.width * scale;
          const h = canvas.height * scale;
          const x = (canvas.width - w) / 2 + offsetX;
          const y = (canvas.height - h) / 2 + offsetY;
          ctx.drawImage(img, x, y, w, h);

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
      setBgProgress(Math.round(((i + 1) / project.scenes.length) * 100));
    }
    recorder.stop();
    await new Promise(r => recorder.onstop = r);
    const videoBlob = new Blob(chunks, { type: 'video/mp4' });
    const url = URL.createObjectURL(videoBlob);
    downloadAsset(url, `${project.title}.mp4`);
    setBgTask(null);
    setBgProgress(0);
    alert("동영상 저장이 완료되었습니다.");
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
            <div className="max-w-5xl mx-auto space-y-8 pt-10">
              <div className="bg-yellow-200 p-4 text-black text-center">DEBUG: character_setup 화면, 캐릭터 수: {project?.characters?.length || 0}</div>
              {bgTask ? (
                <div className="text-center py-20">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-500">{bgTask.message}</p>
                  <p className="text-indigo-600 font-semibold mt-2">{bgProgress}%</p>
                </div>
              ) : (
              <>
              <div className="text-center space-y-4">
                <h1 className="text-3xl sm:text-5xl font-semibold">{project?.title || '새 프로젝트'}</h1>
                <p className="text-slate-400 font-medium">캐릭터를 확인하고 수정하세요</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {(project?.characters || []).map(char => (
                  <div key={char.id} className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all">
                    <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 mb-4 relative">
                      {char.status === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                      {char.portraitUrl && (
                        <img src={char.portraitUrl} className="w-full h-full object-cover cursor-pointer" onClick={() => setSelectedImage(char.portraitUrl)} />
                      )}
                      {!char.portraitUrl && char.status !== 'loading' && (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 text-center mb-1">{char.name}</h3>
                    <p className="text-xs text-slate-400 text-center mb-3">{char.role}</p>
                    <div className="flex gap-2">
                      <button onClick={() => generatePortrait(char.id)} disabled={char.status === 'loading'} className="flex-1 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50">재생성</button>
                      <button onClick={() => { setPromptEditType('character'); setPromptEditId(char.id); setPromptEditInput(''); setIsPromptModalOpen(true); }} className="flex-1 py-2 text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all">수정</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => setIsCharModalOpen(true)} className="bg-slate-50 rounded-3xl p-6 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center min-h-[200px]">
                  <span className="text-3xl text-slate-300 mb-2">+</span>
                  <span className="text-sm text-slate-400 font-medium">캐릭터 추가</span>
                </button>
              </div>

              <div className="flex justify-center gap-4 pt-6">
                <button onClick={() => proceedToStoryboard(true)} disabled={bgTask !== null} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-semibold text-lg shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
                  스토리보드 생성
                </button>
                {project && project.scenes.length > 0 && (
                  <button onClick={() => proceedToStoryboard(false)} className="px-10 py-5 bg-white border border-slate-200 text-slate-700 rounded-2xl font-semibold text-lg hover:bg-slate-50 transition-all">
                    기존 스토리보드 보기
                  </button>
                )}
              </div>
              </>
              )}
            </div>
          )}

          {step === 'storyboard' && (
            <div className="space-y-8 pt-10">
              {!project ? (
                <div className="text-center py-20">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : (
              <>
              <div className="text-center space-y-4">
                <h1 className="text-3xl sm:text-5xl font-semibold">{project.title}</h1>
                <p className="text-slate-400 font-medium">장면별로 이미지와 오디오를 생성하세요</p>
              </div>

              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <button onClick={generateAllImages} disabled={isBatchGenerating} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">
                  전체 이미지 생성
                </button>
                <button onClick={generateBatchAudio} disabled={isBatchGenerating} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all disabled:opacity-50">
                  전체 오디오 생성
                </button>
                <button onClick={exportVideo} disabled={project.scenes.some(s => !s.imageUrl || !s.audioUrl)} className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-all disabled:opacity-50">
                  동영상 추출
                </button>
              </div>

              {/* 가로 스크롤 카드 컨테이너 */}
              <div className="bg-white rounded-[20px] shadow-lg p-6 overflow-hidden">
                <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  {project.scenes.map((scene, idx) => (
                    <div key={scene.id} className="flex-shrink-0 w-[280px] bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                      {/* 이미지 영역 - 16:9 비율 */}
                      <div className="aspect-video bg-slate-100 relative group">
                        {scene.status === 'loading' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-10">
                            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                        {scene.imageUrl ? (
                          <img src={scene.imageUrl} className="w-full h-full object-cover cursor-pointer" onClick={() => setSelectedImage(scene.imageUrl)} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                        {/* 호버 시 컨트롤 버튼 */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                          <button onClick={() => generateSceneImage(scene.id)} disabled={scene.status === 'loading'} className="p-2 bg-white rounded-full text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </button>
                          <button onClick={() => { activeSceneId.current = scene.id; sceneImageUploadRef.current?.click(); }} className="p-2 bg-white rounded-full text-slate-600 hover:bg-slate-50 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          </button>
                          <button onClick={() => deleteScene(scene.id)} className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>

                      {/* 텍스트 영역 */}
                      <div className="p-4">
                        <p className="text-xs text-slate-400 font-medium mb-1">장면 {idx + 1}</p>
                        <p className="text-sm text-slate-700 font-medium line-clamp-2 leading-relaxed mb-3">{scene.scriptSegment}</p>

                        {/* 푸터 영역 */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            {scene.audioUrl ? (
                              <button onClick={() => { const audio = new Audio(scene.audioUrl!); audio.play(); }} className="p-1.5 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              </button>
                            ) : (
                              <button onClick={() => generateAudio(scene.id)} disabled={scene.audioStatus === 'loading'} className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all disabled:opacity-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                              </button>
                            )}
                            <button onClick={() => { activeSceneId.current = scene.id; sceneAudioUploadRef.current?.click(); }} className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            </button>
                          </div>
                          <button onClick={() => { setPromptEditType('scene'); setPromptEditId(scene.id); setPromptEditInput(''); setIsPromptModalOpen(true); }} className="text-xs text-slate-400 hover:text-indigo-600 transition-all">
                            수정
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 추가하기 플레이스홀더 카드 */}
                  <button onClick={addSceneManually} className="flex-shrink-0 w-[280px] min-h-[280px] rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <span className="text-sm text-slate-400 font-medium">스토리보드 추가</span>
                  </button>
                </div>
              </div>
              </>
              )}
            </div>
          )}

          {step === 'input' && (
            <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12 pt-10 sm:pt-10">
               <div className="text-center space-y-2 sm:space-y-4">
                  <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-tight">당신의 대본을 <span className="text-indigo-600">살아있는 영상</span>으로</h1>
                  <p className="text-slate-400 font-medium text-base sm:text-lg">캐릭터 일관성 유지 + AI 내레이션 + 자동 자막</p>
               </div>
               <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
                  {['realistic', '2d-animation', 'custom'].map(s => (
                    <button key={s} onClick={() => { setStyle(s as VisualStyle); updateCurrentProject({ style: s }); }} className={`px-6 py-4 sm:px-10 sm:py-8 rounded-[20px] sm:rounded-[32px] transition-all font-semibold text-sm sm:text-lg ${style === s ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}>{s === '2d-animation' ? '2D 애니메이션' : s === 'realistic' ? '실사화' : '맞춤형'}</button>
                  ))}
                  {savedStyles.map(s => (
                    <button key={s.id} onClick={() => { setStyle(s.id as VisualStyle); updateCurrentProject({ style: s.id }); }} className={`px-6 py-4 sm:px-10 sm:py-8 rounded-[20px] sm:rounded-[32px] transition-all font-semibold text-sm sm:text-lg ${style === s.id ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}>{s.name}</button>
                  ))}
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
                      <button onClick={() => styleRefImageInputRef.current?.click()} className="w-full sm:w-auto px-6 py-3 bg-white border border-indigo-200 rounded-2xl text-xs font-semibold text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all">이미지 업로드</button>
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
                     다음 단계로 이동 &gt;
                   </button>
                 )}
               </div>
            </div>
          )}
        </div>
      )}

      {selectedImage && <div className="fixed inset-0 bg-slate-900/95 z-[250] flex items-center justify-center p-2 sm:p-4 cursor-zoom-out animate-in fade-in" onClick={() => setSelectedImage(null)}><img src={selectedImage} className="max-w-full max-h-[90vh] object-contain rounded-2xl sm:rounded-[40px] shadow-2xl border-4 sm:border-8 border-white/10" /></div>}

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
              {/* 회원가입/로그인 섹션 */}
              <div className="flex gap-3">
                <a href="signup.html" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-center font-semibold rounded-xl transition-all text-sm">회원가입</a>
                <button className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-center font-semibold rounded-xl transition-all text-sm">로그인</button>
              </div>

              {/* Gemini API 설정 - 아코디언 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'gemini' ? null : 'gemini')} className="w-full px-4 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">Gemini API 설정</span>
                    {isGeminiValid && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">연결됨</span>}
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'gemini' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'gemini' && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="space-y-2 pt-4">
                      <label className="text-sm font-medium text-slate-700">API 키</label>
                      <input type={showGeminiKey ? "text" : "password"} value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} placeholder="API 키 입력" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white" />
                      <button onClick={() => setShowGeminiKey(!showGeminiKey)} className="text-xs text-slate-400 hover:text-slate-600">{showGeminiKey ? '숨기기' : '보기'}</button>
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
                          <input type={showChirpKey ? "text" : "password"} value={chirpApiKey} onChange={e => setChirpApiKey(e.target.value)} placeholder="API 키 입력 (비워두면 Gemini 키 사용)" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white" />
                          <button onClick={() => setShowChirpKey(!showChirpKey)} className="text-xs text-slate-400 hover:text-slate-600">{showChirpKey ? '숨기기' : '보기'}</button>
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
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700">ElevenLabs API 키</label>
                            {isElConnected && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">연결됨</span>}
                          </div>
                          <input type={showElKey ? "text" : "password"} value={elSettings.apiKey} onChange={e => setElSettings({...elSettings, apiKey: e.target.value})} placeholder="API 키 입력" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white" />
                          <button onClick={() => setShowElKey(!showElKey)} className="text-xs text-slate-400 hover:text-slate-600">{showElKey ? '숨기기' : '보기'}</button>
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

              {/* 저장된 화풍 - 아코디언 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedSetting(expandedSetting === 'styles' ? null : 'styles')} className="w-full px-4 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">저장된 화풍</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{savedStyles.length}/10</span>
                  </div>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSetting === 'styles' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {expandedSetting === 'styles' && (
                  <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50">
                    {savedStyles.length === 0 ? (
                      <p className="text-sm text-slate-400 pt-4">저장된 화풍이 없습니다</p>
                    ) : (
                      <div className="space-y-2 pt-4">
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
                  <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50">
                    {savedCharacters.length === 0 ? (
                      <p className="text-sm text-slate-400 pt-4">저장된 인물이 없습니다</p>
                    ) : (
                      <div className="space-y-2 pt-4">
                        {savedCharacters.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                              {c.portraitUrl && <img src={c.portraitUrl} className="w-10 h-10 rounded-full object-cover" />}
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

      {/* 프롬프트 수정 모달 */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => setIsPromptModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">{promptEditType === 'character' ? '캐릭터' : '장면'} 수정</h3>
            <p className="text-sm text-slate-400 mb-6">원하는 변경사항을 한국어로 설명해주세요</p>
            <textarea value={promptEditInput} onChange={e => setPromptEditInput(e.target.value)} placeholder="예: 머리색을 금발로 바꿔줘 / 배경을 밤으로 바꿔줘" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm h-32 resize-none" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsPromptModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all">취소</button>
              <button onClick={handleRegeneratePrompt} disabled={!promptEditInput.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">
                재생성
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
    </div>
  );
};

export default App;
