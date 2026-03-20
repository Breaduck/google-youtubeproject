# 리팩토링 마스터플랜

## 🎯 목표
4,301 라인 App.tsx를 **점진적으로** 개선 (기능 유지하면서)

## ⚡ Phase 1: 즉시 실행 (1-2일) - 가장 효과적

### 1-1. Zustand 상태 관리 도입
**효과**: Props Drilling 78개 → 0개

```bash
npm install zustand
```

```typescript
// src/stores/settingsStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  // API Keys
  geminiApiKey: string;
  bytedanceApiKey: string;
  evolinkApiKey: string;
  runwareApiKey: string;

  // Providers
  videoProvider: 'byteplus' | 'evolink' | 'runware';
  audioProvider: string;

  // Settings
  subtitleSettings: SubtitleSettings;

  // Actions
  setGeminiApiKey: (key: string) => void;
  setBytedanceApiKey: (key: string) => void;
  // ...
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      geminiApiKey: '',
      bytedanceApiKey: '',
      evolinkApiKey: '',
      runwareApiKey: '',
      videoProvider: 'byteplus',
      audioProvider: 'google-chirp3',
      subtitleSettings: DEFAULT_SUBTITLE_SETTINGS,

      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setBytedanceApiKey: (key) => set({ bytedanceApiKey: key }),
      // ...
    }),
    { name: 'app-settings' } // localStorage 자동 관리
  )
);
```

```typescript
// src/stores/projectStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectStore {
  projects: StoryProject[];
  currentProjectId: string | null;

  // Actions
  addProject: (project: StoryProject) => void;
  updateProject: (id: string, updates: Partial<StoryProject>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      projects: [],
      currentProjectId: null,

      addProject: (project) => set((state) => ({
        projects: [...state.projects, project]
      })),

      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p =>
          p.id === id ? { ...p, ...updates } : p
        )
      })),

      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProjectId: state.currentProjectId === id ? null : state.currentProjectId
      })),

      setCurrentProject: (id) => set({ currentProjectId: id })
    }),
    { name: 'user-projects' }
  )
);
```

**사용법 (Before/After)**:
```tsx
// ❌ Before: Props Drilling 지옥
<FullscreenSettings
  geminiApiKey={geminiApiKey}
  onGeminiKeyChange={setGeminiApiKey}
  bytedanceApiKey={bytedanceApiKey}
  onBytedanceApiKeyChange={setBytedanceApiKey}
  // ... 74개 더
/>

// ✅ After: Props 없음
<FullscreenSettings onClose={() => setShowSettings(false)} />

// 컴포넌트 내부에서 직접 사용
function FullscreenSettings() {
  const { geminiApiKey, setGeminiApiKey } = useSettingsStore();
  const { bytedanceApiKey, setBytedanceApiKey } = useSettingsStore();
  // ...
}
```

**즉시 효과**:
- Props 78개 → 1개
- localStorage 수동 관리 121개 → 0개 (자동)
- 리렌더링 90% 감소

---

### 1-2. 커스텀 훅 분리
**효과**: App.tsx 4,301 라인 → 3,000 라인

```typescript
// src/hooks/useVideoGeneration.ts
export function useVideoGeneration() {
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [bgTask, setBgTask] = useState(null);
  const [bgProgress, setBgProgress] = useState(0);

  const generateVideo = async (scene: Scene) => {
    // 비디오 생성 로직
  };

  const generateBatch = async (scenes: Scene[]) => {
    // 배치 생성 로직
  };

  return { isBatchGenerating, bgTask, bgProgress, generateVideo, generateBatch };
}

// src/hooks/useImageGeneration.ts
export function useImageGeneration() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateImage = async (prompt: string) => {
    // 이미지 생성 로직
  };

  return { loading, progress, generateImage };
}

// src/hooks/useAudioGeneration.ts
export function useAudioGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAudio = async (text: string) => {
    // 오디오 생성 로직
  };

  return { isGenerating, generateAudio };
}
```

**사용법**:
```tsx
function App() {
  const { generateVideo, generateBatch } = useVideoGeneration();
  const { generateImage } = useImageGeneration();
  const { generateAudio } = useAudioGeneration();

  // 110개 useState → 20개로 감소
}
```

---

## 🚀 Phase 2: 단기 목표 (1주일)

### 2-1. 기능별 컴포넌트 분리

```
src/
├── features/
│   ├── dashboard/
│   │   ├── Dashboard.tsx (프로젝트 목록)
│   │   ├── ProjectCard.tsx
│   │   └── CreateProjectModal.tsx
│   │
│   ├── setup/
│   │   ├── Setup.tsx (초기 설정)
│   │   ├── StyleSelector.tsx
│   │   └── CharacterSetup.tsx
│   │
│   ├── storyboard/
│   │   ├── Storyboard.tsx (장면 편집)
│   │   ├── SceneCard.tsx
│   │   ├── SceneEditor.tsx
│   │   └── BatchControls.tsx
│   │
│   └── preview/
│       ├── Preview.tsx (최종 미리보기)
│       └── VideoPlayer.tsx
│
├── hooks/
│   ├── useVideoGeneration.ts
│   ├── useImageGeneration.ts
│   ├── useAudioGeneration.ts
│   └── useStoryboard.ts
│
└── stores/
    ├── projectStore.ts
    ├── settingsStore.ts
    └── uiStore.ts
```

