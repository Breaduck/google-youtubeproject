"""
Runware Provider Client
- WebSocket 기반 비디오 생성 (SeeDance 1.0 Pro Fast)
- Feature Flag: RUNWARE_ENABLED (기본 OFF)
- Billing Gate: $5 최소 요구 / $20 최소 충전
"""

import os
import asyncio
from typing import Dict, Optional


async def runware_generate_video(
    image_url: str,
    prompt: str,
    duration_sec: int = 5,
    width: int = 1280,
    height: int = 720,
    fps: int = 24,
    model_id: str = "bytedance:2@2"
) -> Dict[str, Optional[str]]:
    """
    Runware SDK를 사용한 비디오 생성 (동기 완료 대기)

    Args:
        image_url: 입력 이미지 HTTP URL (공개 접근 가능)
        prompt: 비디오 생성 프롬프트
        duration_sec: 영상 길이 (초)
        width: 해상도 너비
        height: 해상도 높이
        fps: 프레임률 (기본 24)
        model_id: Runware 모델 ID

    Returns:
        {"task_id": str, "video_url": str or None, "status": str}

    Raises:
        ValueError: Feature Flag OFF 또는 파라미터 오류
        RuntimeError: API 호출 실패
    """
    from runware import Runware, IVideoInference, IFrameImage

    # Feature Flag 체크 (Billing Gate)
    if not os.getenv("RUNWARE_ENABLED", "false").lower() == "true":
        raise ValueError(
            "Runware provider is disabled. Set RUNWARE_ENABLED=true in Modal secrets to enable."
        )

    api_key = os.getenv("RUNWARE_API_KEY")
    if not api_key:
        raise ValueError("RUNWARE_API_KEY not configured in Modal secrets")

    if not image_url or not image_url.startswith("http"):
        raise ValueError(f"Invalid image_url: must be HTTP/HTTPS URL, got {image_url[:50]}")

    print(f"[RUNWARE] Generating video: {width}x{height} @ {fps}fps, {duration_sec}s")
    print(f"[RUNWARE] Model: {model_id}")
    print(f"[RUNWARE] Image: {image_url[:80]}...")

    runware = None
    try:
        # 1. WebSocket 연결
        runware = Runware(api_key=api_key)
        await runware.connect()
        print("[RUNWARE] Connected to Runware API")

        # 2. 비디오 생성 요청 (공식 SDK 패턴)
        request = IVideoInference(
            positivePrompt=prompt,
            model=model_id,
            width=width,
            height=height,
            duration=duration_sec,
            frameImages=[
                IFrameImage(inputImage=image_url)  # HTTP URL 직접 사용
            ],
            numberResults=1,
            includeCost=True  # 비용 정보 포함
        )

        print("[RUNWARE] Sending videoInference request...")

        # 3. 동기 완료 대기 (SDK가 자동으로 폴링)
        videos = await runware.videoInference(requestVideo=request)

        if not videos or len(videos) == 0:
            raise RuntimeError("No video returned from Runware API")

        video = videos[0]

        # 4. 결과 추출
        task_id = getattr(video, 'taskUUID', None) or getattr(video, 'videoUUID', 'unknown')
        video_url = getattr(video, 'videoURL', None)
        status = getattr(video, 'status', 'completed')
        cost = getattr(video, 'cost', None)

        print(f"[RUNWARE] Success: task_id={task_id}, status={status}, cost=${cost}")
        print(f"[RUNWARE] Video URL: {video_url[:80] if video_url else 'None'}...")

        return {
            "task_id": task_id,
            "video_url": video_url,
            "status": status,
            "cost": cost
        }

    except Exception as e:
        error_msg = str(e).lower()

        # Billing Gate: insufficient credits 체크
        if "insufficient" in error_msg or "credits" in error_msg or "paid invoice" in error_msg:
            print(f"[RUNWARE] BILLING ERROR: {str(e)}")
            raise ValueError(f"runware_insufficient_credits: {str(e)}")

        print(f"[RUNWARE] ERROR: {type(e).__name__}: {str(e)}")
        raise RuntimeError(f"Runware API failed: {type(e).__name__}: {str(e)}")

    finally:
        # 5. WebSocket 연결 정리
        if runware:
            try:
                await runware.disconnect()
                print("[RUNWARE] Disconnected from Runware API")
            except Exception as e:
                print(f"[RUNWARE] Warning: disconnect failed: {e}")
