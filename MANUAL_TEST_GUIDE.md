# 🧪 수동 품질 테스트 가이드

## 준비 완료 ✅

**Backend (Modal):** 테스트 파라미터 지원 추가 완료
**Frontend:** videoService.ts 업데이트 완료

---

## 🎯 테스트 5개 조합

### 준비물
```
1. 테스트 이미지 1개 (중립 표정 캐릭터)
2. 테스트 대사: "너무 슬퍼... 왜 이런 일이..."
3. 브라우저 개발자 콘솔
```

---

## 📋 테스트 실행 방법

### Option 1: 브라우저 콘솔 (추천)

**1. 웹사이트 열기:**
```
https://google-youtubeproject.pages.dev
```

**2. 이미지 업로드 & 대사 입력**
- 이미지: 준비한 테스트 이미지
- 대사: "너무 슬퍼... 왜 이런 일이..."

**3. 브라우저 콘솔 열기 (F12)**

**4. 아래 코드 복사 & 실행:**

```javascript
// ===== TEST 1: 현재 설정 (베이스라인) =====
// conditioning: 0.75, guidance: 3.5, steps: 15
// 예상 비용: ₩32
console.log('🧪 TEST 1: Current Baseline (₩32)');
// → UI에서 "Generate Storyboard" 클릭
// → 결과 저장: test1_baseline.mp4

// ===== TEST 2: 최대 품질 =====
// conditioning: 0.8, guidance: 4.0, steps: 30
// 예상 비용: ₩64
console.log('🧪 TEST 2: Maximum Quality (₩64)');

// videoService를 import할 수 없으므로 fetch 직접 호출
const testImage = 'YOUR_IMAGE_URL_HERE'; // 업로드한 이미지 URL
const testDialogue = '너무 슬퍼... 왜 이런 일이...';

// Gemini로 프롬프트 생성 (수동으로 먼저 해야 함)
// 또는 간단히 테스트용 프롬프트 사용
const testPrompt = 'Cinematic 2D Anime style, clean lines, flat shading. Medium shot in soft diffused lighting with muted color palette. Character with slumped shoulders, head tilting downward, eyes glistening with tears, lips trembling. Slow camera zoom-in toward face.';

fetch('https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: testPrompt,
    image_url: testImage,
    num_frames: 97,
    test_conditioning: 0.8,
    test_guidance: 4.0,
    test_steps: 30
  })
})
.then(res => res.blob())
.then(blob => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test2_max_quality.mp4';
  a.click();
  console.log('✅ TEST 2 Complete! Downloaded test2_max_quality.mp4');
});

// 기다린 후 다음 테스트...

// ===== TEST 3: 얼굴 고정 최대 =====
// conditioning: 0.9, guidance: 4.5, steps: 25
// 예상 비용: ₩53
console.log('🧪 TEST 3: Maximum Face Stability (₩53)');
fetch('https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: testPrompt,
    image_url: testImage,
    num_frames: 97,
    test_conditioning: 0.9,
    test_guidance: 4.5,
    test_steps: 25
  })
})
.then(res => res.blob())
.then(blob => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test3_max_face.mp4';
  a.click();
  console.log('✅ TEST 3 Complete! Downloaded test3_max_face.mp4');
});

// ===== TEST 4: 움직임 우선 =====
// conditioning: 0.6, guidance: 3.5, steps: 25
// 예상 비용: ₩53
console.log('🧪 TEST 4: Movement Priority (₩53)');
fetch('https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: testPrompt,
    image_url: testImage,
    num_frames: 97,
    test_conditioning: 0.6,
    test_guidance: 3.5,
    test_steps: 25
  })
})
.then(res => res.blob())
.then(blob => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test4_movement.mp4';
  a.click();
  console.log('✅ TEST 4 Complete! Downloaded test4_movement.mp4');
});

// ===== TEST 5: 균형점 (높은 품질) =====
// conditioning: 0.75, guidance: 4.0, steps: 25
// 예상 비용: ₩53
console.log('🧪 TEST 5: Balanced High Quality (₩53)');
fetch('https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: testPrompt,
    image_url: testImage,
    num_frames: 97,
    test_conditioning: 0.75,
    test_guidance: 4.0,
    test_steps: 25
  })
})
.then(res => res.blob())
.then(blob => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test5_balanced.mp4';
  a.click();
  console.log('✅ TEST 5 Complete! Downloaded test5_balanced.mp4');
});
```

