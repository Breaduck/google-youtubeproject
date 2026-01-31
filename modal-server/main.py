"""LTX-Video Image-to-Video Service"""

import modal
import io
import base64
from pathlib import Path

# Image setup
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "accelerate==1.6.0",
        "diffusers==0.33.1",
        "huggingface-hub==0.36.0",
        "imageio==2.37.0",
        "imageio-ffmpeg==0.5.1",
        "sentencepiece==0.2.0",
        "torch==2.7.0",
        "transformers==4.51.3",
        "pillow",
        "requests",
        "fastapi",
        "pydantic",
    )
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})
)

# Volume setup
MODEL_VOLUME_NAME = "ltx-model"
model_volume = modal.Volume.from_name(MODEL_VOLUME_NAME, create_if_missing=True)
MODEL_PATH = "/models"
image = image.env({"HF_HOME": MODEL_PATH})

MINUTES = 60

app = modal.App("ltx-video-service")

@app.cls(
    image=image,
    volumes={MODEL_PATH: model_volume},
    gpu="A10G",
    timeout=10 * MINUTES,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class LTX:
    @modal.enter()
    def load_model(self):
        import torch
        from diffusers import LTXImageToVideoPipeline

        print("Loading LTX-Video model...")
        self.pipe = LTXImageToVideoPipeline.from_pretrained(
            "Lightricks/LTX-Video",
            torch_dtype=torch.bfloat16
        )
        self.pipe.to("cuda")
        print("Model loaded!")

    @modal.method()
    def generate(
        self,
        image_url: str,
        prompt: str = "natural movement",
        negative_prompt: str = "worst quality, blurry",
        width: int = 704,
        height: int = 480,
        num_frames: int = 161,
        num_inference_steps: int = 30,
        seed: int = 42,
    ) -> bytes:
        import torch
        import requests
        from PIL import Image
        from diffusers.utils import export_to_video
        import tempfile
        import os

        print(f"Generating video from {image_url[:50]}...")

        # Download image
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        input_image = Image.open(io.BytesIO(response.content)).convert("RGB")
        input_image = input_image.resize((width, height))

        # Generate video
        with torch.inference_mode():
            result = self.pipe(
                image=input_image,
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_frames=num_frames,
                num_inference_steps=num_inference_steps,
                guidance_scale=3.0,
                decode_timestep=0.03,
                decode_noise_scale=0.025,
                generator=torch.Generator("cuda").manual_seed(seed),
            )

        frames = result.frames[0]

        # Save to MP4
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            temp_path = tmp.name

        export_to_video(frames, temp_path, fps=24)

        with open(temp_path, "rb") as f:
            video_bytes = f.read()

        os.unlink(temp_path)

        print(f"Video generated: {len(video_bytes) / 1024 / 1024:.2f}MB")
        return video_bytes


@app.function(image=image)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI
    from pydantic import BaseModel

    web_app = FastAPI()

    class VideoRequest(BaseModel):
        image_url: str
        prompt: str = "natural movement"
        negative_prompt: str = "worst quality, blurry"
        width: int = 704
        height: int = 480
        num_frames: int = 161
        num_inference_steps: int = 30
        seed: int = 42

    @web_app.post("/")
    def generate_video(request: VideoRequest):
        ltx = LTX()
        video_bytes = ltx.generate.remote(
            image_url=request.image_url,
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            num_frames=request.num_frames,
            num_inference_steps=request.num_inference_steps,
            seed=request.seed,
        )

        video_base64 = base64.b64encode(video_bytes).decode()
        size_mb = len(video_bytes) / 1024 / 1024

        return {
            "status": "success",
            "video_base64": video_base64,
            "size_mb": round(size_mb, 2),
        }

    return web_app


@app.local_entrypoint()
def main(
    image_url: str = "https://picsum.photos/704/480",
    prompt: str = "gentle movements",
):
    print(f"Testing with image: {image_url}")
    ltx = LTX()
    video_bytes = ltx.generate.remote(image_url=image_url, prompt=prompt)

    output_path = Path("/tmp/test_output.mp4")
    output_path.write_bytes(video_bytes)
    print(f"Video saved to: {output_path}")
    print(f"Size: {len(video_bytes) / 1024 / 1024:.2f}MB")
