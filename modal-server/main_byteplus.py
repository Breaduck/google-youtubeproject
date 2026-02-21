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

BUILD_VERSION = "v1.3-byteplus-model-mapping"

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
    """Data URL을 업로드하고 image_url 반환"""
    try:
        body = await request.json()
        data_url = body.get("data_url", "")

        if not data_url.startswith("data:image/"):
            raise HTTPException(400, "Invalid data URL")

        header, b64_data = data_url.split(",", 1)
        mime = header.split(":")[1].split(";")[0]
        ext = mime.split("/")[1]

        img_bytes = base64.b64decode(b64_data)
        img_id = str(uuid.uuid4())[:12]
        filename = f"{img_id}.{ext}"
        filepath = f"{UPLOAD_DIR}/{filename}"

        Path(UPLOAD_DIR).mkdir(exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(img_bytes)

        print(f"[UPLOAD] {img_id} - {len(img_bytes)} bytes")

        image_url = f"https://hiyoonsh1--byteplus-proxy-web.modal.run/api/v3/uploads/{filename}"
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

        # BytePlus SDK 클라이언트
        client = Ark(
            base_url="https://ark.ap-southeast.bytepluses.com/api/v3",
            api_key=api_key,
        )

        # SDK로 task 생성
        result = client.content_generation.tasks.create(
            model=model_id,  # 매핑된 실제 ID 사용
            content=content
        )

        print(f"[{request_id}] SDK result: {result}")

        # SDK 응답을 JSON으로 변환
        if hasattr(result, 'model_dump'):
            response_data = result.model_dump()
        elif hasattr(result, 'dict'):
            response_data = result.dict()
        else:
            response_data = {"task_id": str(result.id) if hasattr(result, 'id') else None}

        print(f"[{request_id}] Response: {response_data}")

        return JSONResponse(content=response_data, status_code=200)

    except ArkNotFoundError as e:
        # 404: 모델/엔드포인트를 찾을 수 없음
        error_msg = str(e)
        print(f"[{request_id}] [NOT_FOUND] {error_msg}")
        raise HTTPException(
            status_code=404,
            detail=f"Model not found or no access (request_id={request_id}, model={model_id}): {error_msg}"
        )
    except ArkAPIError as e:
        # BytePlus API 에러
        if "AccessDenied" in str(e) or "Unauthorized" in str(e):
            status_code = 403
        elif "NotFound" in str(e):
            status_code = 404
        else:
            status_code = 400
        print(f"[{request_id}] [API_ERROR] {status_code}: {e}")
        raise HTTPException(status_code=status_code, detail=f"BytePlus API error (request_id={request_id}): {str(e)}")
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
    """BytePlus SDK로 태스크 조회"""
    request_id = str(uuid.uuid4())[:8]

    try:
        from byteplussdkarkruntime import Ark

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(401, "Authorization header missing")

        api_key = auth_header.replace("Bearer ", "")

        print(f"[{request_id}] SDK get_task: {task_id}")

        client = Ark(
            base_url="https://ark.ap-southeast.bytepluses.com/api/v3",
            api_key=api_key,
        )

        # SDK로 task 조회
        result = client.content_generation.tasks.retrieve(task_id)

        if hasattr(result, 'model_dump'):
            response_data = result.model_dump()
        elif hasattr(result, 'dict'):
            response_data = result.dict()
        else:
            response_data = {"status": "unknown", "task_id": task_id}

        print(f"[{request_id}] Status: {response_data.get('status')}")

        return JSONResponse(content=response_data, status_code=200)

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR] SDK retrieve failed:")
        print(tb)
        raise HTTPException(
            status_code=500,
            detail=f"SDK error (request_id={request_id}): {type(e).__name__}: {str(e)}"
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
    volumes={UPLOAD_DIR: volume},
)
@modal.asgi_app()
def web():
    return fast_app
