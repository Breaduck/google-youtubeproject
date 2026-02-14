"""
exp/official-sdk — Lightricks 공식 ltx-pipelines SDK 실험 브랜치
비교 대상: diffusers distilled (main) vs official TI2VidTwoStagesPipeline (this)
목적: 다인물 얼굴 안정성 검증
"""
import modal

BUILD_VERSION = "exp/official-sdk-1.1"

# Python 3.11 (torchao FP8 호환)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1", "libglib2.0-0", "ffmpeg")
    .pip_install(
        "torch",
        "torchao",
        "accelerate",
        "sentencepiece",
        "huggingface_hub",
        "Pillow",
        "fastapi[standard]",
        "av",
        "numpy",
        "einops",
        "safetensors",
        "scipy",
        "soundfile",
    )
    .run_commands(
        # 공식 SDK 설치 (ltx-core → ltx-pipelines 순서 필수)
        "git clone --depth 1 https://github.com/Lightricks/LTX-2.git /tmp/ltx2 2>&1 | tail -3",
        "pip install /tmp/ltx2/packages/ltx-core --quiet",
        "pip install /tmp/ltx2/packages/ltx-pipelines --quiet",
        # ltx-core는 transformers 4.x 기준 빌드 → 5.x에서 ROPE_INIT_FUNCTIONS 호환 안됨
        "pip install 'transformers>=4.52,<5.0' --quiet",
        "python -c \"import transformers; print('transformers version:', transformers.__version__)\"",
    )
    .env({
        "HF_HOME": "/models",
        "HF_HUB_DISABLE_PROGRESS_BARS": "1",
        "PYTORCH_ALLOC_CONF": "expandable_segments:True",
        "PYTHONIOENCODING": "utf-8",
    })
)

app = modal.App("ltx-official-exp", image=image)
model_cache = modal.Volume.from_name("model-cache-official-exp", create_if_missing=True)

SAFE_PROMPT = (
    "Static locked camera, fixed tripod. Person blinks once slowly. "
    "No mouth movement. No body movement. No new objects appear. "
    "Photorealistic, high detail, natural skin texture."
)
NEGATIVE_PROMPT = (
    "text, watermark, subtitle, caption, logo, writing, letters, "
    "Chinese, Japanese, Korean, CJK, Hangul, Kanji, "
    "camera movement, pan, zoom, tilt, dolly, "
    "blurry, deformed, distorted, melting, morphing, "
    "multiple faces, face swap, identity change"
)


