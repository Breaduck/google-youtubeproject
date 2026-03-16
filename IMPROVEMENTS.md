# 🔧 프로그램 개선 제안서 (시즌2 로드맵)

## 📊 현재 상태 분석

### ✅ 잘 구현된 기능
- AI 기반 스토리보드 자동 생성
- 맥락 기반 줌/패닝 효과 (방향, 속도 자동 조절)
- 비용 최적화 (짧은 대사 자동 병합)
- 캐릭터 일관성 유지 (참고 이미지)
- TTS 자동 싱크 (자막 길이 기반 시간 계산)
- 실시간 프로젝트 저장 (localStorage)

### 🚧 개선이 필요한 영역
1. **사용자 경험 (UX)**
2. **에러 처리 및 복구**
3. **성능 최적화**
4. **기능 확장**
5. **문서화 및 온보딩**

---

## 🎨 1. 사용자 경험 (UX) 개선

### 1.1 진행 상태 시각화 개선

**현재 문제:**
- 백그라운드 작업 중 사용자가 진행 상태를 명확히 알기 어려움
- "비디오 생성 중..."이 너무 오래 떠있으면 멈춘 것 같은 느낌

**개선 방안:**
```typescript
// 단계별 체크리스트 UI
✅ 스토리보드 생성 완료 (1/5)
🔄 이미지 생성 중... (23/120) - 19% 완료
⏳ 음성 생성 대기 중 (0/120)
⏳ 영상 생성 대기 중
⏳ 병합 대기 중

// 예상 소요 시간 표시
"예상 완료: 약 15분 후 (오후 3:42)"
```

**구현 위치:** `App.tsx` - 진행률 표시 컴포넌트 추가

---

### 1.2 실시간 미리보기

**현재 문제:**
- 이미지/음성이 생성되어야만 결과 확인 가능
- 마음에 안 들면 재생성 → 비용/시간 낭비

**개선 방안:**
```typescript
// 스토리보드 단계에서 미리보기
[장면 1] 텍스트 프롬프트:
"Anime character in office, discussing with colleague..."
↓
[미리보기 버튼] → 저해상도 임시 이미지 생성 (무료/빠름)
↓
확인 후 본 생성 or 프롬프트 수정
```

**구현 난이도:** 중
**예상 효과:** 재생성 50% 감소 → 비용 절감

---

### 1.3 인라인 도움말 (Tooltip)

**현재 문제:**
- 처음 사용자가 각 기능이 뭔지 모름
- 설정값의 의미를 이해하기 어려움

**개선 방안:**
```tsx
// 각 입력/버튼에 툴팁 추가
<button title="AI가 자동으로 대본을 분석하여 등장인물을 추출합니다">
  캐릭터 자동 추출
  <InfoIcon /> {/* hover시 설명 표시 */}
</button>

// 영상 생성 범위 슬라이더
<Tooltip content="처음 N장만 API 영상, 나머지는 줌/패닝 효과">
  영상 생성할 장면 수: [슬라이더]
</Tooltip>
```

**구현 위치:** 모든 주요 버튼/설정에 추가

---

### 1.4 키보드 단축키

**개선 방안:**
```
Ctrl + S: 프로젝트 저장
Ctrl + Enter: 다음 단계로 이동
Space: 미리보기 재생/일시정지
←/→: 이전/다음 장면
Delete: 선택한 장면 삭제
Ctrl + D: 장면 복제
```

**구현 난이도:** 쉬움
**예상 효과:** 작업 속도 30% 향상

---

## ⚠️ 2. 에러 처리 및 복구

### 2.1 API 실패 시 자동 재시도

**현재 문제:**
- 네트워크 일시적 오류 시 즉시 실패
- 사용자가 수동으로 재시도해야 함

**개선 방안:**
```typescript
async function generateWithRetry(fn: () => Promise<T>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // 지수 백오프 (1초, 2초, 4초)
      await sleep(1000 * Math.pow(2, i));
      console.log(`재시도 ${i + 1}/${maxRetries}...`);
    }
  }
}
```

**구현 위치:** `videoService.ts`, `geminiService.ts`

---

### 2.2 중단된 작업 복구

**현재 문제:**
- 브라우저 종료/새로고침 시 진행 중인 작업 손실
- 처음부터 다시 해야 함

**개선 방안:**
```typescript
// localStorage에 진행 상태 저장
interface WorkProgress {
  projectId: string;
  step: 'images' | 'audio' | 'videos';
  completedScenes: string[];
  timestamp: number;
}

// 페이지 로드 시 확인
if (savedProgress && Date.now() - savedProgress.timestamp < 3600000) {
  showModal("중단된 작업이 있습니다. 이어서 하시겠습니까?");
}
```

**예상 효과:** 사용자 불만 대폭 감소

---

### 2.3 친화적인 에러 메시지

**현재 문제:**
```
"Failed to generate image: HTTP 429"
→ 사용자가 이해 못함
```

