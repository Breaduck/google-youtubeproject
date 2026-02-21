"""
BytePlus (ByteDance) 공식 API 프록시 서버
CORS 문제 해결을 위한 중간 서버
"""

import modal
import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

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
    try:
        # 요청 헤더에서 Authorization 추출
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header missing")

        # 요청 본문 읽기
        body = await request.json()

        # BytePlus API 호출
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://ark.ap-southeast.bytepluses.com/api/v3/content_generation/tasks",
                json=body,
                headers={
                    "Authorization": auth_header,
                    "Content-Type": "application/json",
                },
            )

            return JSONResponse(
                content=response.json() if response.status_code == 200 else {"error": response.text},
                status_code=response.status_code,
            )

    except Exception as e:
        print(f"[ERROR] Task creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@fast_app.get("/api/v3/content_generation/tasks/{task_id}")
async def get_task(task_id: str, request: Request):
    """BytePlus API 프록시 - 태스크 조회"""
    try:
        # 요청 헤더에서 Authorization 추출
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header missing")

        # BytePlus API 호출
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://ark.ap-southeast.bytepluses.com/api/v3/content_generation/tasks/{task_id}",
                headers={
                    "Authorization": auth_header,
                },
            )

            return JSONResponse(
                content=response.json() if response.status_code == 200 else {"error": response.text},
                status_code=response.status_code,
            )

    except Exception as e:
        print(f"[ERROR] Task query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@fast_app.get("/health")
async def health():
    """헬스 체크"""
    return {"status": "ok", "service": "byteplus-proxy"}


@app.function(
    image=image,
    timeout=600,
)
@modal.asgi_app()
def web():
    return fast_app
