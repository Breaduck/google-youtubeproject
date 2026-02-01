# ⚡ AGGRESSIVE QUALITY MODE - 표정 & 움직임 우선

## 배포 정보

```
Status: ✓ Deployed - Aggressive Quality
Endpoint: https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run
Deployed: 2026-02-01
Strategy: 품질 최우선 (비용 2배 투자)
```

---

## 🔥 공격적 설정 변경

### 1. Inference Steps: 10 → 20 (2배)
```python
num_inference_steps=20  # was 10
```

**효과:**
- 계산량 2배 증가
- 디테일 정밀도 대폭 향상
- 표정 변화 더 섬세하게 표현
- 노이즈 감소

**Trade-off:**
- 생성 시간: 27초 → 54초 (+27초)
- 비용: ₩27 → ₩54 (2배)

---

### 2. Guidance Scale: 1.0 → 3.0
```python
guidance_scale=3.0  # was 1.0
```

**효과:**
- 프롬프트 지시사항 더 강하게 반영
- "울부짖는 표정" 같은 구체적 표현 가능
- 움직임 의도 명확히 전달
- CFG (Classifier-Free Guidance) 활성화

**주의:**
- Distilled 모델은 원래 CFG-free (1.0)
- 3.0은 실험적 설정
- Full model처럼 동작할 수 있음

---

### 3. Image Conditioning Scale: 1.0 → 0.85
```python
image_conditioning_scale=0.85  # was 1.0 (default)
```

**효과:**
- 이미지 컨디셔닝 15% 완화
- AI가 "숨 쉴 틈" 제공
- 더 자연스러운 움직임 허용
- 표정 변화 자유도 증가

**주의:**
- Character fidelity 약간 감소 가능
- 0.85는 균형점 (너무 낮으면 인물 변형)

---

### 4. Cinematic Prompt Prefix
```python
enhanced_prompt = "Cinematic motion, natural character movement, high dynamic range, subtle motion"
```

**효과:**
- 영화적 움직임 품질
- 자연스러운 캐릭터 모션
- 다이나믹 레인지 향상
- 전문가 수준 비디오 품질

---

## 📊 성능 변화

### Before (Baseline + LoRA)
```
Steps: 10
Guidance: 1.0
Conditioning: 1.0 (default)
Prompt: "subtle motion"

생성: 27초
업스케일: 30초
합계: 57초
비용: ₩27
```

### After (Aggressive Quality)
```
Steps: 20 (2x)
Guidance: 3.0 (3x)
Conditioning: 0.85 (relaxed)
Prompt: "Cinematic motion, natural character movement, high dynamic range, subtle motion"

생성: 54초 (2배)
업스케일: 30초
합계: 84초 (+27초)
비용: ₩54 (2배)
```

---

## 🎯 예상 효과

### 표정 문제 해결
**이전:**
- 표정 고정됨 (무표정)
- 입 안 움직임
- 눈 깜빡임 없음
- 얼굴 녹아내림

**예상 개선:**
- ✅ 자연스러운 표정 변화
- ✅ 입 움직임 가능
- ✅ 눈 깜빡임 생성
- ✅ 얼굴 구조 유지 + 움직임

### 움직임 품질
**이전:**
- 미세한 떨림만
- 정적인 느낌
- 로봇 같은 움직임

**예상 개선:**
- ✅ 자연스러운 호흡
- ✅ 미세한 머리 움직임
- ✅ 살아있는 느낌
- ✅ 영화 같은 품질

---

## ⚠️ 주의사항

### 1. Distilled 모델 한계
```
Distilled 모델은 원래 CFG-free (guidance_scale=1.0)
guidance_scale=3.0은 실험적 설정
→ 예상치 못한 동작 가능
```

**대안:**
- 효과 없으면 Full Model (FP8) 전환 고려
- Full model은 CFG를 native 지원

### 2. Character Fidelity 위험
```
image_conditioning_scale=0.85 (완화)
→ 인물 변형 위험 증가
```

