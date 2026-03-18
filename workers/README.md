# BytePlus Video Proxy - Cloudflare Workers

Modal 대체용 완전 무료 프록시 (10만 요청/일)

## 배포 방법

### 1. 의존성 설치
```bash
cd workers
npm install
```

### 2. Cloudflare 로그인
```bash
npx wrangler login
```

### 3. Imgur Client ID Secret 설정
```bash
npx wrangler secret put IMGUR_CLIENT_ID
# 프롬프트에서 Imgur Client ID 입력
```

### 4. 배포
```bash
npm run deploy
```

### 5. 배포된 URL 확인
```
https://byteplus-video-proxy.<your-subdomain>.workers.dev
```

## 프론트엔드 설정

`src/services/videoService.ts`에서 API URL 변경:
```typescript
const API_BASE = 'https://byteplus-video-proxy.<your-subdomain>.workers.dev';
```

## 무료 한도
- 100,000 requests/day
- CPU time 10ms per request
- 완전 무료!
