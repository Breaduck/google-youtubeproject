import { useState, useEffect, useRef } from 'react';
import { SubtitleSettings, SubtitlePosition, ElevenLabsSettings, SavedStyle, SavedCharacter } from '../types';
import SubtitleTemplateModal, { TEMPLATES } from './SubtitleTemplateModal';
import { useSettingsStore } from '../stores/settingsStore';

type SettingTab = 'account' | 'gemini' | 'video-api' | 'subtitle' | 'narration' | 'saved-styles' | 'saved-characters';

interface FullscreenSettingsProps {
  onClose: () => void;
  isLoggedIn: boolean;
  onLoginStateChange: (loggedIn: boolean) => void;
  onCheckGeminiKey: (key: string) => void;
  calculateVideoCost: () => { numScenes: number; costPerScene: number; totalCost: number };
  totalScenes: number;
  onCheckByteplusKey: (key: string) => void;
  onCheckEvolinkKey: (key: string) => void;
  onCheckRunwareKey: (key: string) => void;
  isElConnected: boolean;
  voices: any[];
  onVoiceTest: () => void;
  isVoiceTesting: boolean;
  onWavUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedWavFile: { file: File; url: string } | null;
  savedStyles: SavedStyle[];
  savedCharacters: SavedCharacter[];
  onAddStyleWithAnalysis: (name: string, images: string[]) => Promise<void>;
  onAddCharacterWithAnalysis: (name: string, images: string[]) => Promise<void>;
  onDeleteStyle: (id: string) => void;
  onDeleteCharacter: (id: string) => void;
}

