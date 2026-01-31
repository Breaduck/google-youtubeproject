"""
LTX-Video Image-to-Video Service
씬 이미지를 8초 AI 영상으로 변환하는 Modal 서비스
"""

import modal
import io
import base64
from pathlib import Path

# ============================================================================
# 1. 이미지 설정
# ============================================================================
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
    )
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})
)

# ============================================================================
# 2. 볼륨 설정
# ============================================================================
MODEL_VOLUME_NAME = "ltx-model"
model_volume = modal.Volume.from_name(MODEL_VOLUME_NAME, create_if_missing=True)

MODEL_PATH = Path("/models")
image = image.env({"HF_HOME": str(MODEL_PATH)})

MINUTES = 60

# ============================================================================
# 3. Modal 앱
# ============================================================================
app = modal.App("ltx-video-service")

# ============================================================================
# 4. LTX 비디오 생성 클래스
# ============================================================================
@app.cls(
    image=image,
    volumes={MODEL_PATH: model_volume},
    gpu="A10G",  # A10G: 비용 효율적, 필요시 H100으로 변경
    timeout=10 * MINUTES,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class LTX:
    @modal.enter()
    def load_model(self):
        """모델 로드 (컨테이너 시작시 1회 실행)"""
        import torch
        from diffusers import LTXImageToVideoPipeline

        print("🔧 LTX-Video 모델 로드 중...")

        # Image-to-Video 파이프라인 사용
        self.pipe = LTXImageToVideoPipeline.from_pretrained(
            "Lightricks/LTX-Video",
            torch_dtype=torch.bfloat16
        )
        self.pipe.to("cuda")

        print("✅ 모델 로드 완료!")

    @modal.method()
    def generate(
        self,
        image_url: str,
        prompt: str = "natural movement, subtle expressions, gentle background motion",
        negative_prompt: str = "worst quality, inconsistent motion, blurry, jittery, distorted",
        width: int = 704,
        height: int = 480,
        num_frames: int = 161,  # 8초 @ 24fps = 192 프레임, 하지만 161이 권장값
        num_inference_steps: int = 30,  # 속도와 품질의 균형
        guidance_scale: float = 3.0,
        seed: int = 42,
    ) -> bytes:
        """
        이미지 URL을 받아서 8초 비디오를 생성합니다.

        Args:
            image_url: 입력 이미지 URL
            prompt: 움직임 설명 프롬프트
            negative_prompt: 피할 요소들
            width: 비디오 너비 (704 권장)
            height: 비디오 높이 (480 권장)
            num_frames: 프레임 수 (161 = ~6.7초)
            num_inference_steps: 생성 스텝 (30-50 권장)
            guidance_scale: 가이던스 스케일
            seed: 랜덤 시드

        Returns:
            MP4 비디오 바이트
        """
        import torch
        import requests
        from PIL import Image
        from diffusers.utils import export_to_video
        import tempfile

        print(f"🎬 비디오 생성 시작")
        print(f"   이미지: {image_url[:50]}...")
        print(f"   프롬프트: {prompt}")
        print(f"   크기: {width}x{height}, {num_frames} 프레임")

        # 1. 이미지 다운로드
        print("📥 이미지 다운로드 중...")
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        input_image = Image.open(io.BytesIO(response.content)).convert("RGB")

        # 이미지 리사이즈 (권장 크기에 맞춤)
        input_image = input_image.resize((width, height))

        # 2. 비디오 생성
        print("🎥 AI 비디오 생성 중...")

        with torch.inference_mode():
            result = self.pipe(
                image=input_image,
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_frames=num_frames,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                decode_timestep=0.03,  # LTX 권장값
                decode_noise_scale=0.025,  # LTX 권장값
                generator=torch.Generator("cuda").manual_seed(seed),
            )

        frames = result.frames[0]  # List of PIL Images

        # 3. MP4로 저장
        print("💾 비디오 저장 중...")
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            temp_path = tmp.name

        # 24fps로 저장 (161 프레임 = 약 6.7초)
        export_to_video(frames, temp_path, fps=24)

        # 4. 바이트로 읽기
        with open(temp_path, "rb") as f:
            video_bytes = f.read()

        # 임시 파일 삭제
        import os
        os.unlink(temp_path)

        size_mb = len(video_bytes) / 1024 / 1024
        print(f"✅ 비디오 생성 완료! 크기: {size_mb:.2f}MB")

        return video_bytes


# ============================================================================
# 5. 웹 엔드포인트 (프론트엔드에서 호출)
# ============================================================================
@app.function(image=image)
@modal.web_endpoint(method="POST")
def generate_video_endpoint(item: dict) -> dict:
    """
    REST API 엔드포인트

    Request Body:
    {
        "image_url": "https://...",
        "prompt": "subtle facial expressions, gentle movement",
        "width": 704,
        "height": 480,
        "num_frames": 161,
        "seed": 42
    }

    Response:
    {
        "status": "success",
        "video_base64": "...",
        "size_mb": 12.5
    }
    """
    print(f"🎬 API 요청 받음: {item.get('image_url', 'N/A')[:50]}...")

    # LTX 인스턴스 생성 및 비디오 생성
    ltx = LTX()

    video_bytes = ltx.generate.remote(
        image_url=item["image_url"],
        prompt=item.get("prompt", "natural movement, subtle expressions"),
        negative_prompt=item.get(
            "negative_prompt",
            "worst quality, inconsistent motion, blurry, jittery, distorted"
        ),
        width=item.get("width", 704),
        height=item.get("height", 480),
        num_frames=item.get("num_frames", 161),
        num_inference_steps=item.get("num_inference_steps", 30),
        guidance_scale=item.get("guidance_scale", 3.0),
        seed=item.get("seed", 42),
    )

    # Base64 인코딩
    video_base64 = base64.b64encode(video_bytes).decode()
    size_mb = len(video_bytes) / 1024 / 1024

    print(f"✅ API 응답 전송: {size_mb:.2f}MB")

    return {
        "status": "success",
        "video_base64": video_base64,
        "size_mb": round(size_mb, 2),
    }


# ============================================================================
# 6. 로컬 테스트용
# ============================================================================
@app.local_entrypoint()
def main(
    image_url: str = "https://picsum.photos/704/480",
    prompt: str = "gentle movements, natural lighting",
):
    """
    로컬 테스트

    Usage:
        modal run main.py
        modal run main.py --image-url="https://..." --prompt="..."
    """
    print("🚀 LTX-Video 서비스 테스트")
    print(f"   이미지: {image_url}")
    print(f"   프롬프트: {prompt}")

    ltx = LTX()

    video_bytes = ltx.generate.remote(
        image_url=image_url,
        prompt=prompt,
    )

    # 로컬에 저장
    output_path = Path("/tmp/test_output.mp4")
    output_path.write_bytes(video_bytes)

    print(f"✅ 완료! 비디오 저장됨: {output_path}")
    print(f"   크기: {len(video_bytes) / 1024 / 1024:.2f}MB")
