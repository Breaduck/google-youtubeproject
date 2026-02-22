"""
BytePlus (ByteDance) SDK 기반 프록시 서버
v1.3-byteplus-sdk: 공식 SDK 사용으로 REST 스키마 문제 해결
"""

import modal
import traceback
import uuid
import base64
import os
import re
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

BUILD_VERSION = "v1.9-runware-provider"

# 모델 Alias → 실제 BytePlus Model ID 매핑
MODEL_ALIAS_MAP = {
    "seedance-1.0-pro": "seedance-1-0-pro-251015",
    "seedance-1.0-pro-fast": "seedance-1-0-pro-fast-251015",
    "seedance-1-0-pro": "seedance-1-0-pro-251015",
}

app = modal.App("byteplus-proxy")

# Modal volumes
upload_volume = modal.Volume.from_name("byteplus-uploads", create_if_missing=True)
cache_volume = modal.Volume.from_name("byteplus-1080p-cache", create_if_missing=True)
UPLOAD_DIR = "/uploads"
CACHE_DIR = "/cache"

# Modal Image with BytePlus SDK + Runware SDK + all dependencies
image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg")  # 720p → 1080p 리사이징용
    .pip_install("byteplus-python-sdk-v2")  # BytePlus 공식 SDK
    .pip_install("runware")  # Runware SDK (https://pypi.org/project/runware/)
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
    """Data URL을 Imgur에 업로드하고 공개 URL 반환 (BytePlus 호환)"""
    try:
        import httpx

        # ENV에서 Imgur Client ID 읽기 (필수)
        imgur_client_id = os.getenv("IMGUR_CLIENT_ID")
        if not imgur_client_id:
            raise HTTPException(400, "imgur_client_id_missing: Set IMGUR_CLIENT_ID in Modal secrets")

        body = await request.json()
        data_url = body.get("data_url", "")

        # 1. data URL 형식 검증
        if not data_url.startswith("data:image/"):
            raise HTTPException(400, "invalid_data_url: Must start with 'data:image/'")

        # 2. MIME 타입 검증 (png/jpeg/webp만 허용)
        header, b64_data = data_url.split(",", 1)
        mime_type = header.split(";")[0].replace("data:", "")
        allowed_mimes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
        if mime_type not in allowed_mimes:
            raise HTTPException(400, f"unsupported_format: Only {allowed_mimes} allowed, got {mime_type}")

        # 3. 크기 제한 (5MB)
        decoded_bytes = base64.b64decode(b64_data)
        size_mb = len(decoded_bytes) / (1024 * 1024)
        if size_mb > 5:
            raise HTTPException(413, f"file_too_large: {size_mb:.2f}MB exceeds 5MB limit")

        print(f"[UPLOAD] Uploading {mime_type} ({size_mb:.2f}MB) to Imgur")

        # 4. Imgur 업로드
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.imgur.com/3/image",
                headers={"Authorization": f"Client-ID {imgur_client_id}"},
                data={"image": b64_data, "type": "base64"}
            )

            if response.status_code != 200:
                error_detail = f"imgur_upload_failed: HTTP {response.status_code} - {response.text[:200]}"
                print(f"[UPLOAD ERROR] {error_detail}")
                raise HTTPException(500, error_detail)

            result = response.json()
            image_url = result["data"]["link"]

            print(f"[UPLOAD] Success → {image_url}")

            # 5. 접근성 검증 (선택적)
            try:
                verify_response = await client.head(image_url, timeout=5.0)
                print(f"[UPLOAD] Verified: {verify_response.status_code}")
            except Exception as e:
                print(f"[UPLOAD] Verification skipped: {str(e)[:100]}")

            return {"image_url": image_url}

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"upload_error: {type(e).__name__}: {str(e)[:200]}"
        print(f"[UPLOAD ERROR] {error_msg}")
        raise HTTPException(500, error_msg)

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

def parse_range_header(range_header: str, total_size: int) -> tuple[int, int]:
    """
    Parse HTTP Range header: bytes=start-end
    Returns: (start, end) inclusive
    """
    match = re.match(r'bytes=(\d+)-(\d*)', range_header)
    if not match:
        raise ValueError(f"Invalid Range header: {range_header}")

    start = int(match.group(1))
    end = int(match.group(2)) if match.group(2) else total_size - 1

    # 범위 검증
    if start >= total_size or end >= total_size or start > end:
        raise ValueError(f"Invalid range: {start}-{end} (total: {total_size})")

    return start, end

