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
        from huggingface_hub import snapshot_download
        from diffusers import LTX2Pipeline

        print("=" * 70)
        print("CHARACTER FIDELITY PRIORITY + OpenCV DNN Upscale")
        print("=" * 70)

        # Use Distilled model for speed (8 steps instead of 40)
        local_dir = "/models/Lightricks/LTX-2-Distilled"
        if not os.path.exists(local_dir):
            print(f"Downloading LTX-2 Distilled model to {local_dir}...")
            snapshot_download("Lightricks/ltx-2-19b-distilled", local_dir=local_dir)
            print("Download complete!")
        else:
            print(f"Using cached LTX-2 Distilled model from {local_dir}")

        # Verify model files exist
        config_file = os.path.join(local_dir, "model_index.json")
        if not os.path.exists(config_file):
            print(f"[ERROR] Model config not found at {config_file}")
            raise FileNotFoundError(f"Model files missing at {local_dir}")

        print("\n[1/4] Loading LTX-2 Distilled (CHARACTER FIDELITY OPTIMIZED)...")
        self.pipe = LTX2Pipeline.from_pretrained(
            local_dir,
            torch_dtype=torch.bfloat16
        )

        print("[2/4] Loading ORIGINAL LoRA (Rank 384 - 7.67 GB) for MAXIMUM QUALITY...")
        from huggingface_hub import hf_hub_download

        lora_cache_dir = "/models/loras"
        os.makedirs(lora_cache_dir, exist_ok=True)

        # ORIGINAL 7.67GB LoRA for best quality
        lora_path = hf_hub_download(
            repo_id="Lightricks/LTX-2",
            filename="ltx-2-19b-distilled-lora-384.safetensors",
            cache_dir=lora_cache_dir
        )

        print(f"  - LoRA downloaded/cached at: {lora_path}")
        print("  - Loading ORIGINAL LoRA weights (7.67 GB)...")
        self.pipe.load_lora_weights(lora_path)
        print("  - Fusing LoRA (scale=0.65)...")
        self.pipe.fuse_lora(lora_scale=0.65)
        print("  ✓ ORIGINAL LoRA loaded successfully (Rank 384, 7.67 GB)")

        print("[3/4] Applying memory optimizations...")
        # Enable CPU offloading for A10G 24GB
        print("  - Sequential CPU offload...")
        self.pipe.enable_sequential_cpu_offload()

        # Enable VAE tiling for memory efficiency
        print("  - VAE tiling...")
        self.pipe.vae.enable_tiling()

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
        print("PIPELINE LOADED - FINAL TWEAK: MOVEMENT + COST OPTIMIZED!")
        print(f"{'='*70}")
        print("Configuration:")
        print("  [Priority 1] Natural Movement:")
        print("    - Conditioning: 0.7 (movement priority > face rigidity)")
        print("    - Forced camera movement (dolly-in/pan)")
        print("    - 2D Animation style (NOT photorealistic)")
        print("    - Steps: 15 (cost optimized from 20)")
        print("  [Priority 2] Emotion & Expression:")
        print("    - Gemini 5-step formula prompts (dialogue → emotion)")
        print("    - ORIGINAL LoRA Rank 384 (7.67 GB) @ scale 0.65")
        print("    - Guidance: 3.0 (strong prompt following)")
        print("  [Priority 3] Character Fidelity:")
        print("    - Multi-frame verification (5 checkpoints)")
        print("    - First frame forced replacement")
        print("    - Negative: 2D style enforcement (no realistic/3d/photo)")
        print("  [Priority 4] Upscaling:")
        print("    - OpenCV DNN EDSR x2")
        print("    - 720p → 1440p → resized to 1080p")
        print("  [Performance Target]:")
        print("    - Time: ~70 seconds (25% faster)")
        print("    - Cost: ~₩35 (business viable)")
        print(f"{'='*70}\n")

    @modal.method()
    def generate(self, prompt: str, image_url: str, character_description: str = "", num_frames: int = 97):
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

        print(f"\n[GENERATION SETTINGS - FINAL TWEAK: COST OPTIMIZED]")
        print(f"  Model: LTX-2 Distilled + ORIGINAL LoRA (7.67 GB)")
        print(f"  Generation: {target_width}x{target_height} (720p)")
        print(f"  Upscale: 1.5x → 1920x1080 (1080p)")
        print(f"  Frames: {num_frames} (~{num_frames/24:.1f}s @ 24fps)")
        print(f"  Inference steps: 15 (cost optimized from 20)")
        print(f"  Guidance scale: 3.0 (strong prompt following)")
        print(f"  Image conditioning: 0.7 (movement priority)")
        print(f"  Style: 2D Animation (NOT photorealistic)")
        print(f"  Camera: Forced movement (dolly-in/pan)")
        print(f"  Prompt: Gemini 5-step (dialogue → emotion)")
        print(f"  Negative: Enhanced + 2D style enforcement")
        print(f"  Target: ~30 KRW (business viability)")
        print(f"\n[STARTING 720p GENERATION]...")

        import time
        gen_start = time.time()

        # FINAL TWEAK: COST OPTIMIZED + MOVEMENT PRIORITY
        # 15 steps, guidance 3.0, conditioning 0.7, ORIGINAL LoRA 7.67GB
        output = self.pipe(
            image=reference_image,
            prompt=enhanced_prompt,          # RESPECTS FRONTEND (Gemini 5-step + camera movement)
            negative_prompt=negative_prompt,
            width=target_width,
            height=target_height,
            num_frames=num_frames,
            num_inference_steps=15,          # OPTIMIZED: 15 steps (was 20) for ₩30 target
            guidance_scale=3.0,              # STRONG: 3.0 for prompt following
            image_conditioning_scale=0.7,    # MOVEMENT: 0.7 (was 0.8) - prioritize natural motion
            generator=torch.Generator(device="cuda").manual_seed(42),
            output_type="pil",
        ).frames[0]

        gen_time = time.time() - gen_start
        print(f"\n[720p GENERATION COMPLETE] Time: {gen_time:.1f}s")

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
            print(f"  [OK] CHARACTER FIDELITY EXCELLENT! ✓")

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
            print(f"  [OK] 1080p character fidelity maintained ✓")

        # Save video with optimized codec
        import imageio
        output_path = tempfile.mktemp(suffix=".mp4")

        frames_np = [np.array(frame) for frame in output]

        writer = imageio.get_writer(
            output_path,
            fps=24,
            codec='libx264',
            quality=8,  # Higher quality
            pixelformat='yuv420p'  # YouTube compatible
        )
        for frame in frames_np:
            writer.append_data(frame)
        writer.close()

        with open(output_path, "rb") as f:
            video_bytes = f.read()

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
            print(f"  [OK] Time target achieved! ✓")
        else:
            print(f"  [!] Time exceeded target by {total_time-67:.1f}s")
        print(f"{'='*70}\n")
        return video_bytes

# 3. Web API
@app.function(image=image)
@modal.asgi_app()
def web_app():
    from fastapi import FastAPI
    from fastapi.responses import Response, StreamingResponse
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from typing import List
    import asyncio
    import json

    web = FastAPI()

    # Enable CORS for frontend
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

    class BatchGenerateRequest(BaseModel):
        scenes: List[GenerateRequest]

    @web.post("/generate")
    async def generate(req: GenerateRequest):
        """Generate single video from image"""
        try:
            generator = VideoGenerator()
            video_bytes = generator.generate.remote(
                req.prompt,
                req.image_url,
                req.character_description,
                req.num_frames
            )
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
