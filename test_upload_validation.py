"""업로드 검증 로직 테스트 (보안 하드닝)"""
import requests
import base64
from io import BytesIO
from PIL import Image

API_BASE = "https://hiyoonsh1--byteplus-proxy-web.modal.run"

print("=== Upload Validation Tests ===\n")

# Test 1: 정상 PNG (400x400, <1MB)
print("1. Valid PNG (400x400)...")
img = Image.new('RGB', (400, 400), color=(100, 150, 255))
buffer = BytesIO()
img.save(buffer, format='PNG')
b64_data = base64.b64encode(buffer.getvalue()).decode()
data_url = f"data:image/png;base64,{b64_data}"

res = requests.post(f"{API_BASE}/api/v3/uploads", json={"data_url": data_url})
print(f"   Status: {res.status_code}")
if res.status_code == 200:
    print(f"   OK: OK: {res.json()['image_url']}")
else:
    print(f"   FAIL: FAIL: {res.json()['detail']}")

# Test 2: 지원되지 않는 포맷 (GIF)
print("\n2. Unsupported format (GIF)...")
gif_data = base64.b64encode(b"GIF89a").decode()
data_url = f"data:image/gif;base64,{gif_data}"
res = requests.post(f"{API_BASE}/api/v3/uploads", json={"data_url": data_url})
print(f"   Status: {res.status_code}")
assert res.status_code == 400, "Should reject GIF"
print(f"   OK: Rejected: {res.json()['detail'][:50]}...")

# Test 3: 너무 큰 파일 (>5MB)
print("\n3. File too large (>5MB)...")
large_img = Image.new('RGB', (3000, 3000), color=(255, 0, 0))
buffer = BytesIO()
large_img.save(buffer, format='PNG')
b64_data = base64.b64encode(buffer.getvalue()).decode()
data_url = f"data:image/png;base64,{b64_data}"
size_mb = len(buffer.getvalue()) / (1024 * 1024)
print(f"   Image size: {size_mb:.2f}MB")

res = requests.post(f"{API_BASE}/api/v3/uploads", json={"data_url": data_url})
print(f"   Status: {res.status_code}")
if size_mb > 5:
    assert res.status_code == 413, "Should reject >5MB"
    print(f"   OK: Rejected: {res.json()['detail'][:50]}...")
else:
    print(f"   (Image too small to trigger 5MB limit)")

# Test 4: 잘못된 data URL 형식
print("\n4. Invalid data URL...")
res = requests.post(f"{API_BASE}/api/v3/uploads", json={"data_url": "not-a-data-url"})
print(f"   Status: {res.status_code}")
assert res.status_code == 400, "Should reject invalid format"
print(f"   OK: Rejected: {res.json()['detail'][:50]}...")

# Test 5: JPEG 허용 확인
print("\n5. Valid JPEG...")
img = Image.new('RGB', (400, 400), color=(255, 200, 100))
buffer = BytesIO()
img.save(buffer, format='JPEG')
b64_data = base64.b64encode(buffer.getvalue()).decode()
data_url = f"data:image/jpeg;base64,{b64_data}"

res = requests.post(f"{API_BASE}/api/v3/uploads", json={"data_url": data_url})
print(f"   Status: {res.status_code}")
if res.status_code == 200:
    print(f"   OK: OK: {res.json()['image_url']}")
else:
    print(f"   FAIL: FAIL: {res.json()['detail']}")

print("\n=== All validation tests completed ===")
