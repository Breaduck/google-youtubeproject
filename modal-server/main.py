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
    .env({
        "HF_HOME": "/models",  # Official Modal standard: Set HF cache location
        "HF_HUB_DISABLE_PROGRESS_BARS": "1"  # Fix cp949 encoding error on Windows
    })
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

        # Force disable progress bars at runtime (critical for cp949 fix)
        os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
        os.environ["PYTHONIOENCODING"] = "utf-8"

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
        # Get HF_TOKEN from Modal Secret (safe handling)
        hf_token = os.environ.get("HF_TOKEN")
        if not hf_token:
            raise ValueError("HF_TOKEN not found in Modal Secret 'huggingface-secret'")
        print(f"  HF_TOKEN: ✓ Loaded from Secret")

        self.pipe = LTX2ImageToVideoPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16,
            cache_dir=cache_dir,
            token=hf_token,
            low_cpu_mem_usage=True  # Load on CPU first, prevent GPU OOM
        )
        print("  [OK] Distilled Image-to-Video Pipeline loaded")

        # Save for dynamic Stage 2 loading
        self.model_id = model_id
        self.cache_dir = cache_dir
        self.hf_token = hf_token

        # Stage 2 Latent Upsampler: NOT loaded here (A10G VRAM limit)
        # → Dynamically loaded in Stage 2 after Stage 1 GPU memory is freed
        print("[2/4] Stage 2 Upsampler: deferred loading (VRAM optimization)")

        print("[3/4] Applying memory optimizations...")
        print("  - Sequential CPU offload (official distilled)...")
        self.pipe.enable_sequential_cpu_offload()

        print("  - VAE tiling...")
        self.pipe.vae.enable_tiling()

        print("  - Attention slicing...")
        self.pipe.enable_attention_slicing()

        print("[4/4] Loading Distilled Sigmas...")
        # Import distilled sigma values for Stage 1
        from diffusers.pipelines.ltx2.utils import DISTILLED_SIGMA_VALUES
        self.stage1_sigmas = DISTILLED_SIGMA_VALUES

        # CRITICAL: Use official 4-step Stage 2 schedule (diffusers has only 3)
        # Source: https://github.com/Lightricks/LTX-2/blob/main/packages/ltx-pipelines/src/ltx_pipelines/utils/constants.py
        STAGE_2_DISTILLED_SIGMA_VALUES_OFFICIAL = [0.909375, 0.725, 0.421875, 0.0]
        self.stage2_sigmas = STAGE_2_DISTILLED_SIGMA_VALUES_OFFICIAL

        print(f"  - Stage 1 sigmas: {len(self.stage1_sigmas)} values")
        print(f"  - Stage 2 sigmas: {len(self.stage2_sigmas)} values (official 4-step)")
        print("  [OK] Distilled sigmas loaded (8+4 official schedule)")

        print(f"\n{'='*70}")
        print("PIPELINE LOADED - OFFICIAL DISTILLED 3-STAGE PATTERN")
        print(f"{'='*70}")
        print("Configuration (Official distilled.py pattern):")
        print("  [Model]:")
        print("    - LTX-2-19b-distilled (rootonchair)")
        print("    - 3-Stage architecture (official)")
        print("    - Sequential CPU offload")
        print("  [Stage 1 - Latent Generation]:")
        print("    - Resolution: 768x512")
        print("    - Steps: 8")
        print("    - Guidance: 1.0")
        print("    - Sigmas: DISTILLED_SIGMA_VALUES")
        print("    - Output: latent")
        print("  [Stage 2a - Latent Upsample]:")
        print("    - 2x upsample: 768x512 → 1536x1024")
        print("    - Latent-to-latent (no VAE)")
        print("  [Stage 2b - Refinement (NEW)]:")
        print(f"    - Steps: {len(self.stage2_sigmas)} (official 4-step schedule)")
        print("    - Guidance: 1.8")
        print("    - Sigmas: STAGE_2_DISTILLED_SIGMA_VALUES (official)")
        print("    - Input: upscaled latent")
        print("  [VAE Decode]:")
        print("    - Latent → Pixels (final step)")
        print("  [Performance Target]:")
        print("    - Expected time: ~80-90 seconds (4초 @ 97 frames)")
        print("    - Expected cost: ~₩40-45")
        print("    - Quality: Improved temporal coherence")
        print("    - VRAM: ~22GB (A10G compatible)")
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

        # ============================================================
        # SAFETY FILTER: Remove unsafe keywords before LTX
        # ============================================================
        import re

        print(f"\n{'='*60}")
        print(f"[PROMPT SAFETY FILTER]")
        print(f"{'='*60}")
        print(f"  Original: {prompt[:200]}...")

        # Camera motion keywords to remove
        camera_keywords = [
            'zoom', 'pan', 'dolly', 'track', 'cinematic', 'camera movement',
            'zoom-in', 'zoom-out', 'zoom in', 'zoom out',
            'pan left', 'pan right', 'panning', 'tracking shot',
            'camera motion', 'camera zoom', 'moving camera'
        ]

        # Speech/lip keywords to detect and remove
        speech_keywords = [
            'speaking', 'talking', 'speech', 'dialogue', 'conversation',
            'lip sync', 'mouth open', 'open mouth', 'lips moving',
            'mouth movement', 'forming words', 'mouth forming',
            'voice', 'vocal', 'saying', 'uttering'
        ]

        filtered_prompt = prompt

        # Remove camera motion keywords
        removed_camera = []
        for keyword in camera_keywords:
            pattern = re.compile(rf'\b{re.escape(keyword)}\b', re.IGNORECASE)
            if pattern.search(filtered_prompt):
                removed_camera.append(keyword)
                filtered_prompt = pattern.sub('', filtered_prompt)

        # Check for speech keywords
        removed_speech = []
        for keyword in speech_keywords:
            pattern = re.compile(rf'\b{re.escape(keyword)}\b', re.IGNORECASE)
            if pattern.search(filtered_prompt):
                removed_speech.append(keyword)
                filtered_prompt = pattern.sub('', filtered_prompt)

        # Clean up extra spaces and punctuation
        filtered_prompt = re.sub(r'\s+', ' ', filtered_prompt).strip()
        filtered_prompt = re.sub(r'\s*,\s*,+', ',', filtered_prompt)
        filtered_prompt = re.sub(r'\s*\.\s*\.+', '.', filtered_prompt)

        # Append ambient sound + closed mouth guidance
        ambient_guide = "Ambient sound of subtle wind or room tone. Character's mouth remains closed with serene expression. No speaking or dialogue."
        enhanced_prompt = f"{filtered_prompt} {ambient_guide}"

        # Log removed terms
        if removed_speech:
            print(f"  [REMOVED SPEECH TERMS]: {', '.join(removed_speech)}")

        if removed_camera:
            print(f"  [REMOVED CAMERA MOTION]: {', '.join(removed_camera)}")

        print(f"  Filtered: {enhanced_prompt[:250]}...")
        print(f"{'='*60}")

        # Negative prompt: Anti-distortion + No speech/voice
        # Motion: blinking, micro-nod, subtle hand gestures only
        # Audio: Ambience-only (Track A ~20%), TTS narration post-mux (Track B 100%)
        negative_prompt = "different person, different face, morphing, warping, distortion, wobbling, melting, ripple effect, face collapse, global motion, jelly effect, unstable, inconsistent, deformed face, displaced features, changing appearance, liquid effect, wave distortion, plastic skin, cartoonish, low quality, oversaturated, blurry, artificial, fake, synthetic, CG, rendered, realistic, 3d render, photo, photorealistic, speaking, talking, dialogue, voice, narration, lip sync, open mouth, mouth movement, speech"

        # Strengthen negative prompt with detected speech terms (from safety filter)
        if 'removed_speech' in locals() and removed_speech:
            for term in removed_speech:
                if term.lower() not in negative_prompt.lower():
                    negative_prompt += f", {term}"
            print(f"[SAFETY] Added {len(removed_speech)} speech terms to negative prompt")

        # 공식 권장 기준 (Official LTX-2 recommendations)
        # cfg_scale: 3.0 typical (2.0-5.0 range)
        # steps: 40 default, 20-30 for quality/speed balance
        # distilled_lora: 0.6-0.8 strength

        # 기본값 (공식 Distilled 권장) - MUST BE DEFINED FIRST!
        DEFAULT_GUIDANCE_STAGE1 = 1.0   # Distilled Stage 1 guidance (1.0)
        DEFAULT_STEPS_STAGE1 = 8        # Distilled Stage 1 (8 steps)
        DEFAULT_GUIDANCE_STAGE2 = 1.8   # Stage 2b refine guidance (1.8-2.2 range)
        DEFAULT_STEPS_STAGE2 = len(self.stage2_sigmas)  # Auto-detect from sigma values

        final_guidance_stage1 = test_guidance if test_guidance is not None else DEFAULT_GUIDANCE_STAGE1
        final_steps_stage1 = test_steps if test_steps is not None else DEFAULT_STEPS_STAGE1

        # 파라미터 검증 (극단값 방지)
        final_guidance_stage1 = max(1.0, min(5.0, final_guidance_stage1))  # 1.0-5.0 범위
        final_steps_stage1 = max(8, min(50, final_steps_stage1))           # 8-50 범위

        test_mode = test_guidance is not None or test_steps is not None

        mode_label = "TEST MODE" if test_mode else "DISTILLED TWO-STAGES"
        print(f"\n[GENERATION SETTINGS - {mode_label}]")
        print(f"  Model: LTX-2-19b-distilled (Official 3-Stage Pattern)")
        print(f"  Stage 1: {target_width}x{target_height} (512p) latent generation")
        print(f"  Stage 2a: Latent upsample 2x → {target_width*2}x{target_height*2} (1024p)")
        print(f"  Stage 2b: 4-step refinement (NEW)")
        print(f"  Frames: {num_frames} (~{num_frames/24:.1f}s @ 24fps)")
        print(f"  Stage 1: {final_steps_stage1} steps, guidance {final_guidance_stage1}")
        print(f"  Stage 2b: {DEFAULT_STEPS_STAGE2} steps, guidance {DEFAULT_GUIDANCE_STAGE2}")
        print(f"  Sigma schedules: DISTILLED + STAGE_2_DISTILLED")
        print(f"  Style: 2D Anime (clean lines, flat shading)")
        print(f"  Motion: Closed mouth, blinking, micro-nod, subtle gestures")
        print(f"  Audio: Ambience-only (narration via TTS post-mux)")
        est_cost = int((40 + final_steps_stage1 * 1.5 + DEFAULT_STEPS_STAGE2 * 2) * 0.000306 * 1450)
        print(f"  Estimated cost: ~₩{est_cost}")
        print(f"\n[STARTING 3-STAGE GENERATION (Official Distilled Pattern)]...")

        import time
        gen_start = time.time()

        # ============================================================
        # STAGE 1: I2V generation at 768x512 → output as LATENT (official distilled)
        # ============================================================
        try:
            print(f"\n{'='*60}")
            print(f"[STAGE 1] Low-res latent generation")
            print(f"  Resolution: {target_width}x{target_height}")
            print(f"  Frames: {num_frames}")
            print(f"  Steps: {final_steps_stage1}, Guidance: {final_guidance_stage1}")
            print(f"  Sigmas: DISTILLED_SIGMA_VALUES ({len(self.stage1_sigmas)} values)")
            print(f"  Precision: {self.pipe.transformer.dtype}")
            print(f"  Offload: Sequential CPU offload enabled")
            print(f"{'='*60}")

            # VRAM before Stage 1
            torch.cuda.reset_peak_memory_stats()
            vram_before = torch.cuda.memory_allocated() / 1024**3
            print(f"  VRAM before: {vram_before:.2f} GiB")

            generator = torch.Generator(device="cuda").manual_seed(42)
            frame_rate = 24.0

            stage1_start = time.time()  # Precise timing

            result = self.pipe(
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
                output_type="latent",   # LATENT output for Stage 2a upsample
                return_dict=False,
            )

            stage1_time = time.time() - stage1_start  # Precise timing

            # DEBUG: Inspect return structure
            print(f"  [DEBUG] Pipeline return type: {type(result)}")
            if isinstance(result, tuple):
                print(f"  [DEBUG] Tuple length: {len(result)}")
                for i, item in enumerate(result):
                    if item is not None:
                        print(f"  [DEBUG] result[{i}] type: {type(item)}, shape: {item.shape if hasattr(item, 'shape') else 'N/A'}")
                    else:
                        print(f"  [DEBUG] result[{i}] is None")
                video_latent = result[0]
                audio_latent = result[1] if len(result) > 1 else None
            else:
                print(f"  [DEBUG] Single return, shape: {result.shape if hasattr(result, 'shape') else 'N/A'}")
                video_latent = result
                audio_latent = None

            vram_after = torch.cuda.memory_allocated() / 1024**3
            vram_peak = torch.cuda.max_memory_allocated() / 1024**3
            vram_reserved = torch.cuda.memory_reserved() / 1024**3

            print(f"[STAGE 1 COMPLETE] Time: {stage1_time:.1f}s")
            print(f"  Latent shape: {video_latent.shape}")
            print(f"  Latent dtype: {video_latent.dtype}")
            print(f"  VRAM after: {vram_after:.2f} GiB")
            print(f"  VRAM peak: {vram_peak:.2f} GiB")
            print(f"  VRAM reserved: {vram_reserved:.2f} GiB")

        except Exception as e:
            stage1_time = time.time() - gen_start
            print(f"\n[ERROR] STAGE 1 FAILED: {str(e)[:200]}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Stage 1 failed after {stage1_time:.1f}s: {str(e)[:100]}")

        # ============================================================
        # STAGE 2a: Latent upsample 2x (official distilled pattern)
        # ============================================================
        try:
            print(f"\n{'='*60}")
            print(f"[STAGE 2a] Latent upsample {target_width}x{target_height} → {target_width*2}x{target_height*2}")
            print(f"{'='*60}")

            from diffusers.pipelines.ltx2 import LTX2LatentUpsamplePipeline
            from diffusers.pipelines.ltx2.latent_upsampler import LTX2LatentUpsamplerModel

            latent_upsampler = LTX2LatentUpsamplerModel.from_pretrained(
                self.model_id,
                subfolder="latent_upsampler",
                torch_dtype=torch.bfloat16,
                cache_dir=self.cache_dir,
                token=self.hf_token,
            )
            upsample_pipe = LTX2LatentUpsamplePipeline(
                vae=self.pipe.vae,
                latent_upsampler=latent_upsampler,
            )
            upsample_pipe.vae.enable_tiling()
            upsample_pipe.enable_model_cpu_offload()

            upscale_start = time.time()
            # Latent-to-latent upsample (official distilled pattern)
            upscaled_latent = upsample_pipe(
                latents=video_latent,  # Latent input from Stage 1
                width=target_width,
                height=target_height,
                output_type="latent",  # Keep in latent space for Stage 2b
                return_dict=False,
            )[0]
            upscale_time = time.time() - upscale_start
            print(f"[STAGE 2a COMPLETE] Time: {upscale_time:.1f}s")
            print(f"  Upscaled latent shape: {upscaled_latent.shape}")
            print(f"  VRAM: {torch.cuda.memory_allocated()/1024**3:.2f} GiB")

            del upsample_pipe, latent_upsampler
            torch.cuda.empty_cache()

        except Exception as e:
            print(f"\n[ERROR] STAGE 2a FAILED: {str(e)[:200]}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Stage 2a upsample failed: {str(e)[:100]}")

        # ============================================================
        # STAGE 2b: Refine upscaled latent (4 steps, official distilled)
        # OPTIONAL: Try-catch for stability (temporary safety net)
        # ============================================================
        stage2b_success = False
        try:
            print(f"\n{'='*60}")
            print(f"[STAGE 2b] 4-step refinement at {target_width*2}x{target_height*2}")
            print(f"  Steps: {DEFAULT_STEPS_STAGE2}, Guidance: {DEFAULT_GUIDANCE_STAGE2}")
            print(f"  Sigmas: STAGE_2_DISTILLED_SIGMA_VALUES ({len(self.stage2_sigmas)} values)")
            print(f"  Upscaled latent shape: {upscaled_latent.shape}")
            print(f"  Upscaled latent dtype: {upscaled_latent.dtype}")

            # VRAM diagnostics BEFORE Stage 2b
            torch.cuda.reset_peak_memory_stats()
            vram_before_2b = torch.cuda.memory_allocated() / 1024**3
            vram_reserved_2b = torch.cuda.memory_reserved() / 1024**3
            print(f"  VRAM before Stage 2b: {vram_before_2b:.2f} GiB")
            print(f"  VRAM reserved: {vram_reserved_2b:.2f} GiB")
            print(f"  VRAM available: {24 - vram_reserved_2b:.2f} GiB (A10G)")
            print(f"{'='*60}")

            refine_start = time.time()

            # Refinement pass using upscaled latent as initialization
            result = self.pipe(
                image=reference_image,  # Keep image conditioning
                prompt=enhanced_prompt,
                negative_prompt=negative_prompt,
                width=target_width * 2,  # Full resolution
                height=target_height * 2,
                num_frames=num_frames,
                frame_rate=frame_rate,
                num_inference_steps=DEFAULT_STEPS_STAGE2,
                sigmas=self.stage2_sigmas,
                guidance_scale=DEFAULT_GUIDANCE_STAGE2,  # 1.8 guidance
                generator=generator,
                latents=upscaled_latent,  # Initialize from upscaled latent
                output_type="latent",  # Keep latent for VAE decode
                return_dict=False,
            )

            # DEBUG: Inspect Stage 2b return structure
            print(f"  [DEBUG] Stage 2b return type: {type(result)}")
            if isinstance(result, tuple):
                print(f"  [DEBUG] Tuple length: {len(result)}")
                for i, item in enumerate(result):
                    if item is not None:
                        print(f"  [DEBUG] result[{i}] type: {type(item)}, shape: {item.shape if hasattr(item, 'shape') else 'N/A'}")
                    else:
                        print(f"  [DEBUG] result[{i}] is None")
                refined_latent = result[0]
                audio_latent_stage2 = result[1] if len(result) > 1 else None
                # Use Stage 2b audio if available, else fallback to Stage 1
                if audio_latent_stage2 is not None:
                    audio_latent = audio_latent_stage2
            else:
                refined_latent = result

            refine_time = time.time() - refine_start
            vram_peak_2b = torch.cuda.max_memory_allocated() / 1024**3

            print(f"[STAGE 2b COMPLETE] Time: {refine_time:.1f}s")
            print(f"  Refined latent shape: {refined_latent.shape}")
            print(f"  VRAM peak during Stage 2b: {vram_peak_2b:.2f} GiB")
            stage2b_success = True

        except Exception as e:
            refine_time = 0.0
            print(f"\n{'='*60}")
            print(f"[STAGE 2b FAILURE - FULL DIAGNOSTICS]")
            print(f"{'='*60}")
            print(f"  Exception type: {type(e).__name__}")
            print(f"  Exception message: {str(e)}")
            print(f"\n[FULL TRACEBACK]:")
            import traceback
            traceback.print_exc()

            # Write full error to temp file for inspection
            import tempfile
            error_log_path = tempfile.mktemp(suffix="_stage2b_error.log")
            with open(error_log_path, "w") as f:
                f.write(f"Stage 2b Failure Report\n")
                f.write(f"=" * 60 + "\n")
                f.write(f"Exception: {type(e).__name__}\n")
                f.write(f"Message: {str(e)}\n\n")
                f.write(f"Traceback:\n")
                f.write(traceback.format_exc())
                f.write(f"\nVRAM stats:\n")
                f.write(f"  Allocated: {torch.cuda.memory_allocated()/1024**3:.2f} GiB\n")
                f.write(f"  Reserved: {torch.cuda.memory_reserved()/1024**3:.2f} GiB\n")
            print(f"  Full error log written to: {error_log_path}")

            print(f"\n[FALLBACK] Using Stage 2a output (no refinement)")
            print(f"  This is a TEMPORARY safety net - Stage 2b MUST be fixed")
            print(f"{'='*60}\n")

            refined_latent = upscaled_latent

        # ============================================================
        # VAE DECODE: Latent → Pixels (official distilled pattern)
        # ============================================================
        print(f"\n{'='*60}")
        print(f"[VAE DECODE] Converting latent to pixels")
        print(f"{'='*60}")

        decode_start = time.time()

        # Ensure latent matches VAE dtype (bfloat16)
        refined_latent = refined_latent.to(dtype=self.pipe.vae.dtype)

        # VAE decode in chunks to avoid VRAM spike
        with torch.no_grad():
            # Decode latent to pixel space
            video_frames = self.pipe.vae.decode(refined_latent / self.pipe.vae.config.scaling_factor, return_dict=False)[0]
            # video_frames shape: (batch, channels, frames, height, width)

        decode_time = time.time() - decode_start
        print(f"[VAE DECODE COMPLETE] Time: {decode_time:.1f}s")
        print(f"  Video tensor shape: {video_frames.shape}")
        print(f"  VRAM: {torch.cuda.memory_allocated()/1024**3:.2f} GiB")

        # Convert to numpy [0,1] range
        video_frames = video_frames.clamp(-1, 1)
        video_frames = (video_frames + 1) / 2  # [-1,1] → [0,1]

        # Rearrange dimensions: (B, C, F, H, W) → (B, F, H, W, C)
        video_frames = video_frames.permute(0, 2, 3, 4, 1).cpu().float().numpy()

        # ============================================================
        # ENCODE TO MP4 (공식 패턴: numpy → uint8 → encode_video)
        # ============================================================
        print(f"\n{'='*60}")
        print(f"[ENCODING] Converting to MP4")
        print(f"{'='*60}")

        # numpy [0,1] → uint8 → torch tensor (공식 encode_video 패턴)
        video_uint8 = np.clip(video_frames * 255, 0, 255).round().astype("uint8")
        video_tensor = torch.from_numpy(video_uint8)  # 공식: torch.from_numpy 필수
        print(f"  Video shape: {video_tensor.shape}")
        print(f"  Frames: {video_tensor.shape[1]}, Resolution: {video_tensor.shape[3]}x{video_tensor.shape[2]}")

        output_path = tempfile.mktemp(suffix=".mp4")

        # Audio processing (if available from pipeline)
        from diffusers.pipelines.ltx2.export_utils import encode_video

        audio_data = None
        audio_sr = None

        print(f"\n{'='*60}")
        print(f"[AUDIO PROCESSING]")
        print(f"{'='*60}")

        if audio_latent is not None:
            print(f"  Audio latent shape: {audio_latent.shape}")
            print(f"  Audio latent dtype: {audio_latent.dtype}")
            print(f"  Audio latent device: {audio_latent.device}")

            # Check if pipeline has vocoder for audio decoding
            if hasattr(self.pipe, 'vocoder') and self.pipe.vocoder is not None:
                try:
                    # Decode audio latent to waveform (try __call__ instead of decode)
                    print(f"  [VOCODER] Decoding audio latent...")
                    audio_waveform = self.pipe.vocoder(audio_latent)  # Use __call__
                    print(f"  Decoded waveform shape: {audio_waveform.shape}")
                    print(f"  Decoded waveform dtype: {audio_waveform.dtype}")
                    print(f"  Decoded waveform device: {audio_waveform.device}")

                    # Ensure correct shape: (channels, samples) or (batch, channels, samples)
                    if audio_waveform.dim() == 3:
                        audio_data = audio_waveform[0].float().cpu()  # Remove batch dim
                    elif audio_waveform.dim() == 4:
                        audio_data = audio_waveform[0, 0].float().cpu()  # Remove batch + extra dim
                    else:
                        audio_data = audio_waveform.float().cpu()

                    audio_sr = self.pipe.vocoder.config.output_sampling_rate
                    print(f"  Final audio: shape={audio_data.shape}, sample_rate={audio_sr}")
                except Exception as e:
                    print(f"  [ERROR] Audio decode failed: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    audio_data = None
                    audio_sr = None
            else:
                print(f"  [WARNING] No vocoder in pipeline - cannot decode audio latent")
                audio_data = None
                audio_sr = None
        else:
            print(f"  [INFO] No audio latent returned by I2V pipeline")
            audio_data = None
            audio_sr = None

        # Encode to temporary path first
        temp_output = tempfile.mktemp(suffix="_temp.mp4")
        encode_video(
            video_tensor[0],        # (frames, H, W, C) torch tensor
            fps=frame_rate,
            audio=audio_data,
            audio_sample_rate=audio_sr,
            output_path=temp_output,
        )
        print(f"  [OK] Video encoded (temp): {temp_output}")

        # Add color metadata with FFmpeg (BT.709, full range)
        # Fixes washed-out colors by explicitly setting colorspace
        import subprocess
        print(f"  [COLOR METADATA] Adding BT.709 metadata...")

        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-i", temp_output,
            "-c:v", "copy",  # No re-encode
            "-c:a", "copy",  # No re-encode
            "-colorspace", "bt709",
            "-color_primaries", "bt709",
            "-color_trc", "bt709",
            "-color_range", "pc",  # Full range (RGB 0-255)
            output_path
        ]

        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  [WARNING] FFmpeg metadata failed: {result.stderr[:200]}")
            print(f"  [FALLBACK] Using original encode without metadata")
            # Fallback: use original file
            import shutil
            shutil.move(temp_output, output_path)
        else:
            print(f"  [OK] Color metadata added: BT.709, full range")
            # Clean up temp file
            import os
            os.remove(temp_output)

        # ============================================================
        # VERIFY: Comprehensive audio quality check
        # ============================================================
        print(f"\n{'='*60}")
        print(f"[AUDIO VERIFICATION]")
        print(f"{'='*60}")

        video_duration = num_frames / frame_rate
        print(f"  Video duration: {video_duration:.2f}s")

        has_audio = False
        fallback_reason = None

        try:
            # Check 1: Audio stream exists
            probe_cmd = [
                "ffprobe", "-v", "error",
                "-select_streams", "a:0",
                "-show_entries", "stream=codec_name,sample_rate,channels:format=duration",
                "-of", "json",
                output_path
            ]

            probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)

            if probe_result.returncode == 0:
                import json
                probe_data = json.loads(probe_result.stdout)

                if "streams" not in probe_data or len(probe_data["streams"]) == 0:
                    print(f"  ✗ No audio stream")
                    fallback_reason = "no_stream"
                else:
                    stream = probe_data["streams"][0]
                    print(f"  ✓ Audio stream:")
                    print(f"    - Codec: {stream.get('codec_name', 'unknown')}")
                    print(f"    - Sample rate: {stream.get('sample_rate', 'unknown')}")
                    print(f"    - Channels: {stream.get('channels', 'unknown')}")

                    # Check 2: Audio duration
                    audio_duration = float(probe_data.get("format", {}).get("duration", 0))
                    print(f"  Audio duration: {audio_duration:.2f}s")

                    if audio_duration < video_duration - 0.2:
                        print(f"  ✗ Audio too short ({audio_duration:.2f}s < {video_duration - 0.2:.2f}s)")
                        fallback_reason = "too_short"
                    else:
                        # Check 3: Loudness (RMS level)
                        volume_cmd = [
                            "ffmpeg", "-i", output_path,
                            "-af", "volumedetect",
                            "-f", "null", "-"
                        ]
                        volume_result = subprocess.run(volume_cmd, capture_output=True, text=True)

                        # Parse mean_volume from stderr
                        import re
                        mean_volume_match = re.search(r"mean_volume:\s+([-\d.]+)\s+dB", volume_result.stderr)

                        if mean_volume_match:
                            mean_volume = float(mean_volume_match.group(1))
                            print(f"  Mean volume: {mean_volume:.1f} dB")

                            # Threshold: -60dB (extremely quiet = probably silent/broken)
                            if mean_volume < -60.0:
                                print(f"  ✗ Audio too quiet ({mean_volume:.1f} dB < -60 dB)")
                                fallback_reason = "too_quiet"
                            else:
                                print(f"  ✓ Audio quality OK")
                                has_audio = True
                        else:
                            print(f"  [WARNING] Could not detect volume level")
                            # If we can't check volume, assume OK if duration is good
                            has_audio = True
            else:
                print(f"  ✗ FFprobe failed: {probe_result.stderr[:200]}")
                fallback_reason = "ffprobe_failed"

        except Exception as e:
            print(f"  [ERROR] Verification failed: {str(e)}")
            import traceback
            traceback.print_exc()
            fallback_reason = "verification_error"

        # ============================================================
        # FALLBACK: Generate ambient audio if missing/bad
        # ============================================================
        if not has_audio:
            print(f"\n{'='*60}")
            print(f"[FALLBACK AUDIO]")
            print(f"  Reason: {fallback_reason}")
            print(f"{'='*60}")

            try:
                fallback_audio_path = tempfile.mktemp(suffix="_ambient.wav")

                # Generate natural ambience: low-freq room tone + subtle wind texture
                # Mix of brown noise (low rumble) + filtered pink noise (wind)
                # Volume: -20dB (~20% for Track A, leaving room for TTS Track B)
                ambient_cmd = [
                    "ffmpeg", "-y",
                    "-f", "lavfi",
                    "-i", f"anoisesrc=duration={video_duration}:color=brown:sample_rate=24000:amplitude=0.0005",
                    "-f", "lavfi",
                    "-i", f"anoisesrc=duration={video_duration}:color=pink:sample_rate=24000:amplitude=0.0003",
                    "-filter_complex", "[0:a]highpass=f=20,lowpass=f=200[brown];[1:a]highpass=f=800,lowpass=f=4000[wind];[brown][wind]amix=inputs=2:duration=first,volume=-20dB[out]",
                    "-map", "[out]",
                    "-ac", "1",  # mono
                    fallback_audio_path
                ]

                ambient_result = subprocess.run(ambient_cmd, capture_output=True, text=True)
                if ambient_result.returncode != 0:
                    print(f"  [ERROR] Ambient generation failed: {ambient_result.stderr[:200]}")
                    raise Exception("Fallback audio generation failed")

                print(f"  [OK] Generated natural ambience: {video_duration:.1f}s @ -20dB")

                # Mux ambient audio into video
                final_output = tempfile.mktemp(suffix="_final.mp4")
                mux_cmd = [
                    "ffmpeg", "-y",
                    "-i", output_path,  # video (no audio)
                    "-i", fallback_audio_path,  # ambient audio
                    "-c:v", "copy",  # no video re-encode
                    "-c:a", "aac",  # encode audio to AAC
                    "-b:a", "128k",
                    "-shortest",  # match video duration
                    final_output
                ]

                mux_result = subprocess.run(mux_cmd, capture_output=True, text=True)
                if mux_result.returncode != 0:
                    print(f"  [ERROR] Muxing failed: {mux_result.stderr[:200]}")
                    raise Exception("Audio muxing failed")

                print(f"  [OK] Muxed ambient audio into MP4")

                # Replace original with muxed version
                import shutil
                shutil.move(final_output, output_path)

                # Cleanup
                import os
                os.remove(fallback_audio_path)

                print(f"  [GUARANTEE] MP4 now contains ambient audio track")
                print(f"  [FALLBACK APPLIED] Reason: {fallback_reason}")

            except Exception as e:
                print(f"  [WARNING] Fallback audio failed: {str(e)}")
                print(f"  [RESULT] Shipping silent MP4 (fallback unavailable)")
                fallback_reason = f"{fallback_reason}_fallback_failed"

        with open(output_path, "rb") as f:
            video_bytes = f.read()

        # CRITICAL: Verify video file is valid
        if len(video_bytes) < 1000:
            raise Exception(f"Video file too small ({len(video_bytes)} bytes) - generation failed")

        total_time = time.time() - gen_start
        cost_usd = total_time * 0.000306
        cost_krw = cost_usd * 1450

        print(f"\n{'='*60}")
        print(f"[COMPLETE - {'3-STAGE' if stage2b_success else '2-STAGE (Stage 2b failed)'} PATTERN]")
        print(f"{'='*60}")
        print(f"  Video frames: {num_frames}")
        print(f"  Resolution: {video_tensor.shape[3]}x{video_tensor.shape[2]}")
        print(f"  Duration: ~{num_frames/24:.1f}s @ 24fps")
        print(f"  Video size: {len(video_bytes) / 1024 / 1024:.2f} MB")
        print(f"\n[PERFORMANCE BREAKDOWN]")
        print(f"  Stage 1 (latent generation): {stage1_time:.1f}s")
        print(f"  Stage 2a (latent upsample): {upscale_time:.1f}s")
        if stage2b_success:
            print(f"  Stage 2b (4-step refine): {refine_time:.1f}s ✓")
        else:
            print(f"  Stage 2b (4-step refine): FAILED (fallback to Stage 2a)")
        print(f"  VAE decode: {decode_time:.1f}s")
        print(f"  Total: {total_time:.1f}s")
        print(f"  Cost: ${cost_usd:.4f} (₩{cost_krw:.0f})")
        print(f"  Target: <90s (<₩45)")
        if total_time <= 90:
            print(f"  [OK] Target achieved!")
        else:
            print(f"  [!] Exceeded by {total_time-90:.1f}s")
        print(f"\n[SIGMA SCHEDULES USED]")
        print(f"  Stage 1: DISTILLED_SIGMA_VALUES ({len(self.stage1_sigmas)} steps)")
        if stage2b_success:
            print(f"  Stage 2b: STAGE_2_DISTILLED_SIGMA_VALUES ({len(self.stage2_sigmas)} steps)")
        print(f"{'='*60}\n")
        return video_bytes

