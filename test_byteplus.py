"""BytePlus API 통합 테스트"""
import requests
import base64

API_BASE = "https://hiyoonsh1--byteplus-proxy-web.modal.run"

# 작은 테스트 이미지 (1x1 빨간 픽셀 PNG)
TEST_IMAGE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
DATA_URL = f"data:image/png;base64,{TEST_IMAGE_B64}"

print("=== Round 1: Upload 테스트 ===")
upload_res = requests.post(f"{API_BASE}/api/v3/uploads", json={"data_url": DATA_URL})
print(f"Status: {upload_res.status_code}")
print(f"Response: {upload_res.json()}")

if upload_res.status_code == 200:
    image_url = upload_res.json()["image_url"]
    print(f"✅ Upload 성공: {image_url}")

    print("\n=== Round 2: 이미지 서빙 테스트 ===")
    img_res = requests.get(image_url)
    print(f"Status: {img_res.status_code}")
    print(f"Content-Type: {img_res.headers.get('content-type')}")
    print(f"Size: {len(img_res.content)} bytes")
    if img_res.status_code == 200:
        print("✅ 이미지 서빙 성공")
    else:
        print("❌ 이미지 서빙 실패")
else:
    print(f"❌ Upload 실패: {upload_res.text}")
