import { useState, useEffect } from 'react';
import { SubtitleSettings } from '../types';
import SubtitleTemplateModal from './SubtitleTemplateModal';

type SettingTab = 'account' | 'gemini' | 'video-api' | 'subtitle' | 'narration' | 'saved-styles' | 'saved-characters';

interface FullscreenSettingsProps {
  onClose: () => void;
  geminiApiKey: string;
  onGeminiKeyChange: (key: string) => void;
  subtitleSettings: SubtitleSettings;
  onSubtitleChange: (settings: SubtitleSettings) => void;
  isLoggedIn: boolean;
  onLoginStateChange: (loggedIn: boolean) => void;
}

export default function FullscreenSettings({
  onClose,
  geminiApiKey,
  onGeminiKeyChange,
  subtitleSettings,
  onSubtitleChange,
  isLoggedIn,
  onLoginStateChange,
}: FullscreenSettingsProps) {
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
          {activeTab === 'gemini' && <GeminiSettings apiKey={geminiApiKey} onChange={onGeminiKeyChange} />}
          {activeTab === 'subtitle' && <SubtitleSettingsPanel settings={subtitleSettings} onChange={onSubtitleChange} />}
          {activeTab === 'account' && <AccountSettings isLoggedIn={isLoggedIn} onLoginStateChange={onLoginStateChange} />}
          {activeTab === 'video-api' && <VideoApiSettings />}
          {activeTab === 'narration' && <NarrationSettings />}
          {activeTab === 'saved-styles' && <SavedStylesPanel />}
          {activeTab === 'saved-characters' && <SavedCharactersPanel />}
        </div>
      </div>
    </div>
  );
}

// === 각 탭별 컴포넌트 ===

function GeminiSettings({ apiKey, onChange }: { apiKey: string; onChange: (key: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Gemini API 설정</h2>
        <p className="text-slate-600 dark:text-slate-400">이미지 생성 및 스크립트 분석에 사용됩니다.</p>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">API 키</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onChange(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm"
        >
          API 키 발급받기 →
        </a>
      </div>
    </div>
  );
}

function SubtitleSettingsPanel({ settings, onChange }: { settings: SubtitleSettings; onChange: (s: SubtitleSettings) => void }) {
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">자막 설정</h2>
          <p className="text-slate-600 dark:text-slate-400">영상에 표시될 자막 스타일을 설정합니다.</p>
        </div>
        <button
          onClick={() => setShowTemplateModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
          </svg>
          템플릿
        </button>
      </div>

      {showTemplateModal && (
        <SubtitleTemplateModal
          current={settings}
          onApply={(newSettings) => {
            onChange(newSettings);
            setShowTemplateModal(false);
          }}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

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

function VideoApiSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">영상화 API 설정</h2>
        <p className="text-slate-600 dark:text-slate-400">이미지를 영상으로 변환하는 API를 설정합니다.</p>
      </div>
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6">
        <p className="text-slate-700 dark:text-slate-300">현재 Provider: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">BytePlus ModelArk</span></p>
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
