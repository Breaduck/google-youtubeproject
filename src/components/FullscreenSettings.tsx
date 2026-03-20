import { useState, useEffect } from 'react';
import { SubtitleSettings } from '../types';
import { TEMPLATES } from './SubtitleTemplateModal';

type SettingTab = 'account' | 'gemini' | 'video-api' | 'subtitle' | 'narration' | 'saved-styles' | 'saved-characters';

interface FullscreenSettingsProps {
  onClose: () => void;
  geminiApiKey: string;
  onGeminiKeyChange: (key: string) => void;
  subtitleSettings: SubtitleSettings;
  onSubtitleChange: (settings: SubtitleSettings) => void;
  isLoggedIn: boolean;
  onLoginStateChange: (loggedIn: boolean) => void;

  // Gemini API settings
  geminiModel: string;
  onGeminiModelChange: (model: string) => void;
  geminiImageModel: string;
  onGeminiImageModelChange: (model: string) => void;
  isGeminiValid: boolean;
  isValidatingGemini: boolean;
  onCheckGeminiKey: (key: string) => void;

  // Video API settings
  videoProvider: 'byteplus' | 'evolink' | 'runware';
  onVideoProviderChange: (provider: 'byteplus' | 'evolink' | 'runware') => void;
  bytedanceApiKey: string;
  onBytedanceApiKeyChange: (key: string) => void;
  bytedanceModel: string;
  onBytedanceModelChange: (model: string) => void;
  evolinkApiKey: string;
  onEvolinkApiKeyChange: (key: string) => void;
  evolinkResolution: string;
  onEvolinkResolutionChange: (resolution: string) => void;
  evolinkDuration: number;
  onEvolinkDurationChange: (duration: number) => void;
  runwareResolution: string;
  onRunwareResolutionChange: (resolution: string) => void;
  runwareDuration: number;
  onRunwareDurationChange: (duration: number) => void;
  videoGenerationRange: number;
  onVideoGenerationRangeChange: (range: number) => void;
  calculateVideoCost: () => { numScenes: number; costPerScene: number; totalCost: number };
  totalScenes: number;
}

