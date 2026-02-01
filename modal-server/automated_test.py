"""
LTX-2 Automated Parameter Testing
자동으로 파라미터 조합을 테스트하고 결과를 분석합니다.
"""

import modal
import requests
import json
import time
from datetime import datetime
from pathlib import Path
import base64

# Modal 앱 연결
stub = modal.Stub("ltx-test-runner")

# 테스트 결과 저장 디렉토리
RESULTS_DIR = Path("test_results")
RESULTS_DIR.mkdir(exist_ok=True)

# 테스트 이미지 (base64 또는 URL)
TEST_IMAGE_URL = "YOUR_TEST_IMAGE_URL_HERE"  # 변경 필요

# 테스트 대사 (다양한 감정)
TEST_DIALOGUES = [
    ("sad", "너무 슬퍼... 왜 이런 일이..."),
    ("happy", "하하하! 정말 재밌어!"),
    ("angry", "화나! 이건 용납할 수 없어!"),
    ("neutral", "안녕하세요. 만나서 반갑습니다."),
]

# Phase 1: Coarse Search (굵은 탐색)
PHASE_1_PARAMS = {
    "conditioning": [0.5, 0.7, 0.9],
    "guidance": [2.5, 3.5, 5.0],
    "steps": [12, 15, 20],
}

# Phase 2: Fine-tune (최적 범위 정밀 탐색) - 나중에 설정
PHASE_2_PARAMS = {
    "conditioning": [],  # Phase 1 결과 보고 결정
    "guidance": [],
    "steps": [],
}


def generate_video_with_params(
    image_url: str,
    dialogue: str,
    conditioning: float,
    guidance: float,
    steps: int,
    endpoint: str = "https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run"
):
    """
    특정 파라미터로 비디오 생성 (Modal API 직접 호출)
    """
    # Gemini로 프롬프트 생성 (프론트엔드와 동일)
    from gemini_helper import generate_motion_prompt

    prompt = generate_motion_prompt(dialogue, "Character in scene")

    # Modal API 호출 - 파라미터 override
    payload = {
        "prompt": prompt,
        "image_url": image_url,
        "num_frames": 97,
        # 테스트할 파라미터 (Modal main.py 수정 필요)
        "test_params": {
            "image_conditioning_scale": conditioning,
            "guidance_scale": guidance,
            "num_inference_steps": steps,
        }
    }

    print(f"Testing: cond={conditioning}, guidance={guidance}, steps={steps}")
    start_time = time.time()

    response = requests.post(
        f"{endpoint}/generate",
        json=payload,
        timeout=300
    )

    elapsed = time.time() - start_time

    if response.status_code == 200:
        return {
            "success": True,
            "video_data": response.content,
            "elapsed_time": elapsed,
            "params": payload["test_params"]
        }
    else:
        return {
            "success": False,
            "error": response.text,
            "elapsed_time": elapsed,
            "params": payload["test_params"]
        }