export default function FullscreenSettings(props: FullscreenSettingsProps) {
  const {
    onClose,
    isLoggedIn,
    onLoginStateChange,
    onCheckGeminiKey,
    calculateVideoCost,
    totalScenes,
    onCheckByteplusKey,
    onCheckEvolinkKey,
    onCheckRunwareKey,
    isElConnected,
    voices,
    onVoiceTest,
    isVoiceTesting,
    onWavUpload,
    uploadedWavFile,
    savedStyles,
    savedCharacters,
    onAddStyleWithAnalysis,
    onAddCharacterWithAnalysis,
    onDeleteStyle,
    onDeleteCharacter,
  } = props;

  // Use Zustand stores
  const {
    geminiApiKey,
    setGeminiApiKey,
    geminiModel,
    setGeminiModel,
    geminiImageModel,
    setGeminiImageModel,
    isGeminiValid,
    isValidatingGemini,
    videoProvider,
    setVideoProvider,
    bytedanceApiKey,
    setBytedanceApiKey,
    bytedanceModel,
    setBytedanceModel,
    isByteplusValid,
    isValidatingByteplus,
    evolinkApiKey,
    setEvolinkApiKey,
    evolinkResolution,
    setEvolinkResolution,
    evolinkDuration,
    setEvolinkDuration,
    isEvolinkValid,
    isValidatingEvolink,
    runwareApiKey,
    setRunwareApiKey,
    runwareResolution,
    setRunwareResolution,
    runwareDuration,
    setRunwareDuration,
    isRunwareValid,
    isValidatingRunware,
    videoGenerationRange,
    setVideoGenerationRange,
    audioProvider,
    setAudioProvider,
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
  const [activeTab, setActiveTab] = useState<SettingTab>('gemini');
  const [showAzureKey, setShowAzureKey] = useState(false);
  const [showElKey, setShowElKey] = useState(false);
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);
  const wavUploadRef = useRef<HTMLInputElement>(null);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // body 스크롤 차단
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const menuItems = [
    { id: 'account' as SettingTab, icon: '👤', label: '계정', badge: isLoggedIn ? '로그인됨' : '로그인' },
    { id: 'gemini' as SettingTab, icon: '🔑', label: 'Gemini API', badge: geminiApiKey ? '연결됨' : '미설정' },
    { id: 'video-api' as SettingTab, icon: '🎬', label: '영상화 API', badge: 'BytePlus' },
    { id: 'subtitle' as SettingTab, icon: '📝', label: '자막설정', badge: subtitleSettings.fontFamily },
    { id: 'narration' as SettingTab, icon: '🎙️', label: '나레이션', badge: 'Chirp3 HD' },
    { id: 'saved-styles' as SettingTab, icon: '🎨', label: '저장된 그림체', badge: `${savedStyles.length}/10` },
    { id: 'saved-characters' as SettingTab, icon: '👥', label: '저장된 인물', badge: `${savedCharacters.length}/10` },
  ];

  return (
    <div className="fixed inset-0 z-[300] bg-white dark:bg-slate-900 flex">
      {/* 좌측 사이드바 */}
      <div className="w-64 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        {/* 헤더 */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all active:scale-98 group"
            title="닫기 (ESC)"
          >
            <svg className="w-7 h-7 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
            <span>이전으로 돌아가기</span>
          </button>
        </div>

        {/* 메뉴 리스트 */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full px-6 py-2 flex items-center gap-3 transition-colors ${
                activeTab === item.id
                  ? 'bg-indigo-600/20 border-l-2 border-indigo-500 text-indigo-700 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="flex-1 text-left font-medium text-sm">{item.label}</span>
              <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full">{item.badge}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 우측 콘텐츠 */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto p-6">
          {activeTab === 'gemini' && (
            <GeminiSettings
              apiKey={geminiApiKey}
              onChange={setGeminiApiKey}
              geminiModel={geminiModel}
              setGeminiModel={setGeminiModel}
              geminiImageModel={geminiImageModel}
              setGeminiImageModel={setGeminiImageModel}
              isGeminiValid={isGeminiValid}
              isValidatingGemini={isValidatingGemini}
              onCheckGeminiKey={onCheckGeminiKey}
            />
          )}
          {activeTab === 'subtitle' && (
            <SubtitleSettingsPanel
              settings={subtitleSettings}
              onChange={setSubtitleSettings}
              showTemplatePopup={showTemplatePopup}
              setShowTemplatePopup={setShowTemplatePopup}
            />
          )}
          {activeTab === 'narration' && (
            <NarrationSettings
              audioProvider={audioProvider}
              setAudioProvider={setAudioProvider}
              chirpVoice={chirpVoice}
              setChirpVoice={setChirpVoice}
              chirpSpeed={chirpSpeed}
              setChirpSpeed={setChirpSpeed}
              neural2Voice={neural2Voice}
              setNeural2Voice={setNeural2Voice}
              standardVoice={standardVoice}
              setStandardVoice={setStandardVoice}
              wavenetVoice={wavenetVoice}
              setWavenetVoice={setWavenetVoice}
              studioVoice={studioVoice}
              setStudioVoice={setStudioVoice}
              azureApiKey={azureApiKey}
              setAzureApiKey={setAzureApiKey}
              azureVoice={azureVoice}
              setAzureVoice={setAzureVoice}
              showAzureKey={showAzureKey}
              onShowAzureKeyToggle={() => setShowAzureKey(!showAzureKey)}
              elSettings={elSettings}
              setElSettings={setElSettings}
              isElConnected={isElConnected}
              voices={voices}
              showElKey={showElKey}
              onShowElKeyToggle={() => setShowElKey(!showElKey)}
              onVoiceTest={onVoiceTest}
              isVoiceTesting={isVoiceTesting}
              wavUploadRef={wavUploadRef}
              onWavUpload={onWavUpload}
              uploadedWavFile={uploadedWavFile}
            />
          )}
          {activeTab === 'account' && <AccountSettings isLoggedIn={isLoggedIn} onLoginStateChange={onLoginStateChange} />}
          {activeTab === 'video-api' && (
            <VideoApiSettings
              videoProvider={videoProvider}
              setVideoProvider={setVideoProvider}
              bytedanceApiKey={bytedanceApiKey}
              setBytedanceApiKey={setBytedanceApiKey}
              bytedanceModel={bytedanceModel}
              setBytedanceModel={setBytedanceModel}
              evolinkApiKey={evolinkApiKey}
              setEvolinkApiKey={setEvolinkApiKey}
              evolinkResolution={evolinkResolution}
              setEvolinkResolution={setEvolinkResolution}
              evolinkDuration={evolinkDuration}
              setEvolinkDuration={setEvolinkDuration}
              runwareApiKey={runwareApiKey}
              setRunwareApiKey={setRunwareApiKey}
              runwareResolution={runwareResolution}
              setRunwareResolution={setRunwareResolution}
              runwareDuration={runwareDuration}
              setRunwareDuration={setRunwareDuration}
              videoGenerationRange={videoGenerationRange}
              setVideoGenerationRange={setVideoGenerationRange}
              calculateVideoCost={calculateVideoCost}
              totalScenes={totalScenes}
              isByteplusValid={isByteplusValid}
              isValidatingByteplus={isValidatingByteplus}
              onCheckByteplusKey={onCheckByteplusKey}
              isEvolinkValid={isEvolinkValid}
              isValidatingEvolink={isValidatingEvolink}
              onCheckEvolinkKey={onCheckEvolinkKey}
              isRunwareValid={isRunwareValid}
              isValidatingRunware={isValidatingRunware}
              onCheckRunwareKey={onCheckRunwareKey}
            />
          )}
          {activeTab === 'saved-styles' && <SavedStylesPanel savedStyles={savedStyles} onAddStyle={onAddStyleWithAnalysis} onDeleteStyle={onDeleteStyle} />}
          {activeTab === 'saved-characters' && <SavedCharactersPanel savedCharacters={savedCharacters} onAddCharacter={onAddCharacterWithAnalysis} onDeleteCharacter={onDeleteCharacter} />}
        </div>
      </div>
    </div>
  );
}

// === 각 탭별 컴포넌트 ===

function GeminiSettings({
  apiKey,
  onChange,
  geminiModel,
  setGeminiModel,
  geminiImageModel,
  setGeminiImageModel,
  isGeminiValid,
  isValidatingGemini,
  onCheckGeminiKey,
}: {
  apiKey: string;
  onChange: (key: string) => void;
  geminiModel: string;
  setGeminiModel: (model: string) => void;
  geminiImageModel: string;
  setGeminiImageModel: (model: string) => void;
  isGeminiValid: boolean;
  isValidatingGemini: boolean;
  onCheckGeminiKey: (key: string) => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showCostDetails, setShowCostDetails] = useState(false);
  const [costPeriod, setCostPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Gemini API 설정</h2>
        <p className="text-slate-600 dark:text-slate-400">이미지 생성 및 스크립트 분석에 사용됩니다.</p>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 space-y-4">
        {/* API 키 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">API 키</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => apiKey.length > 20 && onCheckGeminiKey(apiKey)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-3 pr-12 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showApiKey ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          {!apiKey && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              💡 google.ai studio에서 발급가능합니다
            </p>
          )}

          {apiKey.length > 20 && (
            <div className="flex items-center gap-2 text-sm mt-2">
              {isValidatingGemini ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-slate-600 dark:text-slate-400">검증 중...</span>
                </>
              ) : isGeminiValid ? (
                <>
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-600 font-medium">유효함</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-red-600 font-medium">유효하지 않음</span>
                </>
              )}
            </div>
          )}

          {!apiKey && (
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm mt-2"
            >
              API 키 발급받기 →
            </a>
          )}
        </div>

        {/* 기본 Gemini 엔진 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            기본 Gemini 엔진 (대본/프롬프트 생성)
          </label>
          <select
            value={geminiModel}
            onChange={(e) => setGeminiModel(e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
          </select>
        </div>

        {/* 이미지 모델 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">이미지 모델</label>
          <select
            value={geminiImageModel}
            onChange={(e) => setGeminiImageModel(e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="imagen-4.0-generate-001">Imagen 4 Fast (29원)</option>
            <option value="imagen-3.0-generate-002">Imagen 3 Fast (29원)</option>
            <option value="gemini-3.1-flash-image-preview">Nano Banana 2 (98원)</option>
            <option value="gemini-3-pro-image-preview">Nano Banana Pro (196원)</option>
          </select>
        </div>

        {/* 예상 비용 표시 */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
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
              <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700 space-y-2">
                {/* 기간 선택 */}
                <div className="flex gap-2">
                  {[
                    { value: 'daily', label: '일별' },
                    { value: 'weekly', label: '주별' },
                    { value: 'monthly', label: '월별' },
                  ].map((period) => (
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

                {/* 간단한 요약 통계 */}
                <div className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
                  {(() => {
                    const stored = JSON.parse(
                      localStorage.getItem('gemini_usage') || '{"input":0,"output":0,"images":0}'
                    );
                    return (
                      <>
                        <div className="flex justify-between">
                          <span>총 입력 토큰</span>
                          <span className="font-medium">{(stored.input / 1000).toFixed(1)}K</span>
                        </div>
                        <div className="flex justify-between">
                          <span>총 출력 토큰</span>
                          <span className="font-medium">{(stored.output / 1000).toFixed(1)}K</span>
                        </div>
                        <div className="flex justify-between">
                          <span>생성된 이미지</span>
                          <span className="font-medium">{stored.images}장</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubtitleSettingsPanel({
  settings,
  onChange,
  showTemplatePopup,
  setShowTemplatePopup,
}: {
  settings: SubtitleSettings;
  onChange: (s: SubtitleSettings) => void;
  showTemplatePopup: boolean;
  setShowTemplatePopup: (show: boolean) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [savedPresets, setSavedPresets] = useState<Array<{ name: string; settings: SubtitleSettings }>>([]);
  const [presetName, setPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Load saved presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('subtitle_presets');
    if (saved) {
      try {
        setSavedPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load subtitle presets:', e);
      }
    }
  }, []);

  const categories = ['전체', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];
  const filteredTemplates = selectedCategory === '전체' ? TEMPLATES : TEMPLATES.filter(t => t.category === selectedCategory);

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    onChange({ ...settings, ...template.settings });
  };

  const saveCurrentPreset = () => {
    if (!presetName.trim()) return;
    const newPresets = [...savedPresets, { name: presetName.trim(), settings }];
    setSavedPresets(newPresets);
    localStorage.setItem('subtitle_presets', JSON.stringify(newPresets));
    setPresetName('');
    setShowSaveDialog(false);
    alert('자막 설정이 저장되었습니다.');
  };

  const loadPreset = (preset: { name: string; settings: SubtitleSettings }) => {
    onChange(preset.settings);
  };

  const deletePreset = (index: number) => {
    const newPresets = savedPresets.filter((_, i) => i !== index);
    setSavedPresets(newPresets);
    localStorage.setItem('subtitle_presets', JSON.stringify(newPresets));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">자막 설정</h2>
        <p className="text-slate-600 dark:text-slate-400">영상에 표시될 자막 스타일을 설정합니다.</p>
      </div>

      {/* 저장 다이얼로그 */}
      {showSaveDialog && (
        <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="프리셋 이름 입력..."
            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg"
          />
          <div className="flex gap-2">
            <button
              onClick={saveCurrentPreset}
              disabled={!presetName.trim()}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              저장
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 현재 설정 저장 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowSaveDialog(!showSaveDialog)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
        >
          현재 설정 저장
        </button>
      </div>

      {/* 저장된 프리셋 */}
      {savedPresets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">내가 저장한 프리셋</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {savedPresets.map((preset, index) => (
              <div key={index} className="relative group">
                <button
                  onClick={() => loadPreset(preset)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm transition-colors"
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => deletePreset(index)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 좌측: 설정 */}
        <div className="flex-1 space-y-4">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">폰트</label>
              <div className="flex gap-2">
                <select
                  value={settings.fontFamily}
                  onChange={(e) => onChange({ ...settings, fontFamily: e.target.value })}
                  className="flex-1 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <optgroup label="📐 고딕 (Sans-Serif)">
                    <option value="Pretendard">Pretendard</option>
                    <option value="Noto Sans KR">Noto Sans KR</option>
                    <option value="Nanum Gothic">나눔고딕</option>
                    <option value="Nanum Gothic Coding">나눔고딕 코딩</option>
                    <option value="Gothic A1">Gothic A1</option>
                    <option value="IBM Plex Sans KR">IBM Plex Sans KR</option>
                    <option value="Gowun Dodum">고운 도둠</option>
                  </optgroup>
                  <optgroup label="📚 명조 (Serif)">
                    <option value="Noto Serif KR">Noto Serif KR</option>
                    <option value="Nanum Myeongjo">나눔명조</option>
                    <option value="Gowun Batang">고운 바탕</option>
                    <option value="Song Myung">송명</option>
                    <option value="Hahmlet">Hahmlet</option>
                  </optgroup>
                  <optgroup label="✍️ 손글씨/캘리">
                    <option value="Nanum Pen Script">나눔손글씨 펜</option>
                    <option value="Nanum Brush Script">나눔손글씨 붓</option>
                    <option value="Gaegu">개그체</option>
                    <option value="Poor Story">가난한 이야기</option>
                    <option value="Single Day">싱글 데이</option>
                    <option value="Yeon Sung">연성</option>
                  </optgroup>
                  <optgroup label="🎨 디자인/장식">
                    <option value="Black Han Sans">검은고딕</option>
                    <option value="Do Hyeon">도현</option>
                    <option value="Jua">주아</option>
                    <option value="Sunflower">해바라기</option>
                    <option value="Stylish">스타일리시</option>
                    <option value="Gamja Flower">감자꽃</option>
                    <option value="Gugi">구기</option>
                    <option value="East Sea Dokdo">동해독도</option>
                    <option value="Dokdo">독도</option>
                    <option value="Kirang Haerang">기랑해랑</option>
                    <option value="Hi Melody">하이멜로디</option>
                    <option value="Cute Font">귀여운폰트</option>
                    <option value="Orbit">오빗</option>
                    <option value="Dongle">동글</option>
                    <option value="Black And White Picture">흑백사진</option>
                  </optgroup>
                </select>
                <select
                  value={settings.fontWeight || 700}
                  onChange={(e) => onChange({ ...settings, fontWeight: parseInt(e.target.value) })}
                  className="w-28 px-2 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 text-sm"
                >
                  <option value="100" style={{ fontWeight: 100 }}>Thin</option>
                  <option value="200" style={{ fontWeight: 200 }}>Extra Light</option>
                  <option value="300" style={{ fontWeight: 300 }}>Light</option>
                  <option value="400" style={{ fontWeight: 400 }}>Regular</option>
                  <option value="500" style={{ fontWeight: 500 }}>Medium</option>
                  <option value="600" style={{ fontWeight: 600 }}>Semi Bold</option>
                  <option value="700" style={{ fontWeight: 700 }}>Bold</option>
                  <option value="800" style={{ fontWeight: 800 }}>Extra Bold</option>
                  <option value="900" style={{ fontWeight: 900 }}>Black</option>
                </select>
                <button
                  onClick={() => onChange({ ...settings, fontStyle: settings.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-serif italic transition-all ${
                    settings.fontStyle === 'italic'
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                  }`}
                  title="이탤릭"
                >
                  I
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">크기: {settings.fontSize}px</label>
              <input
                type="range"
                min="16"
                max="80"
                value={settings.fontSize}
                onChange={(e) => onChange({ ...settings, fontSize: parseInt(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">자간: {settings.letterSpacing}px</label>
              <input
                type="range"
                min="-2"
                max="10"
                step="0.5"
                value={settings.letterSpacing}
                onChange={(e) => onChange({ ...settings, letterSpacing: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">행간: {settings.lineHeight}</label>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.1"
                value={settings.lineHeight}
                onChange={(e) => onChange({ ...settings, lineHeight: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">투명도: {Math.round(settings.opacity * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.opacity}
                onChange={(e) => onChange({ ...settings, opacity: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 w-24">텍스트 색상</label>
              <input
                type="color"
                value={settings.textColor}
                onChange={(e) => onChange({ ...settings, textColor: e.target.value })}
                className="w-10 h-10 rounded-full cursor-pointer border-2 border-slate-300 dark:border-slate-600 appearance-none p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              />
              <input
                type="text"
                value={settings.textColor}
                onChange={(e) => onChange({ ...settings, textColor: e.target.value })}
                className="px-3 py-2 w-28 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                placeholder="#FFFFFF"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <input
                  type="checkbox"
                  checked={!!settings.backgroundColor}
                  onChange={(e) => onChange({ ...settings, backgroundColor: e.target.checked ? '#000000' : undefined })}
                  className="rounded"
                />
                배경 색상 사용
              </label>
              {settings.backgroundColor && (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <input
                      type="color"
                      value={settings.backgroundColor}
                      onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                      className="w-10 h-10 rounded-full cursor-pointer border-2 border-slate-300 dark:border-slate-600 appearance-none p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full"
                      style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                    />
                    <input
                      type="text"
                      value={settings.backgroundColor}
                      onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                      className="px-3 py-2 w-28 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                      placeholder="#000000"
                    />
                  </div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">배경 투명도: {Math.round(settings.bgOpacity * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.bgOpacity}
                    onChange={(e) => onChange({ ...settings, bgOpacity: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-600 mb-2"
                  />
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">배경 여백: {settings.bgPadding}px</label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={settings.bgPadding}
                    onChange={(e) => onChange({ ...settings, bgPadding: parseInt(e.target.value) })}
                    className="w-full accent-indigo-600 mb-2"
                  />
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">배경 라운딩: {settings.bgRadius || 0}px</label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={settings.bgRadius || 0}
                    onChange={(e) => onChange({ ...settings, bgRadius: parseInt(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">자막 위치</label>
              <select
                value={settings.position}
                onChange={(e) => {
                  const pos = e.target.value as SubtitlePosition;
                  const yPos = pos === 'top' ? 150 : pos === 'center' ? 360 : 650;
                  onChange({ ...settings, position: pos, yPosition: yPos });
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="top">상단</option>
                <option value="center">중앙</option>
                <option value="bottom">하단</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">수직 위치 (세밀 조정): {settings.yPosition}px</label>
              <input
                type="range"
                min="100"
                max="700"
                value={settings.yPosition}
                onChange={(e) => onChange({ ...settings, yPosition: parseInt(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* 우측: 미리보기 + 템플릿 (Sticky) */}
        <div className="lg:w-[450px] lg:sticky lg:top-8 space-y-4 h-fit shrink-0">
          {/* 미리보기 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 dark:text-slate-100">실시간 미리보기</label>
              <span className="text-xs text-slate-500 dark:text-slate-400">클릭하여 배경 이미지 변경</span>
            </div>
            <div
              className="w-full rounded-xl overflow-hidden relative group cursor-pointer shadow-2xl border-2 border-slate-300 dark:border-slate-700 hover:border-indigo-500 transition-all"
              style={{ paddingTop: '56.25%' }}
            >
              {/* 배경 이미지 */}
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Preview background"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                  <div className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.3), transparent 50%), radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.3), transparent 50%)'
                    }}
                  />
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                  key={`${settings.textColor}-${settings.strokeColor}-${settings.backgroundColor}`}
                  className="absolute left-1/2 -translate-x-1/2 transition-all duration-300"
                  style={{
                    top: `${Math.min((settings.yPosition / 720) * 100, 85)}%`,
                    opacity: settings.opacity,
                  }}
                >
                  {settings.backgroundColor && (
                    <div
                      className="absolute -z-10 transition-all duration-300"
                      style={{
                        backgroundColor: settings.backgroundColor,
                        opacity: settings.bgOpacity,
                        inset: `-${settings.bgPadding / 2}px`,
                        borderRadius: `${settings.bgRadius || 0}px`,
                      }}
                    />
                  )}
                  <p
                    className="relative whitespace-nowrap text-center transition-all duration-300"
                    style={{
                      fontFamily: settings.fontFamily,
                      fontSize: `${settings.fontSize / 2.5}px`,
                      fontWeight: settings.fontWeight || 700,
                      fontStyle: settings.fontStyle || 'normal',
                      color: settings.textColor,
                      letterSpacing: `${settings.letterSpacing / 1.5}px`,
                      lineHeight: settings.lineHeight,
                      WebkitTextStroke: settings.strokeWidth > 0 && settings.strokeColor !== 'transparent' ? `${settings.strokeWidth / 2}px ${settings.strokeColor}` : undefined,
                    }}
                  >
                    자막 미리보기
                  </p>
                </div>

                {/* 호버 시 업로드 버튼 */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/50 backdrop-blur-sm">
                  <label className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold cursor-pointer shadow-2xl transition-all transform hover:scale-105 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <span>{previewImage ? '이미지 변경' : '배경 이미지 추가'}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 템플릿 선택 */}
          <div className="space-y-3">
            <button
              onClick={() => setShowTemplatePopup(true)}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              템플릿 선택
            </button>
          </div>
        </div>
      </div>

      {/* 자막 템플릿 팝업 모달 */}
      {showTemplatePopup && (
        <SubtitleTemplateModal
          current={settings}
          onApply={(newSettings) => {
            onChange(newSettings);
            setShowTemplatePopup(false);
          }}
          onClose={() => setShowTemplatePopup(false)}
        />
      )}
    </div>
  );
}

function AccountSettings({ isLoggedIn, onLoginStateChange }: {
  isLoggedIn: boolean;
  onLoginStateChange: (loggedIn: boolean) => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const currentUser = isLoggedIn ? JSON.parse(localStorage.getItem('currentUser') || '{}') : null;

  const handleSubmit = () => {
    if (mode === 'login') {
      if (!username || !password) {
        alert('아이디와 비밀번호를 입력해주세요.');
        return;
      }
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const user = users.find((u: any) => u.username === username && u.password === password);
      if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        onLoginStateChange(true);
        setUsername('');
        setPassword('');
        alert('로그인 성공!');
      } else {
        alert('아이디 또는 비밀번호가 일치하지 않습니다.');
      }
    } else {
      if (!username || !password || !email) {
        alert('모든 필드를 입력해주세요.');
        return;
      }
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      if (users.find((u: any) => u.username === username)) {
        alert('이미 존재하는 아이디입니다.');
        return;
      }
      users.push({ username, password, email });
      localStorage.setItem('users', JSON.stringify(users));
      setUsername('');
      setPassword('');
      setEmail('');
      setMode('login');
      alert('회원가입 완료! 로그인해주세요.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">계정</h2>
        <p className="text-slate-600 dark:text-slate-400">클라우드 동기화 및 프로젝트 저장</p>
      </div>

      {isLoggedIn ? (
        <div className="max-w-md mx-auto">
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl font-bold border-2 border-white/30">
                  {currentUser?.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{currentUser?.username}</h3>
                  <p className="text-indigo-100 text-sm">{currentUser?.email}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    localStorage.removeItem('currentUser');
                    onLoginStateChange(false);
                    alert('로그아웃되었습니다.');
                  }}
                  className="flex-1 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl font-medium transition-all"
                >
                  로그아웃
                </button>
                <button className="flex-1 py-3 bg-white hover:bg-gray-50 text-indigo-600 rounded-xl font-medium transition-all">
                  프로필 수정
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* 탭 */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-4 font-semibold transition-all relative ${
                  mode === 'login'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                로그인
                {mode === 'login' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400"></div>
                )}
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 py-4 font-semibold transition-all relative ${
                  mode === 'signup'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                회원가입
                {mode === 'signup' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400"></div>
                )}
              </button>
            </div>

            {/* 폼 */}
            <div className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                  아이디
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="사용자 아이디"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-0 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-0 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-0 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              )}

              <button
                onClick={handleSubmit}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/50 transition-all transform hover:scale-[1.02]"
              >
                {mode === 'login' ? '로그인' : '계정 만들기'}
              </button>

              {mode === 'login' && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  계정이 없으신가요?{' '}
                  <button onClick={() => setMode('signup')} className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                    회원가입
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoApiSettings({
  videoProvider,
  setVideoProvider,
  bytedanceApiKey,
  setBytedanceApiKey,
  bytedanceModel,
  setBytedanceModel,
  evolinkApiKey,
  setEvolinkApiKey,
  evolinkResolution,
  setEvolinkResolution,
  evolinkDuration,
  setEvolinkDuration,
  runwareApiKey,
  setRunwareApiKey,
  runwareResolution,
  setRunwareResolution,
  runwareDuration,
  setRunwareDuration,
  videoGenerationRange,
  setVideoGenerationRange,
  calculateVideoCost,
  totalScenes,
  isByteplusValid,
  isValidatingByteplus,
  onCheckByteplusKey,
  isEvolinkValid,
  isValidatingEvolink,
  onCheckEvolinkKey,
  isRunwareValid,
  isValidatingRunware,
  onCheckRunwareKey,
}: {
  videoProvider: 'byteplus' | 'evolink' | 'runware';
  setVideoProvider: (provider: 'byteplus' | 'evolink' | 'runware') => void;
  bytedanceApiKey: string;
  setBytedanceApiKey: (key: string) => void;
  bytedanceModel: string;
  setBytedanceModel: (model: string) => void;
  evolinkApiKey: string;
  setEvolinkApiKey: (key: string) => void;
  evolinkResolution: string;
  setEvolinkResolution: (resolution: string) => void;
  evolinkDuration: number;
  setEvolinkDuration: (duration: number) => void;
  runwareApiKey: string;
  setRunwareApiKey: (key: string) => void;
  runwareResolution: string;
  setRunwareResolution: (resolution: string) => void;
  runwareDuration: number;
  setRunwareDuration: (duration: number) => void;
  videoGenerationRange: number;
  setVideoGenerationRange: (range: number) => void;
  calculateVideoCost: () => { numScenes: number; costPerScene: number; totalCost: number };
  totalScenes: number;
  isByteplusValid: boolean;
  isValidatingByteplus: boolean;
  onCheckByteplusKey: (key: string) => void;
  isEvolinkValid: boolean;
  isValidatingEvolink: boolean;
  onCheckEvolinkKey: (key: string) => void;
  isRunwareValid: boolean;
  isValidatingRunware: boolean;
  onCheckRunwareKey: (key: string) => void;
}) {
  const [showBytedanceKey, setShowBytedanceKey] = useState(false);
  const [showEvolinkKey, setShowEvolinkKey] = useState(false);
  const [showRunwareKey, setShowRunwareKey] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">영상화 API 설정</h2>
        <p className="text-slate-600 dark:text-slate-400">이미지를 영상으로 변환하는 API를 설정합니다.</p>
      </div>

      {/* 제공업체 선택 */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">제공업체 선택</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setVideoProvider('byteplus')}
              className={`p-4 rounded-lg border-2 transition-all ${
                videoProvider === 'byteplus'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
              }`}
            >
              <div className="text-center">
                <p className="font-semibold text-slate-900 dark:text-slate-100">BytePlus</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">₩307/10초</p>
              </div>
            </button>
            <button
              onClick={() => setVideoProvider('evolink')}
              className={`p-4 rounded-lg border-2 transition-all ${
                videoProvider === 'evolink'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
              }`}
            >
              <div className="text-center">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Evolink</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">₩190/10초</p>
              </div>
            </button>
            <button
              onClick={() => setVideoProvider('runware')}
              className={`p-4 rounded-lg border-2 transition-all ${
                videoProvider === 'runware'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
              }`}
            >
              <div className="text-center">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Runware</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">₩195/10초</p>
              </div>
            </button>
          </div>
        </div>

        {/* BytePlus 설정 */}
        {videoProvider === 'byteplus' && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">BytePlus API 키</label>
                {isByteplusValid && (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="relative">
                <input
                  type={showBytedanceKey ? 'text' : 'password'}
                  value={bytedanceApiKey}
                  onChange={(e) => setBytedanceApiKey(e.target.value)}
                  onBlur={() => bytedanceApiKey.length > 10 && onCheckByteplusKey(bytedanceApiKey)}
                  placeholder="ARK_API_KEY"
                  className="w-full px-4 py-3 pr-12 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setShowBytedanceKey(!showBytedanceKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showBytedanceKey ? '👁️' : '👁️‍🗨️'}
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
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">BytePlus ModelArk에서 API 키를 발급받으세요</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">모델</label>
              <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">SeeDance 1.0 Pro Fast</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">10초 영상, 720p 고정</p>
              </div>
            </div>
          </div>
        )}

        {/* Evolink 설정 */}
        {videoProvider === 'evolink' && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Evolink API 키</label>
                {isEvolinkValid && (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="relative">
                <input
                  type={showEvolinkKey ? 'text' : 'password'}
                  value={evolinkApiKey}
                  onChange={(e) => setEvolinkApiKey(e.target.value)}
                  onBlur={() => evolinkApiKey.length > 10 && onCheckEvolinkKey(evolinkApiKey)}
                  placeholder="Evolink API Key"
                  className="w-full px-4 py-3 pr-12 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setShowEvolinkKey(!showEvolinkKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showEvolinkKey ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {evolinkApiKey.length > 10 && (
                <div className="flex items-center gap-2 text-sm mt-2">
                  {isValidatingEvolink ? (
                    <>
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-600 dark:text-slate-400">검증 중...</span>
                    </>
                  ) : isEvolinkValid ? (
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
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">영상 설정</label>
              <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">SeeDance 1.0 Pro Fast</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">10초 영상, 720p 고정 • ₩190/영상</p>
              </div>
            </div>
          </div>
        )}

        {/* Runware 설정 */}
        {videoProvider === 'runware' && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Runware API 키</label>
                {isRunwareValid && (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="relative">
                <input
                  type={showRunwareKey ? 'text' : 'password'}
                  value={runwareApiKey}
                  onChange={(e) => setRunwareApiKey(e.target.value)}
                  onBlur={() => runwareApiKey.length > 10 && onCheckRunwareKey(runwareApiKey)}
                  placeholder="Runware API Key"
                  className="w-full px-4 py-3 pr-12 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setShowRunwareKey(!showRunwareKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showRunwareKey ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {runwareApiKey.length > 10 && (
                <div className="flex items-center gap-2 text-sm mt-2">
                  {isValidatingRunware ? (
                    <>
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-600 dark:text-slate-400">검증 중...</span>
                    </>
                  ) : isRunwareValid ? (
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
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">영상 설정</label>
              <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">SeeDance 1.0 Pro Fast</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">10초 영상, 720p 고정 • ₩195/영상</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 영상 생성 범위 설정 */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            영상 생성할 장면 수 (최대 180장)
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="range"
              min="0"
              max="180"
              value={Math.floor(videoGenerationRange / 10)}
              onChange={(e) => setVideoGenerationRange(parseInt(e.target.value) * 10)}
              className="flex-1 accent-indigo-600"
            />
            <input
              type="number"
              min="0"
              max="180"
              value={Math.floor(videoGenerationRange / 10)}
              onChange={(e) => setVideoGenerationRange(Math.max(0, Math.min(180, parseInt(e.target.value) || 0)) * 10)}
              className="w-20 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">장</span>
          </div>
        </div>

        {/* 비용 계산 */}
        {(() => {
          const { numScenes, costPerScene, totalCost } = calculateVideoCost();
          return (
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
                  💰 {numScenes}장 영상화 예정
                </p>
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                  ₩{totalCost.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-indigo-600 dark:text-indigo-400">
                  1장당 ₩{costPerScene.toLocaleString()} (10초 기준: {videoProvider === 'byteplus' ? '₩307' : videoProvider === 'evolink' ? '₩190' : '₩195'})
                </span>
                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
                  총 시간: {Math.floor(videoGenerationRange / 60)}분 {videoGenerationRange % 60}초
                </span>
              </div>
              {totalScenes > numScenes && (
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  📌 나머지 {totalScenes - numScenes}장은 정적 효과(무료)로 처리됩니다
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function SavedStylesPanel({
  savedStyles,
  onAddStyle,
  onDeleteStyle
}: {
  savedStyles: SavedStyle[];
  onAddStyle: (name: string, images: string[]) => Promise<void>;
  onDeleteStyle: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleImages, setNewStyleImages] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (e.target) e.target.value = '';
  };

  const handleAddClick = async () => {
    if (!newStyleName.trim()) {
      alert('그림체 이름을 입력해주세요.');
      return;
    }
    if (newStyleImages.length === 0) {
      alert('이미지를 최소 1장 이상 등록해주세요.');
      return;
    }
    if (savedStyles.length >= 10) {
      alert('자주 쓰는 그림체는 최대 10개까지 저장 가능합니다.');
      return;
    }

    setIsAdding(true);
    try {
      await onAddStyle(newStyleName, newStyleImages);
      setNewStyleName('');
      setNewStyleImages([]);
      alert('그림체가 저장되었습니다.');
    } catch (err) {
      alert('그림체 저장에 실패했습니다. Gemini API 키를 확인해주세요.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">저장된 그림체</h2>
        <p className="text-slate-600 dark:text-slate-400">자주 사용하는 그림체를 저장하고 불러올 수 있습니다. (최대 10개)</p>
      </div>

      {/* 새 그림체 추가 폼 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">새 그림체 추가</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">제목</label>
            <input
              type="text"
              value={newStyleName}
              onChange={e => setNewStyleName(e.target.value)}
              placeholder="예: 지브리 스타일, 수채화 풍경 등"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">레퍼런스 이미지 (최대 10장)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all"
            >
              + 이미지 선택
            </button>
            {newStyleImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3">
                {newStyleImages.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                    <img src={img} className="w-full h-full object-cover" alt="" />
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
            onClick={handleAddClick}
            disabled={!newStyleName.trim() || newStyleImages.length === 0 || isAdding}
            className="w-full py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? '저장 중...' : '그림체 저장'}
          </button>
        </div>
      </div>

      {/* 저장된 그림체 목록 */}
      {savedStyles.length === 0 ? (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-2">아직 저장된 그림체가 없습니다.</p>
          <p className="text-slate-500 dark:text-slate-500 text-sm">위 폼을 사용하여 그림체를 추가해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {savedStyles.map((style) => (
            <div key={style.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{style.name}</h3>
                <button
                  onClick={() => {
                    if (confirm(`"${style.name}" 그림체를 삭제하시겠습니까?`)) {
                      onDeleteStyle(style.id);
                    }
                  }}
                  className="text-red-500 hover:text-red-700 transition-colors"
                  title="삭제"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{style.description}</p>
              {style.refImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {style.refImages.slice(0, 4).map((img, idx) => (
                    <img key={idx} src={img} className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700" alt="" />
                  ))}
                  {style.refImages.length > 4 && (
                    <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                      +{style.refImages.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NarrationSettings({
  audioProvider,
  setAudioProvider,
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
  showAzureKey,
  onShowAzureKeyToggle,
  elSettings,
  setElSettings,
  isElConnected,
  voices,
  showElKey,
  onShowElKeyToggle,
  onVoiceTest,
  isVoiceTesting,
  wavUploadRef,
  onWavUpload,
  uploadedWavFile,
}: {
  audioProvider: 'google-chirp3' | 'google-neural2' | 'microsoft' | 'elevenlabs';
  setAudioProvider: (provider: 'google-chirp3' | 'google-neural2' | 'microsoft' | 'elevenlabs') => void;
  chirpVoice: string;
  setChirpVoice: (voice: string) => void;
  chirpSpeed: number;
  setChirpSpeed: (speed: number) => void;
  neural2Voice: string;
  setNeural2Voice: (voice: string) => void;
  standardVoice: string;
  setStandardVoice: (voice: string) => void;
  wavenetVoice: string;
  setWavenetVoice: (voice: string) => void;
  studioVoice: string;
  setStudioVoice: (voice: string) => void;
  azureApiKey: string;
  setAzureApiKey: (key: string) => void;
  azureVoice: string;
  setAzureVoice: (voice: string) => void;
  showAzureKey: boolean;
  onShowAzureKeyToggle: () => void;
  elSettings: ElevenLabsSettings;
  setElSettings: (settings: ElevenLabsSettings) => void;
  isElConnected: boolean;
  voices: any[];
  showElKey: boolean;
  onShowElKeyToggle: () => void;
  onVoiceTest: () => void;
  isVoiceTesting: boolean;
  wavUploadRef: React.RefObject<HTMLInputElement | null>;
  onWavUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedWavFile: { file: File; url: string } | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">나레이션 설정</h2>
        <p className="text-slate-600 dark:text-slate-400">TTS 음성 제공자와 음성 스타일을 선택하세요.</p>
      </div>

      {/* 목소리 모델 선택 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">목소리 모델</label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setAudioProvider('google-chirp3')}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              audioProvider === 'google-chirp3'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Chirp3 HD
          </button>
          <button
            onClick={() => setAudioProvider('google-neural2')}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              audioProvider === 'google-neural2'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Neural2
          </button>
          <button
            onClick={() => setAudioProvider('microsoft')}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              audioProvider === 'microsoft'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Azure TTS
          </button>
          <button
            onClick={() => setAudioProvider('elevenlabs')}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              audioProvider === 'elevenlabs'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            ElevenLabs
          </button>
        </div>
      </div>

      {/* Google Chirp3 설정 */}
      {audioProvider === 'google-chirp3' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Chirp 음성</label>
            <select
              value={chirpVoice}
              onChange={(e) => setChirpVoice(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">목소리 속도</label>
            <div className="flex gap-3 items-center">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={chirpSpeed}
                onChange={(e) => setChirpSpeed(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-600"
              />
              <input
                type="number"
                min="0.5"
                max="2.0"
                step="0.1"
                value={chirpSpeed}
                onChange={(e) => setChirpSpeed(Math.max(0.5, Math.min(2.0, parseFloat(e.target.value) || 1.0)))}
                className="w-20 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-center focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-slate-100"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">×</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">0.5 (느리게) ~ 2.0 (빠르게)</p>
          </div>
        </div>
      )}

      {/* Google Standard 설정 - REMOVED */}
      {audioProvider === 'google-neural2' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Neural2 음성</label>
            <select
              value={neural2Voice}
              onChange={(e) => setNeural2Voice(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="ko-KR-Neural2-A">Neural2-A - 표준 여성</option>
              <option value="ko-KR-Neural2-B">Neural2-B - 부드러운 여성</option>
              <option value="ko-KR-Neural2-C">Neural2-C - 자연스러운 남성</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">목소리 속도</label>
            <div className="flex gap-3 items-center">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={chirpSpeed}
                onChange={(e) => setChirpSpeed(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-600"
              />
              <input
                type="number"
                min="0.5"
                max="2.0"
                step="0.1"
                value={chirpSpeed}
                onChange={(e) => setChirpSpeed(Math.max(0.5, Math.min(2.0, parseFloat(e.target.value) || 1.0)))}
                className="w-20 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-center focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-slate-100"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">×</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">0.5 (느리게) ~ 2.0 (빠르게)</p>
          </div>
        </div>
      )}

      {/* Microsoft Azure 설정 */}
      {audioProvider === 'microsoft' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Azure API 키</label>
            <div className="relative">
              <input
                type={showAzureKey ? 'text' : 'password'}
                value={azureApiKey}
                onChange={(e) => setAzureApiKey(e.target.value)}
                placeholder="Azure Speech API 키 입력"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-slate-100"
              />
              <button
                onClick={onShowAzureKeyToggle}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showAzureKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">무료 티어: 월 500만 글자 (한국 서버)</p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">음성 선택</label>
            <select
              value={azureVoice}
              onChange={(e) => setAzureVoice(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <optgroup label="한국어 Neural">
                <option value="ko-KR-SunHiNeural">선희 (여성, 밝고 친근함)</option>
                <option value="ko-KR-InJoonNeural">인준 (남성, 차분하고 안정적)</option>
                <option value="ko-KR-BongJinNeural">봉진 (남성, 중후하고 신뢰감)</option>
                <option value="ko-KR-GookMinNeural">국민 (남성, 명확하고 자연스러움)</option>
              </optgroup>
            </select>
          </div>
        </div>
      )}

      {/* ElevenLabs 설정 */}
      {audioProvider === 'elevenlabs' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ElevenLabs API 키</label>
              {isElConnected && (
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="relative">
              <input
                type={showElKey ? 'text' : 'password'}
                value={elSettings.apiKey}
                onChange={(e) => setElSettings({ ...elSettings, apiKey: e.target.value })}
                placeholder="API 키 입력"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-slate-100"
              />
              <button
                onClick={onShowElKeyToggle}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showElKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            </div>
            {elSettings.apiKey.length > 10 && !isElConnected && voices.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                유효한 API 키를 입력하고 페이지를 새로고침하면 음성 목록이 로드됩니다.
              </p>
            )}
            {!isElConnected && elSettings.apiKey.length > 10 && (
              <p className="text-xs text-red-600 dark:text-red-400">
                API 키가 유효하지 않습니다. 확인 후 페이지를 새로고침하세요.
              </p>
            )}
          </div>
          {voices.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">음성 선택 ({voices.length}개 사용 가능)</label>
              <select
                value={elSettings.voiceId}
                onChange={(e) => setElSettings({ ...elSettings, voiceId: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {voices.length === 0 && elSettings.apiKey.length < 10 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              API 키를 입력하면 사용 가능한 음성 목록이 자동으로 표시됩니다.
            </p>
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">음성 속도: {elSettings.speed.toFixed(1)}x</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={elSettings.speed}
              onChange={(e) => setElSettings({ ...elSettings, speed: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>
      )}

      {/* 음성 테스트 버튼 */}
      <button
        onClick={onVoiceTest}
        disabled={isVoiceTesting}
        className="w-full py-3 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isVoiceTesting ? '테스트 중...' : '음성 테스트'}
      </button>

      {/* WAV 업로드 */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
        <input type="file" ref={wavUploadRef} accept=".wav,.mp3" className="hidden" onChange={onWavUpload} />
        <button
          onClick={() => wavUploadRef.current?.click()}
          className="w-full py-3 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-all"
        >
          WAV파일 업로드
        </button>
        {uploadedWavFile && <p className="text-xs text-green-600 dark:text-green-400">✓ {uploadedWavFile.file.name}</p>}
      </div>
    </div>
  );
}

function SavedCharactersPanel({
  savedCharacters,
  onAddCharacter,
  onDeleteCharacter
}: {
  savedCharacters: SavedCharacter[];
  onAddCharacter: (name: string, images: string[]) => Promise<void>;
  onDeleteCharacter: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newCharName, setNewCharName] = useState('');
  const [newCharImages, setNewCharImages] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (newCharImages.length + files.length > 10) {
      alert("인물 레퍼런스는 최대 10장까지 가능합니다.");
      return;
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCharImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

  const handleAddClick = async () => {
    if (!newCharName.trim()) {
      alert('인물 이름을 입력해주세요.');
      return;
    }
    if (newCharImages.length === 0) {
      alert('이미지를 최소 1장 이상 등록해주세요.');
      return;
    }
    if (savedCharacters.length >= 10) {
      alert('자주 사용하는 인물은 최대 10명까지 저장 가능합니다.');
      return;
    }

    setIsAdding(true);
    try {
      await onAddCharacter(newCharName, newCharImages);
      setNewCharName('');
      setNewCharImages([]);
      alert('인물이 저장되었습니다.');
    } catch (err) {
      alert('인물 저장에 실패했습니다. Gemini API 키를 확인해주세요.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">저장된 인물</h2>
        <p className="text-slate-600 dark:text-slate-400">자주 사용하는 캐릭터를 저장하고 불러올 수 있습니다. (최대 10개)</p>
      </div>

      {/* 새 인물 추가 폼 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">새 인물 추가</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">이름</label>
            <input
              type="text"
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
              placeholder="이름을 입력해주세요"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">레퍼런스 이미지 (최대 10장)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all"
            >
              + 이미지 선택
            </button>
            {newCharImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3">
                {newCharImages.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                    <img src={img} className="w-full h-full object-cover" alt="" />
                    <button
                      onClick={() => setNewCharImages(prev => prev.filter((_, i) => i !== idx))}
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
            onClick={handleAddClick}
            disabled={!newCharName.trim() || newCharImages.length === 0 || isAdding}
            className="w-full py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? '저장 중...' : '인물 저장'}
          </button>
        </div>
      </div>

      {/* 저장된 인물 목록 */}
      {savedCharacters.length === 0 ? (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-2">아직 저장된 인물이 없습니다.</p>
          <p className="text-slate-500 dark:text-slate-500 text-sm">위 폼을 사용하여 인물을 추가해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {savedCharacters.map((character) => (
            <div key={character.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4">
                {character.portraitUrl && (
                  <img src={character.portraitUrl} className="w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700" alt={character.name} />
                )}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{character.name}</h3>
                    <button
                      onClick={() => {
                        if (confirm(`"${character.name}" 인물을 삭제하시겠습니까?`)) {
                          onDeleteCharacter(character.id);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 transition-colors"
                      title="삭제"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{character.description}</p>
                  {character.refImages.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {character.refImages.slice(0, 3).map((img, idx) => (
                        <img key={idx} src={img} className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700" alt="" />
                      ))}
                      {character.refImages.length > 3 && (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                          +{character.refImages.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
