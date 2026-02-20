"""
브랜치2 — SeeDANCE 1.0 Pro-fast (BytePlus 공식)
모델: seedance-1.0-pro-fast
해상도: 1248×704 (16:9, 720p)
FPS: 24, Duration: 5s
"""
import modal

BUILD_VERSION = "seedance-1.0-pro-fast-byteplus"

# GPU 불필요 — API 호출만
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("fastapi", "requests", "Pillow")
    .env({"PYTHONIOENCODING": "utf-8"})
)

app = modal.App("seedance-experiment", image=image)
video_cache = modal.Volume.from_name("video-cache-seedance", create_if_missing=True)

# ── Safe Motion Mapper (v3.3과 동일) ───────────────────────────────────────
SAFE_MOTION_TEMPLATES = {
    "A": "quick head turn toward the listener",
    "B": "slight forward lean",
    "C": "raise one hand slightly below the chin (hand stays away from face)",
    "D": "micro nod once",
}
MOTION_HOLD_SUFFIX = ", then hold still, subtle breathing"

SCENE_DESC_FORBIDDEN = [
    "camera shake", "camera movement", "camera pan", "panning", "zooming",
    "open mouth", "talking", "speaking", "laughing", "crying",
    "angry face", "expressive face", "fast motion", "rapid movement",
]


