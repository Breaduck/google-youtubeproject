# 🎨 Community Optimization: 2D Anime Style + Balanced Settings

## 배포 정보

```
Status: ✅ Deployed - Community Optimized Settings
Endpoint: https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run
Deployed: 2026-02-01
Strategy: 2D Anime 강제 + 얼굴 안정성/움직임 균형
```

---

## 🎯 핵심 변경사항

### Backend (Modal - main.py)

**파라미터 조정:**
```python
# BEFORE (Final Tweak):
guidance_scale=3.0
image_conditioning_scale=0.7
lora_scale=0.65
num_inference_steps=15

# AFTER (Community Optimized):
guidance_scale=3.5              # +0.5: 프롬프트 엄격히 따르기
image_conditioning_scale=0.75   # +0.05: 얼굴 안정성 약간 강화
lora_scale=0.65                 # 유지: 안전 범위
num_inference_steps=15          # 유지: ₩32 비용
```

**효과:**
- ✅ **guidance_scale 3.5**: 프롬프트 지시사항을 더 엄격하게 준수
- ✅ **conditioning 0.75**: 얼굴 흘러내림 방지 + 자연스러운 움직임 균형
- ✅ **lora_scale 0.65**: Overcook 방지 (0.7 이하 유지)
- ✅ **steps 15**: 비용 효율성 유지 (₩32)

---

### Frontend (Gemini - geminiService.ts)

**프롬프트 강제 규칙:**

1. **필수 프리픽스:**
   ```
   "Cinematic 2D Anime style, clean lines, flat shading"
   ```
   - 모든 프롬프트 맨 앞에 자동 삽입
   - 2D 애니메이션 미학 강제
   - clean lines (깔끔한 선), flat shading (평면 음영) 명시

2. **필수 카메라 움직임:**
   ```
   "Slow camera zoom-in"
   ```
   - 정적인 프레임 방지
   - 모든 씬에 카메라 움직임 강제

**구현 방식:**
```typescript
// 1. 프롬프트 템플릿에 명시
MANDATORY PREFIX: "Cinematic 2D Anime style, clean lines, flat shading"
MANDATORY CAMERA: "Slow camera zoom-in"

// 2. Fallback 체크 (Gemini가 무시할 경우 강제 삽입)
if (!generatedPrompt.includes('cinematic 2d anime')) {
  generatedPrompt = `Cinematic 2D Anime style, clean lines, flat shading. ${generatedPrompt}`;
}

if (!generatedPrompt.includes('slow camera zoom-in')) {
  generatedPrompt += '. Slow camera zoom-in.';
}
```

---

## 📊 설정 비교

| 파라미터 | Final Tweak | Community Opt | 변화 | 효과 |
|----------|-------------|---------------|------|------|
| **guidance_scale** | 3.0 | 3.5 | +16.7% | 프롬프트 엄수 강화 |
| **conditioning** | 0.7 | 0.75 | +7.1% | 얼굴 안정성 증가 |
| **lora_scale** | 0.65 | 0.65 | 0% | 안전 범위 유지 |
| **steps** | 15 | 15 | 0% | 비용 유지 |
| **Style Prefix** | ❌ | ✅ | NEW | 2D Anime 강제 |
| **Camera** | 가끔 | 항상 | NEW | 움직임 보장 |

---

## 🎬 예상 프롬프트 변화

### Before (Final Tweak)
```
Input: "너무 슬퍼..."

Gemini Output:
"Medium shot in soft diffused lighting with muted color palette.
Character's shoulders slumped forward, head tilting downward, eyes
glistening with tears, lips trembling and forming words. Slow dolly
in toward face as expression deepens. 2D animation style with smooth
motion and subtle shadows."
```

### After (Community Optimized)
```
Input: "너무 슬퍼..."

Gemini Output:
"Cinematic 2D Anime style, clean lines, flat shading. Medium shot in
soft diffused lighting with muted color palette. Character's shoulders
slumped forward, head tilting downward, eyes glistening with tears, lips
trembling and forming words. Slow camera zoom-in toward face as expression
deepens."
```

**차이점:**
- ✅ 맨 앞에 "Cinematic 2D Anime style, clean lines, flat shading"
- ✅ 카메라: "dolly in" → "Slow camera zoom-in" (일관성)
- ✅ 불필요한 "2D animation style" 중복 제거

---

## 💰 비용 영향

**변화 없음:**
```
Steps: 15 (유지)
Generation time: ~40초
Upscale time: ~30초
Total: ~73초

GPU cost: 73초 × $0.000306/초 = $0.022
Gemini cost: ~$0.0002
──────────────────────────
Total: ~$0.0222 USD = ₩32
```

---

## ⚖️ Trade-offs

### 강화된 것 (Conditioning 0.75)
```
✅ 얼굴 안정성 증가 (0.7 → 0.75)
✅ 얼굴 흘러내림 위험 감소
✅ 캐릭터 특징 보존 향상
```

### 약화된 것
```
⚠️ 움직임 자유도 약간 감소 (0.7 → 0.75)
⚠️ 표정 변화 범위 약간 제한
```

### 균형점
```
0.7: 움직임 최우선 (얼굴 변할 수 있음)
0.75: 균형 (얼굴 안정 + 적절한 움직임) ⭐ 선택
0.8: 얼굴 고정 우선 (움직임 제한적)
```

---

## 🎨 2D Anime Style 강제의 이유

### LTX-2 특성
```
✅ 2D 애니메이션 미학에 최적화
✅ Clean lines, flat shading에 강함
❌ Photorealistic은 부자연스러움
❌ 3D render는 아티팩트 발생
```

