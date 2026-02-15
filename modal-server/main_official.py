"""
exp/official-sdk — Diffusers LTX-2 공식 파이프라인
참조: https://huggingface.co/docs/diffusers/main/api/pipelines/ltx2
"""
import modal

BUILD_VERSION = "exp/official-sdk-2.0-diffusers"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1", "libglib2.0-0", "ffmpeg")
    .pip_install(
        "torch",
        "accelerate",
        "sentencepiece",
        "huggingface_hub",
        "Pillow",
        "fastapi[standard]",
        "av",
        "numpy",
        "safetensors",
        "scipy",
        "soundfile",
        "einops",
    )
    .run_commands(
        # LTX-2 지원은 diffusers main 브랜치
        "pip install git+https://github.com/huggingface/diffusers.git --quiet",
        "pip install 'transformers>=4.52,<5.0' --quiet",
        "python -c \"from diffusers.pipelines.ltx2 import LTX2ImageToVideoPipeline; print('Diffusers LTX-2 import OK')\"",
    )
    .env({
        "HF_HOME": "/models",
        "HF_HUB_DISABLE_PROGRESS_BARS": "1",
        "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
        "PYTHONIOENCODING": "utf-8",
    })
)

app = modal.App("ltx-official-exp", image=image)
model_cache = modal.Volume.from_name("model-cache-official-exp", create_if_missing=True)

PROMPT = (
    "Cinematic motion, natural character movement, high dynamic range, subtle motion"
)
NEGATIVE_PROMPT = (
    "text, watermark, subtitle, caption, logo, "
    "camera movement, pan, zoom, tilt, dolly, "
    "blurry, deformed, distorted, melting, morphing"
)

# Stage 1 해상도 → Latent Upsampler 2x → Stage 2 출력 1920x1088
W1, H1 = 960, 544


