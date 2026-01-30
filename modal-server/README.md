# LTX-Video Service 설정 가이드

Modal을 사용한 AI 비디오 생성 서비스

## 1. Modal 설치 및 로그인

```bash
# Modal CLI 설치
pip install modal

# Modal 로그인 (브라우저가 열립니다)
modal setup
```

## 2. Hugging Face 토큰 설정

### 2-1. Hugging Face 토큰 발급
1. https://huggingface.co/settings/tokens 접속
2. "New token" 클릭
3. Token type: **Read** 선택
4. 토큰 생성 후 복사

### 2-2. Modal Secret 등록

```bash
# Hugging Face 토큰을 Modal Secret으로 등록
modal secret create huggingface-secret HF_TOKEN=hf_your_token_here
```

**예시:**
```bash
modal secret create huggingface-secret HF_TOKEN=hf_abcdefghijklmnopqrstuvwxyz1234567890
```

## 3. 모델 다운로드 (최초 1회)

```bash
# modal-server 폴더로 이동
cd modal-server

# 모델 다운로드 실행 (15-30분 소요)
modal run main.py
```

이 과정은 최초 1회만 실행하면 됩니다. 이후에는 캐시된 모델을 사용합니다.

## 4. 서비스 배포

```bash
# 서비스를 Modal에 배포
modal deploy main.py
```

배포가 완료되면 다음과 같은 URL이 생성됩니다:
```
https://your-username--ltx-video-service-generate-video-endpoint.modal.run
```

이 URL을 프론트엔드 코드에서 사용하면 됩니다!

## 5. 로컬 테스트

```bash
# 함수 직접 호출 테스트
modal run main.py::generate_video --image-url "https://example.com/image.jpg" --prompt "subtle movements"
```

## 6. API 사용법 (프론트엔드)

### Request
```javascript
const response = await fetch('https://your-modal-url.modal.run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image_url: 'https://your-image-url.jpg',
    prompt: 'subtle facial expressions, gentle background movement',
    duration: 8.0,
    fps: 24,
    seed: 42
  })
});

const result = await response.json();
// result.video_base64 에 비디오 데이터가 Base64로 인코딩되어 있음
```

### Response
```json
{
  "status": "success",
  "video_base64": "...",
  "size_mb": 12.5
}
```

## 7. 비용 최적화 팁

1. **GPU 선택:** A10G는 가장 비용 효율적 (시간당 ~$1)
2. **병렬 처리:** 여러 씬을 동시에 처리하면 전체 시간 단축
3. **모델 캐시:** Volume 사용으로 다운로드 비용 절약
4. **타임아웃 설정:** 불필요하게 긴 타임아웃 방지

## 8. 문제 해결

### "Model not found" 에러
```bash
modal run main.py  # 모델 다시 다운로드
```

### Secret이 없다는 에러
```bash
modal secret list  # 등록된 secret 확인
modal secret create huggingface-secret HF_TOKEN=your_token
```

### GPU 메모리 부족
- `main.py`에서 `num_inference_steps`를 20으로 줄이기
- 또는 GPU를 A100으로 변경 (더 비쌈)

## 9. 모니터링

```bash
# 실행 중인 작업 확인
modal app list

# 로그 확인
modal app logs ltx-video-service
```
