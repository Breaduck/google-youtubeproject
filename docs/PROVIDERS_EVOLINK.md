# Evolink Provider (SeeDance 1.0 Pro Fast)

## Overview

Evolink API를 통한 SeeDance 1.0 Pro Fast 비디오 생성

**공식 문서**: https://evolink.ai/seedance-1-pro-fast

## API Specification

### Base URL
```
https://api.evolink.ai
```

### Authentication
```http
Authorization: Bearer YOUR_API_KEY
```

### Endpoints

#### 1. 비디오 생성 태스크 생성
```http
POST /v1/videos/generations
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "model": "doubao-seedance-1.0-pro-fast",
  "prompt": "A cinematic scene...",
  "image_urls": ["https://example.com/image.jpg"],
  "duration": 5,
  "quality": "720p",
  "aspect_ratio": "16:9"
}
```

**Response**:
```json
{
  "id": "task-unified-xxx",
  "status": "pending",
  "created": 1761313744
}
```

#### 2. 태스크 상태 조회
```http
GET /v1/tasks/{task_id}
Authorization: Bearer YOUR_API_KEY
```

**Response (완료 시)**:
```json
{
  "id": "task-unified-xxx",
  "status": "completed",
  "progress": 100,
  "result": {
    "video_url": "https://cdn.evolink.ai/outputs/xxx.mp4"
  }
}
```

## Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `model` | string | ✅ | - | `doubao-seedance-1.0-pro-fast` |
| `prompt` | string | ✅ | - | 최대 2000 토큰 |
| `image_urls` | array | ❌ | - | 이미지-투-비디오 모드 (공개 HTTPS URL) |
| `duration` | integer | ❌ | 5 | 2-12초 |
| `quality` | string | ❌ | 1080p | 480p, 720p, 1080p |
| `aspect_ratio` | string | ❌ | 16:9 | 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 |

## Pricing

| Quality | Price (USD/sec) | Credits/sec |
|---------|----------------|-------------|
| 480p    | $0.0084        | 0.60147     |
| 720p    | $0.0186        | 1.3366      |
| 1080p   | $0.0408        | 2.94052     |

**예시**: 720p 5초 = $0.0186 × 5 = $0.093 (약 135원, 환율 1,450원)

## Implementation Notes

### 1. 이미지 URL 요구사항
- **반드시 공개 HTTPS URL** (dataURL 불가)
- 우리 서버: `/api/v3/uploads` (Imgur) 활용

### 2. CORS 우회
- Evolink CDN은 CORS 미지원 가능성
- Modal 프록시: `/api/v3/evolink/download?url=...`

### 3. 폴링 전략
- `status: pending|processing|completed|failed`
- 평균 생성 시간: ~20-30초 (720p 5초 기준)
- 최대 폴링 시간: 120초

### 4. 에러 처리
```json
{
  "error": {
    "code": "insufficient_credits",
    "message": "Not enough credits"
  }
}
```

## Sources

- [Seedance 1.0 Pro Fast API Documentation](https://evolink.ai/seedance-1-pro-fast)
- [Seedance 1.0 Pro API Documentation - Pollo AI](https://docs.pollo.ai/m/seedance/seedance-pro)