export default function FullscreenSettings(props: FullscreenSettingsProps) {
  const {
    onClose,
    geminiApiKey,
    onGeminiKeyChange,
    subtitleSettings,
    onSubtitleChange,
    isLoggedIn,
    onLoginStateChange,
    geminiModel,
    onGeminiModelChange,
    geminiImageModel,
    onGeminiImageModelChange,
    isGeminiValid,
    isValidatingGemini,
    onCheckGeminiKey,
    videoProvider,
    onVideoProviderChange,
    bytedanceApiKey,
    onBytedanceApiKeyChange,
    bytedanceModel,
    onBytedanceModelChange,
    evolinkApiKey,
    onEvolinkApiKeyChange,
    evolinkResolution,
    onEvolinkResolutionChange,
    evolinkDuration,
    onEvolinkDurationChange,
    runwareResolution,
    onRunwareResolutionChange,
    runwareDuration,
    onRunwareDurationChange,
    videoGenerationRange,
    onVideoGenerationRangeChange,
    calculateVideoCost,
    totalScenes,
  } = props;
  const [activeTab, setActiveTab] = useState<SettingTab>('gemini');

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
    { id: 'subtitle' as SettingTab, icon: '📝', label: '자막 설정', badge: subtitleSettings.fontFamily },
    { id: 'narration' as SettingTab, icon: '🎙️', label: '나레이션', badge: 'Chirp3 HD' },
    { id: 'saved-styles' as SettingTab, icon: '🎨', label: '저장된 그림체', badge: '0/10' },
    { id: 'saved-characters' as SettingTab, icon: '👥', label: '저장된 인물', badge: '0/10' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex">
      {/* 좌측 사이드바 */}
      <div className="w-64 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        {/* 헤더 */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">설정</h1>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
            >
              축소
            </button>
          </div>
        </div>

        {/* 메뉴 리스트 */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full px-6 py-3 flex items-center gap-3 transition-colors ${
                activeTab === item.id
                  ? 'bg-indigo-600/20 border-l-2 border-indigo-500 text-indigo-700 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="flex-1 text-left font-medium">{item.label}</span>
              <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full">{item.badge}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 우측 콘텐츠 */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto p-8">
          {activeTab === 'gemini' && (
            <GeminiSettings
              apiKey={geminiApiKey}
              onChange={onGeminiKeyChange}
              geminiModel={geminiModel}
              onGeminiModelChange={onGeminiModelChange}
              geminiImageModel={geminiImageModel}
              onGeminiImageModelChange={onGeminiImageModelChange}
              isGeminiValid={isGeminiValid}
              isValidatingGemini={isValidatingGemini}
              onCheckGeminiKey={onCheckGeminiKey}
            />
          )}
          {activeTab === 'subtitle' && <SubtitleSettingsPanel settings={subtitleSettings} onChange={onSubtitleChange} />}
          {activeTab === 'account' && <AccountSettings isLoggedIn={isLoggedIn} onLoginStateChange={onLoginStateChange} />}
          {activeTab === 'video-api' && (
            <VideoApiSettings
              videoProvider={videoProvider}
              onVideoProviderChange={onVideoProviderChange}
              bytedanceApiKey={bytedanceApiKey}
              onBytedanceApiKeyChange={onBytedanceApiKeyChange}
              bytedanceModel={bytedanceModel}
              onBytedanceModelChange={onBytedanceModelChange}
              evolinkApiKey={evolinkApiKey}
              onEvolinkApiKeyChange={onEvolinkApiKeyChange}
              evolinkResolution={evolinkResolution}
              onEvolinkResolutionChange={onEvolinkResolutionChange}
              evolinkDuration={evolinkDuration}
              onEvolinkDurationChange={onEvolinkDurationChange}
              runwareResolution={runwareResolution}
              onRunwareResolutionChange={onRunwareResolutionChange}
              runwareDuration={runwareDuration}
              onRunwareDurationChange={onRunwareDurationChange}
              videoGenerationRange={videoGenerationRange}
              onVideoGenerationRangeChange={onVideoGenerationRangeChange}
              calculateVideoCost={calculateVideoCost}
              totalScenes={totalScenes}
            />
          )}
          {activeTab === 'narration' && <NarrationSettings />}
          {activeTab === 'saved-styles' && <SavedStylesPanel />}
          {activeTab === 'saved-characters' && <SavedCharactersPanel />}
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
  onGeminiModelChange,
  geminiImageModel,
  onGeminiImageModelChange,
  isGeminiValid,
  isValidatingGemini,
  onCheckGeminiKey,
}: {
  apiKey: string;
  onChange: (key: string) => void;
  geminiModel: string;
  onGeminiModelChange: (model: string) => void;
  geminiImageModel: string;
  onGeminiImageModelChange: (model: string) => void;
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

          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm mt-2"
          >
            API 키 발급받기 →
          </a>
        </div>

        {/* 기본 Gemini 엔진 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            기본 Gemini 엔진 (대본/프롬프트 생성)
          </label>
          <select
            value={geminiModel}
            onChange={(e) => onGeminiModelChange(e.target.value)}
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
            onChange={(e) => onGeminiImageModelChange(e.target.value)}
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

function SubtitleSettingsPanel({ settings, onChange }: { settings: SubtitleSettings; onChange: (s: SubtitleSettings) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');

  const categories = ['전체', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];
  const filteredTemplates = selectedCategory === '전체' ? TEMPLATES : TEMPLATES.filter(t => t.category === selectedCategory);

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    onChange({ ...settings, ...template.settings });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">자막 설정</h2>
        <p className="text-slate-600 dark:text-slate-400">영상에 표시될 자막 스타일을 설정합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 좌측: 설정 */}
        <div className="space-y-4">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">폰트</label>
              <select
                value={settings.fontFamily}
                onChange={(e) => onChange({ ...settings, fontFamily: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="Pretendard">Pretendard</option>
                <option value="Noto Sans KR">Noto Sans KR</option>
                <option value="Nanum Gothic">나눔고딕</option>
              </select>
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

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">텍스트 색상</label>
              <input
                type="color"
                value={settings.textColor}
                onChange={(e) => onChange({ ...settings, textColor: e.target.value })}
                className="w-full h-12 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">외곽선 두께: {settings.strokeWidth}px</label>
              <input
                type="range"
                min="0"
                max="10"
                value={settings.strokeWidth}
                onChange={(e) => onChange({ ...settings, strokeWidth: parseInt(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">외곽선 색상</label>
              <input
                type="color"
                value={settings.strokeColor}
                onChange={(e) => onChange({ ...settings, strokeColor: e.target.value })}
                className="w-full h-12 rounded-lg cursor-pointer"
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
                  <input
                    type="color"
                    value={settings.backgroundColor}
                    onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                    className="w-full h-12 rounded-lg cursor-pointer mb-2"
                  />
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
                    className="w-full accent-indigo-600"
                  />
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">수직 위치: {settings.yPosition}px</label>
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

        {/* 우측: 미리보기 */}
        <div>
          <div className="bg-slate-900 dark:bg-slate-800 rounded-xl p-6 aspect-video flex items-center justify-center relative">
            <div className="relative inline-block" style={{ opacity: settings.opacity }}>
              {settings.backgroundColor && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: settings.backgroundColor,
                    opacity: settings.bgOpacity,
                    padding: `${settings.bgPadding}px`,
                    marginLeft: `-${settings.bgPadding}px`,
                    marginRight: `-${settings.bgPadding}px`,
                    marginTop: `-${settings.bgPadding}px`,
                    marginBottom: `-${settings.bgPadding}px`,
                    borderRadius: '8px',
                  }}
                />
              )}
              <p
                className="relative"
                style={{
                  fontFamily: settings.fontFamily,
                  fontSize: `${Math.min(settings.fontSize, 48)}px`,
                  color: settings.textColor,
                  letterSpacing: `${settings.letterSpacing}px`,
                  lineHeight: settings.lineHeight,
                  WebkitTextStroke: settings.strokeWidth > 0 ? `${settings.strokeWidth}px ${settings.strokeColor}` : undefined,
                }}
              >
                자막 미리보기
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 템플릿 선택 (하단) */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">템플릿 (30개)</h3>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 템플릿 그리드 */}
        <div className="grid grid-cols-5 gap-3">
          {filteredTemplates.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => applyTemplate(tmpl)}
              className="aspect-video bg-slate-900 dark:bg-slate-800 rounded-lg flex items-center justify-center p-3 hover:ring-2 hover:ring-indigo-500 transition-all"
            >
              <span
                className="text-xs font-bold text-center"
                style={{
                  color: tmpl.settings.textColor,
                  WebkitTextStroke: tmpl.settings.strokeWidth && tmpl.settings.strokeWidth > 0
                    ? `${Math.max(1, tmpl.settings.strokeWidth / 2)}px ${tmpl.settings.strokeColor}`
                    : undefined,
                }}
              >
                {tmpl.name}
              </span>
            </button>
          ))}
        </div>
      </div>
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
        <p className="text-slate-600 dark:text-slate-400">로그인하여 클라우드 동기화 기능을 사용하세요.</p>
      </div>

      {isLoggedIn ? (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {currentUser?.username?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{currentUser?.username}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{currentUser?.email}</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('currentUser');
              onLoginStateChange(false);
              alert('로그아웃되었습니다.');
            }}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            로그아웃
          </button>
        </div>
      ) : (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-8">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              회원가입
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">아이디</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              {mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoApiSettings({
  videoProvider,
  onVideoProviderChange,
  bytedanceApiKey,
  onBytedanceApiKeyChange,
  bytedanceModel,
  onBytedanceModelChange,
  evolinkApiKey,
  onEvolinkApiKeyChange,
  evolinkResolution,
  onEvolinkResolutionChange,
  evolinkDuration,
  onEvolinkDurationChange,
  runwareResolution,
  onRunwareResolutionChange,
  runwareDuration,
  onRunwareDurationChange,
  videoGenerationRange,
  onVideoGenerationRangeChange,
  calculateVideoCost,
  totalScenes,
}: {
  videoProvider: 'byteplus' | 'evolink' | 'runware';
  onVideoProviderChange: (provider: 'byteplus' | 'evolink' | 'runware') => void;
  bytedanceApiKey: string;
  onBytedanceApiKeyChange: (key: string) => void;
  bytedanceModel: string;
  onBytedanceModelChange: (model: string) => void;
  evolinkApiKey: string;
  onEvolinkApiKeyChange: (key: string) => void;
  evolinkResolution: string;
  onEvolinkResolutionChange: (resolution: string) => void;
  evolinkDuration: number;
  onEvolinkDurationChange: (duration: number) => void;
  runwareResolution: string;
  onRunwareResolutionChange: (resolution: string) => void;
  runwareDuration: number;
  onRunwareDurationChange: (duration: number) => void;
  videoGenerationRange: number;
  onVideoGenerationRangeChange: (range: number) => void;
  calculateVideoCost: () => { numScenes: number; costPerScene: number; totalCost: number };
  totalScenes: number;
}) {
  const [showBytedanceKey, setShowBytedanceKey] = useState(false);
  const [showEvolinkKey, setShowEvolinkKey] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">영상화 API 설정</h2>
        <p className="text-slate-600 dark:text-slate-400">이미지를 영상으로 변환하는 API를 설정합니다.</p>
      </div>

      {/* Provider 선택 */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Provider 선택</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onVideoProviderChange('byteplus')}
              className={`p-4 rounded-lg border-2 transition-all ${
                videoProvider === 'byteplus'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
              }`}
            >
              <div className="text-center">
                <p className="font-semibold text-slate-900 dark:text-slate-100">BytePlus</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">₩54/10초</p>
              </div>
            </button>
            <button
              onClick={() => onVideoProviderChange('evolink')}
              className={`p-4 rounded-lg border-2 transition-all ${
                videoProvider === 'evolink'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
              }`}
            >
              <div className="text-center">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Evolink</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">₩203/5초</p>
              </div>
            </button>
            <button
              onClick={() => onVideoProviderChange('runware')}
              className={`p-4 rounded-lg border-2 transition-all ${
                videoProvider === 'runware'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
              }`}
            >
              <div className="text-center">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Runware</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">₩203/5초</p>
              </div>
            </button>
          </div>
        </div>

        {/* BytePlus 설정 */}
        {videoProvider === 'byteplus' && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">모델</label>
              <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">SeeDance 1.0 Pro Fast</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">10초 영상, 720p 고정</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">BytePlus API 키</label>
              <div className="relative">
                <input
                  type={showBytedanceKey ? 'text' : 'password'}
                  value={bytedanceApiKey}
                  onChange={(e) => onBytedanceApiKeyChange(e.target.value)}
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
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">BytePlus ModelArk에서 API 키를 발급받으세요</p>
            </div>
          </div>
        )}

        {/* Evolink 설정 */}
        {videoProvider === 'evolink' && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Evolink API 키</label>
              <div className="relative">
                <input
                  type={showEvolinkKey ? 'text' : 'password'}
                  value={evolinkApiKey}
                  onChange={(e) => onEvolinkApiKeyChange(e.target.value)}
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
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">해상도</label>
              <select
                value={evolinkResolution}
                onChange={(e) => onEvolinkResolutionChange(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">영상 길이: {evolinkDuration}초</label>
              <input
                type="range"
                min="3"
                max="10"
                value={evolinkDuration}
                onChange={(e) => onEvolinkDurationChange(parseInt(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        )}

        {/* Runware 설정 */}
        {videoProvider === 'runware' && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">해상도</label>
              <select
                value={runwareResolution}
                onChange={(e) => onRunwareResolutionChange(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">영상 길이: {runwareDuration}초</label>
              <input
                type="range"
                min="3"
                max="10"
                value={runwareDuration}
                onChange={(e) => onRunwareDurationChange(parseInt(e.target.value))}
                className="w-full accent-indigo-600"
              />
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
              onChange={(e) => onVideoGenerationRangeChange(parseInt(e.target.value) * 10)}
              className="flex-1 accent-indigo-600"
            />
            <input
              type="number"
              min="0"
              max="180"
              value={Math.floor(videoGenerationRange / 10)}
              onChange={(e) => onVideoGenerationRangeChange(Math.max(0, Math.min(180, parseInt(e.target.value) || 0)) * 10)}
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
                  {videoProvider === 'byteplus' ? '10초' : '5초'} 영상 생성에 1장당 ₩{costPerScene.toLocaleString()}
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

function NarrationSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">나레이션 설정</h2>
        <p className="text-slate-600 dark:text-slate-400">음성 합성(TTS) 엔진을 설정합니다.</p>
      </div>
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6">
        <p className="text-slate-700 dark:text-slate-300">현재 엔진: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Chirp3 HD</span></p>
      </div>
    </div>
  );
}

function SavedStylesPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">저장된 그림체</h2>
        <p className="text-slate-600 dark:text-slate-400">자주 사용하는 그림체를 저장하고 불러올 수 있습니다. (최대 10개)</p>
      </div>
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-600 dark:text-slate-400 mb-4">저장된 그림체가 없습니다.</p>
        <p className="text-slate-500 dark:text-slate-500 text-sm mb-6">유튜브 링크를 분석하거나 직접 스타일을 저장하세요.</p>
        <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
          새 그림체 추가
        </button>
      </div>
    </div>
  );
}

function SavedCharactersPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">저장된 인물</h2>
        <p className="text-slate-600 dark:text-slate-400">자주 사용하는 캐릭터를 저장하고 불러올 수 있습니다. (최대 10개)</p>
      </div>
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-12 text-center">
        <p className="text-slate-600 dark:text-slate-400 mb-4">저장된 인물이 없습니다.</p>
        <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
          새 인물 추가
        </button>
      </div>
    </div>
  );
}
