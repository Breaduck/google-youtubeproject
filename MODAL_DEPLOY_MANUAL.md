# 🚀 Modal API 수동 배포 가이드

## 문제 상황

1. **CORS 에러 (303 See Other):** Modal API 재배포 필요
2. **인코딩 에러:** 한글 Windows에서 Modal CLI 배포 실패
3. **코드 업데이트 완료:** 테스트 파라미터 지원 추가됨

---

## ✅ 해결 방법 1: CMD에서 직접 배포 (추천)

### 1단계: CMD 창 열기

```
Win + R → cmd 입력 → Enter
```

### 2단계: UTF-8 코드페이지 설정

```cmd
chcp 65001
```

### 3단계: 폴더 이동

```cmd
cd C:\Users\hiyoo\OneDrive\바탕 화면\video-saas\modal-server
```

### 4단계: Modal 배포

```cmd
python -m modal deploy main.py
```

**예상 출력:**
```
✓ Initialized. View run at https://modal.com/...
✓ Created objects.
│
├── 🔨 Created mount ...
├── 🔨 Created ltx-video-service-distilled-1080p.VideoGenerator
└── 🔨 Created web_app => https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run
✓ App deployed! 🎉
```

---

## 🔧 해결 방법 2: PowerShell 사용

```powershell
cd "C:\Users\hiyoo\OneDrive\바탕 화면\video-saas\modal-server"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
python -m modal deploy main.py
```

---

## 🌐 해결 방법 3: Modal 웹 대시보드

1. **Modal 웹사이트 접속:**
   ```
   https://modal.com/apps
   ```

2. **로그인** (GitHub 계정)

3. **기존 앱 찾기:**
   - "ltx-video-service-distilled-1080p" 앱 클릭

4. **Redeploy 버튼 클릭**

또는:

1. **새 배포:**
   - "Deploy" 버튼 클릭
   - Repository 연결: `https://github.com/Breaduck/google-youtubeproject`
   - 파일 선택: `modal-server/main.py`
   - "Deploy" 실행

---

## 📝 변경 사항 (이미 GitHub에 커밋됨)

### 파일: `modal-server/main.py`

**추가된 내용:**

```python
class GenerateRequest(BaseModel):
    prompt: str
    image_url: str
    character_description: str = ""
    num_frames: int = 97
    # Test parameters (optional) - 새로 추가!
    test_conditioning: float = None
    test_guidance: float = None
    test_steps: int = None

@web.post("/generate")
async def generate(req: GenerateRequest):
    generator = VideoGenerator()
    video_bytes = generator.generate.remote(
        req.prompt,
        req.image_url,
        req.character_description,
        req.num_frames,
        req.test_conditioning,  # 새로 추가!
        req.test_guidance,      # 새로 추가!
        req.test_steps          # 새로 추가!
    )
```

---

## 🔍 배포 확인

### 배포 후 테스트:

```bash
# Health check
curl https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run/health

# 예상 결과:
{"status":"healthy","service":"ltx-video-720p"}
```

### 브라우저에서 확인:

```javascript
// 웹사이트에서 F12 → Console
fetch('https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run/health')
  .then(r => r.json())
  .then(d => console.log('✅ Modal:', d))
  .catch(e => console.error('❌ Modal:', e));
```

---

## ⚠️ 배포 실패 시

### 에러 1: "No such file or directory"
```
해결: 폴더 경로 확인
cd C:\Users\hiyoo\OneDrive\바탕 화면\video-saas\modal-server
dir  # main.py 파일 있는지 확인
```

### 에러 2: "Not logged in"
```
해결: Modal 로그인
python -m modal token new
# 브라우저에서 GitHub 로그인
```

### 에러 3: "'cp949' codec can't encode"
```
해결: CMD 창에서 chcp 65001 실행 후 재시도
또는 Modal 웹 대시보드 사용
```

---

## 🎯 배포 완료 후 다음 단계

1. ✅ Modal API 배포 완료
2. ✅ Health check 확인
3. ✅ Gemini API key 설정 (브라우저)
   ```javascript
   localStorage.setItem('gemini_api_key', 'YOUR_KEY');
   ```
4. ✅ 웹사이트에서 테스트
5. ✅ test-quality.html로 5개 파라미터 테스트

---

## 📊 현재 상태

```
✅ 코드 수정 완료 (GitHub push 완료)
✅ 프론트엔드 배포 완료 (Cloudflare Pages)
⏳ Modal API 재배포 필요 ← 지금 이 단계!
```

**배포 명령어 (CMD에서):**
```cmd
chcp 65001
cd C:\Users\hiyoo\OneDrive\바탕 화면\video-saas\modal-server
python -m modal deploy main.py
```

---

**수동 배포 후 모든 문제 해결됩니다!** 🚀

배포 시간: 약 2-3분
