"""
LTX-Video Service for AI Video Generation
씬당 8초 짜리 AI 영상을 빠르고 저렴하게 생성하는 Modal 서비스
"""

import modal
from pathlib import Path

# ============================================================================
# 1. 이미지 설정: 필요한 라이브러리 설치
# ============================================================================
image = modal.Image.debian_slim().pip_install(
    "torch",
    "diffusers",
    "transformers",
    "accelerate",
    "sentencepiece",
    "huggingface_hub",
    "pillow",  # 이미지 처리용
    "requests"  # 이미지 다운로드용
)

# ============================================================================
# 2. 볼륨 설정: 모델 캐시 (매번 다운로드 방지)
# ============================================================================
model_cache = modal.Volume.from_name(
    "model-cache",
    create_if_missing=True
)

MODEL_DIR = "/models"
MODEL_NAME = "Lightricks/LTX-Video"

# ============================================================================
# 3. Modal 앱 정의
# ============================================================================
app = modal.App("ltx-video-service")

# ============================================================================
# 4. 모델 다운로드 함수 (최초 1회만 실행)
# ============================================================================
@app.function(
    image=image,
    volumes={MODEL_DIR: model_cache},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=3600,  # 1시간 (모델 다운로드는 시간이 걸릴 수 있음)
)
def download_model():
    """
    Hugging Face에서 LTX-Video 모델을 다운로드합니다.
    모델이 이미 있으면 스킵합니다.
    """
    from huggingface_hub import snapshot_download
    import os

    model_path = Path(MODEL_DIR) / MODEL_NAME.replace("/", "--")

    # 모델이 이미 있는지 확인
    if model_path.exists() and any(model_path.iterdir()):
        print(f"✅ 모델이 이미 존재합니다: {model_path}")
        return str(model_path)

    print(f"📥 모델 다운로드 중: {MODEL_NAME}")
    print(f"📁 저장 위치: {model_path}")

    # Hugging Face에서 모델 다운로드
    hf_token = os.environ.get("HF_TOKEN")

    downloaded_path = snapshot_download(
        repo_id=MODEL_NAME,
        local_dir=str(model_path),
        token=hf_token,
        ignore_patterns=["*.md", "*.txt"]  # 불필요한 파일 제외
    )

    # 볼륨에 변경사항 저장
    model_cache.commit()

    print(f"✅ 모델 다운로드 완료: {downloaded_path}")
    return downloaded_path


# ============================================================================
# 5. 비디오 생성 함수 (핵심 기능)
# ============================================================================
@app.function(
    image=image,
    volumes={MODEL_DIR: model_cache},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    gpu="A10G",  # LTX-Video는 GPU 필요 (A10G는 비용 효율적)
    timeout=600,  # 10분 (비디오 생성)
    memory=16384,  # 16GB RAM
)
def generate_video(
    image_url: str,
    prompt: str,
    duration: float = 8.0,
    fps: int = 24,
    seed: int = 42,
) -> bytes:
    """
    이미지 한 장을 받아서 8초짜리 AI 비디오를 생성합니다.

    Args:
        image_url: 입력 이미지 URL (스토리보드 이미지)
        prompt: 비디오 생성 프롬프트 (표정, 동작, 배경 움직임 등)
        duration: 비디오 길이 (초) - 기본 8초
        fps: 초당 프레임 수 - 기본 24fps
        seed: 랜덤 시드 (재현성)

    Returns:
        생성된 비디오 바이트 (MP4)
    """
    import torch
    from diffusers import LTXPipeline
    from PIL import Image
    import requests
    from io import BytesIO
    import tempfile
    import os

    print(f"🎬 비디오 생성 시작")
    print(f"   이미지: {image_url}")
    print(f"   프롬프트: {prompt}")
    print(f"   길이: {duration}초, FPS: {fps}")

    # 모델 경로
    model_path = Path(MODEL_DIR) / MODEL_NAME.replace("/", "--")

    if not model_path.exists():
        raise FileNotFoundError(
            f"모델이 없습니다. download_model()을 먼저 실행하세요: {model_path}"
        )

    # 1. 입력 이미지 다운로드
    print("📥 이미지 다운로드 중...")
    response = requests.get(image_url)
    response.raise_for_status()
    input_image = Image.open(BytesIO(response.content)).convert("RGB")

    # 2. 파이프라인 로드
    print("🔧 파이프라인 로드 중...")
    pipe = LTXPipeline.from_pretrained(
        str(model_path),
        torch_dtype=torch.bfloat16,
    ).to("cuda")

    # 메모리 최적화
    pipe.enable_model_cpu_offload()

    # 3. 비디오 생성
    print("🎥 비디오 생성 중...")

    # 프레임 수 계산
    num_frames = int(duration * fps)

    with torch.inference_mode():
        output = pipe(
            prompt=prompt,
            image=input_image,
            num_frames=num_frames,
            guidance_scale=3.0,  # 낮은 값 = 이미지에 더 충실
            num_inference_steps=30,  # 속도와 품질의 균형
            generator=torch.Generator("cuda").manual_seed(seed),
        )

    # 4. 비디오 저장 (임시 파일)
    print("💾 비디오 저장 중...")
    frames = output.frames[0]  # List of PIL Images

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        temp_path = tmp.name

    # PIL 이미지들을 MP4로 변환
    from diffusers.utils import export_to_video
    export_to_video(frames, temp_path, fps=fps)

    # 5. 바이트로 읽어서 반환
    with open(temp_path, "rb") as f:
        video_bytes = f.read()

    # 임시 파일 삭제
    os.unlink(temp_path)

    print(f"✅ 비디오 생성 완료! 크기: {len(video_bytes) / 1024 / 1024:.2f}MB")

    return video_bytes


# ============================================================================
# 6. 웹 엔드포인트 (프론트엔드에서 호출)
# ============================================================================
@app.function(
    image=image,
)
@modal.web_endpoint(method="POST")
def generate_video_endpoint(item: dict) -> dict:
    """
    프론트엔드에서 호출할 REST API 엔드포인트

    Request Body:
    {
        "image_url": "https://...",
        "prompt": "subtle facial expressions, gentle background movement",
        "duration": 8.0,
        "fps": 24,
        "seed": 42
    }

    Response:
    {
        "status": "success",
        "video_url": "https://...",  # Modal에서 제공하는 임시 URL
        "size_mb": 12.5
    }
    """
    import base64

    # 비디오 생성 (병렬 호출 가능)
    video_bytes = generate_video.remote(
        image_url=item["image_url"],
        prompt=item.get("prompt", "natural movement, subtle expressions"),
        duration=item.get("duration", 8.0),
        fps=item.get("fps", 24),
        seed=item.get("seed", 42),
    )

    # Base64 인코딩하여 반환 (또는 S3/Cloudflare R2에 업로드)
    video_base64 = base64.b64encode(video_bytes).decode()

    return {
        "status": "success",
        "video_base64": video_base64,
        "size_mb": len(video_bytes) / 1024 / 1024,
    }


# ============================================================================
# 7. 로컬 테스트용 (선택사항)
# ============================================================================
@app.local_entrypoint()
def main():
    """
    로컬에서 테스트할 때 사용
    터미널에서: modal run modal-server/main.py
    """
    print("🚀 LTX-Video 서비스 테스트")
    print("1. 모델 다운로드...")
    download_model.remote()
    print("✅ 완료!")