def analyze_video_quality(video_path: Path, reference_image_path: Path):
    """
    비디오 품질 자동 분석
    - 얼굴 안정성 (character fidelity)
    - 움직임 존재 여부
    - 프레임 간 변화량
    """
    import cv2
    import numpy as np

    # 비디오 로드
    cap = cv2.VideoCapture(str(video_path))
    frames = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)

    cap.release()

    if len(frames) == 0:
        return {"error": "No frames extracted"}

    # 참조 이미지 로드
    ref_image = cv2.imread(str(reference_image_path))
    ref_image = cv2.resize(ref_image, (frames[0].shape[1], frames[0].shape[0]))

    # 1. 얼굴 안정성 (Character Fidelity)
    checkpoint_indices = [0, len(frames)//4, len(frames)//2, len(frames)*3//4, len(frames)-1]
    fidelity_diffs = []

    for idx in checkpoint_indices:
        if idx < len(frames):
            frame = frames[idx]
            diff = np.abs(frame.astype(float) - ref_image.astype(float)).mean()
            fidelity_diffs.append(diff)

    avg_fidelity_diff = np.mean(fidelity_diffs)
    max_fidelity_diff = np.max(fidelity_diffs)

    # 2. 움직임 존재 여부
    frame_diffs = []
    for i in range(1, len(frames)):
        diff = np.abs(frames[i].astype(float) - frames[i-1].astype(float)).mean()
        frame_diffs.append(diff)

    avg_motion = np.mean(frame_diffs)
    max_motion = np.max(frame_diffs)

    # 3. 종합 점수
    # 얼굴 안정성: diff < 20 = 좋음, < 30 = 보통, > 30 = 나쁨
    if max_fidelity_diff < 20:
        fidelity_score = 100
    elif max_fidelity_diff < 30:
        fidelity_score = 70
    else:
        fidelity_score = max(0, 100 - (max_fidelity_diff - 30) * 2)

    # 움직임: avg_motion > 2 = 좋음, > 1 = 보통, < 1 = 나쁨 (정적)
    if avg_motion > 2:
        motion_score = 100
    elif avg_motion > 1:
        motion_score = 50
    else:
        motion_score = max(0, avg_motion * 50)

    # 종합 점수 (얼굴 60%, 움직임 40%)
    overall_score = fidelity_score * 0.6 + motion_score * 0.4

    return {
        "fidelity": {
            "avg_diff": float(avg_fidelity_diff),
            "max_diff": float(max_fidelity_diff),
            "score": float(fidelity_score),
            "status": "GOOD" if max_fidelity_diff < 20 else "OK" if max_fidelity_diff < 30 else "BAD"
        },
        "motion": {
            "avg_motion": float(avg_motion),
            "max_motion": float(max_motion),
            "score": float(motion_score),
            "status": "GOOD" if avg_motion > 2 else "OK" if avg_motion > 1 else "BAD"
        },
        "overall_score": float(overall_score),
        "grade": "A" if overall_score >= 90 else "B" if overall_score >= 70 else "C" if overall_score >= 50 else "F"
    }


def run_phase_1_tests():
    """
    Phase 1: Coarse Search
    """
    results = []
    total_tests = (
        len(PHASE_1_PARAMS["conditioning"]) *
        len(PHASE_1_PARAMS["guidance"]) *
        len(PHASE_1_PARAMS["steps"]) *
        len(TEST_DIALOGUES)
    )

    print(f"🔬 Phase 1: Testing {total_tests} combinations")
    print(f"Estimated cost: ₩{total_tests * 32:,}")
    print(f"Estimated time: {total_tests * 1.2:.0f} minutes")

    test_num = 0

    for conditioning in PHASE_1_PARAMS["conditioning"]:
        for guidance in PHASE_1_PARAMS["guidance"]:
            for steps in PHASE_1_PARAMS["steps"]:
                for emotion, dialogue in TEST_DIALOGUES:
                    test_num += 1

                    print(f"\n{'='*60}")
                    print(f"Test {test_num}/{total_tests}")
                    print(f"Params: cond={conditioning}, guide={guidance}, steps={steps}")
                    print(f"Emotion: {emotion}, Dialogue: {dialogue}")
                    print(f"{'='*60}")

                    # 비디오 생성
                    result = generate_video_with_params(
                        image_url=TEST_IMAGE_URL,
                        dialogue=dialogue,
                        conditioning=conditioning,
                        guidance=guidance,
                        steps=steps
                    )

                    if result["success"]:
                        # 비디오 저장
                        video_filename = f"test_{test_num}_c{conditioning}_g{guidance}_s{steps}_{emotion}.mp4"
                        video_path = RESULTS_DIR / video_filename

                        with open(video_path, "wb") as f:
                            f.write(result["video_data"])

                        print(f"✓ Video saved: {video_filename}")
                        print(f"  Time: {result['elapsed_time']:.1f}s")

                        # TODO: 품질 분석 (참조 이미지 필요)
                        # quality = analyze_video_quality(video_path, reference_image_path)

                        results.append({
                            "test_num": test_num,
                            "params": result["params"],
                            "emotion": emotion,
                            "dialogue": dialogue,
                            "elapsed_time": result["elapsed_time"],
                            "video_file": video_filename,
                            # "quality": quality,
                            "timestamp": datetime.now().isoformat()
                        })
                    else:
                        print(f"✗ Failed: {result['error']}")
                        results.append({
                            "test_num": test_num,
                            "params": result["params"],
                            "emotion": emotion,
                            "dialogue": dialogue,
                            "error": result["error"],
                            "timestamp": datetime.now().isoformat()
                        })

                    # 결과를 JSON으로 저장 (중간 저장)
                    with open(RESULTS_DIR / "phase1_results.json", "w", encoding="utf-8") as f:
                        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"✓ Phase 1 Complete!")
    print(f"  Total tests: {total_tests}")
    print(f"  Results saved: {RESULTS_DIR / 'phase1_results.json'}")
    print(f"{'='*60}")

    return results


def analyze_phase_1_results():
    """
    Phase 1 결과 분석 및 최적 범위 추천
    """
    with open(RESULTS_DIR / "phase1_results.json", "r", encoding="utf-8") as f:
        results = json.load(f)

    # 성공한 테스트만 분석
    successful = [r for r in results if "quality" in r]

    if not successful:
        print("No quality data available for analysis")
        return

    # 점수별 정렬
    sorted_by_score = sorted(successful, key=lambda x: x["quality"]["overall_score"], reverse=True)

    print("\n🏆 Top 10 Best Configurations:")
    print(f"{'Rank':<6} {'Score':<8} {'Cond':<8} {'Guide':<8} {'Steps':<8} {'Emotion':<10}")
    print("-" * 60)

    for i, result in enumerate(sorted_by_score[:10], 1):
        params = result["params"]
        quality = result["quality"]
        print(f"{i:<6} {quality['overall_score']:<8.1f} "
              f"{params['image_conditioning_scale']:<8} "
              f"{params['guidance_scale']:<8} "
              f"{params['num_inference_steps']:<8} "
              f"{result['emotion']:<10}")

    # 최적 범위 추천
    top_10 = sorted_by_score[:10]

    best_cond = [r["params"]["image_conditioning_scale"] for r in top_10]
    best_guide = [r["params"]["guidance_scale"] for r in top_10]
    best_steps = [r["params"]["num_inference_steps"] for r in top_10]

    print("\n📊 Recommended Range for Phase 2:")
    print(f"  Conditioning: {min(best_cond):.2f} - {max(best_cond):.2f}")
    print(f"  Guidance: {min(best_guide):.1f} - {max(best_guide):.1f}")
    print(f"  Steps: {min(best_steps)} - {max(best_steps)}")


if __name__ == "__main__":
    print("🤖 LTX-2 Automated Testing System")
    print("=" * 60)

    # Phase 1 실행
    results = run_phase_1_tests()

    # 결과 분석
    # analyze_phase_1_results()

    print("\n✅ All tests complete!")
    print(f"Results saved in: {RESULTS_DIR}")
