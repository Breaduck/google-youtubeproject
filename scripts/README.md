# 썸네일 생성 스크립트

## 사전 준비

1. **tsx 설치**
   ```bash
   npm install -D tsx
   ```

2. **Google Cloud SDK 설치 및 인증**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **환경변수 설정**
   ```bash
   export GOOGLE_CLOUD_PROJECT_ID=your-project-id
   ```

## 실행

```bash
npm run generate-thumbnails
```

## 예상 비용

- 템플릿 개수: 41개
- 이미지당 비용: $0.02
- **총 예상 비용: $0.82 (약 ₩1,197)**

## 결과물

- 출력 경로: `public/templates/{templateId}.webp`
- 해상도: 1024x576 (16:9)
- 형식: WebP

## 주의사항

- 1초 간격으로 API 호출 (Rate limit 방지)
- 실패 시 3회 자동 재시도
- Google Cloud 인증 필요 (`gcloud auth print-access-token`)