### 강제 프리픽스 효과
```
"Cinematic 2D Anime style, clean lines, flat shading"

→ LTX-2가 가장 잘하는 스타일로 유도
→ Photorealistic 충돌 방지
→ 일관된 미학 보장
```

---

## 📈 예상 개선사항

### 비주얼 품질
```
✅ 더 깔끔한 선 (clean lines)
✅ 일관된 2D 애니메이션 느낌 (flat shading)
✅ 얼굴 안정성 증가 (conditioning 0.75)
✅ 프롬프트 지시사항 엄격히 준수 (guidance 3.5)
```

### 움직임
```
✅ 모든 씬에 카메라 움직임 (Slow camera zoom-in 강제)
✅ 정적인 프레임 제거
✅ 적절한 움직임 (conditioning 0.75 균형)
```

### 일관성
```
✅ 모든 영상이 동일한 2D Anime 스타일
✅ 카메라 움직임 일관성 (항상 zoom-in)
✅ 프롬프트 구조 일관성 (prefix 강제)
```

---

## 🧪 테스트 포인트

### Test 1: 2D Anime Style 확인
```
기대:
- Clean lines (깔끔한 외곽선)
- Flat shading (평면 음영, 과도한 그라데이션 없음)
- 애니메이션 느낌 (NOT photorealistic)

확인:
- Photorealistic 느낌이 나오는가? → ❌ (실패)
- 2D 애니메이션 느낌이 나오는가? → ✅ (성공)
```

### Test 2: 카메라 움직임
```
기대:
- 모든 씬에 "Slow camera zoom-in"
- 정적인 프레임 없음

확인:
- 카메라가 움직이는가? → ✅ (성공)
- 정적인 씬이 있는가? → ❌ (실패)
```

### Test 3: 얼굴 안정성
```
기대:
- 얼굴 흘러내림 감소 (conditioning 0.75)
- 캐릭터 특징 유지
- 적절한 표정 변화

확인:
- 얼굴이 흘러내리는가? → ❌ (실패)
- 표정이 자연스러운가? → ✅ (성공)
- 캐릭터 특징 유지되는가? → ✅ (성공)
```

### Test 4: 프롬프트 준수
```
기대:
- guidance 3.5로 프롬프트 엄격히 준수
- 대사 감정이 시각적으로 표현됨

확인:
- 슬픈 대사 → 슬픈 표정? → ✅ (성공)
- 웃는 대사 → 웃는 표정? → ✅ (성공)
```

---

## 🔧 추가 조정 옵션 (필요 시)

### 얼굴 안정성 더 강화하려면
```python
image_conditioning_scale=0.8  # 0.75 → 0.8
# Trade-off: 움직임 더 제한됨
```

### 프롬프트 준수 더 강화하려면
```python
guidance_scale=4.0  # 3.5 → 4.0
# Trade-off: Over-saturation 위험
```

### 비용 더 낮추려면
```python
num_inference_steps=12  # 15 → 12
# Cost: ₩32 → ₩26
# Trade-off: 품질 약간 하락
```

---

## ✅ 배포 완료

### Modal Backend
```
✅ guidance_scale: 3.5
✅ image_conditioning_scale: 0.75
✅ lora_scale: 0.65 (안전 범위)
✅ steps: 15 (₩32 비용)
✅ Health: Healthy
✅ Endpoint: https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run
```

### Frontend (Cloudflare Pages)
```
✅ Gemini: 2D Anime prefix 강제
✅ Gemini: Slow camera zoom-in 강제
✅ GitHub: Pushed (commit 9787623)
🔄 Cloudflare Pages: Auto-deploying (1-2분)
```

---

## 🚀 테스트 준비 완료

**Production URL (1-2분 후):**
```
https://google-youtubeproject.pages.dev
```

**테스트 시나리오:**
1. 이미지 업로드
2. 대사 입력 (감정 포함)
3. "Generate Storyboard" 클릭
4. ~73초 대기
5. **확인 포인트:**
   - ✅ 2D Anime 스타일 (clean lines, flat shading)
   - ✅ 카메라 움직임 (Slow camera zoom-in)
   - ✅ 얼굴 안정성 (흘러내림 없음)
   - ✅ 대사에 맞는 표정
   - ✅ 비용 ₩32 유지

---

## 📊 전체 진화 과정

| 버전 | Cond. | Guidance | Style | Camera | 비용 | 문제점 |
|------|-------|----------|-------|--------|------|--------|
| Baseline | 0.85 | 3.0 | Mixed | ❌ | ₩25 | 품질 낮음 |
| Aggressive | 0.85 | 3.0 | Mixed | ❌ | ₩54 | 비용 과다 |
| Emotion | 0.8 | 3.0 | Mixed | ❌ | ₩39 | 비용 과다 |
| Final Tweak | 0.7 | 3.0 | 2D hint | 가끔 | ₩32 | 얼굴 흘러내림 |
| **Community** | **0.75** | **3.5** | **2D 강제** | **항상** | **₩32** | **균형 달성** |

---

## 🎯 요약

**Community Optimization 핵심:**
- ✅ 2D Anime 스타일 강제 (LTX-2 최적 활용)
- ✅ 카메라 움직임 강제 (정적 프레임 제거)
- ✅ 얼굴 안정성/움직임 균형 (0.75 conditioning)
- ✅ 프롬프트 엄격 준수 (3.5 guidance)
- ✅ 비용 효율성 유지 (₩32, steps 15)

**기대 효과:**
- 더 깔끔한 2D 애니메이션 미학
- 모든 씬에 자연스러운 움직임
- 얼굴 흘러내림 최소화
- 일관된 스타일 및 품질

**균형점 달성!** 🎨✨
