# Imgur Client ID Setup (필수)

## 1. Imgur 앱 등록

1. https://imgur.com/ 로그인
2. https://api.imgur.com/oauth2/addclient 접속
3. 앱 정보 입력:
   - Application name: `BytePlus Video Proxy`
   - Authorization type: `OAuth 2 authorization without a callback URL`
   - Email: (your email)
4. Submit → Client ID 발급받음

## 2. Modal Secret 등록

```bash
python -m modal secret create imgur-client-id IMGUR_CLIENT_ID=<your_client_id>
```

예:
```bash
python -m modal secret create imgur-client-id IMGUR_CLIENT_ID=abc123xyz456
```

## 3. 검증

```bash
python -m modal secret list
```

`imgur-client-id`가 목록에 표시되어야 합니다.

## 4. 배포

```bash
cd modal-server
export PYTHONIOENCODING=utf-8
python -m modal deploy main_byteplus.py
```

## ⚠️ 보안 주의사항

- **절대** 코드에 Client ID를 직접 넣지 마세요
- **절대** git에 Client ID를 커밋하지 마세요
- Modal Secret으로만 관리합니다

## 기존 노출된 Client ID 폐기

이전 커밋에 노출된 `Client-ID 546c25a59c58ad7`는 즉시 폐기하고 새로 발급받으세요.