@app.cls(
    cpu=2.0,  # GPU 불필요
    timeout=600,
    # secrets 제거: API 키는 request body에서 받음
)
class SeeDANCEVideoGenerator:

    @modal.enter()
    def setup(self):
        import os
        # API 엔드포인트 (BytePlus ModelArk 공식)
        self.api_base = os.environ.get("SEEDANCE_API_BASE", "https://ark.ap-southeast.bytepluses.com/api/v3")
        self.provider = os.environ.get("SEEDANCE_PROVIDER", "byteplus")
        self.model = "seedance-1-0-pro-fast-250528"  # BytePlus ModelArk model ID

        print(f"\n{'='*70}")
        print(f"[SEEDANCE] BUILD: {BUILD_VERSION}")
        print(f"[SEEDANCE] Provider: {self.provider}")
        print(f"[SEEDANCE] API Base: {self.api_base}")
        print(f"[SEEDANCE] API Key: from request body")
        print(f"{'='*70}\n")

    @modal.method()
    def generate(self, data: dict) -> dict:
        import time, base64, re, os
        import requests
        from io import BytesIO
        from PIL import Image as PILImage

        t_start = time.time()

        # ── REQUEST 파싱 ──────────────────────────────────────────────
        image_url = data.get("image_url", "")
        dialogue = data.get("dialogue", "")
        image_prompt_raw = data.get("image_prompt", "")
        seed = data.get("seed", 42)
        api_key = data.get("api_key", "")  # 프론트엔드에서 전달받은 API 키

        # API 키 검증
        if not api_key or len(api_key) < 10:
            raise ValueError("Invalid or missing API key. Please configure in frontend settings.")

        # SeeDANCE 1.0 Pro-fast: 5초 고정 (24fps × 5s = 120 frames)
        num_frames = 120
        duration_sec = 5.0

        print(f"\n{'='*70}")
        print(f"[REQUEST] dialogue='{dialogue[:80]}' (len={len(dialogue)})")
        print(f"[REQUEST] duration={duration_sec}s  num_frames={num_frames}  seed={seed}")
        print(f"[REQUEST] api_key={'*' * (len(api_key) - 4) + api_key[-4:] if len(api_key) > 4 else '***'}")

        # ── Safe Motion Mapper ────────────────────────────────────────
        def safe_motion_mapper(dlg: str) -> tuple:
            d = (dlg or "").strip()
            if "!" in d:
                key, preset = "A", "A-head-turn"
            elif "?" in d:
                key, preset = "D", "D-micro-nod"
            elif len(d) >= 20:
                key, preset = "B", "B-forward-lean"
            else:
                key, preset = "C", "C-hand-raise"
            return SAFE_MOTION_TEMPLATES[key] + MOTION_HOLD_SUFFIX, preset

        motion_desc, preset_name = safe_motion_mapper(dialogue)
        print(f"[MOTION] preset={preset_name}  motion_desc='{motion_desc}'")

        # ── scene_description 정제 ────────────────────────────────────
        scene_desc = image_prompt_raw or ""
        for _w in SCENE_DESC_FORBIDDEN:
            scene_desc = scene_desc.replace(_w, "").replace(_w.title(), "")
        scene_desc = re.sub(r'\s+', ' ', scene_desc).strip()[:200]
        if not scene_desc:
            scene_desc = "anime character in a clean 2D scene"

        # ── 프롬프트 조립 (SeeDANCE용) ─────────────────────────────────
        prompt = (
            f"A cinematic 2D anime scene, clean lineart, consistent character design, "
            f"stable facial features. Static camera, smooth animation. "
            f"Keep eyes open, minimal mouth movement. {scene_desc}. "
            f"Motion: {motion_desc}."
        )
        negative_prompt = (
            "closed eyes, eyes shut, face morphing, deformed face, "
            "jitter, flicker, camera movement, text, watermark"
        )

        print(f"[PROMPT] '{prompt[:150]}...'")
        print(f"{'='*70}\n")

        # ── 이미지 업로드 (base64) ─────────────────────────────────────
        if image_url.startswith("data:"):
            _, encoded = image_url.split(",", 1)
            img_data = base64.b64decode(encoded)
        else:
            img_data = requests.get(image_url, timeout=30).content

        img = PILImage.open(BytesIO(img_data)).convert("RGB")
        # SeeDANCE 1.0 Pro-fast: 1248×704 (16:9, 720p)
        img = img.resize((1248, 704), PILImage.Resampling.LANCZOS)
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode()

        # ── SeeDANCE API 호출 ──────────────────────────────────────────
        print(f"[API] Calling {self.provider} SeeDANCE API...")
        t_api = time.time()

        # BytePlus 공식 API 요청
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,  # seedance-1.0-pro-fast
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "image": f"data:image/png;base64,{img_base64}",
            "width": 1248,
            "height": 704,
            "num_frames": num_frames,
            "fps": 24,
            "duration": duration_sec,
            "seed": seed,
        }

        try:
            # 1단계: 비디오 생성 태스크 생성
            resp = requests.post(
                f"{self.api_base}/video/generations",
                headers=headers,
                json=payload,
                timeout=60,
            )
            resp.raise_for_status()
            result = resp.json()
            print(f"[API] Create task response: {result}")

            # task_id 추출 (BytePlus ModelArk 응답 형식)
            task_id = result.get("task_id") or result.get("id") or result.get("data", {}).get("task_id")
            if not task_id:
                raise ValueError(f"No task_id in response: {result}")

            print(f"[API] Task created: {task_id}")

            # 2단계: 태스크 완료 대기 (폴링)
            max_wait = 180  # 최대 3분
            poll_interval = 5
            elapsed = 0
            video_url = None

            while elapsed < max_wait:
                time.sleep(poll_interval)
                elapsed += poll_interval

                status_resp = requests.get(
                    f"{self.api_base}/video/generations/{task_id}",
                    headers=headers,
                    timeout=30,
                )
                status_resp.raise_for_status()
                status_result = status_resp.json()

                status = status_result.get("status") or status_result.get("data", {}).get("status")
                print(f"[API] Task {task_id} status: {status} ({elapsed}s)")

                if status in ["completed", "success", "complete"]:
                    video_url = (
                        status_result.get("video_url") or
                        status_result.get("url") or
                        status_result.get("data", {}).get("video_url") or
                        status_result.get("data", {}).get("url")
                    )
                    break
                elif status in ["failed", "error"]:
                    error_msg = status_result.get("error") or status_result.get("message", "Unknown error")
                    raise ValueError(f"Task failed: {error_msg}")

            if not video_url:
                raise TimeoutError(f"Task {task_id} did not complete within {max_wait}s")

            # 3단계: 비디오 다운로드
            print(f"[API] Downloading video from: {video_url[:80]}...")
            video_resp = requests.get(video_url, timeout=60)
            video_resp.raise_for_status()
            video_bytes = video_resp.content

            print(f"[API] Generation done: {time.time()-t_api:.1f}s")
            print(f"[API] Video size: {len(video_bytes)//1024}KB")

        except Exception as e:
            print(f"[API] Error: {e}")
            raise

        # ── 비용 계산 ─────────────────────────────────────────────────
        total_time = time.time() - t_start
        # CPU 인스턴스 비용 (거의 무시 가능, ~$0.0001/s)
        cpu_cost = total_time * 0.0001
        # API 비용: SeeDANCE 1.0 Pro-fast (BytePlus 공식)
        # 토큰 계산: (1248 × 704 × 24 × 5) / 1024 = 103,340 tokens
        # $1.00/1M tokens → 103,340 tokens = $0.1033 ≈ $0.10
        api_cost_usd = 0.10  # 5초 기준
        total_cost_usd = cpu_cost + api_cost_usd
        total_cost_krw = int(total_cost_usd * 1460)

        print(f"[COST] Total: {total_time:.1f}s | API: ${api_cost_usd} | ₩{total_cost_krw}")

        return {
            "video_base64": base64.b64encode(video_bytes).decode(),
            "total_time_sec": round(total_time, 1),
            "cost_usd": round(total_cost_usd, 4),
            "cost_krw": total_cost_krw,
            "engine": f"seedance-1.0-pro-fast",
            "resolution": "1248x704",
            "frames": num_frames,
            "duration": duration_sec,
        }


