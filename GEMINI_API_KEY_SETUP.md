# 🔑 Gemini API Key 설정 (필수!)

## 문제 원인

**CORS 에러의 진짜 원인:**
```
Access to fetch at '...modal.run/generate' has been blocked by CORS policy
```

실제로는 **Gemini API key가 없어서** Modal API 호출 전에 에러가 발생한 것입니다.

---

## ✅ 즉시 해결 방법

### 1단계: Gemini API Key 발급

**URL:** https://aistudio.google.com/app/apikey

1. Google 계정으로 로그인
2. "Create API Key" 버튼 클릭
3. API key 복사 (AIza... 형식)

---

### 2단계: 브라우저에서 설정

**웹사이트 접속:**
```
https://google-youtubeproject.hiyoonsh1.workers.dev
```

**F12 → Console 탭에서 실행:**
```javascript
localStorage.setItem('gemini_api_key', 'YOUR_ACTUAL_API_KEY_HERE');
console.log('✅ Gemini API key set!');
```

**예시:**
```javascript
localStorage.setItem('gemini_api_key', 'AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
console.log('✅ Gemini API key set!');
```

---

### 3단계: 페이지 새로고침

```javascript
location.reload();
```

또는 **F5** 키로 새로고침

---

## 🧪 테스트 페이지에서도 동일하게 설정

`test-quality.html` 파일을 사용할 경우:

1. **파일을 브라우저로 열기**
   ```
   C:\Users\hiyoo\OneDrive\바탕 화면\video-saas\test-quality.html
   ```

2. **F12 → Console 탭에서 API key 설정**
   ```javascript
   localStorage.setItem('gemini_api_key', 'YOUR_ACTUAL_API_KEY_HERE');
   ```

3. **페이지 새로고침** (F5)

---

## 🔍 설정 확인

```javascript
// API key 확인
console.log('Gemini API Key:', localStorage.getItem('gemini_api_key'));

// 결과:
// ✅ "AIza..." → 설정됨
// ❌ null → 설정 안됨 (위의 2단계 다시 실행)
```

---

## ⚠️ 주의사항

### localStorage는 도메인별로 저장됨

```
메인 사이트: https://google-youtubeproject.hiyoonsh1.workers.dev
테스트 페이지: file:/// (로컬 파일)
```

→ **각각 따로 설정해야 함!**

**메인 사이트에서 테스트 → 메인 사이트에서 API key 설정**
**test-quality.html 사용 → 파일 열고 나서 API key 설정**

---

## 🎯 설정 후 예상 동작

### BEFORE (API key 없음)
```javascript
[LTX] generateSceneVideo called
[LTX] Dialogue: 너무 슬퍼...
[LTX] Generating emotion-based motion prompt via Gemini...
❌ Error: Gemini API key is required
// → Modal API 호출 안 됨
// → CORS 에러처럼 보임 (실제로는 Gemini 에러)
```

### AFTER (API key 설정됨)
```javascript
[LTX] generateSceneVideo called
[LTX] Dialogue: 너무 슬퍼...
[LTX] Generating emotion-based motion prompt via Gemini...
✅ [LTX] Gemini motion prompt: Cinematic 2D Anime style...
[LTX] Calling Modal API: https://...modal.run
[LTX] Modal API response: 200 (85.3s)
✅ [LTX] Video blob received: 2.34 MB
```

---

## 💡 왜 CORS 에러처럼 보이는가?

```javascript
// videoService.ts에서:
const motionDescription = await gemini.generateMotionPrompt(...);
// ↑ 여기서 에러 발생 (Gemini API key 없음)
// ↓ 아래 코드 실행 안 됨

const response = await fetch(`${MODAL_API}/generate`, ...);
// Modal API는 호출조차 안 됨!
```

하지만 브라우저는 fetch 관련 에러로 표시 → "CORS policy" 에러로 오해

---

## 🚀 설정 완료 후 다음 단계

1. ✅ Gemini API key 설정 완료
2. ✅ 페이지 새로고침
3. ✅ "동영상 추출" 버튼 클릭
4. ✅ 브라우저 콘솔 확인:
   ```
   [LTX] Gemini motion prompt: ...
   [LTX] Calling Modal API: ...
   ```
5. ✅ 비디오 생성 성공!

---

## 📊 설정 완료 체크리스트

- [ ] Gemini API key 발급 (https://aistudio.google.com/app/apikey)
- [ ] 브라우저 콘솔에서 localStorage 설정
- [ ] 페이지 새로고침
- [ ] localStorage.getItem('gemini_api_key') 확인 (null 아님)
- [ ] 테스트 실행

---

**Gemini API key 설정 후 모든 문제 해결됩니다!** 🔑
