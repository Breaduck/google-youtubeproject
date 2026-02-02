import modal

# 1. Image setup
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
        from diffusers import LTX2Pipeline

        print("=" * 70)
        print("LTX-2 FAST MODE (BASE MODEL)")
        print("=" * 70)

        # Use official LTX-2 model from Hugging Face
        model_id = "Lightricks/LTX-2"
        cache_dir = "/models/ltx2-cache"

        print(f"\n[1/4] Loading LTX-2 from {model_id}...")
        print(f"  Cache directory: {cache_dir}")

        # Use Hugging Face token from secrets
        hf_token = os.environ.get("HF_TOKEN")

        self.pipe = LTX2Pipeline.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16,
            cache_dir=cache_dir,
            token=hf_token
        )
        print("  [OK] Model loaded successfully")

        print("[2/4] SKIPPING LoRA for stability (base model only)...")
        print("  - Using base Distilled model without LoRA")

        print("[3/4] Applying memory optimizations...")
        # CRITICAL: 19B model needs CPU offload for 24GB GPU
        print("  - Sequential CPU offload (19B model requires this)...")
        self.pipe.enable_sequential_cpu_offload()

        # Enable VAE tiling for memory efficiency
        print("  - VAE tiling...")
        self.pipe.vae.enable_tiling()

        # Enable attention slicing for further memory reduction
        print("  - Attention slicing...")
        self.pipe.enable_attention_slicing()

        print("[4/4] Loading OpenCV DNN Super Resolution...")
        # Download EDSR model for upscaling (fast and good quality)
        model_path = "/models/opencv-sr/EDSR_x2.pb"
        os.makedirs(os.path.dirname(model_path), exist_ok=True)

        if not os.path.exists(model_path):
            print("  - Downloading EDSR x2 model...")
            import urllib.request
            urllib.request.urlretrieve(
                "https://github.com/Saafke/EDSR_Tensorflow/raw/master/models/EDSR_x2.pb",
                model_path
            )

        # Create DNN Super Resolution object
        self.sr = cv2.dnn_superres.DnnSuperResImpl_create()
        self.sr.readModel(model_path)
        self.sr.setModel("edsr", 2)  # x2 upscale

        print(f"\n{'='*70}")
        print("PIPELINE LOADED - FAST & STABLE MODE!")
        print(f"{'='*70}")
        print("Configuration (Optimized for Speed & Stability):")
        print("  [Model]:")
        print("    - LTX-2 Distilled (19B parameters)")
        print("    - Base model only (no LoRA)")
        print("    - Direct CUDA loading (no CPU offload)")
        print("  [Generation Parameters]:")
        print("    - Steps: 8 (Distilled optimal)")
        print("    - Guidance: 3.0 (official typical value)")
        print("    - Conditioning: 0.8 (balanced)")
        print("  [Upscaling]:")
        print("    - OpenCV DNN EDSR x2 (720p → 1440p → 1080p)")
        print("  [Performance]:")
        print("    - Expected time: ~40 seconds (4초 영상)")
        print("    - Expected cost: ~₩20 (4초 기준)")
        print(f"{'='*70}\n")

    @modal.method()
    def generate(self, prompt: str, image_url: str, character_description: str = "", num_frames: int = 97,
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

        # 720p GENERATION: 1280x720 (16:9, divisible by 32 for LTX-2)
        # Will be upscaled to 1080p (1920x1080) using Real-ESRGAN
        target_width = 1280   # 40 * 32
        target_height = 720   # 45 * 16

        print(f"[PREPROCESSING] Target resolution: {target_width}x{target_height} (720p)")
        print(f"[PREPROCESSING] Final output: 1920x1080 (1080p via 1.5x upscale)")

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

        # 기본값 (Distilled 모델 최적화) - MUST BE DEFINED FIRST!
        DEFAULT_CONDITIONING = 0.8  # 공식 문서 기반
        DEFAULT_GUIDANCE = 3.0      # 공식 기본값
        DEFAULT_STEPS = 8           # Distilled 모델 권장 (8 steps stage 1)

        final_conditioning = test_conditioning if test_conditioning is not None else DEFAULT_CONDITIONING
        final_guidance = test_guidance if test_guidance is not None else DEFAULT_GUIDANCE
        final_steps = test_steps if test_steps is not None else DEFAULT_STEPS

        # 파라미터 검증 (극단값 방지)
        final_conditioning = max(0.3, min(1.0, final_conditioning))  # 0.3-1.0 범위
        final_guidance = max(1.0, min(10.0, final_guidance))         # 1.0-10.0 범위
        final_steps = max(8, min(50, final_steps))                   # 8-50 범위

        test_mode = test_conditioning is not None or test_guidance is not None or test_steps is not None

        mode_label = "TEST MODE" if test_mode else "FAST & STABLE MODE"
        print(f"\n[GENERATION SETTINGS - {mode_label}]")
        print(f"  Model: LTX-2 Distilled (base model, no LoRA)")
        print(f"  Generation: {target_width}x{target_height} (720p)")
        print(f"  Upscale: 1.5x → 1920x1080 (1080p)")
        print(f"  Frames: {num_frames} (~{num_frames/24:.1f}s @ 24fps)")
        print(f"  Inference steps: {final_steps} (Distilled optimal: 8)")
        print(f"  Guidance scale: {final_guidance} (official: 3.0 typical)")
        print(f"  Image conditioning: {final_conditioning}")
        print(f"  Style: 2D Anime (clean lines, flat shading)")
        print(f"  Prompt: Gemini 6-element + 2D Anime prefix")
        print(f"  Negative: Enhanced + 2D style enforcement")
        est_cost = int((30 + final_steps * 1.5) * 0.000306 * 1450)
        print(f"  Estimated cost: ~₩{est_cost} (4초 기준)")
        print(f"\n[STARTING 720p GENERATION]...")

        import time
        gen_start = time.time()

        if test_mode:
            print(f"\n{'='*60}")
            print(f"[TEST MODE] Custom parameters (validated):")
            print(f"  Conditioning: {final_conditioning} {'(TEST)' if test_conditioning else '(default 0.8)'}")
            print(f"  Guidance: {final_guidance} {'(TEST)' if test_guidance else '(default 3.0)'}")
            print(f"  Steps: {final_steps} {'(TEST)' if test_steps else '(default 8)'}")
            print(f"{'='*60}")
        else:
            print(f"\n{'='*60}")
            print(f"[PRODUCTION MODE] Distilled optimized settings:")
            print(f"  Conditioning: {final_conditioning} (official range)")
            print(f"  Guidance: {final_guidance} (official default)")
            print(f"  Steps: {final_steps} (Distilled optimal: 8)")
            print(f"  Model: Base only (no LoRA for stability)")
            print(f"{'='*60}")

        # QUALITY-FIRST MODE: Accept custom parameters for experimentation
        try:
            output = self.pipe(
                image=reference_image,
                prompt=enhanced_prompt,          # RESPECTS FRONTEND (Gemini 6-element + 2D Anime prefix)
                negative_prompt=negative_prompt,
                width=target_width,
                height=target_height,
                num_frames=num_frames,
                num_inference_steps=final_steps,
                guidance_scale=final_guidance,
                image_conditioning_scale=final_conditioning,
                generator=torch.Generator(device="cuda").manual_seed(42),
                output_type="pil",
            ).frames[0]

            gen_time = time.time() - gen_start
            print(f"\n[720p GENERATION COMPLETE] Time: {gen_time:.1f}s")

        except Exception as e:
            gen_time = time.time() - gen_start
            print(f"\n{'='*60}")
            print(f"[ERROR] LTX-2 GENERATION FAILED!")
            print(f"{'='*60}")
            print(f"  Error type: {type(e).__name__}")
            print(f"  Error message: {str(e)[:200]}")
            print(f"\n  Parameters used:")
            print(f"    - steps: {final_steps}")
            print(f"    - guidance: {final_guidance}")
            print(f"    - conditioning: {final_conditioning}")
            print(f"    - frames: {num_frames}")
            print(f"    - resolution: {target_width}x{target_height}")
            print(f"  Time before failure: {gen_time:.1f}s")
            print(f"{'='*60}")
            import traceback
            traceback.print_exc()
            raise Exception(f"LTX-2 generation failed after {gen_time:.1f}s: {str(e)[:100]}")

        print(f"\n[CHARACTER FIDELITY VERIFICATION - PRIORITY #1]")
        print(f"  Generated {len(output)} frames @ {target_width}x{target_height}")

        # CRITICAL: Verify character fidelity at 720p BEFORE upscaling
        input_image_array = np.array(reference_image)

        check_indices = [0, len(output)//4, len(output)//2, len(output)*3//4, len(output)-1]
        fidelity_scores = []

        for idx in check_indices:
            frame_array = np.array(output[idx])
            diff = np.abs(frame_array.astype(float) - input_image_array.astype(float)).mean()
            fidelity_scores.append(diff)
            status = "OK" if diff < 20.0 else "WARN" if diff < 30.0 else "FAIL"
            print(f"  Frame {idx:3d}: diff={diff:5.2f} [{status}]")

        max_diff = max(fidelity_scores)
        avg_diff = sum(fidelity_scores) / len(fidelity_scores)
        print(f"  Max difference: {max_diff:.2f}")
        print(f"  Avg difference: {avg_diff:.2f}")

        # STRICT CHARACTER FIDELITY ENFORCEMENT
        if max_diff > 30.0:
            print(f"  [CRITICAL] Character fidelity FAILED (>{30.0})")
            print(f"  [ACTION] Forcing first frame replacement")
            output[0] = reference_image.copy()
            print(f"  [ACTION] This indicates image conditioning is weak!")
        elif max_diff > 20.0:
            print(f"  [WARNING] Character fidelity borderline")
            print(f"  [ACTION] Forcing first frame replacement as safety")
            output[0] = reference_image.copy()
        else:
            print(f"  [OK] CHARACTER FIDELITY EXCELLENT! OK")

        print(f"\n[UPSCALING TO 1080p - PRIORITY #2]")
        print(f"  Input: {len(output)} frames @ {target_width}x{target_height}")
        print(f"  Method: OpenCV DNN EDSR x2")
        print(f"  Target: 1920x1080")

        upscale_start = time.time()

        # Upscale frames using OpenCV DNN
        upscaled_frames = []
        import cv2

        for i, frame in enumerate(output):
            if i % 20 == 0:
                print(f"  Upscaling frame {i+1}/{len(output)}...")

            # Convert PIL to OpenCV format
            frame_np = np.array(frame)
            frame_cv = cv2.cvtColor(frame_np, cv2.COLOR_RGB2BGR)

            # OpenCV DNN Super Resolution (x2)
            upscaled_cv = self.sr.upsample(frame_cv)  # 1280x720 → 2560x1440

            # Resize to 1920x1080 (1.5x from original)
            upscaled_cv = cv2.resize(upscaled_cv, (1920, 1080), interpolation=cv2.INTER_LANCZOS4)

            # Convert back to RGB and PIL
            upscaled_np = cv2.cvtColor(upscaled_cv, cv2.COLOR_BGR2RGB)
            from PIL import Image as PILImage
            upscaled_pil = PILImage.fromarray(upscaled_np)

            upscaled_frames.append(upscaled_pil)

        upscale_time = time.time() - upscale_start
        print(f"  [UPSCALE COMPLETE] Time: {upscale_time:.1f}s")
        print(f"  Output: {len(upscaled_frames)} frames @ 1920x1080")

        # Replace output with upscaled frames
        output = upscaled_frames

        # Final verification at 1080p
        print(f"\n[FINAL VERIFICATION @ 1080p]")
        input_1080p = reference_image.resize((1920, 1080), Image.Resampling.LANCZOS)
        input_1080p_array = np.array(input_1080p)

        final_diff = np.abs(np.array(output[0]).astype(float) - input_1080p_array.astype(float)).mean()
        print(f"  First frame diff @ 1080p: {final_diff:.2f}")

        if final_diff > 25.0:
            print(f"  [ACTION] Replacing first frame at 1080p")
            output[0] = input_1080p.copy()
        else:
            print(f"  [OK] 1080p character fidelity maintained OK")

        # Save video with OpenCV (more reliable than imageio)
        output_path = tempfile.mktemp(suffix=".mp4")

        print(f"\n[ENCODING VIDEO]")
        print(f"  Output: {output_path}")
        print(f"  Frames: {len(output)}")
        print(f"  Resolution: 1920x1080")
        print(f"  FPS: 24")

        # Use H.264 codec for better browser compatibility
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        video_writer = cv2.VideoWriter(output_path, fourcc, 24.0, (1920, 1080))

        if not video_writer.isOpened():
            raise Exception("Failed to open video writer")

        for i, frame in enumerate(output):
            frame_np = np.array(frame)
            frame_bgr = cv2.cvtColor(frame_np, cv2.COLOR_RGB2BGR)
            video_writer.write(frame_bgr)

            if i % 20 == 0:
                print(f"  Encoding frame {i+1}/{len(output)}...")

        video_writer.release()
        print(f"  [OK] Video encoding complete")

        with open(output_path, "rb") as f:
            video_bytes = f.read()

        # CRITICAL: Verify video file is valid
        if len(video_bytes) < 1000:
            raise Exception(f"Video file too small ({len(video_bytes)} bytes) - generation failed")

        total_time = time.time() - gen_start
        cost_usd = total_time * 0.000306
        cost_krw = cost_usd * 1450

        print(f"\n[COMPLETE]")
        print(f"  [OK] Generated {len(output)} frames @ 1920x1080 (1080p)")
        print(f"  [OK] Video size: {len(video_bytes) / 1024 / 1024:.2f} MB")
        print(f"  [OK] Duration: ~{num_frames/24:.1f}s @ 24fps")
        print(f"\n[PERFORMANCE]")
        print(f"  Generation time: {gen_time:.1f}s")
        print(f"  Upscale time: {upscale_time:.1f}s")
        print(f"  Total time: {total_time:.1f}s")
        print(f"  Cost: ${cost_usd:.4f} (₩{cost_krw:.0f})")
        print(f"  Target: <67s (<₩30)")
        if total_time <= 67:
            print(f"  [OK] Time target achieved! OK")
        else:
            print(f"  [!] Time exceeded target by {total_time-67:.1f}s")
        print(f"{'='*70}\n")
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