def resize_to_1080p(video_bytes: bytes, request_id: str) -> bytes:
    """720p → 1080p 리사이징 (유튜브 업로드용, 오디오 제거)"""
    import subprocess
    import tempfile
    import json

    # 임시 파일 생성
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_in:
        tmp_in.write(video_bytes)
        tmp_in_path = tmp_in.name

    tmp_out_path = tmp_in_path.replace(".mp4", "_1080p.mp4")

    # FFmpeg 리사이징 (lanczos + 오디오 제거)
    ffmpeg_result = subprocess.run([
        "ffmpeg", "-i", tmp_in_path,
        "-vf", "scale=1920:1080:flags=lanczos",  # 고품질 스케일링
        "-c:v", "libx264",
        "-preset", "ultrafast",  # 빠른 처리
        "-crf", "18",  # 고품질 유지
        "-tune", "animation",  # 애니메이션 최적화
        "-an",  # 오디오 제거
        "-y", tmp_out_path
    ], capture_output=True, stderr=subprocess.PIPE, text=True)

    if ffmpeg_result.returncode != 0:
        print(f"[{request_id}] FFmpeg error: {ffmpeg_result.stderr}")
        raise RuntimeError(f"FFmpeg failed: {ffmpeg_result.stderr[:200]}")

    # ffprobe로 최종 해상도 검증
    probe_result = subprocess.run([
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        tmp_out_path
    ], capture_output=True, text=True)

    if probe_result.returncode == 0:
        probe_data = json.loads(probe_result.stdout)
        width = probe_data["streams"][0]["width"]
        height = probe_data["streams"][0]["height"]
        print(f"[{request_id}] Verified resolution: {width}x{height}")
    else:
        print(f"[{request_id}] ffprobe failed, skipping verification")

    # 결과 읽기
    with open(tmp_out_path, "rb") as f:
        output_bytes = f.read()

    # 임시 파일 삭제
    os.unlink(tmp_in_path)
    os.unlink(tmp_out_path)

    return output_bytes

