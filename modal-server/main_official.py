"""
exp/official-sdk — Lightricks 공식 ltx-pipelines SDK 실험 브랜치
비교 대상: diffusers distilled (main) vs official TI2VidTwoStagesPipeline (this)
목적: 다인물 얼굴 안정성 검증
"""
import modal

BUILD_VERSION = "exp/official-sdk-1.0"

# Python 3.11 (torchao FP8 호환)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1", "libglib2.0-0", "ffmpeg")
    .pip_install(
        "torch",
        "torchao",
        "transformers",
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
    gpu="A100-40GB",          # 공식 FP8 checkpoint 27.1GB → A100 40GB 필요
    timeout=3600,
    volumes={"/models": model_cache},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class OfficialVideoGenerator:

    @modal.enter()
    def load_model(self):
        import os, torch
        from huggingface_hub import hf_hub_download, snapshot_download

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

        # ── 1. 모델 파일 다운로드 ──────────────────────────────────
        print("[OFFICIAL][1/4] Downloading FP8 checkpoint (27.1GB)...")
        ckpt_path = hf_hub_download(
            repo_id=REPO_ID,
            filename="ltx-2-19b-distilled-fp8.safetensors",
            cache_dir=CACHE, token=hf_token,
        )
        print(f"  checkpoint: {ckpt_path}")

        print("[OFFICIAL][2/4] Downloading spatial upscaler (996MB)...")
        upscaler_path = hf_hub_download(
            repo_id=REPO_ID,
            filename="ltx-2-spatial-upscaler-x2-1.0.safetensors",
            cache_dir=CACHE, token=hf_token,
        )
        print(f"  upscaler:   {upscaler_path}")

        print("[OFFICIAL][3/4] Downloading distilled LoRA (7.67GB)...")
        lora_path = hf_hub_download(
            repo_id=REPO_ID,
            filename="ltx-2-19b-distilled-lora-384.safetensors",
            cache_dir=CACHE, token=hf_token,
        )
        print(f"  lora:       {lora_path}")

        print("[OFFICIAL][4/4] Downloading text_encoder / tokenizer (Gemma)...")
        # gemma_root = snapshot root containing text_encoder/ and tokenizer/
        gemma_root = snapshot_download(
            repo_id=REPO_ID,
            allow_patterns=["text_encoder/*", "tokenizer/*", "model_index.json"],
            cache_dir=CACHE, token=hf_token,
        )
        print(f"  gemma_root: {gemma_root}")

        # ── 2. 공식 파이프라인 로드 ────────────────────────────────
        from ltx_pipelines.ti2vid_two_stages import TI2VidTwoStagesPipeline

        print("[OFFICIAL] Loading TI2VidTwoStagesPipeline...")
        vram_before = torch.cuda.memory_allocated() / 1024**3

        self.pipeline = TI2VidTwoStagesPipeline(
            checkpoint_path=ckpt_path,
            distilled_lora=[(lora_path, 1.0, None)],   # Stage2 distilled refinement
            spatial_upsampler_path=upscaler_path,
            gemma_root=gemma_root,
            loras=[],
            device="cuda",
            quantization=None,   # FP8 checkpoint은 이미 양자화됨
        )

        vram_after = torch.cuda.memory_allocated() / 1024**3
        print(f"[OFFICIAL] Pipeline loaded OK")
        print(f"[OFFICIAL] VRAM used: {vram_after:.1f} GB / {vram_gb:.1f} GB")
        print(f"{'='*70}\n")

    @modal.fastapi_endpoint(method="POST")
    def generate_official(self, request: dict):
        import time, tempfile, os, base64
        import torch, numpy as np
        from PIL import Image
        from io import BytesIO

        t_total_start = time.time()

        prompt     = request.get("prompt", SAFE_PROMPT)
        image_url  = request.get("image_url", "")
        num_frames = request.get("num_frames", 192)   # 8초 @ 24fps
        seed       = request.get("seed", 42)

        print(f"\n{'='*60}")
        print(f"[OFFICIAL] generate_official() called")
        print(f"  frames={num_frames} ({num_frames/24:.1f}s @ 24fps)")
        print(f"  seed={seed}")
        print(f"{'='*60}")

        # ── 이미지 로드 ──────────────────────────────────────────
        if image_url.startswith("data:"):
            _, encoded = image_url.split(",", 1)
            ref_img = Image.open(BytesIO(base64.b64decode(encoded))).convert("RGB")
        else:
            import requests as _req
            ref_img = Image.open(BytesIO(_req.get(image_url, timeout=30).content)).convert("RGB")

        # 960x544 (16:9, 32배수) → Stage2 후 1920x1088 → crop → 1920x1080
        W, H = 960, 544
        # center-crop to 960/544 aspect
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

        # 임시 파일로 저장 (official API는 파일 경로를 받음)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            ref_img.save(f.name)
            img_path = f.name

        # ── 파이프라인 호출 ───────────────────────────────────────
        from ltx_pipelines.ti2vid_two_stages import TI2VidTwoStagesPipeline
        from ltx_core.components.guiders import MultiModalGuiderParams

        video_guider = MultiModalGuiderParams(
            cfg_scale=3.0,
            stg_scale=1.0,
            rescale_scale=0.7,
            modality_scale=3.0,
            skip_step=0,
            stg_blocks=[29],
        )
        audio_guider = MultiModalGuiderParams(
            cfg_scale=7.0,
            stg_scale=1.0,
            rescale_scale=0.7,
            modality_scale=3.0,
            skip_step=0,
            stg_blocks=[29],
        )

        print(f"[OFFICIAL] Stage1: {W}x{H}, {num_frames}frames, 40steps, cfg=3.0, stg=1.0")
        t_gen_start = time.time()

        video_iter, audio_latent = self.pipeline(
            prompt=SAFE_PROMPT,
            negative_prompt=NEGATIVE_PROMPT,
            seed=seed,
            height=H,
            width=W,
            num_frames=num_frames,
            frame_rate=24.0,
            num_inference_steps=40,
            video_guider_params=video_guider,
            audio_guider_params=audio_guider,
            images=[(img_path, 0, 1.0)],
            enhance_prompt=False,
        )

        # 프레임 수집
        frames = list(video_iter)   # Iterator[Tensor] → list
        t_gen_end = time.time()
        gen_time = t_gen_end - t_gen_start
        print(f"[OFFICIAL] Generation done: {gen_time:.1f}s")
        os.unlink(img_path)

        # ── 1920x1080 크롭 및 MP4 인코딩 ─────────────────────────
        t_enc_start = time.time()
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            out_path = f.name

        _encode_to_mp4(frames, out_path, fps=24, crop_to_1080=True)
        enc_time = time.time() - t_enc_start
        print(f"[OFFICIAL] Encoding done: {enc_time:.1f}s")

        # ── 결과 반환 ─────────────────────────────────────────────
        with open(out_path, "rb") as f:
            video_bytes = f.read()
        os.unlink(out_path)

        total_time = time.time() - t_total_start
        cost_usd   = total_time * 0.000583    # A100-40GB
        cost_krw   = int(cost_usd * 1470)

        # ── 비교 테이블 출력 ──────────────────────────────────────
        print(f"\n{'='*60}")
        print(f"[COMPARISON TABLE]")
        print(f"{'Metric':<30} {'diffusers-distilled':>20} {'official':>20}")
        print(f"{'-'*70}")
        print(f"{'total_time_sec':<30} {'~274s (seq-offload)':>20} {total_time:>19.1f}s")
        print(f"{'estimated_cost_usd':<30} {'~$0.084':>20} ${cost_usd:>19.4f}")
        print(f"{'estimated_cost_krw':<30} {'~₩123':>20} {'₩'+str(cost_krw):>20}")
        print(f"{'multi_face_stability':<30} {'POOR (melting)':>20} {'TBD (check video)':>20}")
        print(f"{'STG guidance':<30} {'None':>20} {'stg_scale=1.0':>20}")
        print(f"{'upscaler':<30} {'bilinear interp':>20} {'official model':>20}")
        print(f"{'='*60}\n")

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


def _encode_to_mp4(frames, out_path: str, fps: int = 24, crop_to_1080: bool = True):
    """frames: list of Tensor [H, W, C] float32 0-1 → MP4 bt709 yuv420p"""
    import subprocess, tempfile, os, numpy as np
    from PIL import Image

    frame_dir = tempfile.mkdtemp()
    for i, f in enumerate(frames):
        if hasattr(f, "cpu"):
            f = f.cpu().float().numpy()
        img = (np.clip(f, 0, 1) * 255).astype(np.uint8)
        # crop 1920x1088 → 1920x1080 (8px bottom)
        if crop_to_1080 and img.shape[0] == 1088:
            img = img[:1080]
        Image.fromarray(img).save(os.path.join(frame_dir, f"frame_{i:05d}.png"))

    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", os.path.join(frame_dir, "frame_%05d.png"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-colorspace", "bt709",
        "-color_primaries", "bt709",
        "-color_trc", "bt709",
        "-color_range", "tv",
        "-crf", "18",
        out_path,
    ], check=True, capture_output=True)

    import shutil
    shutil.rmtree(frame_dir, ignore_errors=True)


# ── 헬스체크 ──────────────────────────────────────────────────────────
@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def health():
    return {"status": "ok", "build": BUILD_VERSION, "engine": "official"}
