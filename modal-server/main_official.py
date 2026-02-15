"""
exp/official-sdk — Diffusers LTX-2 공식 파이프라인
참조: https://huggingface.co/docs/diffusers/main/api/pipelines/ltx2
"""
import modal

BUILD_VERSION = "exp/official-sdk-2.12-spawn-volume"

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
        "peft",
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
video_cache = modal.Volume.from_name("video-cache-official", create_if_missing=True)

PROMPT = (
    "Cinematic motion, natural character movement, high dynamic range, subtle motion"
)
NEGATIVE_PROMPT = (
    "text, watermark, subtitle, caption, logo, "
    "camera movement, pan, zoom, tilt, dolly, "
    "blurry, deformed, distorted, melting, morphing"
)

# Stage 1 해상도 → Latent Upsampler 2x → Stage 2 출력
W1, H1 = 960, 544
W2, H2 = 1920, 1088


@app.cls(
    gpu="A100-80GB",
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
        self.pipe.enable_model_cpu_offload(device="cuda:0")
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
        self.upsample_pipe.enable_model_cpu_offload(device="cuda:0")

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
        num_frames = data.get("num_frames", 121)  # 공식 기본값 (~5초 @ 24fps)
        seed       = data.get("seed", 42)

        print(f"\n{'='*60}")
        print(f"[DIFFUSERS] generate() called")
        print(f"  frames={num_frames} ({num_frames/24:.2f}s @ 24fps), seed={seed}")
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

        # prepare_latents monkey patch:
        # conditioning_mask를 항상 upscaled_latent.shape에서 직접 생성
        # → height/width/num_frames 역산 오차로 인한 shape 불일치 근본 차단
        import types as _types

        def _patched_prepare_latents(
            _self, image, batch_size, num_channels_latents,
            height, width, num_frames, noise_scale, dtype, device, generator, latents=None
        ):
            if latents is not None and latents.ndim == 5:
                B, C, T, H, W = latents.shape
                print(f"[PATCH] latent 5D: B={B} C={C} T={T} H={H} W={W}")
                mask_shape = (B, 1, T, H, W)
                conditioning_mask = latents.new_zeros(mask_shape)
                conditioning_mask[:, :, 0] = 1.0
                latents = _self._normalize_latents(
                    latents, _self.vae.latents_mean,
                    _self.vae.latents_std, _self.vae.config.scaling_factor
                )
                latents = _self._create_noised_state(
                    latents, noise_scale * (1 - conditioning_mask), generator
                )
                latents = _self._pack_latents(
                    latents,
                    _self.transformer_spatial_patch_size,
                    _self.transformer_temporal_patch_size,
                )
                conditioning_mask = _self._pack_latents(
                    conditioning_mask,
                    _self.transformer_spatial_patch_size,
                    _self.transformer_temporal_patch_size,
                ).squeeze(-1)
                return latents.to(device=device, dtype=dtype), conditioning_mask
            # 나머지 경로(image encode 등)는 원본 호출
            return _patched_prepare_latents._orig(_self, image, batch_size, num_channels_latents,
                                                   height, width, num_frames, noise_scale,
                                                   dtype, device, generator, latents)

        _patched_prepare_latents._orig = self.pipe.__class__.prepare_latents
        self.pipe.prepare_latents = _types.MethodType(_patched_prepare_latents, self.pipe)

        print(f"[DEBUG] upscaled_latent.shape={upscaled_latent.shape}")

        video, audio = self.pipe(
            latents=upscaled_latent,
            audio_latents=audio_latent,
            prompt=PROMPT,
            negative_prompt=NEGATIVE_PROMPT,
            height=H2,
            width=W2,
            num_frames=num_frames,
            frame_rate=24.0,
            num_inference_steps=3,
            noise_scale=STAGE_2_DISTILLED_SIGMA_VALUES[0],
            sigmas=STAGE_2_DISTILLED_SIGMA_VALUES,
            guidance_scale=1.0,
            generator=generator,
            output_type="np",
            return_dict=False,
        )

        # patch 해제 (다음 generate 호출에서 Stage 1이 영향 받지 않도록)
        del self.pipe.prepare_latents
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
        cost_usd   = total_time * 0.000694  # A100-80GB 단가
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


# ── 생성 + 저장 전담 함수 (spawn 패턴) ─────────────────────────────────────
@app.function(image=image, timeout=700, volumes={"/video-cache": video_cache})
def run_and_save(data: dict, job_id: str):
    """generate() 호출 후 결과를 Volume에 직접 저장. web() 함수와 완전히 독립."""
    import json, os, base64 as _b64

    CACHE_DIR = "/video-cache"
    os.makedirs(CACHE_DIR, exist_ok=True)

    def _save_status(status_data: dict):
        with open(f"{CACHE_DIR}/{job_id}.json", "w") as f:
            json.dump(status_data, f)
        video_cache.commit()

    # 시작 즉시 running 상태 기록
    _save_status({"status": "running"})
    print(f"[RUN_AND_SAVE {job_id}] started")

    try:
        gen = OfficialVideoGenerator()
        result = gen.generate.remote(data)

        # MP4 저장
        video_bytes = _b64.b64decode(result["video_base64"])
        with open(f"{CACHE_DIR}/{job_id}.mp4", "wb") as f:
            f.write(video_bytes)

        # 메타 저장
        meta = {k: v for k, v in result.items() if k != "video_base64"}
        meta["status"] = "complete"
        _save_status(meta)
        print(f"[RUN_AND_SAVE {job_id}] complete → {len(video_bytes)//1024}KB saved")
    except Exception as e:
        _save_status({"status": "error", "error": str(e)})
        print(f"[RUN_AND_SAVE {job_id}] error: {e}")


# ── ASGI 웹 앱 ────────────────────────────────────────────────────────────
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
        return {"status": "ok", "build": BUILD_VERSION, "engine": "diffusers"}

    @fast_app.post("/start")
    async def start_generation(request: Request):
        data = await request.json()
        job_id = uuid.uuid4().hex[:8]
        # spawn: fire-and-forget, run_and_save가 독립 컨테이너에서 실행
        run_and_save.spawn(data, job_id)
        print(f"[WEB] spawned job {job_id}")
        return JSONResponse({"job_id": job_id})

    @fast_app.get("/status/{job_id}")
    def job_status(job_id: str):
        st = _read_status(job_id)
        if st is None:
            return JSONResponse({"status": "running"})  # spawn 직후 파일 없을 수 있음
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