@fast_app.get("/api/v3/content_generation/tasks/{task_id}/download")
async def download_video(task_id: str, request: Request, export: str = None):
    """BytePlus 비디오 다운로드 (CORS 우회 프록시 + HTTP Range 지원)

    ?export=1080 → 1080p 변환 (유튜브용, 캐시됨)
    기본 → 720p 원본 반환
    Range: bytes=start-end → 206 Partial Content
    """
    request_id = str(uuid.uuid4())[:8]

    try:
        import httpx

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(401, "Authorization header missing")

        api_key = auth_header.replace("Bearer ", "")
        range_header = request.headers.get("Range")

        filename = f"{task_id}_1080p.mp4" if export == "1080" else f"{task_id}.mp4"

        # 1. export=1080 캐시 확인 (Range 지원)
        if export == "1080":
            cache_path = f"{CACHE_DIR}/{task_id}_1080p.mp4"
            if os.path.exists(cache_path):
                print(f"[{request_id}] Cache hit: {task_id}_1080p.mp4")
                file_size = os.path.getsize(cache_path)

                # Range 요청 처리
                if range_header:
                    try:
                        start, end = parse_range_header(range_header, file_size)
                        print(f"[{request_id}] Range request: {start}-{end}/{file_size}")

                        with open(cache_path, "rb") as f:
                            f.seek(start)
                            chunk = f.read(end - start + 1)

                        return Response(
                            content=chunk,
                            status_code=206,
                            media_type="video/mp4",
                            headers={
                                "Content-Range": f"bytes {start}-{end}/{file_size}",
                                "Accept-Ranges": "bytes",
                                "Content-Length": str(len(chunk)),
                                "Content-Type": "video/mp4",
                                "Content-Disposition": f'attachment; filename="{filename}"',
                                "Access-Control-Allow-Origin": "*",
                            }
                        )
                    except ValueError as e:
                        raise HTTPException(416, f"Range not satisfiable: {str(e)}")

                # 전체 파일 반환
                with open(cache_path, "rb") as f:
                    cached_bytes = f.read()

                return Response(
                    content=cached_bytes,
                    status_code=200,
                    media_type="video/mp4",
                    headers={
                        "Accept-Ranges": "bytes",
                        "Content-Length": str(file_size),
                        "Content-Type": "video/mp4",
                        "Content-Disposition": f'attachment; filename="{filename}"',
                        "Access-Control-Allow-Origin": "*",
                    }
                )

        # 2. BytePlus에서 task 조회하여 video_url 획득
        endpoint = f"https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/{task_id}"

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.get(
                endpoint,
                headers={"Authorization": f"Bearer {api_key}"}
            )

            if response.status_code != 200:
                error_text = response.text
                raise HTTPException(response.status_code, f"Task query failed (request_id={request_id}): {error_text}")

            result = response.json()
            video_url = result.get("content", {}).get("video_url")

            if not video_url:
                raise HTTPException(404, f"No video_url in task (request_id={request_id}): {result.get('status')}")

            # 3. SSRF 방지: volces.com 도메인만 허용
            if not ("volces.com" in video_url or "tos-ap-southeast" in video_url):
                raise HTTPException(403, f"Invalid video URL domain (request_id={request_id})")

            print(f"[{request_id}] Streaming video: {video_url[:80]}...")

            # 4. 스트리밍 다운로드 (Range 헤더 전달 시도)
            async with httpx.AsyncClient(timeout=120.0) as stream_client:
                upstream_headers = {}
                if range_header:
                    upstream_headers["Range"] = range_header
                    print(f"[{request_id}] Forwarding Range: {range_header}")

                video_response = await stream_client.get(
                    video_url,
                    follow_redirects=True,
                    headers=upstream_headers
                )

                # Upstream이 206을 반환하면 그대로 전달 (export=1080 아닐 때만)
                if video_response.status_code == 206 and export != "1080":
                    print(f"[{request_id}] Upstream supports Range, forwarding 206")
                    return Response(
                        content=video_response.content,
                        status_code=206,
                        media_type="video/mp4",
                        headers={
                            "Content-Range": video_response.headers.get("Content-Range", ""),
                            "Accept-Ranges": "bytes",
                            "Content-Length": video_response.headers.get("Content-Length", str(len(video_response.content))),
                            "Content-Type": "video/mp4",
                            "Content-Disposition": f'attachment; filename="{filename}"',
                            "Access-Control-Allow-Origin": "*",
                        }
                    )

                # Upstream이 200 반환 또는 export=1080
                if video_response.status_code not in [200, 206]:
                    raise HTTPException(
                        502,
                        f"Upstream video download failed (request_id={request_id}): HTTP {video_response.status_code}"
                    )

                original_bytes = video_response.content
                original_mb = len(original_bytes) / (1024 * 1024)
                print(f"[{request_id}] Downloaded: {original_mb:.2f}MB")

                # 5. export=1080 요청 시 변환 + 캐시
                if export == "1080":
                    print(f"[{request_id}] Converting to 1080p...")
                    upscaled_bytes = resize_to_1080p(original_bytes, request_id)
                    upscaled_mb = len(upscaled_bytes) / (1024 * 1024)
                    print(f"[{request_id}] Upscaled 1080p: {upscaled_mb:.2f}MB")

                    # 캐시 저장
                    os.makedirs(CACHE_DIR, exist_ok=True)
                    cache_path = f"{CACHE_DIR}/{task_id}_1080p.mp4"
                    with open(cache_path, "wb") as f:
                        f.write(upscaled_bytes)
                    cache_volume.commit()
                    print(f"[{request_id}] Cached: {task_id}_1080p.mp4")

                    file_size = len(upscaled_bytes)

                    # Range 요청 처리
                    if range_header:
                        try:
                            start, end = parse_range_header(range_header, file_size)
                            chunk = upscaled_bytes[start:end+1]
                            print(f"[{request_id}] Range: {start}-{end}/{file_size}")

                            return Response(
                                content=chunk,
                                status_code=206,
                                media_type="video/mp4",
                                headers={
                                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                                    "Accept-Ranges": "bytes",
                                    "Content-Length": str(len(chunk)),
                                    "Content-Type": "video/mp4",
                                    "Content-Disposition": f'attachment; filename="{filename}"',
                                    "Access-Control-Allow-Origin": "*",
                                }
                            )
                        except ValueError as e:
                            raise HTTPException(416, f"Range not satisfiable: {str(e)}")

                    # 전체 파일 반환
                    return Response(
                        content=upscaled_bytes,
                        status_code=200,
                        media_type="video/mp4",
                        headers={
                            "Accept-Ranges": "bytes",
                            "Content-Length": str(file_size),
                            "Content-Type": "video/mp4",
                            "Content-Disposition": f'attachment; filename="{filename}"',
                            "Access-Control-Allow-Origin": "*",
                        }
                    )

                # 6. 기본: 720p 원본 반환 (Range 지원)
                file_size = len(original_bytes)

                if range_header:
                    try:
                        start, end = parse_range_header(range_header, file_size)
                        chunk = original_bytes[start:end+1]
                        print(f"[{request_id}] Range: {start}-{end}/{file_size}")

                        return Response(
                            content=chunk,
                            status_code=206,
                            media_type="video/mp4",
                            headers={
                                "Content-Range": f"bytes {start}-{end}/{file_size}",
                                "Accept-Ranges": "bytes",
                                "Content-Length": str(len(chunk)),
                                "Content-Type": "video/mp4",
                                "Content-Disposition": f'attachment; filename="{filename}"',
                                "Access-Control-Allow-Origin": "*",
                            }
                        )
                    except ValueError as e:
                        raise HTTPException(416, f"Range not satisfiable: {str(e)}")

                # 전체 파일 반환
                return Response(
                    content=original_bytes,
                    status_code=200,
                    media_type="video/mp4",
                    headers={
                        "Accept-Ranges": "bytes",
                        "Content-Length": str(file_size),
                        "Content-Type": "video/mp4",
                        "Content-Disposition": f'attachment; filename="{filename}"',
                        "Access-Control-Allow-Origin": "*",
                    }
                )

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR]:")
        print(tb)
        raise HTTPException(500, f"Download error (request_id={request_id}): {type(e).__name__}: {str(e)}")