@app.cls(
    gpu="L40S",               # 48GB VRAM, 모델 ~36GB → 충분, A100-80GB 대비 51% 절감
    timeout=3600,
    volumes={"/models": model_cache},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class OfficialVideoGenerator:

    @modal.enter()
    def load_model(self):
        import os, torch
        from huggingface_hub import hf_hub_download, snapshot_download

        # Gemma3TextConfig transformers 5.x 호환 패치
        try:
            from transformers import Gemma3TextConfig
            _orig_init = Gemma3TextConfig.__init__
            def _patched_init(self, *a, **kw):
                _orig_init(self, *a, **kw)
                if not hasattr(self, 'rope_local_base_freq'):
                    self.rope_local_base_freq = getattr(self, 'rope_theta', 10000.0)
                if hasattr(self, 'rope_scaling') and isinstance(self.rope_scaling, dict):
                    if 'rope_type' not in self.rope_scaling:
                        self.rope_scaling['rope_type'] = self.rope_scaling.get('type', 'default')
            Gemma3TextConfig.__init__ = _patched_init
            print("[OFFICIAL] Gemma3TextConfig patched OK")
        except Exception as e:
            print(f"[OFFICIAL] Gemma3 patch skipped: {e}")

        hf_token = os.environ.get("HF_TOKEN")
        if not hf_token:
            raise ValueError("HF_TOKEN not found")

        REPO_ID = "Lightricks/LTX-2"
        CACHE   = "/models/ltx2-official-cache"

        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024**3
        gpu_name = torch.cuda.get_device_name(0)
        print(f"\n{'='*70}")
        print(f"[OFFICIAL] BUILD: {BUILD_VERSION}")
        print(f"[OFFICIAL] GPU: {gpu_name}  |  VRAM: {vram_gb:.1f} GB")
        print(f"{'='*70}")

        print("[OFFICIAL][1/3] Downloading FP8 checkpoint (dev, non-distilled)...")
        ckpt_path = hf_hub_download(
            repo_id=REPO_ID,
            filename="ltx-2-19b-dev-fp8.safetensors",
            cache_dir=CACHE, token=hf_token,
        )
        print(f"  checkpoint: {ckpt_path}")

        print("[OFFICIAL][2/3] Downloading spatial upscaler (996MB)...")
        upscaler_path = hf_hub_download(
            repo_id=REPO_ID,
            filename="ltx-2-spatial-upscaler-x2-1.0.safetensors",
            cache_dir=CACHE, token=hf_token,
        )
        print(f"  upscaler:   {upscaler_path}")

        print("[OFFICIAL][3/3] Downloading text_encoder / tokenizer (Gemma)...")
        gemma_root = snapshot_download(
            repo_id=REPO_ID,
            allow_patterns=["text_encoder/*", "tokenizer/*", "model_index.json"],
            cache_dir=CACHE, token=hf_token,
        )
        print(f"  gemma_root: {gemma_root}")

        from ltx_pipelines.ti2vid_two_stages import TI2VidTwoStagesPipeline
        from ltx_core.quantization import QuantizationPolicy

        print("[OFFICIAL] Loading TI2VidTwoStagesPipeline...")
        self.pipeline = TI2VidTwoStagesPipeline(
            checkpoint_path=ckpt_path,
            distilled_lora=[],
            spatial_upsampler_path=upscaler_path,
            gemma_root=gemma_root,
            loras=[],
            device="cuda",
            quantization=QuantizationPolicy.fp8_cast(),
        )
        vram_after = torch.cuda.memory_allocated() / 1024**3
        print(f"[OFFICIAL] Pipeline loaded OK | VRAM: {vram_after:.1f} GB / {vram_gb:.1f} GB")
        print(f"{'='*70}\n")

    @modal.method()
    def generate(self, data: dict) -> dict:
        import time, tempfile, os, base64
        import torch, numpy as np
        from PIL import Image
        from io import BytesIO
        from ltx_core.components.guiders import MultiModalGuiderParams
        from ltx_pipelines.utils.media_io import encode_video

        t_total_start = time.time()

        image_url  = data.get("image_url", "")
        num_frames = data.get("num_frames", 192)   # 8초 @ 24fps
        seed       = data.get("seed", 42)

        W, H = 1920, 1080

        print(f"\n{'='*60}")
        print(f"[OFFICIAL] generate() called")
        print(f"  frames={num_frames} ({num_frames/24:.1f}s @ 24fps), seed={seed}")
        print(f"{'='*60}")

        # ── 이미지 로드 ──────────────────────────────────────────
        if image_url.startswith("data:"):
            _, encoded = image_url.split(",", 1)
            ref_img = Image.open(BytesIO(base64.b64decode(encoded))).convert("RGB")
        else:
            import requests as _req
            ref_img = Image.open(BytesIO(_req.get(image_url, timeout=30).content)).convert("RGB")

        iw, ih = ref_img.size
        target_ar = W / H
        if iw / ih > target_ar:
            new_w = int(ih * target_ar)
            ref_img = ref_img.crop(((iw - new_w) // 2, 0, (iw + new_w) // 2, ih))
        else:
            new_h = int(iw / target_ar)
            ref_img = ref_img.crop((0, (ih - new_h) // 2, iw, (ih + new_h) // 2))
        ref_img = ref_img.resize((W, H), Image.Resampling.LANCZOS)
        print(f"[OFFICIAL] Input resized to {W}x{H}")

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            ref_img.save(f.name)
            img_path = f.name

        # ── 파이프라인 호출 ───────────────────────────────────────
        video_guider = MultiModalGuiderParams(
            cfg_scale=3.0, stg_scale=1.0, rescale_scale=0.7,
            modality_scale=3.0, skip_step=0, stg_blocks=[29],
        )
        audio_guider = MultiModalGuiderParams(
            cfg_scale=7.0, stg_scale=1.0, rescale_scale=0.7,
            modality_scale=3.0, skip_step=0, stg_blocks=[29],
        )

        t_gen_start = time.time()
        video_iter, _ = self.pipeline(
            prompt=SAFE_PROMPT,
            negative_prompt=NEGATIVE_PROMPT,
            seed=seed, height=H, width=W,
            num_frames=num_frames, frame_rate=24.0,
            num_inference_steps=40,
            video_guider_params=video_guider,
            audio_guider_params=audio_guider,
            images=[(img_path, 0, 1.0)],
            enhance_prompt=False,
        )
        print(f"[OFFICIAL] Generation done: {time.time()-t_gen_start:.1f}s")
        os.unlink(img_path)

        # ── 인코딩 ────────────────────────────────────────────────
        def _crop_iter(it):
            for chunk in it:
                yield chunk[:, :1080, :, :] if chunk.shape[1] > 1080 else chunk

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            out_path = f.name

        t_enc_start = time.time()
        with torch.no_grad():
            encode_video(
                video=_crop_iter(video_iter),
                fps=24, audio=None, audio_sample_rate=None,
                output_path=out_path, video_chunks_number=num_frames,
            )
        print(f"[OFFICIAL] Encoding done: {time.time()-t_enc_start:.1f}s")

        with open(out_path, "rb") as f:
            video_bytes = f.read()
        os.unlink(out_path)

        total_time = time.time() - t_total_start
        cost_usd   = total_time * 0.001104
        cost_krw   = int(cost_usd * 1470)
        print(f"[OFFICIAL] Total: {total_time:.1f}s | ₩{cost_krw}")

        import base64 as _b64
        return {
            "video_base64": _b64.b64encode(video_bytes).decode(),
            "total_time_sec": round(total_time, 1),
            "cost_usd": round(cost_usd, 4),
            "cost_krw": cost_krw,
            "engine": "official-TI2VidTwoStagesPipeline",
            "resolution": "1920x1080",
            "frames": num_frames,
        }


# ── ASGI 웹 앱 (CORS + 비동기 job queue) ─────────────────────────────────
@app.function(image=image, timeout=600)
@modal.asgi_app()
def web():
    import asyncio, uuid
    from fastapi import FastAPI, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse

    fast_app = FastAPI()
    fast_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    jobs: dict = {}  # {job_id: {"status", "result", "error"}}

    @fast_app.get("/health")
    def health():
        return {"status": "ok", "build": BUILD_VERSION, "engine": "official"}

    @fast_app.post("/start")
    async def start_generation(request: Request):
        data = await request.json()
        job_id = uuid.uuid4().hex[:8]
        jobs[job_id] = {"status": "running", "result": None, "error": None}

        async def _run():
            try:
                gen = OfficialVideoGenerator()
                result = await gen.generate.remote.aio(data)
                jobs[job_id]["result"] = result
                jobs[job_id]["status"] = "complete"
                print(f"[JOB {job_id}] complete")
            except Exception as e:
                jobs[job_id]["error"] = str(e)
                jobs[job_id]["status"] = "error"
                print(f"[JOB {job_id}] error: {e}")

        asyncio.create_task(_run())
        print(f"[JOB {job_id}] started")
        return JSONResponse({"job_id": job_id})

    @fast_app.get("/status/{job_id}")
    def job_status(job_id: str):
        if job_id not in jobs:
            return JSONResponse({"status": "not_found"}, status_code=404)
        job = jobs[job_id]
        if job["status"] == "error":
            return JSONResponse({"status": "error", "error": job["error"]})
        return JSONResponse({"status": job["status"]})

    @fast_app.get("/result/{job_id}")
    def job_result(job_id: str):
        if job_id not in jobs:
            return JSONResponse({"status": "not_found"}, status_code=404)
        job = jobs[job_id]
        if job["status"] != "complete":
            return JSONResponse({"status": job["status"]}, status_code=400)
        result = job["result"]
        del jobs[job_id]
        return JSONResponse(result)

    return fast_app
