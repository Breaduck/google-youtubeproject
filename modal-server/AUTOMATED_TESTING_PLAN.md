# 🤖 자동화 테스트 시스템 계획

## 현재 상태 인정

```
현실: 10/100
- ❌ 얼굴 흘러내림
- ❌ 움직임 없음 (정적)
- ❌ 표정 변화 없음

목표: 90/100
갭: 80점 (매우 큼)
```

---

## 🎯 실험 전략

### Phase 1: Coarse Search (굵은 탐색)

**테스트 범위:**
```python
conditioning: [0.5, 0.6, 0.7, 0.8, 0.9]  # 5개
guidance: [2.5, 3.0, 3.5, 4.0, 5.0]      # 5개
steps: [12, 15, 20]                      # 3개

총 조합: 5 × 5 × 3 = 75개
```

**비용 계산:**
```
1개당: ₩32
75개: ₩2,400
시간: 75 × 1.2분 = 90분 (1.5시간)
```

**테스트 대사:**
```
1. 슬픔: "너무 슬퍼... 왜 이런 일이..."
2. 기쁨: "하하하! 정말 재밌어!"
3. 분노: "화나! 이건 용납할 수 없어!"
4. 중립: "안녕하세요. 만나서 반갑습니다."
```

---

### Phase 2: Fine-tune (정밀 탐색)

**Phase 1 결과 보고 결정:**
```
예시: Phase 1에서 conditioning 0.7-0.8이 좋았다면
→ Phase 2: [0.65, 0.70, 0.75, 0.80, 0.85]

총 조합: ~20-30개
비용: ₩640-960
```

---

## 📊 자동 품질 측정 지표

### 1. 얼굴 안정성 (Character Fidelity)
```python
체크포인트: [Frame 0, 24, 48, 72, 96]
측정: 입력 이미지 vs 각 프레임 픽셀 차이

평가:
- diff < 20: GOOD (100점)
- diff < 30: OK (70점)
- diff > 30: BAD (0-50점)
```

### 2. 움직임 존재 여부
```python
측정: 프레임 간 픽셀 변화량

평가:
- avg_motion > 2: GOOD (100점) - 자연스러운 움직임
- avg_motion > 1: OK (50점) - 약간 움직임
- avg_motion < 1: BAD (0-30점) - 거의 정적
```

### 3. 종합 점수
```python
overall_score = fidelity_score × 0.6 + motion_score × 0.4

등급:
- 90-100: A (목표 달성!)
- 70-89: B (사용 가능)
- 50-69: C (개선 필요)
- 0-49: F (실패)
```

---

## 🔧 구현 필요 사항

### 1. Modal main.py 수정
**현재:**
```python
# 파라미터 하드코딩
guidance_scale=3.5
image_conditioning_scale=0.75
num_inference_steps=15
```

**수정 필요:**
```python
@modal.method()
def generate(self, prompt: str, image_url: str,
             character_description: str = "",
             num_frames: int = 97,
             # 테스트용 파라미터 override
             test_params: dict = None):

    # 테스트 모드
    if test_params:
        guidance_scale = test_params.get("guidance_scale", 3.5)
        conditioning_scale = test_params.get("image_conditioning_scale", 0.75)
        steps = test_params.get("num_inference_steps", 15)
    else:
        # 기본값
        guidance_scale = 3.5
        conditioning_scale = 0.75
        steps = 15

    output = self.pipe(
        image=reference_image,
        prompt=enhanced_prompt,
        negative_prompt=negative_prompt,
        width=target_width,
        height=target_height,
        num_frames=num_frames,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        image_conditioning_scale=conditioning_scale,
        generator=torch.Generator(device="cuda").manual_seed(42),
        output_type="pil",
    ).frames[0]
```

### 2. 테스트 이미지 준비
```
필요: 중립 표정의 캐릭터 이미지 (1280x720)
용도: 모든 테스트에 동일 이미지 사용 (공정 비교)
```

### 3. Gemini Helper
```python
# gemini_helper.py
def generate_motion_prompt(dialogue: str, image_prompt: str):
    # Gemini API 호출하여 프롬프트 생성
    # (현재 geminiService.ts와 동일 로직)
    pass
```

---

## 📋 실행 순서

### Step 1: Modal main.py 수정
```bash
1. test_params 파라미터 추가
2. Modal 재배포
3. 테스트 엔드포인트 확인
```

### Step 2: 테스트 이미지 업로드
```bash
1. 중립 표정 캐릭터 이미지 생성/준비
2. 이미지를 URL로 접근 가능하게 (base64 또는 호스팅)
3. automated_test.py에 이미지 URL 입력
```

