"""
exp/official-sdk — Diffusers LTX-2 공식 파이프라인
참조: https://huggingface.co/docs/diffusers/main/api/pipelines/ltx2
"""
import modal

BUILD_VERSION = "v3.5-fps12-default"

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

# ── Safe Motion Mapper 템플릿 ──────────────────────────────────────────────
SAFE_MOTION_TEMPLATES = {
    "A": "quick head turn toward the listener",
    "B": "slight forward lean",
    "C": "raise one hand slightly below the chin (hand stays away from face)",
    "D": "micro nod once",
}
MOTION_HOLD_SUFFIX = ", then hold still, subtle breathing"

# scene_description에서 제거할 모순 키워드
SCENE_DESC_FORBIDDEN = [
    "camera shake", "camera movement", "camera pan", "panning", "zooming",
    "open mouth", "talking", "speaking", "laughing", "crying",
    "angry face", "expressive face", "fast motion", "rapid movement",
]

NEGATIVE_PROMPT = (
    "closed eyes, eyes shut, squinting, "
    "face morphing, inconsistent face, deformed face, melted face, "
    "warped facial features, extra eyes, bad anatomy, "
    "jitter, flicker, unstable outlines, heavy motion blur, "
    "low quality, blurry, distorted, "
    "camera movement, pan, zoom, tilt, dolly, camera shake, "
    "text, watermark, subtitle, logo"
)