---

## 📝 더 간단한 방법: Python 스크립트

```python
# test_runner.py
import requests
import time

MODAL_API = "https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run"
TEST_IMAGE = "YOUR_IMAGE_URL_HERE"  # 변경 필요
TEST_PROMPT = "Cinematic 2D Anime style, clean lines, flat shading. Medium shot in soft diffused lighting with muted color palette. Character with slumped shoulders, head tilting downward, eyes glistening with tears, lips trembling. Slow camera zoom-in toward face."

tests = [
    {
        "name": "Test 1: Baseline",
        "conditioning": 0.75,
        "guidance": 3.5,
        "steps": 15,
        "cost": 32,
        "filename": "test1_baseline.mp4"
    },
    {
        "name": "Test 2: Max Quality",
        "conditioning": 0.8,
        "guidance": 4.0,
        "steps": 30,
        "cost": 64,
        "filename": "test2_max_quality.mp4"
    },
    {
        "name": "Test 3: Max Face Stability",
        "conditioning": 0.9,
        "guidance": 4.5,
        "steps": 25,
        "cost": 53,
        "filename": "test3_max_face.mp4"
    },
    {
        "name": "Test 4: Movement Priority",
        "conditioning": 0.6,
        "guidance": 3.5,
        "steps": 25,
        "cost": 53,
        "filename": "test4_movement.mp4"
    },
    {
        "name": "Test 5: Balanced High Quality",
        "conditioning": 0.75,
        "guidance": 4.0,
        "steps": 25,
        "cost": 53,
        "filename": "test5_balanced.mp4"
    }
]

print("🧪 LTX-2 Quality Test Runner")
print("=" * 60)
print(f"Total tests: {len(tests)}")
print(f"Total cost: ₩{sum(t['cost'] for t in tests)}")
print("=" * 60)

for i, test in enumerate(tests, 1):
    print(f"\n[{i}/{len(tests)}] {test['name']}")
    print(f"  Params: cond={test['conditioning']}, guide={test['guidance']}, steps={test['steps']}")
    print(f"  Cost: ₩{test['cost']}")

    payload = {
        "prompt": TEST_PROMPT,
        "image_url": TEST_IMAGE,
        "num_frames": 97,
        "test_conditioning": test['conditioning'],
        "test_guidance": test['guidance'],
        "test_steps": test['steps']
    }

    start_time = time.time()

    response = requests.post(
        f"{MODAL_API}/generate",
        json=payload,
        timeout=300
    )

    elapsed = time.time() - start_time

    if response.status_code == 200:
        with open(test['filename'], 'wb') as f:
            f.write(response.content)

        print(f"  ✅ Success! ({elapsed:.1f}s)")
        print(f"  Saved: {test['filename']}")
    else:
        print(f"  ❌ Failed: {response.status_code}")
        print(f"  Error: {response.text[:100]}")

    # 다음 테스트 전 대기 (GPU 쿨다운)
    if i < len(tests):
        print("  Waiting 5s before next test...")
        time.sleep(5)

print("\n" + "=" * 60)
print("✅ All tests complete!")
print("Compare videos: test1_baseline.mp4 vs test2_max_quality.mp4 etc.")
print("=" * 60)
```

**실행:**
```bash
cd C:\Users\hiyoo\OneDrive\바탕 화면\video-saas
python test_runner.py
```

---

## 📊 결과 비교 기준