@fast_app.post("/api/v3/evolink/videos/generations")
async def create_evolink_video(request: Request):
    """Evolink 비디오 생성 태스크 생성"""
    request_id = str(uuid.uuid4())[:8]

    try:
        import httpx

        # ENV에서 Evolink 설정 읽기 (프론트에서 전달받음)
        body = await request.json()
        evolink_api_key = body.get("api_key") or os.getenv("EVOLINK_API_KEY")
        if not evolink_api_key:
            raise HTTPException(400, "evolink_api_key_missing: Provide api_key in request body")

        evolink_base_url = os.getenv("EVOLINK_BASE_URL", "https://api.evolink.ai")
        evolink_model_id = os.getenv("EVOLINK_MODEL_ID", "doubao-seedance-1.0-pro-fast")

        # 파라미터 추출
        prompt = body.get("prompt", "")
        image_urls = body.get("image_urls", [])
        duration = body.get("duration", 5)
        quality = body.get("quality", "720p")
        aspect_ratio = body.get("aspect_ratio", "16:9")

        print(f"[{request_id}] Evolink generation: duration={duration}s quality={quality}")

        # Evolink API 요청
        request_body = {
            "model": evolink_model_id,
            "prompt": prompt,
            "duration": duration,
            "quality": quality,
            "aspect_ratio": aspect_ratio
        }

        if image_urls:
            request_body["image_urls"] = image_urls

        endpoint = f"{evolink_base_url}/v1/videos/generations"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                endpoint,
                json=request_body,
                headers={
                    "Authorization": f"Bearer {evolink_api_key}",
                    "Content-Type": "application/json"
                }
            )

            print(f"[{request_id}] Evolink response: {response.status_code}")

            if response.status_code != 200:
                error_text = response.text
                print(f"[{request_id}] Evolink error: {error_text}")
                raise HTTPException(
                    response.status_code,
                    f"Evolink API failed (request_id={request_id}): {error_text}"
                )

            result = response.json()
            print(f"[{request_id}] Task created: {result.get('id')}")

            return JSONResponse(content=result, status_code=200)

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR]:")
        print(tb)
        raise HTTPException(
            500,
            f"Evolink generation error (request_id={request_id}): {type(e).__name__}: {str(e)}"
        )

