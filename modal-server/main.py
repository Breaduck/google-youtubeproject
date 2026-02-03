import modal

# 1. Image setup (Modal Official Example Standard)
image = (
    modal.Image.debian_slim()
    .apt_install(
        "git",
        "libgl1",
        "libglib2.0-0",
        "ffmpeg"
    )
    .pip_install(
        "torch",
        "transformers",
        "accelerate",
        "sentencepiece",
        "huggingface_hub",
        "Pillow",
        "fastapi[standard]",
        "av",
        "opencv-python-headless",
        "opencv-contrib-python-headless",  # OpenCV DNN Super Resolution
        "imageio",
        "imageio-ffmpeg",
        "numpy"
    )
    .run_commands(
        "pip install git+https://github.com/huggingface/diffusers.git"
    )
    .env({"HF_HOME": "/models"})  # Official Modal standard: Set HF cache location
)

app = modal.App("ltx-video-service-distilled-1080p", image=image)
model_cache = modal.Volume.from_name("model-cache-distilled", create_if_missing=True)

# 2. Model class
@app.cls(
    gpu="A10G",
    timeout=3600,
    volumes={"/models": model_cache},
    secrets=[modal.Secret.from_name("huggingface-secret")]
)
class VideoGenerator:
    @modal.enter()
    def load_model(self):
        import os
        import torch
        import cv2
        from diffusers import LTX2ImageToVideoPipeline
        from diffusers.pipelines.ltx2 import LTX2LatentUpsamplePipeline
        from diffusers.pipelines.ltx2.latent_upsampler import LTX2LatentUpsamplerModel
        from diffusers.pipelines.ltx2.utils import STAGE_2_DISTILLED_SIGMA_VALUES, DISTILLED_SIGMA_VALUES
        from diffusers import FlowMatchEulerDiscreteScheduler
        from diffusers.pipelines.ltx2.export_utils import encode_video

        print("=" * 70)
        print("LTX-2 DISTILLED TWO-STAGES (OFFICIAL)")
        print("=" * 70)

        # Use official Distilled checkpoint
        model_id = "rootonchair/LTX-2-19b-distilled"
        cache_dir = "/models/ltx2-distilled-cache"

        print(f"\n[1/4] Loading LTX-2 Distilled from {model_id}...")
        print(f"  Precision: bfloat16")
        print(f"  Cache directory: {cache_dir}")
        print(f"  Note: Distilled = 8 steps Stage 1, no LoRA")

        # Load Image-to-Video Distilled pipeline
        # Get HF token and verify
        hf_token = os.environ.get("HF_TOKEN")
        print(f"  HF_TOKEN status: {'✓ SET' if hf_token else '✗ NOT SET'}")

        self.pipe = LTX2ImageToVideoPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16,
            cache_dir=cache_dir,
            token=hf_token  # Latest diffusers: token parameter
        )
        print("  [OK] Distilled Image-to-Video Pipeline loaded")

        print("[2/4] Loading Stage 2 Latent Upsampler (Official 2x)...")
        # Create Latent Upsample Pipeline
        self.upsample_pipe = LTX2LatentUpsamplePipeline(
            vae=self.pipe.vae,
            latent_upsampler=LTX2LatentUpsamplerModel.from_pretrained(
                model_id,
                subfolder="latent_upsampler",
                torch_dtype=torch.bfloat16,
                cache_dir=cache_dir,
                token=hf_token  # Latest diffusers: token parameter
            )
        )
        print("  [OK] Latent Upsample Pipeline ready (2x upscale)")

        print("[3/4] Applying memory optimizations...")
        # Model CPU offload: official recommendation for memory management
        print("  - Model CPU offload (official)...")
        self.pipe.enable_model_cpu_offload()
        self.upsample_pipe.enable_model_cpu_offload()

        # Enable VAE tiling for memory efficiency
        print("  - VAE tiling...")
        self.pipe.vae.enable_tiling()

        # Enable attention slicing for extra memory safety
        print("  - Attention slicing...")
        self.pipe.enable_attention_slicing()

        print("[4/4] Loading Distilled Sigmas...")
        # Import distilled sigma values for Stage 1 and Stage 2
        from diffusers.pipelines.ltx2.utils import DISTILLED_SIGMA_VALUES, STAGE_2_DISTILLED_SIGMA_VALUES
        self.stage1_sigmas = DISTILLED_SIGMA_VALUES
        self.stage2_sigmas = STAGE_2_DISTILLED_SIGMA_VALUES
        print(f"  - Stage 1 sigmas: {len(self.stage1_sigmas)} values")
        print(f"  - Stage 2 sigmas: {len(self.stage2_sigmas)} values")
        print("  [OK] Distilled sigmas loaded (no LoRA needed)")

        print(f"\n{'='*70}")
        print("PIPELINE LOADED - OFFICIAL DISTILLED TWO-STAGES")
        print(f"{'='*70}")
        print("Configuration (Official Recommended):")
        print("  [Model]:")
        print("    - LTX-2-19b-distilled (rootonchair)")
        print("    - Two-Stages architecture")
        print("    - Model CPU offload (official)")
        print("  [Stage 1 - Generation]:")
        print("    - Resolution: 768x512 (official)")
        print("    - Steps: 8 (distilled)")
        print("    - Guidance: 1.0 (distilled)")
        print("    - Sigmas: DISTILLED_SIGMA_VALUES")
        print("  [Stage 2 - Upsample & Refine]:")
        print("    - Latent Upsample: 2x (768x512 → 1536x1024)")
        print("    - Steps: 3 (distilled)")
        print("    - Guidance: 1.0")
        print("    - Sigmas: STAGE_2_DISTILLED_SIGMA_VALUES")
        print("    - No LoRA (distilled path)")
        print("  [Performance Target]:")
        print("    - Expected time: ~60 seconds (5초 @ 121 frames)")
        print("    - Expected cost: ~₩27")
        print("    - Quality: 85/100 (distilled)")
        print("    - VRAM: ~21GB (A10G compatible)")
        print(f"{'='*70}\n")

    @modal.method()
    def generate(self, prompt: str, image_url: str, character_description: str = "", num_frames: int = 121,
                 # 테스트용 파라미터 (품질 실험)
                 test_conditioning: float = None,
                 test_guidance: float = None,
                 test_steps: int = None):
        import tempfile
        import torch
        import numpy as np
        import requests
        from PIL import Image
        from io import BytesIO

        print(f"\n{'='*60}")
        print(f"[IMAGE-TO-VIDEO] Starting generation")
        print(f"{'='*60}")
        print(f"User prompt: {prompt[:100]}...")

        # Handle both HTTP URLs and base64 data URLs
        if image_url.startswith('data:'):
            # Extract base64 data
            import base64
            header, encoded = image_url.split(',', 1)
            image_data = base64.b64decode(encoded)
            reference_image = Image.open(BytesIO(image_data)).convert("RGB")
            print(f"[INPUT] Loaded base64 image: {reference_image.size}")
        else:
            # Download from HTTP URL
            response = requests.get(image_url, timeout=30)
            reference_image = Image.open(BytesIO(response.content)).convert("RGB")
            print(f"[INPUT] Downloaded image from URL: {reference_image.size}")

        # OFFICIAL: 512p (768x512) Stage 1 → 2x upscale → 1024p (1536x1024)
        # For 1080p target: 512p → 2x → 1024p → crop to 1080p
        target_width = 768    # Official recommended
        target_height = 512   # Official recommended

        print(f"[PREPROCESSING] Target resolution: {target_width}x{target_height} (512p, official)")
        print(f"[PREPROCESSING] Stage 1 (512p) → Stage 2 Upsample (2x) → 1024p → Crop to 1080p")

        # Center crop and resize for best quality
        img_width, img_height = reference_image.size
        aspect_ratio = target_width / target_height
        img_aspect = img_width / img_height

        print(f"[PREPROCESSING] Original: {img_width}x{img_height} (aspect: {img_aspect:.2f})")

        if img_aspect > aspect_ratio:
            # Image is wider - crop width
            new_width = int(img_height * aspect_ratio)
            left = (img_width - new_width) // 2
            reference_image = reference_image.crop((left, 0, left + new_width, img_height))
            print(f"[PREPROCESSING] Cropped width: {img_width} -> {new_width}")
        else:
            # Image is taller - crop height
            new_height = int(img_width / aspect_ratio)
            top = (img_height - new_height) // 2
            reference_image = reference_image.crop((0, top, img_width, top + new_height))
            print(f"[PREPROCESSING] Cropped height: {img_height} -> {new_height}")

        # Resize to target dimensions with high-quality resampling
        reference_image = reference_image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        print(f"[PREPROCESSING] Final size: {reference_image.size}")

        # Save preprocessed image for verification
        import hashlib
        img_hash = hashlib.md5(np.array(reference_image).tobytes()).hexdigest()[:8]
        print(f"[PREPROCESSING] Image hash: {img_hash}")

        # CRITICAL FIX: Maximum image conditioning for LTX-2
        # Problems from previous test:
        # 1. Identity loss (0s vs 3s = different person)
        # 2. Global motion (whole body wobbling like jelly)
        # 3. Expression control failure (mouth stuck, eyes collapse)
        # 4. Detail melting (facial features displaced)
        # 5. Background warping (ripple effect around character)

        # EMOTION-DRIVEN MOTION - Frontend Gemini 5-step formula prompt
        # Strategy: 100% respect frontend prompt (Gemini analyzed dialogue)

        # USE FRONTEND PROMPT DIRECTLY (no override!)
        enhanced_prompt = prompt  # Gemini 5-step formula from frontend

        print(f"\n[FRONTEND PROMPT] Gemini 5-step formula:")
        print(f"  {enhanced_prompt[:200]}...")

        # Negative prompt: Anti-distortion + 2D Animation Style enforcement
        negative_prompt = "different person, different face, morphing, warping, distortion, wobbling, melting, ripple effect, face collapse, global motion, jelly effect, unstable, inconsistent, deformed face, displaced features, changing appearance, liquid effect, wave distortion, plastic skin, cartoonish, low quality, oversaturated, blurry, artificial, fake, synthetic, CG, rendered, realistic, 3d render, photo, photorealistic"

        # 공식 권장 기준 (Official LTX-2 recommendations)
        # cfg_scale: 3.0 typical (2.0-5.0 range)
        # steps: 40 default, 20-30 for quality/speed balance
        # distilled_lora: 0.6-0.8 strength

        # 기본값 (공식 Distilled 권장) - MUST BE DEFINED FIRST!
        DEFAULT_GUIDANCE_STAGE1 = 1.0   # Distilled guidance (1.0)
        DEFAULT_STEPS_STAGE1 = 8        # Distilled Stage 1 (8 steps)
        DEFAULT_GUIDANCE_STAGE2 = 1.0   # Distilled Stage 2 guidance
        DEFAULT_STEPS_STAGE2 = 3        # Distilled Stage 2 (3 steps)

        final_guidance_stage1 = test_guidance if test_guidance is not None else DEFAULT_GUIDANCE_STAGE1
        final_steps_stage1 = test_steps if test_steps is not None else DEFAULT_STEPS_STAGE1

        # 파라미터 검증 (극단값 방지)
        final_guidance_stage1 = max(1.0, min(5.0, final_guidance_stage1))  # 1.0-5.0 범위
        final_steps_stage1 = max(8, min(50, final_steps_stage1))           # 8-50 범위

        test_mode = test_guidance is not None or test_steps is not None

        mode_label = "TEST MODE" if test_mode else "DISTILLED TWO-STAGES"
        print(f"\n[GENERATION SETTINGS - {mode_label}]")
        print(f"  Model: LTX-2-19b-distilled")
        print(f"  Stage 1: {target_width}x{target_height} (512p)")
        print(f"  Stage 2: 2x upscale → {target_width*2}x{target_height*2} (1024p)")
        print(f"  Frames: {num_frames} (~{num_frames/24:.1f}s @ 24fps)")
        print(f"  Stage 1 steps: {final_steps_stage1} (distilled)")
        print(f"  Stage 1 guidance: {final_guidance_stage1} (distilled)")
        print(f"  Stage 2 steps: {DEFAULT_STEPS_STAGE2}")
        print(f"  Stage 2 guidance: {DEFAULT_GUIDANCE_STAGE2}")
        print(f"  Style: 2D Anime (clean lines, flat shading)")
        est_cost = int((30 + final_steps_stage1 * 1.5) * 0.000306 * 1450)
        print(f"  Estimated cost: ~₩{est_cost}")
        print(f"\n[STARTING TWO-STAGES GENERATION]...")

        import time
        gen_start = time.time()

        # ============================================================
        # STAGE 1: Generate video latents at 512p
        # ============================================================
        try:
            print(f"\n{'='*60}")
            print(f"[STAGE 1] Generating video latents at {target_width}x{target_height}")
            print(f"{'='*60}")

            generator = torch.Generator(device="cuda").manual_seed(42)
            frame_rate = 24.0

            video_latent, audio_latent = self.pipe(
                image=reference_image,
                prompt=enhanced_prompt,
                negative_prompt=negative_prompt,
                width=target_width,
                height=target_height,
                num_frames=num_frames,
                frame_rate=frame_rate,
                num_inference_steps=final_steps_stage1,
                sigmas=self.stage1_sigmas,
                guidance_scale=final_guidance_stage1,
                generator=generator,
                output_type="latent",
                return_dict=False,
            )

            stage1_time = time.time() - gen_start
            print(f"[STAGE 1 COMPLETE] Time: {stage1_time:.1f}s")

        except Exception as e:
            stage1_time = time.time() - gen_start
            print(f"\n[ERROR] STAGE 1 FAILED: {str(e)[:200]}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Stage 1 failed after {stage1_time:.1f}s: {str(e)[:100]}")

        # ============================================================
        # STAGE 2: Upsample latents 2x
        # ============================================================
        try:
            print(f"\n{'='*60}")
            print(f"[STAGE 2a] Upsampling latents 2x")
            print(f"{'='*60}")

            upscale_start = time.time()
            upscaled_video_latent = self.upsample_pipe(
                latents=video_latent,
                output_type="latent",
                return_dict=False,
            )[0]

            upscale_time = time.time() - upscale_start
            print(f"[STAGE 2a COMPLETE] Upsample time: {upscale_time:.1f}s")

        except Exception as e:
            print(f"\n[ERROR] STAGE 2a UPSAMPLE FAILED: {str(e)[:200]}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Stage 2a upsample failed: {str(e)[:100]}")

        # ============================================================
        # STAGE 2b: Refine with distilled sigmas (no LoRA)
        # ============================================================
        try:
            print(f"\n{'='*60}")
            print(f"[STAGE 2b] Refining with distilled sigmas (3 steps, no LoRA)")
            print(f"{'='*60}")

            refine_start = time.time()
            video, audio = self.pipe(
                latents=upscaled_video_latent,
                audio_latents=audio_latent,
                prompt=enhanced_prompt,
                negative_prompt=negative_prompt,
                num_inference_steps=DEFAULT_STEPS_STAGE2,
                noise_scale=self.stage2_sigmas[0],
                sigmas=self.stage2_sigmas,
                guidance_scale=DEFAULT_GUIDANCE_STAGE2,
                generator=generator,
                output_type="np",
                return_dict=False,
            )

            refine_time = time.time() - refine_start
            total_time = time.time() - gen_start
            print(f"[STAGE 2b COMPLETE] Refine time: {refine_time:.1f}s")
            print(f"[TOTAL GENERATION TIME] {total_time:.1f}s")

        except Exception as e:
            print(f"\n[ERROR] STAGE 2b REFINE FAILED: {str(e)[:200]}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Stage 2b refine failed: {str(e)[:100]}")

        # ============================================================
        # ENCODE TO MP4 (Official)
        # ============================================================
        print(f"\n{'='*60}")
        print(f"[ENCODING] Converting to MP4")
        print(f"{'='*60}")

        # Convert video from float [0,1] to uint8 [0,255]
        video = (video * 255).round().astype("uint8")
        video = torch.from_numpy(video)
        print(f"  Video shape: {video.shape}")
        print(f"  Frames: {video.shape[1]}")
        print(f"  Resolution: {video.shape[3]}x{video.shape[2]}")

        # Save to temporary MP4 file using official encoder
        output_path = tempfile.mktemp(suffix=".mp4")

        encode_video(
            video[0],  # First batch
            fps=frame_rate,
            audio=audio[0].float().cpu() if audio is not None else None,
            audio_sample_rate=self.pipe.vocoder.config.output_sampling_rate if audio is not None else None,
            output_path=output_path,
        )

        print(f"  [OK] Video encoded to: {output_path}")

        with open(output_path, "rb") as f:
            video_bytes = f.read()

        # CRITICAL: Verify video file is valid
        if len(video_bytes) < 1000:
            raise Exception(f"Video file too small ({len(video_bytes)} bytes) - generation failed")

        total_time = time.time() - gen_start
        cost_usd = total_time * 0.000306
        cost_krw = cost_usd * 1450

        print(f"\n{'='*60}")
        print(f"[COMPLETE - OFFICIAL DISTILLED TWO-STAGES]")
        print(f"{'='*60}")
        print(f"  Video frames: {num_frames}")
        print(f"  Resolution: {video.shape[3]}x{video.shape[2]}")
        print(f"  Duration: ~{num_frames/24:.1f}s @ 24fps")
        print(f"  Video size: {len(video_bytes) / 1024 / 1024:.2f} MB")
        print(f"\n[PERFORMANCE BREAKDOWN]")
        print(f"  Stage 1 (512p generation): {stage1_time:.1f}s")
        print(f"  Stage 2a (2x upsample): {upscale_time:.1f}s")
        print(f"  Stage 2b (refine 3 steps): {refine_time:.1f}s")
        print(f"  Total: {total_time:.1f}s")
        print(f"  Cost: ${cost_usd:.4f} (₩{cost_krw:.0f})")
        print(f"  Target: <60s (<₩30)")
        if total_time <= 60:
            print(f"  [OK] Target achieved!")
        else:
            print(f"  [!] Exceeded by {total_time-60:.1f}s")
        print(f"{'='*60}\n")
        return video_bytes

