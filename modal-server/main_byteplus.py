"""
BytePlus (ByteDance) 공식 API 프록시 서버
CORS 문제 해결을 위한 중간 서버
v1.2-byteplus-proxy-debug: 500 에러 원인 완전 노출
"""

import modal
import traceback
import uuid
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

BUILD_VERSION = "v1.2-byteplus-proxy-debug"

app = modal.App("byteplus-proxy")

# Modal Image 설정
image = modal.Image.debian_slim().pip_install(
    "fastapi",
    "httpx",
)

fast_app = FastAPI()

# CORS 설정
fast_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@fast_app.post("/api/v3/content_generation/tasks")
async def create_task(request: Request):
    """BytePlus API 프록시 - 태스크 생성"""
    request_id = str(uuid.uuid4())[:8]

    try:
        # 1. Raw body 크기 로깅
        raw = await request.body()
        body_bytes = len(raw)
        print(f"[{request_id}] POST /tasks - body_bytes={body_bytes}")

        # 2. JSON 파싱
        try:
            import json
            body = json.loads(raw)
        except json.JSONDecodeError as e:
            tb = traceback.format_exc().split('\n')[-6:-1]
            print(f"[{request_id}] [ERROR] JSON parse failed: {e}")
            print('\n'.join(tb))
            raise HTTPException(
                status_code=400,
                detail=f"Invalid JSON: {str(e)}"
            )

        # 3. Authorization 체크
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header missing")

        # 4. Data URL 감지 및 제한
        if "content" in body and isinstance(body["content"], list):
            for item in body["content"]:
                if item.get("type") == "image_url":
                    image_url = item.get("image_url", {}).get("url", "")
                    if image_url.startswith("data:image/"):
                        image_len = len(image_url)
                        print(f"[{request_id}] Detected data URL - image_len={image_len}")
                        if image_len > 1_000_000:
                            raise HTTPException(
                                status_code=413,
                                detail="Request too large. Use image_url (upload) instead of data:image base64."
                            )

        # 5. BytePlus API 호출
        print(f"[{request_id}] Calling BytePlus API...")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://ark.ap-southeast.bytepluses.com/api/v3/content_generation/tasks",
                    json=body,
                    headers={
                        "Authorization": auth_header,
                        "Content-Type": "application/json",
                    },
                )

                # 6. 응답 처리
                print(f"[{request_id}] BytePlus response: status={response.status_code}")

                if response.status_code == 200:
                    return JSONResponse(
                        content=response.json(),
                        status_code=200,
                    )
                else:
                    # 실패 시 상세 에러 반환
                    error_detail = {
                        "error": "BytePlus API error",
                        "status_code": response.status_code,
                        "response_text": response.text[:500],  # 처음 500자만
                        "request_id": request_id
                    }
                    print(f"[{request_id}] [ERROR] BytePlus API failed: {error_detail}")
                    return JSONResponse(
                        content=error_detail,
                        status_code=response.status_code,
                    )

        except httpx.TimeoutException as e:
            tb = traceback.format_exc().split('\n')[-6:-1]
            print(f"[{request_id}] [ERROR] Timeout: {e}")
            print('\n'.join(tb))
            raise HTTPException(
                status_code=504,
                detail=f"BytePlus API timeout (request_id={request_id}): {str(e)}"
            )
        except httpx.RequestError as e:
            tb = traceback.format_exc().split('\n')[-6:-1]
            print(f"[{request_id}] [ERROR] Request failed: {e}")
            print('\n'.join(tb))
            raise HTTPException(
                status_code=502,
                detail=f"BytePlus API request failed (request_id={request_id}): {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        # 7. 최종 예외 처리
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR] Unexpected error:")
        print(tb)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error (request_id={request_id}): {type(e).__name__}: {str(e)}"
        )


@fast_app.get("/api/v3/content_generation/tasks/{task_id}")
async def get_task(task_id: str, request: Request):
    """BytePlus API 프록시 - 태스크 조회"""
    request_id = str(uuid.uuid4())[:8]

    try:
        print(f"[{request_id}] GET /tasks/{task_id}")

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header missing")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://ark.ap-southeast.bytepluses.com/api/v3/content_generation/tasks/{task_id}",
                headers={
                    "Authorization": auth_header,
                },
            )

            print(f"[{request_id}] BytePlus response: status={response.status_code}")

            if response.status_code == 200:
                return JSONResponse(
                    content=response.json(),
                    status_code=200,
                )
            else:
                error_detail = {
                    "error": "BytePlus API error",
                    "status_code": response.status_code,
                    "response_text": response.text[:500],
                    "request_id": request_id
                }
                print(f"[{request_id}] [ERROR] BytePlus API failed: {error_detail}")
                return JSONResponse(
                    content=error_detail,
                    status_code=response.status_code,
                )

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR] Unexpected error:")
        print(tb)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error (request_id={request_id}): {type(e).__name__}: {str(e)}"
        )


@fast_app.get("/health")
async def health():
    """헬스 체크"""
    return {
        "status": "ok",
        "service": "byteplus-proxy",
        "version": BUILD_VERSION
    }


@app.function(
    image=image,
    timeout=600,
)
@modal.asgi_app()
def web():
    return fast_app
