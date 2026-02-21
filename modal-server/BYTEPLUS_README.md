# BytePlus Proxy Server (Modal)

BytePlus API 프록시 서버 (Imgur 공개 이미지 호스팅 연동)

## 이미지 업로드

**POST /api/v3/uploads**

Data URL → Imgur 공개 URL 변환 (BytePlus는 공개 HTTPS URL만 허용)

**검증 규칙:**
- MIME: `image/png`, `image/jpeg`, `image/webp`만 허용
- 크기: 최대 5MB (base64 디코드 후)
- 형식: `data:image/*;base64,...` 형식만 허용
- BytePlus 요구사항: 최소 300px 너비

**에러 코드:**
- `400 imgur_client_id_missing`: Modal Secret 미설정
- `400 invalid_data_url`: data URL 형식 오류
- `400 unsupported_format`: 지원되지 않는 이미지 포맷
- `413 file_too_large`: 5MB 초과
- `500 imgur_upload_failed`: Imgur 업로드 실패

Request:
```json
{"data_url": "data:image/png;base64,iVBORw0KG..."}
```

Response:
```json
{"image_url": "https://i.imgur.com/xyz.png"}
```

## 환경 변수 (Modal Secrets)

**필수:**
```bash
# Imgur Client ID (https://imgur.com/account/settings/apps)
modal secret create imgur-client-id IMGUR_CLIENT_ID=<your_client_id>
```

**선택:**
```bash
# Seedance 모델 ID 오버라이드
BYTEPLUS_SEEDANCE_MODEL_ID="seedance-1-0-pro-fast-251015"
```

**보안:**
- 절대 코드에 API 키/Client ID를 하드코딩하지 마세요
- Modal Secret으로만 관리합니다

## 모델 Alias 매핑

프론트엔드가 보내는 alias → 실제 BytePlus Model ID:

| Alias | 실제 Model ID |
|-------|---------------|
| `seedance-1.0-pro` | `seedance-1-0-pro-251015` |
| `seedance-1.0-pro-fast` | `seedance-1-0-pro-fast-251015` |
| `seedance-1-0-pro` | `seedance-1-0-pro-251015` |

**중요**: BytePlus 콘솔에서 모델 활성화 필요:
https://console.byteplus.com → ModelArk → Models

## 사용 가능한 모델 확인

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://hiyoonsh1--byteplus-proxy-web.modal.run/api/v3/byteplus/models
```

## 에러 코드

- **404**: 모델/엔드포인트를 찾을 수 없음 또는 미활성화
- **403**: 접근 권한 없음
- **400**: API 요청 오류
- **500**: 서버 내부 오류

## 배포

```bash
cd modal-server
export PYTHONIOENCODING=utf-8
python -m modal deploy main_byteplus.py
```

## 로그 확인

```bash
python -m modal app logs byteplus-proxy
```

## SDK 참고

- PyPI: https://pypi.org/project/byteplus-python-sdk-v2/
- GitHub: https://github.com/byteplus-sdk/byteplus-python-sdk-v2