@app.cls(
    gpu="H100",
    timeout=3600,
    volumes={"/models": model_cache},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class OfficialVideoGenerator:

    @modal.enter()
    def load_model(self):
        import os, torch
        from diffusers.pipelines.ltx2 import LTX2ImageToVideoPipeline, LTX2LatentUpsamplePipeline
        from diffusers.pipelines.ltx2.latent_upsampler import LTX2LatentUpsamplerModel

        hf_token = os.environ.get("HF_TOKEN")
        if not hf_token:
            raise ValueError("HF_TOKEN not found")

        REPO_ID = "Lightricks/LTX-2"
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024**3
        print(f"\n{'='*70}")
        print(f"[DIFFUSERS] BUILD: {BUILD_VERSION}")
        print(f"[DIFFUSERS] GPU: {gpu_name}  |  VRAM: {vram_gb:.1f} GB")
        print(f"{'='*70}")

        print("[DIFFUSERS][1/3] Loading LTX2ImageToVideoPipeline (BF16)...")
        self.pipe = LTX2ImageToVideoPipeline.from_pretrained(
            REPO_ID,
            torch_dtype=torch.bfloat16,
            token=hf_token,
        )
        self.pipe.to("cuda")
        self.pipe.vae.enable_tiling()

        print("[DIFFUSERS][2/3] Loading distilled LoRA rank-384...")
        self.pipe.load_lora_weights(
            REPO_ID,
            adapter_name="stage_2_distilled",
            weight_name="ltx-2-19b-distilled-lora-384.safetensors",
            token=hf_token,
        )
        self.pipe.disable_lora()  # Stage 1에서는 비활성화

        print("[DIFFUSERS][3/3] Loading Latent Upsampler...")
        latent_upsampler = LTX2LatentUpsamplerModel.from_pretrained(
            REPO_ID,
            subfolder="latent_upsampler",
            torch_dtype=torch.bfloat16,
            token=hf_token,
        )
        self.upsample_pipe = LTX2LatentUpsamplePipeline(
            vae=self.pipe.vae,
            latent_upsampler=latent_upsampler,
        )
        self.upsample_pipe.to("cuda")

        # 원본 스케줄러 저장 (Stage 2에서 교체 후 복원용)
        import copy
        self.original_scheduler_config = copy.deepcopy(self.pipe.scheduler.config)

        vram_used = torch.cuda.memory_allocated() / 1024**3
        print(f"[DIFFUSERS] All loaded | VRAM: {vram_used:.1f} GB / {vram_gb:.1f} GB")
        print(f"{'='*70}\n")

    @modal.method()
    def generate(self, data: dict) -> dict:
        import time, tempfile, os, base64
        import torch
        from PIL import Image
        from io import BytesIO
        from diffusers import FlowMatchEulerDiscreteScheduler
        from diffusers.pipelines.ltx2.utils import STAGE_2_DISTILLED_SIGMA_VALUES
        from diffusers.pipelines.ltx2.export_utils import encode_video

        t_total_start = time.time()

        image_url  = data.get("image_url", "")
        num_frames = data.get("num_frames", 192)
        seed       = data.get("seed", 42)

        print(f"\n{'='*60}")
        print(f"[DIFFUSERS] generate() called")
        print(f"  frames={num_frames} ({num_frames/24:.1f}s @ 24fps), seed={seed}")
        print(f"{'='*60}")

        # 이미지 로드
        if image_url.startswith("data:"):
            _, encoded = image_url.split(",", 1)
            ref_img = Image.open(BytesIO(base64.b64decode(encoded))).convert("RGB")
        else:
            import requests as _req
            ref_img = Image.open(BytesIO(_req.get(image_url, timeout=30).content)).convert("RGB")

        # Stage 1 해상도로 크롭 + 리사이즈
        iw, ih = ref_img.size
        target_ar = W1 / H1
        if iw / ih > target_ar:
            new_w = int(ih * target_ar)
            ref_img = ref_img.crop(((iw - new_w) // 2, 0, (iw + new_w) // 2, ih))
        else:
            new_h = int(iw / target_ar)
            ref_img = ref_img.crop((0, (ih - new_h) // 2, iw, (ih + new_h) // 2))
        ref_img = ref_img.resize((W1, H1), Image.Resampling.LANCZOS)
        print(f"[DIFFUSERS] Input resized to {W1}x{H1}")

        generator = torch.Generator("cpu").manual_seed(seed)

        # Stage 1 스케줄러 복원
        self.pipe.scheduler = FlowMatchEulerDiscreteScheduler.from_config(
            self.original_scheduler_config
        )
        self.pipe.disable_lora()

        # ── Stage 1 ──────────────────────────────────────────────
        print("[DIFFUSERS] Stage 1: generating...")
        t1 = time.time()
        video_latent, audio_latent = self.pipe(
            image=ref_img,
            prompt=PROMPT,
            negative_prompt=NEGATIVE_PROMPT,
            width=W1,
            height=H1,
            num_frames=num_frames,
            frame_rate=24.0,
            num_inference_steps=20,
            guidance_scale=3.0,
            generator=generator,
            output_type="latent",
            return_dict=False,
        )
        print(f"[DIFFUSERS] Stage 1 done: {time.time()-t1:.1f}s")

        # ── Latent Upscale 2x ────────────────────────────────────
        print("[DIFFUSERS] Upscaling latents (2x)...")
        t2 = time.time()
        upscaled_latent = self.upsample_pipe(
            latents=video_latent,
            output_type="latent",
            return_dict=False,
        )[0]
        print(f"[DIFFUSERS] Upscale done: {time.time()-t2:.1f}s")

        # ── Stage 2 (distilled LoRA) ─────────────────────────────
        print("[DIFFUSERS] Stage 2: LoRA refinement...")
        t3 = time.time()
        self.pipe.enable_lora()
        self.pipe.set_adapters("stage_2_distilled", 1.0)
        self.pipe.scheduler = FlowMatchEulerDiscreteScheduler.from_config(
            self.original_scheduler_config,
            use_dynamic_shifting=False,
            shift_terminal=None,
        )

        video, audio = self.pipe(
            latents=upscaled_latent,
            audio_latents=audio_latent,
            prompt=PROMPT,
            negative_prompt=NEGATIVE_PROMPT,
            num_inference_steps=3,
            noise_scale=STAGE_2_DISTILLED_SIGMA_VALUES[0],
            sigmas=STAGE_2_DISTILLED_SIGMA_VALUES,
            guidance_scale=1.0,
            generator=generator,
            output_type="np",
            return_dict=False,
        )
        print(f"[DIFFUSERS] Stage 2 done: {time.time()-t3:.1f}s")

        # ── 인코딩 ────────────────────────────────────────────────
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            out_path = f.name

        t_enc = time.time()
        encode_video(
            video[0],
            fps=24.0,
            audio=audio[0].float().cpu(),
            audio_sample_rate=self.pipe.vocoder.config.output_sampling_rate,
            output_path=out_path,
        )
        print(f"[DIFFUSERS] Encoding done: {time.time()-t_enc:.1f}s")

        with open(out_path, "rb") as f:
            video_bytes = f.read()
        os.unlink(out_path)

        total_time = time.time() - t_total_start
        cost_usd   = total_time * 0.001097
        cost_krw   = int(cost_usd * 1470)
        print(f"[DIFFUSERS] Total: {total_time:.1f}s | ₩{cost_krw}")

        import base64 as _b64
        return {
            "video_base64": _b64.b64encode(video_bytes).decode(),
            "total_time_sec": round(total_time, 1),
            "cost_usd": round(cost_usd, 4),
            "cost_krw": cost_krw,
            "engine": "diffusers-LTX2ImageToVideoPipeline",
            "resolution": "1920x1088",
            "frames": num_frames,
        }


# ── ASGI 웹 앱 ────────────────────────────────────────────────────────────
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

    jobs: dict = {}

    @fast_app.get("/health")
    def health():
        return {"status": "ok", "build": BUILD_VERSION, "engine": "diffusers"}

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
