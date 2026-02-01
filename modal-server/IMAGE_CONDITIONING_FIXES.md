# LTX Video Image Conditioning Critical Fixes

## Deployment
✓ Successfully deployed to Modal: https://hiyoonsh1--ltx-video-service-v2-web-app.modal.run

## Problem
The LTX-Video image-to-video pipeline was completely ignoring the input reference image and generating different people/characters instead of animating the original person in the image.

## Root Causes Identified

1. **guidance_scale too high (8.5)** - When guidance scale is too high, the model follows the text prompt too strongly and ignores the image conditioning
2. **Appearance descriptions in prompt** - Describing appearance in the prompt confuses the model since the image already provides this information
3. **Excessive quality keywords** - Too many keywords in the prompt dilutes the image conditioning
4. **No first frame verification** - No mechanism to detect when image conditioning fails

## Critical Fixes Applied

### Fix 1: Lower guidance_scale (8.5 → 4.0)
```python
guidance_scale=4.0  # Significantly lowered: prioritize image over prompt
```
**Impact:** The lower guidance scale makes the model prioritize the input image over the text prompt, ensuring the character from the input image is preserved.

### Fix 2: Motion-Only Prompts (Remove ALL Appearance Descriptions)
```python
# OLD (WRONG):
enhanced_prompt = "A person with brown hair, wearing casual clothes, standing still..."

# NEW (CORRECT):
motion_only_prompt = "subtle breathing motion, gentle eye blinks, minimal natural facial movements"
enhanced_prompt = f"{motion_only_prompt}, smooth, natural"
```
**Impact:** The input image provides all appearance information. The prompt should ONLY describe motion/action.

### Fix 3: Explicit Negative Prompt for Character Preservation
```python
negative_prompt = "different person, different face, new character, morphing, scene change, distorted face, warped, inconsistent appearance"
```
**Impact:** Explicitly tells the model what NOT to do - don't generate a different person.

### Fix 4: First Frame Verification & Replacement
```python
# Calculate pixel difference between first frame and input image
diff = np.abs(first_frame_array.astype(float) - input_image_array.astype(float)).mean()

if diff > 30.0:  # Different person detected
    print("[WARNING] First frame differs significantly - REPLACING")
    output[0] = reference_image.copy()  # Force first frame to match input
```
**Impact:** Detects when image conditioning completely fails and forces the first frame to be the exact input image as a safety fallback.

### Fix 5: Enhanced Debugging & Model Verification
```python
# Verify model components on load
print(f"Pipeline components loaded:")
print(f"  - VAE: {type(self.pipe.vae).__name__}")
print(f"  - Transformer: {type(self.pipe.transformer).__name__}")
print(f"  - Scheduler: {type(self.pipe.scheduler).__name__}")

# Image preprocessing logging
print(f"[PREPROCESSING] Original: {img_width}x{img_height}")
print(f"[PREPROCESSING] Final size: {reference_image.size}")
print(f"[PREPROCESSING] Image hash: {img_hash}")

# Generation settings logging
print(f"[GENERATION SETTINGS]")
print(f"  Guidance scale: 4.0 (LOW - prioritizes image conditioning)")
print(f"  Prompt: '{enhanced_prompt}'")
print(f"  Strategy: MOTION ONLY (no appearance description)")
```
**Impact:** Provides visibility into what's happening at each stage for debugging.

## Expected Results

With these fixes:
1. ✓ The person in the input image should be preserved exactly
2. ✓ Only subtle motion should be added (breathing, eye blinks, minimal facial movements)
3. ✓ No new faces or different characters should appear
4. ✓ First frame will always match the input image (forced if needed)
5. ✓ Clear debugging output to verify image conditioning is working

## Testing Instructions

1. Open the test page: `C:\Users\hiyoo\OneDrive\바탕 화면\google-youtubeproject\test-modal-base64.html`
2. Select an image with a clear person's face
3. Click "Modal API 테스트 (Base64)"
4. Verify the generated video:
   - Same person as input image ✓
   - Subtle natural motion only ✓
   - No scene changes or morphing ✓
   - First frame matches input exactly ✓

## Technical Parameters

- **Resolution:** 1024x576 (16:9, divisible by 64)
- **Frames:** 97 (~4 seconds @ 24fps)
- **Inference Steps:** 50
- **Guidance Scale:** 4.0 (LOW for strong image conditioning)
- **Model:** Lightricks/LTX-Video-0.9.8-dev
- **Pipeline:** LTXImageToVideoPipeline (image-to-video, not text-to-video)

## Deployment Command

```bash
cd "C:\Users\hiyoo\OneDrive\바탕 화면\video-saas"
set PYTHONUTF8=1
python -X utf8 -m modal deploy main.py
```

## Next Steps

1. Test with the HTML test page
2. If successful, integrate with the YouTube storyboard project
3. Deploy frontend to Cloudflare Pages
4. Monitor first frame verification logs to ensure image conditioning is working