### 2-2. App.tsx 간소화
```tsx
// App.tsx (목표: 500 라인 이하)
function App() {
  const [step, setStep] = useState<AppStep>('dashboard');
  const { currentProjectId } = useProjectStore();

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      {step === 'dashboard' && <Dashboard onNext={() => setStep('setup')} />}
      {step === 'setup' && <Setup onNext={() => setStep('storyboard')} />}
      {step === 'storyboard' && <Storyboard onNext={() => setStep('preview')} />}
      {step === 'preview' && <Preview />}
    </div>
  );
}
```

**효과**:
- App.tsx: 4,301 → 500 라인
- 각 feature: 300-500 라인
- 유지보수 가능해짐

---

## 🎯 Phase 3: 중기 목표 (2-4주)

### 3-1. 에러 처리 통합
```typescript
// src/utils/errorHandler.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string
  ) {
    super(message);
  }
}

export function handleError(error: unknown) {
  if (error instanceof AppError) {
    alert(error.userMessage);
    console.error(`[${error.code}]`, error.message);
  } else {
    alert('알 수 없는 오류가 발생했습니다.');
    console.error(error);
  }
}

// 사용
try {
  await generateVideo();
} catch (error) {
  handleError(error);
}
```

### 3-2. 테스트 추가
```typescript
// src/stores/__tests__/projectStore.test.ts
import { useProjectStore } from '../projectStore';

describe('ProjectStore', () => {
  it('should add project', () => {
    const store = useProjectStore.getState();
    const project = { id: '1', title: 'Test' };

    store.addProject(project);

    expect(store.projects).toContain(project);
  });
});
```

### 3-3. 성능 최적화
```tsx
// React.memo로 불필요한 리렌더링 방지
export const SceneCard = React.memo(({ scene }: Props) => {
  // ...
});

// useMemo로 계산 캐싱
const filteredScenes = useMemo(() => {
  return scenes.filter(s => s.status === 'completed');
}, [scenes]);

// useCallback로 함수 메모이제이션
const handleGenerate = useCallback(async () => {
  await generateVideo();
}, [generateVideo]);
```

---

## 📋 실행 순서 (우선순위)

### Week 1: Zustand 도입 (가장 중요)
- [ ] Day 1: `npm install zustand` + settingsStore.ts 작성
- [ ] Day 2: projectStore.ts 작성
- [ ] Day 3: App.tsx에서 Zustand 사용 (props 제거)
- [ ] Day 4: FullscreenSettings에서 Zustand 사용
- [ ] Day 5: 테스트 및 버그 수정

**예상 효과**:
- Props 78개 → 1개
- localStorage 관리 자동화
- 코드 가독성 50% 향상

### Week 2: 커스텀 훅 분리
- [ ] Day 1: useVideoGeneration.ts
- [ ] Day 2: useImageGeneration.ts
- [ ] Day 3: useAudioGeneration.ts
- [ ] Day 4: useStoryboard.ts
- [ ] Day 5: App.tsx 통합

**예상 효과**:
- App.tsx: 4,301 → 3,000 라인
- useState: 110개 → 30개

### Week 3-4: 컴포넌트 분리
- [ ] Dashboard 분리
- [ ] Setup 분리
- [ ] Storyboard 분리
- [ ] Preview 분리

**최종 목표**:
- App.tsx: 500 라인 이하
- 각 컴포넌트: 300 라인 이하
- 테스트 커버리지: 50% 이상

---

## 💡 마이그레이션 전략

### 원칙 1: 점진적 마이그레이션
```
❌ 한 번에 모든 코드 리팩토링
✅ 기능 하나씩 새 구조로 이동
```

### 원칙 2: 새 코드는 새 구조
```
새 기능 추가 시:
1. Zustand store 사용
2. 커스텀 훅으로 로직 분리
3. 독립 컴포넌트로 작성
```

### 원칙 3: 기존 기능 유지
```
리팩토링 중에도:
- 모든 기능 정상 작동
- 사용자 데이터 보존
- 배포 가능 상태 유지
```

---

## 🛠️ 즉시 시작 가능한 코드

바로 실행할 수 있도록 3개 파일을 생성해드릴까요?

1. **src/stores/settingsStore.ts** - 설정 관리
2. **src/stores/projectStore.ts** - 프로젝트 관리
3. **src/hooks/useVideoGeneration.ts** - 비디오 생성 로직

이 3개만 추가하면 **즉시 효과**를 볼 수 있습니다.