**안전장치:**
- 5-checkpoint 검증 여전히 활성
- 첫 프레임 강제 교체 유지
- Threshold: 20.0 (excellent), 30.0 (fail)

### 3. 비용 2배
```
₩27 → ₩54 (100% 증가)
```

**정당화:**
- 표정 문제 해결이 최우선
- 품질 검증 후 최적화 가능
- Steps 15로 타협점 찾을 수 있음

---

## 🧪 테스트 시나리오

### Test 1: 기본 표정 변화
```
Input: 중립적 표정 이미지
Expected: 미소, 눈 깜빡임, 입 미세 움직임
Prompt: "Cinematic motion, natural character movement, high dynamic range, subtle motion"
```

### Test 2: 강한 표정 (울부짖기)
```
Input: 중립적 표정 이미지
Expected: 슬픈 표정, 입 벌림, 눈물 느낌
Prompt: "Cinematic motion, natural character movement, high dynamic range, crying expression, emotional facial movement"
```

### Test 3: Character Fidelity
```
Input: 특징적 얼굴 (안경, 수염 등)
Expected: 특징 유지하면서 자연스러운 움직임
Verification: 5-checkpoint < 20.0
```

---

## 📈 성능 목표 (수정)

| 지표 | 이전 목표 | 새 목표 | 예상 |
|------|-----------|---------|------|
| **시간** | <67초 | <90초 | 84초 |
| **비용** | ₩30 | ₩60 | ₩54 |
| **품질** | High | **Excellent** | 🧪 테스트 필요 |
| **표정** | Static | **Dynamic** | 🧪 테스트 필요 |

---

## 🔄 최적화 경로

### 품질 만족 시
**Option A: Steps 줄이기 (20 → 15)**
```python
num_inference_steps=15
예상: 품질 90%, 시간 -13초, 비용 -₩13
```

**Option B: Guidance 낮추기 (3.0 → 2.0)**
```python
guidance_scale=2.0
예상: 품질 95%, 프롬프트 반영 약간 감소
```

### 품질 부족 시
**Option C: Full Model 전환**
```python
Model: Lightricks/LTX-2 (Full FP8)
Steps: 30-40
Guidance: 3.0-5.0
예상: 품질 최대, 시간 +50%, 비용 +70%
```

---

## 🚀 배포 완료

### 적용된 설정
```python
# AGGRESSIVE QUALITY MODE
num_inference_steps=20              # 2배
guidance_scale=3.0                  # 3배
image_conditioning_scale=0.85       # 완화
prompt="Cinematic motion, natural character movement, high dynamic range, subtle motion"
```

### 배포 상태
```
✓ Modal deployed
✓ API healthy
✓ LoRA loaded (Rank 175 FP8)
✓ All settings updated
```

---

## ✅ 테스트 시작

**테스트 포인트:**
1. **표정 변화 발생하는가?**
   - 입 움직임
   - 눈 깜빡임
   - 자연스러운 표정

2. **Character fidelity 유지되는가?**
   - 5-checkpoint < 20.0
   - 인물 동일성 유지
   - 특징 보존

3. **움직임 품질 향상되었는가?**
   - 영화 같은 느낌
   - 자연스러운 모션
   - 생동감

4. **비용 대비 효과 합리적인가?**
   - ₩54 (2배) 투자 가치
   - 품질 향상 체감
   - 프로덕션 사용 가능

---

## 📝 결과 기록

**테스트 후 기록:**
- [ ] 표정 변화: Yes / No / Partial
- [ ] Character fidelity: Excellent / Good / Fail
- [ ] 움직임 품질: Excellent / Good / Poor
- [ ] 비용 정당화: Yes / No
- [ ] 최종 결정: Use / Optimize / Reject

---

## 🎬 지금 바로 테스트!

**Endpoint:**
```
https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run
```

**예상 시간:** 84초 (첫 실행)

**표정이 살아났는지 확인하세요!** ⚡