### Step 3: Phase 1 실행
```bash
cd modal-server
python automated_test.py

# 결과: test_results/ 폴더에 저장
# - 75개 비디오 파일
# - phase1_results.json (품질 점수)
```

### Step 4: 결과 분석
```bash
python -c "from automated_test import analyze_phase_1_results; analyze_phase_1_results()"

# Top 10 조합 확인
# Phase 2 범위 추천 받기
```

### Step 5: Phase 2 실행 (선택)
```bash
# Phase 1 결과 보고 PHASE_2_PARAMS 설정
# 재실행
```

---

## 🚨 현실적 문제점

### 문제 1: 현재 품질이 너무 낮음 (10/100)
```
조합 최적화만으로 10 → 90 달성 가능?
→ 불확실함

가능성:
1. 파라미터 조합으로 개선: 10 → 40-50
2. 프롬프트 전략 개선: +10-20
3. 모델 자체 한계: 나머지 갭

현실적 목표:
- Phase 1 후: 30-50/100
- Phase 2 후: 50-70/100
- 추가 개선: 70-80/100
```

### 문제 2: LTX-2 자체 한계
```
LTX-2는 완벽하지 않음:
- 복잡한 움직임 약함
- 얼굴 안정성 한계 존재
- "90/100"은 LTX-2로 불가능할 수도

현실:
- LTX-2 최대 성능: 70-80/100 추정
- 90/100 달성: 다른 모델 필요할 수도
```

---

## 💡 대안 전략

### 전략 A: 빠른 실험 (추천)
```
1. 수동으로 5-10개 조합만 테스트
2. 육안으로 품질 확인
3. "쓸만한" 조합 찾기
4. 자동화는 그 이후

비용: ₩160-320
시간: 10-20분
```

### 전략 B: 전체 자동화
```
1. Modal main.py 수정 (test_params)
2. Phase 1 75개 조합 실행
3. 결과 분석 후 Phase 2
4. 최적 조합 선택

비용: ₩2,400-3,000
시간: 2-3시간
```

### 전략 C: 모델 교체 검토
```
LTX-2 한계가 명확하면:
- Runway Gen-3
- Pika Labs
- Kling AI
- Luma Dream Machine

검토 후 재선택
```

---

## 🎯 즉시 실행 가능: 수동 5개 테스트

### 테스트 조합 (전략적 선택)
```python
# 1. 현재 설정 (베이스라인)
cond=0.75, guide=3.5, steps=15

# 2. 얼굴 고정 최대
cond=0.9, guide=4.0, steps=20

# 3. 움직임 최대
cond=0.5, guide=3.0, steps=15

# 4. 균형 1
cond=0.7, guide=3.0, steps=15

# 5. 균형 2
cond=0.8, guide=4.0, steps=15
```

**실행:**
```bash
1. 테스트 이미지 1개 준비
2. 대사: "너무 슬퍼... 왜 이런 일이..."
3. 5개 조합 각각 테스트
4. 비디오 다운로드 및 육안 비교
5. 가장 나은 것 선택

비용: ₩160
시간: 10분
```

---

## ✅ 추천 액션

**지금 당장:**
1. **수동 5개 테스트** (전략 A)
   - 현재 설정이 얼마나 나쁜지 확인
   - 다른 조합이 나은지 확인
   - ₩160, 10분

**테스트 결과 보고:**
2. **결과에 따라 결정**
   - 개선 있음 → 자동화 (전략 B)
   - 개선 없음 → 모델 교체 검토 (전략 C)

**솔직한 평가:**
```
현재 10/100 상태에서
파라미터 조합만으로 90/100 달성은
→ 가능성 낮음 (30-50%)

현실적 기대:
- 최적 조합: 50-70/100
- 추가 개선 (프롬프트, 후처리): +10-20
- 최종: 60-80/100

60-80/100이면 "유튜브 스토리보드"로 사용 가능?
→ 이게 핵심 질문
```

---

## 🔑 핵심 질문

**테스트 전에 답해야 할 질문:**
```
Q1: 60-70/100 품질이면 유튜브 스토리보드로 쓸 만한가?
Q2: 90/100이 절대 필요한가? (할리우드 수준?)
Q3: LTX-2가 맞는 모델인가? (다른 모델이 더 나을 수도)

답에 따라:
- 60-70으로 OK → 계속 최적화
- 90 필요 → 모델 교체 검토
```

지금 당장 수동 5개 테스트부터 시작하시겠습니까?