W1, H1 = 960, 544


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
        from diffusers.pipelines.ltx2 import LTX2ImageToVideoPipeline

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
        # A100-80GB: 모델 전체(~21GB)가 VRAM에 상주 → cpu_offload 제거
        self.pipe.to("cuda")
        self.pipe.vae.enable_tiling()

        # ── LoRA 로딩 (v3.0: 비활성화 — 커스텀 LoRA 훅 재활용 시 주석 해제) ──
        # self.pipe.load_lora_weights(
        #     REPO_ID,
        #     adapter_name="stage_2_distilled",
        #     weight_name="ltx-2-19b-distilled-lora-384.safetensors",
        #     token=hf_token,
        # )
        # self.pipe.disable_lora()

        vram_used = torch.cuda.memory_allocated() / 1024**3
        print(f"[DIFFUSERS] All loaded | VRAM: {vram_used:.1f} GB / {vram_gb:.1f} GB")
        print(f"{'='*70}\n")

    @modal.method()
    def generate(self, data: dict) -> dict:
        import time, tempfile, os, base64
        import torch
        from PIL import Image
        from io import BytesIO
        from diffusers.pipelines.ltx2.export_utils import encode_video

        t_total_start = time.time()
        import os as _os, re as _re, subprocess as _sp

        image_url       = data.get("image_url", "")
        raw_frames      = int(data.get("num_frames", 72))
        fps             = float(data.get("fps", 12.0))  # 기본 12 FPS
        duration_sec    = float(data.get("duration_sec", raw_frames / fps))  # duration 계산
        seed            = data.get("seed", 42)
        dialogue        = data.get("dialogue", "")
        image_prompt_raw = data.get("image_prompt", data.get("scene_description", ""))

        # num_frames: 상한 240 클램프 (12fps * 20초 최대)
        num_frames = raw_frames if raw_frames <= 240 else 120

        # ── 1단계 REQUEST 로그 ────────────────────────────────────────
        print(f"\n{'='*70}")
        print(f"[REQUEST] keys={list(data.keys())}")
        print(f"[REQUEST] FPS={fps}  Duration={duration_sec:.1f}s  NumFrames={raw_frames}→{num_frames}")
        print(f"[REQUEST] dialogue='{dialogue[:80]}' (len={len(dialogue)})")
        for _k in ("motion_desc", "motionDesc", "motion", "motions"):
            _v = data.get(_k)
            if _v is not None:
                print(f"[REQUEST] {_k}='{_v}'")
        print(f"[REQUEST] motion_desc_raw='{data.get('motion_desc', '')}'")
        print(f"[REQUEST] seed={seed}")

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

        motion_desc_final, preset_name = safe_motion_mapper(dialogue)
        print(f"[MOTION] preset={preset_name}  motion_desc_final='{motion_desc_final}'")

        # ── scene_description 정제 ────────────────────────────────────
        scene_desc = image_prompt_raw or ""
        for _w in SCENE_DESC_FORBIDDEN:
            scene_desc = scene_desc.replace(_w, "").replace(_w.title(), "")
        scene_desc = _re.sub(r'\s+', ' ', scene_desc).strip()[:200]
        if not scene_desc:
            scene_desc = "anime character in a clean 2D scene"

        # ── 프롬프트 조립 ─────────────────────────────────────────────
        PROMPT = (
            "A cinematic 2D anime scene, clean lineart, consistent character design, "
            "stable facial features, stable eyes and mouth shape, no face morphing, no lineart flicker. "
            "Static camera, smooth animation, high quality linework. "
            "Keep eyes open most of the time, consistent facial features throughout, minimal mouth movement. "
            f"{scene_desc}. "
            f"Motion: {motion_desc_final}."
        )

        # ── ENV 오버라이드 ────────────────────────────────────────────
        steps = int(_os.environ.get("LTX_STEPS", "12"))
        cfg   = float(_os.environ.get("LTX_CFG", "2.5"))

        # ── FINAL 로그 ────────────────────────────────────────────────
        print(f"[FINAL] fps={fps}  duration={duration_sec:.1f}s  num_frames={num_frames}")
        print(f"[FINAL] steps={steps}  cfg={cfg}  seed={seed}  preset={preset_name}")
        print(f"[FINAL] prompt_last_300='{PROMPT[-300:]}'")
        print(f"[FINAL] negative_prompt='{NEGATIVE_PROMPT}'")
        print(f"{'='*70}\n")

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

        def _gpu_stat(label):
            try:
                out = _sp.check_output([
                    "nvidia-smi",
                    "--query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total",
                    "--format=csv,noheader,nounits"
                ], text=True).strip()
                print(f"[GPU {label}] util={out}")
            except Exception as e:
                print(f"[GPU {label}] nvidia-smi failed: {e}")

        # ── Stage 1 ──────────────────────────────────────────────
        _gpu_stat("before_stage1")
        print("[DIFFUSERS] Stage 1: generating...")
        t1 = time.time()
        video_latent, audio_latent = self.pipe(
            image=ref_img,
            prompt=PROMPT,
            negative_prompt=NEGATIVE_PROMPT,
            width=W1,
            height=H1,
            num_frames=num_frames,
            frame_rate=fps,  # 요청받은 FPS 사용 (기본 12)
            num_inference_steps=steps,
            guidance_scale=cfg,
            generator=generator,
            output_type="latent",
            return_dict=False,
        )
        print(f"[DIFFUSERS] Stage 1 done: {time.time()-t1:.1f}s")
        _gpu_stat("after_stage1")

        # ── 외부 VAE decode (Stage 2 없이 바로 디코딩) ────────────
        print("[DIFFUSERS] VAE decoding...")
        t_dec = time.time()
        vae = self.pipe.vae
        print(f"  video_latent.shape={video_latent.shape}  dtype={video_latent.dtype}  device={video_latent.device}")

        # 모델이 bfloat16으로 로딩됨 → 직접 캐스팅 (next(parameters) 우회)
        z = (video_latent / float(vae.config.scaling_factor)).to(
            dtype=torch.bfloat16, device="cuda"
        )
        print(f"  z.shape={z.shape}  dtype={z.dtype}")

        with torch.no_grad():
            decoded = vae.decode(z).sample

        print(f"  decoded.shape={decoded.shape}  dtype={decoded.dtype}  device={decoded.device}")
        print(f"  decoded.min={decoded.min().item():.3f}  max={decoded.max().item():.3f}")

        # [B, C, T, H, W] → [T, H, W, C], [-1,1] → [0,1]
        decoded = decoded.clamp(-1, 1)
        decoded = (decoded + 1.0) / 2.0
        frames_np = decoded[0].permute(1, 2, 3, 0).float().cpu().numpy()
        print(f"  frames_np.shape={frames_np.shape}  range=[{frames_np.min():.3f}, {frames_np.max():.3f}]")

        # ── 오디오 decode ────────────────────────────────────────
        n_samples = int(num_frames / fps * self.pipe.vocoder.config.output_sampling_rate)
        with torch.no_grad():
            try:
                # vocoder도 bfloat16 weights → 동일하게 캐스팅
                audio_latent_bf16 = audio_latent.to(dtype=torch.bfloat16, device="cuda")
                audio_out = self.pipe.vocoder(audio_latent_bf16)
                if hasattr(audio_out, "audio_values"):
                    audio_out = audio_out.audio_values
                audio_tensor = audio_out[0].float().cpu()   # [C, samples] or [samples]
            except Exception as e:
                print(f"[AUDIO] vocoder decode 실패({e}), 무음으로 대체")
                audio_tensor = torch.zeros(2, n_samples)

        # encode_video는 stereo [2, samples] 필요
        if audio_tensor.dim() == 1:
            audio_tensor = audio_tensor.unsqueeze(0).expand(2, -1)
        elif audio_tensor.shape[0] == 1:
            audio_tensor = audio_tensor.expand(2, -1)
        print(f"  audio_tensor.shape={audio_tensor.shape}")
        print(f"[DIFFUSERS] VAE+Audio decode done: {time.time()-t_dec:.1f}s")
        _gpu_stat("after_decode")

        # ── 1단계: 초기 인코딩 (diffusers encode_video) ─────────────
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            out_path_initial = f.name

        t_enc = time.time()
        encode_video(
            frames_np,
            fps=fps,  # 요청받은 FPS 사용 (기본 12)
            audio=audio_tensor,
            audio_sample_rate=self.pipe.vocoder.config.output_sampling_rate,
            output_path=out_path_initial,
        )
        print(f"[ENCODE-1] Initial encode done ({fps} FPS): {time.time()-t_enc:.1f}s")

        # ffprobe 유틸 함수
        import json as _json
        def _ffprobe(path, label):
            try:
                cmd = [
                    "ffprobe", "-v", "error", "-show_entries",
                    "format=duration,size,bit_rate:stream=width,height,avg_frame_rate,codec_name,pix_fmt",
                    "-of", "json", path
                ]
                result = _sp.run(cmd, capture_output=True, text=True, check=True)
                data = _json.loads(result.stdout)
                print(f"[FFPROBE {label}]")
                if "format" in data:
                    fmt = data["format"]
                    dur = fmt.get("duration", "N/A")
                    size = fmt.get("size", "N/A")
                    br = fmt.get("bit_rate", "N/A")
                    print(f"  duration={dur}s  size={size}B ({int(size)//1024 if size != 'N/A' else 0}KB)  bit_rate={br}")
                if "streams" in data and len(data["streams"]) > 0:
                    vid = next((s for s in data["streams"] if s.get("codec_type") == "video"), {})
                    if vid:
                        print(f"  video: {vid.get('width')}x{vid.get('height')} {vid.get('codec_name')} {vid.get('pix_fmt')} fps={vid.get('avg_frame_rate')}")
            except Exception as e:
                print(f"[FFPROBE {label}] failed: {e}")

        _ffprobe(out_path_initial, "INITIAL")

        # ── 2단계: 고품질 재인코딩 (libx264 crf=18 animation) ─────────
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            out_path_final = f.name

        t_re = time.time()
        re_cmd = [
            "ffmpeg", "-y", "-i", out_path_initial,
            "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-tune", "animation",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-c:a", "aac", "-b:a", "128k",
            out_path_final
        ]
        _sp.run(re_cmd, check=True, capture_output=True)
        print(f"[ENCODE-2] Re-encode (crf=18 animation) done: {time.time()-t_re:.1f}s")

        _ffprobe(out_path_final, "FINAL")

        # 최종 파일 읽기
        with open(out_path_final, "rb") as f:
            video_bytes = f.read()

        # 임시 파일 정리
        os.unlink(out_path_initial)
        os.unlink(out_path_final)

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
            "resolution": f"{W1}x{H1}",
            "frames": num_frames,
            "fps": fps,
            "duration_sec": duration_sec,
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