# 3. Web API
@app.function(image=image, timeout=900)
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

    # ── Polling pattern for long-running generations ──
    jobs = {}  # {job_id: {"status", "result", "error"}}

    async def _run_job(job_id, prompt, image_url, character_description, num_frames,
                       test_conditioning, test_guidance, test_steps):
        try:
            print(f"[JOB {job_id}] Starting generation...")
            generator = VideoGenerator()
            video_bytes = await generator.generate.remote.aio(
                prompt, image_url, character_description, num_frames,
                test_conditioning, test_guidance, test_steps
            )
            jobs[job_id]["status"] = "complete"
            jobs[job_id]["result"] = video_bytes
            print(f"[JOB {job_id}] Complete: {len(video_bytes)} bytes")
        except Exception as e:
            import traceback
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = str(e)
            print(f"[JOB {job_id}] Error: {e}")
            traceback.print_exc()

    @web.post("/start")
    async def start_generation(req: GenerateRequest):
        """Start video generation, return job_id immediately"""
        import uuid
        job_id = uuid.uuid4().hex[:8]
        jobs[job_id] = {"status": "running", "result": None, "error": None}
        asyncio.create_task(_run_job(
            job_id, req.prompt, req.image_url, req.character_description,
            req.num_frames, req.test_conditioning, req.test_guidance, req.test_steps
        ))
        print(f"[JOB {job_id}] Started")
        return Response(
            content=json.dumps({"job_id": job_id}),
            media_type="application/json",
            headers={"Access-Control-Allow-Origin": "*"}
        )

    @web.get("/status/{job_id}")
    async def job_status(job_id: str):
        """Poll job status: running | complete | error"""
        if job_id not in jobs:
            return Response(
                content=json.dumps({"status": "not_found"}),
                status_code=404,
                media_type="application/json",
                headers={"Access-Control-Allow-Origin": "*"}
            )
        job = jobs[job_id]
        return Response(
            content=json.dumps({"status": job["status"], "error": job["error"]}),
            media_type="application/json",
            headers={"Access-Control-Allow-Origin": "*"}
        )

    @web.get("/result/{job_id}")
    async def job_result(job_id: str):
        """Retrieve completed video"""
        if job_id not in jobs:
            return Response(
                content=json.dumps({"error": "not_found"}),
                status_code=404,
                media_type="application/json",
                headers={"Access-Control-Allow-Origin": "*"}
            )
        job = jobs[job_id]
        if job["status"] != "complete":
            return Response(
                content=json.dumps({"error": "not ready", "status": job["status"]}),
                status_code=202,
                media_type="application/json",
                headers={"Access-Control-Allow-Origin": "*"}
            )
        video_bytes = job["result"]
        del jobs[job_id]
        return Response(
            content=video_bytes,
            media_type="video/mp4",
            headers={"Access-Control-Allow-Origin": "*"}
        )

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
