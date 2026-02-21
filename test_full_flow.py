"""BytePlus 전체 플로우 자동 테스트"""
import requests
import time
import sys

API_BASE = "https://hiyoonsh1--byteplus-proxy-web.modal.run"

# API 키 입력
BYTEPLUS_API_KEY = input("BytePlus API key: ").strip()
if not BYTEPLUS_API_KEY:
    print("API key required")
    sys.exit(1)

# 테스트 이미지 (1x1 PNG)
TEST_IMAGE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
DATA_URL = f"data:image/png;base64,{TEST_IMAGE_B64}"

print("=== Test 1: Upload ===")
upload_res = requests.post(f"{API_BASE}/api/v3/uploads", json={"data_url": DATA_URL})
print(f"Status: {upload_res.status_code}")
if upload_res.status_code != 200:
    print(f"FAIL: {upload_res.text}")
    sys.exit(1)

image_url = upload_res.json()["image_url"]
print(f"OK: {image_url}")

print("\n=== Test 2: Create task ===")
task_body = {
    "model": "seedance-1.0-pro-fast",
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
    task_id = task_res.json().get("task_id") or task_res.json().get("id")
    print(f"OK: Task {task_id}")

    print("\n=== Test 3: Poll task ===")
    for i in range(10):
        time.sleep(3)
        status_res = requests.get(
            f"{API_BASE}/api/v3/content_generation/tasks/{task_id}",
            headers={"Authorization": f"Bearer {BYTEPLUS_API_KEY}"}
        )
        if status_res.status_code == 200:
            data = status_res.json()
            status = data.get("status") or data.get("data", {}).get("status")
            print(f"Poll {i+1}: {status}")
            if status in ["completed", "success"]:
                print(f"SUCCESS: {data}")
                break
        else:
            print(f"Poll {i+1} failed: {status_res.status_code}")
else:
    print(f"FAIL: {task_res.json()}")
