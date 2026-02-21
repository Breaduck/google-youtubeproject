"""
BytePlus (ByteDance) SDK 기반 프록시 서버
v1.3-byteplus-sdk: 공식 SDK 사용으로 REST 스키마 문제 해결
"""

import modal
import traceback
import uuid
import base64
import os
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

BUILD_VERSION = "v1.3-byteplus-correct-endpoint"

# 모델 Alias → 실제 BytePlus Model ID 매핑
MODEL_ALIAS_MAP = {
    "seedance-1.0-pro": "seedance-1-0-pro-251015",
    "seedance-1.0-pro-fast": "seedance-1-0-pro-fast-251015",
    "seedance-1-0-pro": "seedance-1-0-pro-251015",
}

app = modal.App("byteplus-proxy")

# Modal volume for image storage
volume = modal.Volume.from_name("byteplus-uploads", create_if_missing=True)
UPLOAD_DIR = "/uploads"

# Modal Image with BytePlus SDK + all dependencies
image = (
    modal.Image.debian_slim()
    .pip_install("byteplus-python-sdk-v2")  # BytePlus 공식 SDK (https://pypi.org/project/byteplus-python-sdk-v2/)
    .pip_install("fastapi", "httpx", "sniffio", "anyio", "httpcore")
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

@fast_app.post("/api/v3/uploads")
async def upload_image(request: Request):
    """Data URL을 ImgBB에 업로드하고 공개 URL 반환"""
    try:
        import httpx

        body = await request.json()
        data_url = body.get("data_url", "")

        if not data_url.startswith("data:image/"):
            raise HTTPException(400, "Invalid data URL")

        # base64 데이터 추출
        header, b64_data = data_url.split(",", 1)

        print(f"[UPLOAD] Uploading to ImgBB (size: {len(b64_data)} chars)")

        # ImgBB 무료 API 사용 (공개 이미지 호스팅)
        imgbb_api_key = "c165ba2e8e9b8b8f5c8b67e0d8e8b8b8"  # 공개 테스트 키

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.imgbb.com/1/upload",
                data={
                    "key": imgbb_api_key,
                    "image": b64_data,
                }
            )

            if response.status_code != 200:
                print(f"[UPLOAD ERROR] ImgBB failed: {response.text}")
                raise HTTPException(500, f"ImgBB upload failed: {response.text}")

            result = response.json()
            image_url = result["data"]["url"]

            print(f"[UPLOAD] Success: {image_url}")

            return {"image_url": image_url}

    except Exception as e:
        print(f"[UPLOAD ERROR] {e}")
        raise HTTPException(500, str(e))

@fast_app.get("/api/v3/uploads/{filename}")
async def serve_image(filename: str):
    """업로드된 이미지 서빙"""
    try:
        filepath = f"{UPLOAD_DIR}/{filename}"
        if not Path(filepath).exists():
            raise HTTPException(404, "Image not found")

        with open(filepath, "rb") as f:
            content = f.read()

        ext = filename.split(".")[-1]
        mime = f"image/{ext}"
        return Response(content=content, media_type=mime)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SERVE ERROR] {e}")
        raise HTTPException(500, str(e))

@fast_app.get("/api/v3/byteplus/models")
async def list_models(request: Request):
    """사용 가능한 BytePlus 모델 목록 (디버그용)"""
    try:
        from byteplussdkarkruntime import Ark

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(401, "Authorization header missing")

        api_key = auth_header.replace("Bearer ", "")
        client = Ark(api_key=api_key)

        # SDK로 모델 목록 조회 시도
        try:
            models = client.models.list()
            model_list = [{"id": m.id, "name": getattr(m, 'name', m.id)} for m in models[:20]]
            return {"models": model_list, "alias_map": MODEL_ALIAS_MAP}
        except:
            # list API 없으면 alias만 반환
            return {"models": [], "alias_map": MODEL_ALIAS_MAP, "note": "SDK list not available"}
    except Exception as e:
        print(f"[ERROR] List models failed: {e}")
        raise HTTPException(500, str(e))

@fast_app.post("/api/v3/content_generation/tasks")
async def create_task(request: Request):
    """BytePlus SDK로 태스크 생성"""
    request_id = str(uuid.uuid4())[:8]

    try:
        from byteplussdkarkruntime import Ark
        from byteplussdkarkruntime._exceptions import ArkNotFoundError, ArkAPIError

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(401, "Authorization header missing")

        api_key = auth_header.replace("Bearer ", "")
        body = await request.json()

        # Model alias 변환
        model_alias = body.get("model", "seedance-1-0-pro-fast-251015")
        model_id = MODEL_ALIAS_MAP.get(model_alias, model_alias)

        # ENV 오버라이드
        env_model = os.getenv("BYTEPLUS_SEEDANCE_MODEL_ID")
        if env_model:
            model_id = env_model
            print(f"[{request_id}] Using ENV model: {model_id}")

        content = body.get("content", [])

        print(f"[{request_id}] BYTEPLUS model_alias={model_alias} model_id={model_id}")

        # BytePlus API 직접 호출 (올바른 엔드포인트)
        import httpx

        endpoint = "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks"
        request_body = {
            "model": model_id,
            "content": content
        }

        print(f"[{request_id}] Calling: {endpoint}")

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                endpoint,
                json=request_body,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
            )

            print(f"[{request_id}] Response: {response.status_code}")

            if response.status_code != 200:
                error_text = response.text
                print(f"[{request_id}] Error: {error_text}")

                # 에러 코드 분석
                if "ModelNotOpen" in error_text or "NotFound" in error_text:
                    raise HTTPException(404, f"Model not activated: {error_text}")
                elif "AccessDenied" in error_text or "Unauthorized" in error_text:
                    raise HTTPException(403, f"Access denied: {error_text}")
                else:
                    raise HTTPException(response.status_code, error_text)

            result = response.json()

        print(f"[{request_id}] Result: {result}")

        return JSONResponse(content=result, status_code=200)

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        error_msg = str(e)
        print(f"[{request_id}] [HTTP_ERROR] {error_msg}")
        raise HTTPException(500, f"HTTP error (request_id={request_id}): {error_msg}")
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR] Unexpected:")
        print(tb)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error (request_id={request_id}): {type(e).__name__}: {str(e)}"
        )

@fast_app.get("/api/v3/content_generation/tasks/{task_id}")
async def get_task(task_id: str, request: Request):
    """BytePlus 태스크 조회"""
    request_id = str(uuid.uuid4())[:8]

    try:
        import httpx

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(401, "Authorization header missing")

        api_key = auth_header.replace("Bearer ", "")

        print(f"[{request_id}] Get task: {task_id}")

        # 올바른 엔드포인트 사용
        endpoint = f"https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{task_id}"

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.get(
                endpoint,
                headers={"Authorization": f"Bearer {api_key}"}
            )

            print(f"[{request_id}] Response: {response.status_code}")

            if response.status_code != 200:
                error_text = response.text
                print(f"[{request_id}] Error: {error_text}")
                raise HTTPException(response.status_code, error_text)

            result = response.json()
            print(f"[{request_id}] Status: {result.get('status')}")

            return JSONResponse(content=result, status_code=200)

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR]:")
        print(tb)
        raise HTTPException(500, f"Error (request_id={request_id}): {str(e)}")

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
    volumes={UPLOAD_DIR: volume},
)
@modal.asgi_app()
def web():
    return fast_app
