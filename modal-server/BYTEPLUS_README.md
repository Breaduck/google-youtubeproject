# BytePlus Proxy Server (Modal)

공식 BytePlus Python SDK 기반 프록시 서버

## 환경 변수

```bash
# 선택: Seedance 모델 ID 오버라이드
BYTEPLUS_SEEDANCE_MODEL_ID="seedance-1-0-pro-fast-251015"
```

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