**개선 방안:**
```typescript
const ERROR_MESSAGES = {
  'HTTP 429': '⚠️ API 호출 한도 초과\n\n무료 한도를 모두 사용했습니다.\n해결 방법:\n1. 24시간 후 재시도\n2. 유료 계정으로 전환',
  'HTTP 401': '🔑 API 키 오류\n\nAPI 키가 유효하지 않습니다.\n"내 페이지"에서 키를 다시 확인해주세요.',
  'Network Error': '🌐 네트워크 오류\n\n인터넷 연결을 확인하고\n다시 시도해주세요.',
};

throw new Error(ERROR_MESSAGES[errorType] || '알 수 없는 오류가 발생했습니다.');
```

**구현 위치:** 모든 API 호출 부분

---

## 🚀 3. 성능 최적화

### 3.1 이미지 캐싱

**현재 문제:**
- 동일한 프롬프트로 재생성 시에도 새로 생성
- 비용/시간 낭비

**개선 방안:**
```typescript
// IndexedDB에 생성된 이미지 캐싱
interface ImageCache {
  prompt: string;
  hash: string; // MD5 hash of prompt
  imageUrl: string;
  timestamp: number;
}

// 캐시 확인 → 있으면 재사용, 없으면 생성
const cachedImage = await getFromCache(promptHash);
if (cachedImage && Date.now() - cachedImage.timestamp < 7 * 24 * 3600000) {
  return cachedImage.imageUrl; // 7일간 유효
}
```

**예상 효과:** 재생성 비용 90% 절감

---

### 3.2 병렬 처리 최적화

**현재 문제:**
- 이미지/음성을 순차적으로 생성 (느림)

**개선 방안:**
```typescript
// 이미지 생성과 음성 생성 동시 진행
await Promise.all([
  generateAllImages(),
  generateAllAudios(), // 이미지 없어도 대사만으로 가능
]);

// 이미지 생성도 배치 처리 (5개씩)
const batches = chunk(scenes, 5);
for (const batch of batches) {
  await Promise.all(batch.map(scene => generateImage(scene)));
}
```

**예상 효과:** 전체 작업 시간 40% 단축

---

### 3.3 메모리 관리

**현재 문제:**
- 모든 비디오를 메모리에 로드 → 브라우저 크래시 가능 (100+ 장면)

**개선 방안:**
```typescript
// Blob URL 즉시 해제
URL.revokeObjectURL(oldVideoUrl);

// 큰 파일은 스트리밍 처리
const stream = new ReadableStream({
  start(controller) {
    // 청크 단위로 전송
  }
});
```

**구현 위치:** `videoService.ts` - mergeVideos 함수

---

## ✨ 4. 기능 확장

### 4.1 프로젝트 관리

**현재 상태:**
- localStorage에만 저장 (브라우저 캐시 삭제 시 손실)

**개선 방안:**
```typescript
// 프로젝트 내보내기/가져오기
exportProject() {
  const json = JSON.stringify(project);
  downloadFile('my-project.json', json);
}

importProject(file: File) {
  const project = JSON.parse(await file.text());
  loadProject(project);
}

// 클라우드 동기화 (선택)
syncToCloud() {
  // Google Drive API or Firebase
}
```

**예상 효과:** 데이터 손실 방지, 공유 가능

---

### 4.2 일괄 편집

**현재 문제:**
- 장면 하나씩만 수정 가능 → 100개 장면은 비효율적

**개선 방안:**
```typescript
// 다중 선택 + 일괄 작업
selectAll() → 전체 선택
bulkEdit({
  imagePrompt: "add 'sunset lighting' to all",
  intensity: 7, // 모든 장면 긴박도 7로
  regenerate: true, // 전체 재생성
});
```

**구현 난이도:** 중
**예상 효과:** 대량 수정 시간 90% 단축

---

### 4.3 템플릿 시스템

**개선 방안:**
```typescript
// 자주 쓰는 설정을 템플릿으로 저장
interface Template {
  name: string;
  style: StyleTemplate;
  subtitleSettings: SubtitleSettings;
  ttsVoice: string;
  videoRange: number;
}

// "유튜브 쇼츠용", "교육 영상용", "뉴스 영상용" 등
const templates = [
  { name: "유튜브 쇼츠", videoRange: 60, subtitleSettings: {...} },
  { name: "교육 콘텐츠", style: "realistic", ttsVoice: "Charon" },
];
```

**예상 효과:** 새 프로젝트 시작 시간 80% 단축

---

### 4.4 실시간 협업 (고급)

**개선 방안:**
```typescript
// WebSocket 또는 Firebase Realtime DB
onProjectUpdate((change) => {
  if (change.userId !== currentUser) {
    showNotification(`${change.userName}님이 장면 ${change.sceneId}를 수정했습니다`);
    updateScene(change.sceneId, change.data);
  }
});
```

**구현 난이도:** 매우 높음
**우선순위:** 낮음 (시즌3 고려)

---