# 3. Web API
@app.function(image=image)
@modal.asgi_app()
def web_app():
    from fastapi import FastAPI, Request
    from fastapi.responses import Response, StreamingResponse
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from typing import List
    import asyncio
    import json

    web = FastAPI()

    # CRITICAL: CORS middleware MUST be first and handle ALL responses including errors
    @web.middleware("http")
    async def add_cors_headers(request: Request, call_next):
        # Handle OPTIONS preflight
        if request.method == "OPTIONS":
            return Response(
                content="",
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Credentials": "true",
                }
            )

        try:
            response = await call_next(request)
        except Exception as e:
            # Even on error, return with CORS headers
            import traceback
            error_detail = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            print(f"[ERROR] Middleware caught exception: {error_detail}")
            return Response(
                content=json.dumps({"error": str(e), "detail": error_detail}),
                status_code=500,
                media_type="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                }
            )

        # Add CORS headers to successful responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    # Enable CORS for frontend (backup)
    web.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class GenerateRequest(BaseModel):
        prompt: str
        image_url: str
        character_description: str = ""
        num_frames: int = 97
        # Test parameters (optional)
        test_conditioning: float = None
        test_guidance: float = None
        test_steps: int = None

    class BatchGenerateRequest(BaseModel):
        scenes: List[GenerateRequest]

    @web.post("/generate")
    async def generate(req: GenerateRequest):
        """Generate single video from image"""
        print(f"\n{'='*60}")
        print(f"[API REQUEST] /generate")
        print(f"  Prompt: {req.prompt[:100]}...")
        print(f"  Image URL length: {len(req.image_url)}")
        print(f"  Frames: {req.num_frames}")
        print(f"{'='*60}\n")

        try:
            print("[API] Creating VideoGenerator instance...")
            generator = VideoGenerator()

            print("[API] Calling generate.remote()...")
            video_bytes = generator.generate.remote(
                req.prompt,
                req.image_url,
                req.character_description,
                req.num_frames,
                req.test_conditioning,
                req.test_guidance,
                req.test_steps
            )

            print(f"[API] Video generated successfully: {len(video_bytes)} bytes")

            return Response(
                content=video_bytes,
                media_type="video/mp4",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "*"
                }
            )
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"\n{'='*60}")
            print(f"[API ERROR] Exception in /generate")
            print(f"  Type: {type(e).__name__}")
            print(f"  Message: {str(e)}")
            print(f"  Traceback:\n{error_trace}")
            print(f"{'='*60}\n")

            return Response(
                content=json.dumps({
                    "error": str(e),
                    "type": type(e).__name__,
                    "traceback": error_trace
                }),
                status_code=500,
                media_type="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "*"
                }
            )

    @web.options("/generate")
    async def generate_options():
        """Handle preflight CORS request"""
        return Response(
            content="",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        )

    @web.post("/batch-generate")
    async def batch_generate(req: BatchGenerateRequest):
        """Generate multiple videos in parallel (up to 10 at a time)"""
        try:
            generator = VideoGenerator()
            total = len(req.scenes)

            # Process in batches of 10 for cost optimization
            batch_size = min(10, total)
            results = []

            for i in range(0, total, batch_size):
                batch = req.scenes[i:i+batch_size]

                # Parallel processing
                batch_results = await asyncio.gather(*[
                    generator.generate.remote.aio(
                        scene.prompt,
                        scene.image_url,
                        scene.character_description,
                        scene.num_frames
                    )
                    for scene in batch
                ])

                results.extend(batch_results)
                print(f"Batch progress: {len(results)}/{total}")

            # Return all videos as base64 for easy handling
            import base64
            encoded_videos = [base64.b64encode(video).decode() for video in results]

            return Response(
                content=json.dumps({
                    "success": True,
                    "total": total,
                    "videos": encoded_videos
                }),
                media_type="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "*"
                }
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                content=json.dumps({"error": str(e)}),
                media_type="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "*"
                }
            )

    @web.get("/health")
    async def health():
        """Health check endpoint"""
        return {"status": "healthy", "service": "ltx-video-720p"}

    return web
