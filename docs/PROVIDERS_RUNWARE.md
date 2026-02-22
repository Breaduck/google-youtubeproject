# Runware Provider 문서

## 개요
- **모델**: SeeDance 1.0 Pro Fast (ByteDance via Runware)
- **Model ID**: `bytedance:2@2`
- **비용**: $0.14/video
- **최소 충전**: $20 (환불: 크레딧만 가능)
- **Feature Flag**: `RUNWARE_ENABLED` (서버), `VITE_RUNWARE_ENABLED` (프론트)

## 아키텍처

### 동기 완료 대기 방식
- Runware는 WebSocket 기반이므로, 세션 이슈를 피하기 위해 "요청 1회에서 완료까지 대기"하는 방식으로 구현
- 폴링 엔드포인트 없음 (생성 요청이 완료까지 블로킹)

### 플로우
```
Frontend
  ↓ POST /api/v3/runware/videos/generations (동기 대기)
Modal Server (main_byteplus.py)
  ↓ providers.runware_client.runware_generate_video()
Runware SDK (WebSocket)
  ↓ IVideoInference + IFrameImage(inputImage=URL)
  ↓ await videoInference() → 완료 대기
  ↓ return {task_id, video_url, status}
Modal Server
  ↓ return video_url
Frontend
  ↓ GET /api/v3/runware/download?url=... (CORS 프록시)
  ↓ Blob 반환
```

## 입력 파라미터

### POST /api/v3/runware/videos/generations
```json
{
  "api_key": "RUNWARE_API_KEY",
  "image_url": "https://i.imgur.com/...",
  "prompt": "Cinematic motion...",
  "duration": 5,
  "resolution": "720p"
}
```

### 지원 해상도
- **480p**: 864×480
- **720p**: 1280×720 (권장)
- **1080p**: 1920×1088

### 제약 사항
- `image_url`은 **공개 HTTP/HTTPS URL**이어야 함 (data URL 불가)
- Imgur 업로드 필수 (`/api/v3/uploads` 사용)
- Duration: 1.2~12초 (Runware SDK 제약)

## 출력

### 성공 응답 (200)
```json
{
  "id": "task-uuid-xxxx",
  "status": "completed",
  "result": {
    "video_url": "https://cdn.runware.ai/..."
  }
}
```

### 에러 응답
- **403**: Feature Flag OFF (`RUNWARE_ENABLED=false`)
- **402**: Insufficient credits (최소 $5 크레딧 필요)
- **400**: 잘못된 파라미터
- **500**: Runware API 오류

## Feature Flag 관리

### 서버 (Modal)
```bash
# Secret 생성
python -m modal secret create runware-config RUNWARE_ENABLED=true RUNWARE_API_KEY=your_key

# Secret 목록 확인
python -m modal secret list
```

### 프론트엔드
```bash
# .env 파일 수정
VITE_RUNWARE_ENABLED=true
```

## WebSocket 연결 관리

### 자동 연결 정리
```python
try:
    runware = Runware(api_key=api_key)
    await runware.connect()
    # ... videoInference ...
finally:
    await runware.disconnect()  # 항상 정리
```

### 로그 확인
```bash
python -m modal app logs byteplus-proxy

# 확인 항목:
# [RUNWARE] Connected to Runware API
# [RUNWARE] Disconnected from Runware API
```

## Billing Gate

### 최소 충전 정책
- **API 요구**: $5 크레딧 또는 paid invoice
- **실제 충전**: $20 최소 (공식 정책)
- **환불**: 크레딧 형태로만 가능 (현금 불가)
- **만료**: 없음 (크레딧은 영구 유지)

### 에러 처리
```typescript
if (createRes.status === 402) {
  throw new Error(
    '⚠️ Runware 크레딧 부족\n' +
    '• 최소 충전: $20\n' +
    '• 충전: https://my.runware.ai/wallet'
  );
}
```

## 문제 해결

### WebSocket 연결 누수
**증상**: Modal 함수가 종료되지 않음
**원인**: `disconnect()` 호출 누락
**해결**: `finally` 블록에서 반드시 `await runware.disconnect()` 호출

### 이미지 URL 오류
**증상**: `Invalid image_url` 또는 `inputImage` 오류
**원인**: data URL 또는 private URL 전달
**해결**: Imgur 업로드 후 공개 URL 사용

### Feature Flag 미적용
**증상**: Runware가 기본 활성화됨
**원인**: ENV 변수 미설정
**해결**: Modal Secret + .env 파일 확인

## 참고 자료
- [Runware Python SDK](https://github.com/Runware/sdk-python)
- [Video Inference API](https://runware.ai/docs/video-inference/api-reference)
- [Billing Gate](docs/BILLING_GATE.md)

---

**마지막 업데이트**: 2026-02-22
**Build Version**: v1.10-runware-provider-fixed