## 📖 5. 문서화 및 온보딩

### 5.1 인터랙티브 튜토리얼

**개선 방안:**
```typescript
// 첫 방문 시 가이드 투어
const tutorial = [
  { target: "#api-key-input", message: "먼저 API 키를 입력하세요" },
  { target: "#script-input", message: "대본을 작성합니다" },
  { target: "#generate-storyboard", message: "스토리보드를 생성합니다" },
  // ...
];

// Shepherd.js 또는 Intro.js 라이브러리 사용
```

**예상 효과:** 사용자 이탈률 50% 감소

---

### 5.2 예제 프로젝트

**개선 방안:**
```typescript
// 샘플 프로젝트 제공
const sampleProjects = [
  {
    title: "뉴스 영상 예제",
    script: "오늘의 주요 뉴스입니다...",
    style: "news-report",
  },
  {
    title: "교육 콘텐츠 예제",
    script: "AI에 대해 알아봅시다...",
    style: "documentary",
  },
];

// "예제로 시작하기" 버튼
```

**예상 효과:** 빠른 학습, 즉시 결과 확인

---

### 5.3 비디오 튜토리얼

**개선 방안:**
- YouTube에 사용법 영상 업로드
- 프로그램 내에서 바로 재생 가능
- 각 기능별 짧은 클립 (30초-1분)

---

## 🎯 우선순위 로드맵

### 🔥 High Priority (시즌2 초반)
1. ✅ **친화적인 에러 메시지** (즉시 개선 가능)
2. ✅ **인라인 도움말/툴팁** (UX 대폭 향상)
3. ✅ **API 자동 재시도** (안정성 개선)
4. ✅ **진행 상태 시각화** (사용자 불안 해소)
5. ✅ **프로젝트 내보내기/가져오기** (데이터 보호)

### 🔶 Medium Priority (시즌2 중반)
6. ⏳ **이미지 캐싱** (비용 절감)
7. ⏳ **병렬 처리 최적화** (속도 향상)
8. ⏳ **키보드 단축키** (생산성)
9. ⏳ **템플릿 시스템** (편의성)
10. ⏳ **중단된 작업 복구** (안정성)

### 🔷 Low Priority (시즌2 후반/시즌3)
11. 📅 **실시간 미리보기** (복잡도 높음)
12. 📅 **일괄 편집** (고급 기능)
13. 📅 **인터랙티브 튜토리얼** (온보딩)
14. 📅 **클라우드 동기화** (인프라 필요)
15. 📅 **실시간 협업** (장기 과제)

---

## 🛠️ 즉시 적용 가능한 간단한 개선 (Quick Wins)

### 1. 로딩 스피너 개선
```tsx
// 현재: 단순 텍스트
"비디오 생성 중..."

// 개선: 애니메이션 + 상세 정보
<div className="loading-spinner">
  <div className="spinner-animation"></div>
  <p>비디오 생성 중... (23/120)</p>
  <p className="text-xs">예상 완료: 약 12분 후</p>
</div>
```

### 2. 성공 알림 개선
```tsx
// 현재: alert("완료!")

// 개선: 토스트 알림 + 다음 단계 제안
<Toast>
  ✅ 이미지 120장 생성 완료!
  <button>다음: 음성 생성하기 →</button>
</Toast>
```

### 3. 비용 실시간 표시
```tsx
// 스토리보드 생성 시 예상 비용 표시
<div className="cost-estimate">
  💰 예상 비용:
  이미지: ₩3,480 (120장)
  음성: ₩800
  영상: ₩3,240 (60장 API + 60장 효과)
  ---
  총: ₩7,520
</div>
```

### 4. 버전 정보 표시
```tsx
// 우측 하단에 작게
<div className="version-info">
  v1.0 (시즌1) | <a href="/changelog">변경 내역</a>
</div>
```

---

## 📊 예상 개선 효과

### 사용자 경험
- 학습 시간: 30분 → **10분** (튜토리얼/예제)
- 작업 완료율: 60% → **85%** (에러 복구)
- 사용자 만족도: 70% → **90%** (UX 개선)

### 성능
- 전체 작업 시간: 100% → **60%** (병렬 처리)
- 재생성 비용: 100% → **10%** (캐싱)
- 메모리 사용량: 100% → **40%** (최적화)

### 비용
- 불필요한 재생성: 100% → **20%** (미리보기)
- 중복 생성: 100% → **10%** (캐싱)

---

## 🎬 결론

**시즌1 완성 축하드립니다!** 🎉

현재 프로그램은 **핵심 기능이 완벽히 구현**되어 있습니다.
시즌2에서는 **사용자 경험**과 **안정성**에 집중하면,
진정한 프로덕션급 도구가 될 것입니다.

**다음 단계:**
1. USER_GUIDE.md를 README.md에 링크
2. Quick Wins부터 차근차근 개선
3. 사용자 피드백 수집
4. 우선순위에 따라 순차 적용

**화이팅! 🚀**