@fast_app.get("/api/v3/evolink/tasks/{task_id}")
async def get_evolink_task(task_id: str, request: Request):
    """Evolink 태스크 상태 조회"""
    request_id = str(uuid.uuid4())[:8]

    try:
        import httpx

        # Authorization 헤더에서 API 키 추출
        auth_header = request.headers.get("Authorization")
        evolink_api_key = auth_header.replace("Bearer ", "") if auth_header else os.getenv("EVOLINK_API_KEY")
        if not evolink_api_key:
            raise HTTPException(400, "evolink_api_key_missing: Provide Authorization header")

        evolink_base_url = os.getenv("EVOLINK_BASE_URL", "https://api.evolink.ai")

        endpoint = f"{evolink_base_url}/v1/tasks/{task_id}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                endpoint,
                headers={"Authorization": f"Bearer {evolink_api_key}"}
            )

            if response.status_code != 200:
                error_text = response.text
                print(f"[{request_id}] Evolink task query error: {error_text}")
                raise HTTPException(
                    response.status_code,
                    f"Evolink task query failed (request_id={request_id}): {error_text}"
                )

            result = response.json()
            status = result.get("status")
            print(f"[{request_id}] Task {task_id}: {status}")

            return JSONResponse(content=result, status_code=200)

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR]:")
        print(tb)
        raise HTTPException(
            500,
            f"Evolink task query error (request_id={request_id}): {type(e).__name__}: {str(e)}"
        )

@fast_app.get("/api/v3/evolink/download")
async def download_evolink_video(request: Request, url: str = None):
    """Evolink 비디오 다운로드 프록시 (CORS 우회)"""
    request_id = str(uuid.uuid4())[:8]

    try:
        import httpx

        if not url:
            raise HTTPException(400, "url parameter missing")

        # SSRF 방지: evolink.ai 도메인만 허용
        if not ("evolink.ai" in url or "cdn.evolink.ai" in url):
            raise HTTPException(403, f"Invalid URL domain (request_id={request_id}): {url}")

        print(f"[{request_id}] Proxying Evolink video: {url[:80]}...")

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(url, follow_redirects=True)

            if response.status_code != 200:
                raise HTTPException(
                    502,
                    f"Upstream download failed (request_id={request_id}): HTTP {response.status_code}"
                )

            video_bytes = response.content
            file_size_mb = len(video_bytes) / (1024 * 1024)
            print(f"[{request_id}] Downloaded: {file_size_mb:.2f}MB")

            return Response(
                content=video_bytes,
                status_code=200,
                media_type="video/mp4",
                headers={
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(len(video_bytes)),
                    "Content-Type": "video/mp4",
                    "Content-Disposition": f'attachment; filename="evolink_video.mp4"',
                    "Access-Control-Allow-Origin": "*",
                }
            )

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR]:")
        print(tb)
        raise HTTPException(
            500,
            f"Evolink download error (request_id={request_id}): {type(e).__name__}: {str(e)}"
        )

