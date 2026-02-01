# 🔍 "Failed to fetch" 에러 디버깅 가이드

## 에러 발생 위치

**증상:** "동영상 생성 중 오류가 발생했습니다: TypeError: Failed to fetch"

**발생 시점:** "동영상 추출" 버튼 클릭 시

---

## 🎯 디버깅 순서

### Step 1: 브라우저 콘솔 확인

1. **F12** 키 눌러서 개발자 도구 열기
2. **Console** 탭 선택
3. 에러 메시지 확인:

```javascript
// 확인할 내용:
[LTX] generateSceneVideo called
[LTX] Dialogue: ...
[LTX] Generating emotion-based motion prompt via Gemini...
// ↑ 여기서 멈췄다면: Gemini API 문제
// ↓ 여기까지 왔다면: Modal API 문제
[LTX] Gemini motion prompt: ...
[LTX] Calling Modal API: ...
[LTX] Modal API response: ...
```

**Case A: Gemini에서 멈춤**
```
에러: "Gemini API key is required" 또는 401 Unauthorized
해결: Gemini API key 설정 필요
```

**Case B: Modal 호출 실패**
```
에러: "Failed to fetch" at Modal API call
해결: Modal 엔드포인트 확인 필요
```

---

### Step 2: Gemini API Key 확인

**확인 방법:**
1. F12 → Console 탭
2. 다음 입력:
```javascript
localStorage.getItem('gemini_api_key')
```

**결과:**
- `null` 또는 `""` → **API key 없음!**
- `"AI..."` → API key 있음 (정상)

**API Key 설정:**
```javascript
localStorage.setItem('gemini_api_key', 'YOUR_GEMINI_API_KEY');
// 페이지 새로고침
```

---

### Step 3: Modal 엔드포인트 테스트

**브라우저 콘솔에서 직접 테스트:**

```javascript
// Health check
fetch('https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run/health')
  .then(res => res.json())
  .then(data => console.log('Health:', data))
  .catch(err => console.error('Health failed:', err));

// 결과:
// 성공: {status: "healthy"}
// 실패: Failed to fetch → Modal 문제
```

---

### Step 4: 캐시 삭제 & 강제 새로고침

**방법:**
```
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)
```

**또는:**
```
1. F12 → Network 탭
2. "Disable cache" 체크
3. 페이지 새로고침
```

---

## 💡 가능한 원인 & 해결책

### 원인 1: Gemini API Key 없음 ⭐ 가능성 높음
```
증상: 콘솔에 "Gemini API key is required" 에러
해결:
1. Gemini API key 발급 (https://aistudio.google.com/app/apikey)
2. localStorage에 저장:
   localStorage.setItem('gemini_api_key', 'YOUR_KEY');
3. 페이지 새로고침
```

### 원인 2: Cloudflare 배포 미완료
```
증상: GitHub push 직후 (1-2분 내)
해결: 2-3분 기다린 후 재시도
```

### 원인 3: 브라우저 캐시
```
증상: 구 버전 코드 실행 중
해결: Ctrl+Shift+R (강제 새로고침)
```

### 원인 4: Modal 타임아웃
```
증상: 오래 걸리다가 실패
해결: Modal timeout 설정 확인 (현재 3600초)
```

---

## 🧪 테스트용 간단 확인

**콘솔에서 실행:**

```javascript
// 1. Gemini API key 확인
console.log('Gemini API Key:', localStorage.getItem('gemini_api_key') ? 'SET' : 'NOT SET');

// 2. Modal health check
fetch('https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run/health')
  .then(res => res.json())
  .then(data => console.log('✅ Modal:', data))
  .catch(err => console.error('❌ Modal:', err));

// 3. 전체 생성 테스트 (이미지 URL 필요)
const testImage = 'YOUR_IMAGE_URL'; // 변경 필요
const testPrompt = 'Cinematic 2D Anime style, clean lines, flat shading. Medium shot with character.';

fetch('https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: testPrompt,
    image_url: testImage,
    num_frames: 97
  })
})
.then(res => {
  console.log('Status:', res.status);
  return res.blob();
})
.then(blob => {
  console.log('✅ Success! Size:', blob.size);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test.mp4';
  a.click();
})
.catch(err => console.error('❌ Failed:', err));
```

---

## 🎯 가장 가능성 높은 원인

**90% 확률: Gemini API Key 없음**

```javascript
// 확인
localStorage.getItem('gemini_api_key')
// null 이면 → 설정 필요

// 설정
localStorage.setItem('gemini_api_key', 'YOUR_ACTUAL_GEMINI_API_KEY');
location.reload();
```

---

## 📞 추가 정보 필요

**에러 발생 시 알려주실 정보:**

1. **브라우저 콘솔 에러 메시지 전체**
   - F12 → Console 탭
   - 빨간색 에러 메시지 복사

2. **Network 탭 확인**
   - F12 → Network 탭
   - "동영상 추출" 클릭
   - 실패한 요청 클릭
   - Status code, Response 확인

3. **어느 단계에서 멈췄는지**
   - Gemini 프롬프트 생성 중?
   - Modal API 호출 중?
   - 비디오 다운로드 중?

---

**가장 먼저 Gemini API Key 확인하세요!** 🔑