### 1. 얼굴 안정성 (Character Fidelity)
```
점검:
- 얼굴이 흘러내리는가?
- 캐릭터 특징 유지되는가? (눈, 코, 입 위치)
- 표정 변화가 자연스러운가?

등급:
A: 완벽 유지 (90-100점)
B: 약간 변화 (70-89점)
C: 눈에 띄는 변화 (50-69점)
F: 심각한 왜곡 (0-49점)
```

### 2. 움직임
```
점검:
- 카메라가 움직이는가?
- 인물이 자연스럽게 움직이는가?
- 표정이 변하는가?
- 입술이 대사에 맞춰 움직이는가?

등급:
A: 자연스러운 움직임 (90-100점)
B: 적절한 움직임 (70-89점)
C: 미세한 움직임 (50-69점)
F: 거의 정적 (0-49점)
```

### 3. 종합 품질
```
얼굴 안정성 60% + 움직임 40% = 종합 점수

목표:
- 90/100 이상: 이상적
- 70-89/100: 사용 가능
- 50-69/100: 개선 필요
- 50 미만: 실패
```

---

## 🎯 테스트 후 액션

### 결과가 좋으면 (70+점)
```
1. 가장 높은 점수 조합 확인
2. 비용 최적화 시작:
   - Steps 줄이기: 30 → 25 → 20 → 15
   - 품질 유지하면서 최소 Steps 찾기
3. 자동화 테스트로 정밀 조정
```

### 결과가 나쁘면 (<50점)
```
1. 모든 조합이 나쁜가?
   → YES: LTX-2 한계, 다른 모델 검토
   → NO: 가장 나은 조합 선택 후 정밀 조정

2. 프롬프트 문제?
   → Gemini 프롬프트 재검토
   → Negative prompt 강화

3. 이미지 문제?
   → 다른 테스트 이미지 시도
   → 이미지 전처리 개선
```

---

## 💡 추가 제안

### 제안 1: 더 많은 Steps 시도 (₩100 예산)
```
현재 최대: 30 steps (₩64)
₩100 예산: 35-40 steps 가능

Test 6: Ultra Quality
- conditioning: 0.8
- guidance: 4.5
- steps: 40
- 예상 비용: ₩85

Test 7: Ultra Face Stability
- conditioning: 0.95
- guidance: 5.0
- steps: 35
- 예상 비용: ₩75
```

### 제안 2: LoRA Scale 조정
```
현재: lora_scale=0.65 (고정)

실험:
- lora_scale=0.5 (약하게)
- lora_scale=0.7 (강하게)
- lora_scale=0.8 (최대)

→ LoRA 영향 확인
→ 품질 차이 비교
```

### 제안 3: Negative Prompt 강화
```
현재 Negative: "realistic, 3d render, photo, photorealistic, ..."

추가:
- "distorted face, melting face, liquid face"
- "inconsistent features, displaced eyes, warped mouth"
- "jittery motion, unstable video, flickering"

→ 얼굴 왜곡 더 강하게 방지
```

---

## 📋 체크리스트

**테스트 전:**
- [ ] 테스트 이미지 준비 (중립 표정, 1280x720 권장)
- [ ] 이미지 URL 확보 (base64 또는 호스팅)
- [ ] Modal 배포 확인 (Healthy 상태)
- [ ] 예산 확인 (₩255 준비)

**테스트 중:**
- [ ] Test 1 완료 (베이스라인)
- [ ] Test 2 완료 (최대 품질)
- [ ] Test 3 완료 (얼굴 고정)
- [ ] Test 4 완료 (움직임 우선)
- [ ] Test 5 완료 (균형)

**테스트 후:**
- [ ] 5개 비디오 육안 비교
- [ ] 얼굴 안정성 점수 기록
- [ ] 움직임 점수 기록
- [ ] 종합 점수 계산
- [ ] 최적 조합 선택
- [ ] 다음 단계 결정

---

**준비 완료!** 테스트 시작하시겠습니까? 🚀