# ── 생성 + 저장 함수 (spawn 패턴, v3.4와 동일) ─────────────────────────────
@app.function(image=image, timeout=700, volumes={"/video-cache": video_cache})
def run_and_save(data: dict, job_id: str):
    import json, os, base64

    CACHE_DIR = "/video-cache"
    os.makedirs(CACHE_DIR, exist_ok=True)

    def _save_status(status_data: dict):
        with open(f"{CACHE_DIR}/{job_id}.json", "w") as f:
            json.dump(status_data, f)
        video_cache.commit()

    _save_status({"status": "running"})
    print(f"[RUN_AND_SAVE {job_id}] started")

    try:
        gen = SeeDANCEVideoGenerator()
        result = gen.generate.remote(data)

        video_bytes = base64.b64decode(result["video_base64"])
        with open(f"{CACHE_DIR}/{job_id}.mp4", "wb") as f:
            f.write(video_bytes)

        meta = {k: v for k, v in result.items() if k != "video_base64"}
        meta["status"] = "complete"
        _save_status(meta)
        print(f"[RUN_AND_SAVE {job_id}] complete → {len(video_bytes)//1024}KB")
    except Exception as e:
        _save_status({"status": "error", "error": str(e)})
        print(f"[RUN_AND_SAVE {job_id}] error: {e}")


# ── ASGI 웹 앱 (v3.4와 동일 구조) ───────────────────────────────────────────
@app.function(image=image, timeout=60, volumes={"/video-cache": video_cache})
@modal.asgi_app()
def web():
    import uuid, json, os
    from fastapi import FastAPI, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse, StreamingResponse

    fast_app = FastAPI()
    fast_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    CACHE_DIR = "/video-cache"

    def _read_status(job_id):
        video_cache.reload()
        p = f"{CACHE_DIR}/{job_id}.json"
        if not os.path.exists(p):
            return None
        with open(p) as f:
            return json.load(f)

    @fast_app.get("/health")
    def health():
        return {"status": "ok", "build": BUILD_VERSION, "engine": "seedance"}

    @fast_app.post("/start")
    async def start_generation(request: Request):
        data = await request.json()
        job_id = uuid.uuid4().hex[:8]
        run_and_save.spawn(data, job_id)
        print(f"[WEB] spawned job {job_id}")
        return JSONResponse({"job_id": job_id})

    @fast_app.get("/status/{job_id}")
    def job_status(job_id: str):
        st = _read_status(job_id)
        if st is None:
            return JSONResponse({"status": "running"})
        if st["status"] == "error":
            return JSONResponse({"status": "error", "error": st.get("error")})
        return JSONResponse({"status": st["status"]})

    @fast_app.get("/download/{job_id}")
    def download_video(job_id: str):
        video_cache.reload()
        vp = f"{CACHE_DIR}/{job_id}.mp4"
        if not os.path.exists(vp):
            return JSONResponse({"error": "not found"}, status_code=404)
        def _iter():
            with open(vp, "rb") as f:
                while chunk := f.read(1024 * 1024):
                    yield chunk
        return StreamingResponse(_iter(), media_type="video/mp4")

    return fast_app
