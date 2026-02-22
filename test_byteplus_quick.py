"""BytePlus 빠른 테스트 (ImgBB 업로드 검증)"""
import requests
import time

API_BASE = "https://hiyoonsh1--byteplus-proxy-web.modal.run"
BYTEPLUS_API_KEY = "002c08ea-0f36-4ad1-84ef-25740c463f5d"

# 테스트 이미지 (400x400 파란색 PNG)
import base64
from io import BytesIO
from PIL import Image

# 400x400 파란색 이미지 생성
img = Image.new('RGB', (400, 400), color=(100, 150, 255))
buffer = BytesIO()
img.save(buffer, format='PNG')
TEST_IMAGE_B64 = base64.b64encode(buffer.getvalue()).decode()
DATA_URL = f"data:image/png;base64,{TEST_IMAGE_B64}"

print("=== Test 1: Upload to ImgBB ===")
upload_res = requests.post(f"{API_BASE}/api/v3/uploads", json={"data_url": DATA_URL})
print(f"Status: {upload_res.status_code}")
if upload_res.status_code != 200:
    print(f"FAIL: {upload_res.text}")
    exit(1)

image_url = upload_res.json()["image_url"]
print(f"OK: {image_url}")

print("\n=== Test 2: Create BytePlus task ===")
task_body = {
    "model": "seedance-1-0-pro-fast-251015",
    "content": [
        {"type": "image_url", "image_url": {"url": image_url}},
        {"type": "text", "text": "A simple test video --resolution 720p --duration 5"}
    ]
}

task_res = requests.post(
    f"{API_BASE}/api/v3/content_generation/tasks",
    json=task_body,
    headers={"Authorization": f"Bearer {BYTEPLUS_API_KEY}"}
)

print(f"Status: {task_res.status_code}")
print(f"Response: {task_res.json()}")

if task_res.status_code == 200:
    result = task_res.json()
    task_id = result.get("task_id") or result.get("id")
    print(f"\nSUCCESS: Task created - {task_id}")

    print("\n=== Test 3: Poll task status ===")
    for i in range(5):
        time.sleep(3)
        status_res = requests.get(
            f"{API_BASE}/api/v3/content_generation/tasks/{task_id}",
            headers={"Authorization": f"Bearer {BYTEPLUS_API_KEY}"}
        )
        if status_res.status_code == 200:
            data = status_res.json()
            status = data.get("status") or data.get("data", {}).get("status")
            print(f"Poll {i+1}: {status}")
            if status in ["completed", "success", "succeeded"]:
                print(f"OK: Video ready: {data}")
                break
        else:
            print(f"Poll {i+1} failed: {status_res.status_code}")
else:
    print(f"\nFAIL: FAIL: {task_res.json()}")
