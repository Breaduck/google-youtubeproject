# 썸네일 생성 스크립트

## 사전 준비

1. **tsx 설치**
   ```bash
   npm install -D tsx
   ```

2. **Gemini API 키 설정**
   ```bash
   export GEMINI_API_KEY=your_gemini_api_key
   ```

## 실행

```bash
npm run generate-thumbnails
```

## 예상 비용

- 템플릿 개수: 41개
- 모델: Imagen 3 Fast
- 이미지당 비용: $0.04
- **총 예상 비용: $1.64 (약 ₩2,394)**

## 결과물

- 출력 경로: `public/templates/{templateId}.webp`
- 해상도: 1024x576 (16:9)
- 형식: WebP

## 주의사항

- 1초 간격으로 API 호출 (Rate limit 방지)
- 실패 시 3회 자동 재시도
- Gemini API 키 필요