@fast_app.post("/api/v3/runware/videos/generations")
async def create_runware_video(request: Request):
    """Runware 비디오 생성 (SeeDance 1.0 Pro Fast)"""
    request_id = str(uuid.uuid4())[:8]

    try:
        from runware import Runware, IImageInference

        body = await request.json()
        runware_api_key = body.get("api_key") or os.getenv("RUNWARE_API_KEY")
        if not runware_api_key:
            raise HTTPException(400, "runware_api_key_missing")

        image_url = body.get("image_url")
        prompt = body.get("prompt", "")
        duration = body.get("duration", 5)
        resolution = body.get("resolution", "720p")
        aspect_ratio = body.get("aspect_ratio", "16:9")

        if not image_url:
            raise HTTPException(400, "image_url required")

        # 해상도 매핑
        resolution_map = {
            "480p": {"width": 864, "height": 480},
            "720p": {"width": 1280, "height": 720},
            "1080p": {"width": 1920, "height": 1088}
        }
        size = resolution_map.get(resolution, {"width": 1280, "height": 720})

        print(f"[{request_id}] Runware generation: {resolution} ({size['width']}×{size['height']}) duration={duration}s")

        # Runware 클라이언트 초기화
        runware = Runware(api_key=runware_api_key)
        await runware.connect()

        # 비디오 생성 (image-to-video)
        task = await runware.videoInference(
            positivePrompt=prompt,
            model="bytedance:2@2",  # SeeDance 1.0 Pro Fast
            frameImages=[IImageInference(imageUUID=image_url)],
            duration=duration,
            width=size["width"],
            height=size["height"]
        )

        task_id = task[0].taskUUID
        print(f"[{request_id}] Task created: {task_id}")

        return JSONResponse(content={
            "id": task_id,
            "status": "processing",
            "video_url": None
        }, status_code=200)

    except Exception as e:
        # Billing Gate: insufficient credits 체크
        error_msg = str(e).lower()
        if "insufficient" in error_msg or "credits" in error_msg or "paid invoice" in error_msg:
            print(f"[{request_id}] BILLING ERROR: {str(e)}")
            raise HTTPException(402, f"runware_insufficient_credits: {str(e)}")

        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR]:")
        print(tb)
        raise HTTPException(500, f"Runware error (request_id={request_id}): {type(e).__name__}: {str(e)}")

@fast_app.get("/api/v3/runware/tasks/{task_id}")
async def get_runware_task(task_id: str, request: Request):
    """Runware 태스크 상태 조회"""
    request_id = str(uuid.uuid4())[:8]

    try:
        from runware import Runware

        auth_header = request.headers.get("Authorization")
        runware_api_key = auth_header.replace("Bearer ", "") if auth_header else os.getenv("RUNWARE_API_KEY")
        if not runware_api_key:
            raise HTTPException(400, "runware_api_key_missing")

        # Runware SDK는 task UUID로 결과 조회
        runware = Runware(api_key=runware_api_key)
        await runware.connect()

        result = await runware.getResponse(taskUUID=task_id)

        if result and len(result) > 0:
            video_url = result[0].videoURL if hasattr(result[0], 'videoURL') else None
            status = "completed" if video_url else "processing"

            return JSONResponse(content={
                "id": task_id,
                "status": status,
                "result": {"video_url": video_url} if video_url else None
            }, status_code=200)

        return JSONResponse(content={
            "id": task_id,
            "status": "processing",
            "result": None
        }, status_code=200)

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR]:")
        print(tb)
        raise HTTPException(500, f"Runware task query error (request_id={request_id}): {str(e)}")

@fast_app.get("/api/v3/runware/download")
async def download_runware_video(request: Request, url: str = None):
    """Runware 비디오 다운로드 프록시 (CORS 우회)"""
    request_id = str(uuid.uuid4())[:8]

    try:
        import httpx

        if not url:
            raise HTTPException(400, "url parameter missing")

        # SSRF 방지: runware.ai 도메인만 허용
        if not ("runware.ai" in url or "cdn.runware" in url):
            raise HTTPException(403, f"Invalid URL domain (request_id={request_id})")

        print(f"[{request_id}] Proxying Runware video: {url[:80]}...")

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(url, follow_redirects=True)

            if response.status_code != 200:
                raise HTTPException(502, f"Upstream download failed (request_id={request_id}): HTTP {response.status_code}")

            video_bytes = response.content
            file_size_mb = len(video_bytes) / (1024 * 1024)
            print(f"[{request_id}] Downloaded: {file_size_mb:.2f}MB")

            return Response(
                content=video_bytes,
                status_code=200,
                media_type="video/mp4",
                headers={
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(len(video_bytes)),
                    "Content-Type": "video/mp4",
                    "Content-Disposition": 'attachment; filename="runware_video.mp4"',
                    "Access-Control-Allow-Origin": "*",
                }
            )

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[{request_id}] [ERROR]:")
        print(tb)
        raise HTTPException(500, f"Runware download error (request_id={request_id}): {str(e)}")

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
    volumes={UPLOAD_DIR: upload_volume, CACHE_DIR: cache_volume},
    secrets=[modal.Secret.from_name("imgur-client-id")],
)
@modal.asgi_app()
def web():
    return fast_app
