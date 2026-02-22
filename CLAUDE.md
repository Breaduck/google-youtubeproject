# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

핵심 지표 (North Star)
- **생성 비용:** 8초 영상 기준 54원 (Aggressive Quality Mode, 환율 1,450원/$)
- **품질 우선:** 표정 & 움직임 해결 최우선 (비용 2배 투자)

협업 가이드 (Communication Rules)
- **선제적 질문:** 요구사항이 모호하거나 비용/품질 트레이드오프가 발생할 경우 즉시 질문할 것.
- **최적 제안:** 더 저렴하거나 효율적인 방식이 있다면 작업 전 대표님께 먼저 제안할 것.
- **토큰 효율:** 항상 최고로 효율적으로 탐색할 것. 불필요한 서술을 지양하고 핵심 코드와 정보 위주로 응답하여 토큰 사용량을 최소화할 것.
- 항상 cloud flare에 자동배포하기
- **Billing Gate (필수):** 외부 API 연동 전 `docs/BILLING_GATE.md` 체크리스트 확인 필수. 최소 충전/환불/무료크레딧 적용범위 확인 없이 결제 유도 금지.

## ⚙️ Current Configuration (Aggressive Quality Mode)
- **Model:** LTX-2 Distilled + LoRA Rank 175 FP8 (1.79 GB)
- **Steps:** 20 (2배 증가, 품질 우선)
- **Guidance Scale:** 3.0 (프롬프트 강화)
- **Image Conditioning:** 0.85 (움직임 자유도)
- **Prompt:** "Cinematic motion, natural character movement, high dynamic range, subtle motion"
- **Cost:** ~₩54 per 8초 video (84초 생성 시간)

## 📦 Repository & Backup
- **Main Repo:** `https://github.com/Breaduck/google-youtubeproject`
- **Modal API (브랜치2):** `https://hiyoonsh1--byteplus-proxy-web.modal.run`
- **Cloudflare Pages:**
  - main: `https://google-youtubeproject.pages.dev`
  - 브랜치2: `https://branch2-9jl.pages.dev` (자동 배포)
- **Sync Rule:** 유의미한 코드 수정이나 최적화 작업이 끝나면, 작업 내역을 요약하여 위 레포지토리로 반드시 `git push` 할 것.
- **Deploy 방법:**
  - Frontend: `git push origin <브랜치명>` → Cloudflare Pages 자동 배포 (각 브랜치별 독립 프로젝트)
  - 수동 배포 (필요시): `npm run build && npx wrangler pages deploy dist --project-name=branch2 --commit-dirty=true`
  - Modal (브랜치2): `cd modal-server && export PYTHONIOENCODING=utf-8 && python -m modal deploy main_byteplus.py`
- **Structure:** 로컬 `video-saas` 폴더의 작업물을 레포지토리 구조에 맞춰 일관성 있게 관리할 것.

## 🔐 Security & Secrets Management

**절대 금지:**
- API 키, Client ID, Secret을 코드에 하드코딩
- 민감 정보를 git commit에 포함

**Modal Secrets 관리:**
```bash
# Secret 생성
python -m modal secret create <secret-name> KEY_NAME=<value>

# Secret 목록 확인
python -m modal secret list

# Function에서 사용
@app.function(secrets=[modal.Secret.from_name("<secret-name>")])
def my_function():
    api_key = os.getenv("KEY_NAME")
```

**현재 필수 Secrets (브랜치2):**
- `imgur-client-id`: IMGUR_CLIENT_ID (이미지 업로드용)

**보안 체크리스트:**
1. 새 API 연동 시 항상 ENV 변수 사용
2. 커밋 전 `git diff`로 민감 정보 누출 확인
3. 노출된 키는 즉시 폐기 후 재발급
4. modal-server/SECURITY_NOTICE.md 참조

## 🌿 브랜치 구조 (Branch-Based Experimentation)

| Branch | 설명 | Video Engine | Server File | Cost/Video | Resolution | Duration |
|--------|------|-------------|-------------|------------|------------|----------|
| `main` | LTX Distilled 모드 실험 | LTX-2 Distilled | `main.py` | - | - | - |
| `exp/official-sdk` (브랜치1) | LTX 공식 루트 실험 | LTX-2 TI2VidTwoStagesPipeline | `main_official.py` | ₩31 | 960×544 | 3s |
| `브랜치2` | SeeDANCE API 실험 | BytePlus SeeDANCE | `main_byteplus.py` (proxy) | ₩146 | 720p/1080p | 5s |

**CRITICAL:**
- **각 브랜치는 독립적인 실험 환경**: 브랜치별로 다른 비디오 생성 엔진과 서버 파일 사용
- **브랜치2 (현재 활성)**: BytePlus SeeDANCE 1.0 Pro-fast 전용, Model ID: `seedance-1-0-pro-fast-251015`
- **Cloudflare 배포**: 각 브랜치는 별도 Pages 프로젝트로 배포 권장 (충돌 방지)

## 📡 BytePlus Integration (브랜치2)

**Architecture Flow:**
```
Frontend (data:image/png;base64,...)
    ↓ POST /api/v3/uploads
Modal Proxy (main_byteplus.py)
    ↓ Imgur 공개 업로드
Imgur (https://i.imgur.com/...)
    ↓ POST /api/v3/content_generation/tasks
BytePlus SeeDANCE API
    ↓ GET /api/v3/content_generation/tasks/{task_id}
Video Result (polling)
```

**Key Implementation Details:**
1. **Image Upload Requirement**: BytePlus는 공개 HTTPS URL만 허용 → Imgur 중간 호스팅 필수
2. **Upload Validation**:
   - 포맷: png/jpeg/webp만 허용
   - 크기: 최대 5MB
   - 최소 크기: 300px 너비 (BytePlus 요구사항)
3. **Model Alias Mapping**: 서버 측에서 `seedance-1.0-pro-fast` → `seedance-1-0-pro-fast-251015` 변환
4. **Correct Endpoint**: `/api/v3/contents/generations/tasks` (SDK 문서 오류 주의)
5. **Error Handling**: HTTP 상태 코드로 명확한 에러 구분 (404/403/400/413/500)

**참고 문서:**
- modal-server/BYTEPLUS_README.md: API 명세
- modal-server/SETUP_IMGUR.md: Imgur Client ID 설정
- modal-server/SECURITY_NOTICE.md: 보안 이슈 히스토리

## 🚨 Billing Gate (외부 API 도입 필수 프로세스)

**원칙:** 외부 API 연동 시 사용자에게 예상치 못한 과금 방지 + 투명한 비용 안내

### 필수 체크리스트 (docs/BILLING_GATE.md)
새로운 외부 API 도입 전 **반드시** 확인하고 문서화:
- [ ] **최소 잔액 조건**: API 호출에 필요한 최소 크레딧/잔액
- [ ] **최소 충전 금액**: 사용자가 실제로 충전해야 하는 최소 금액
- [ ] **무료 크레딧 적용 범위**: 무료 크레딧이 해당 기능에 사용 가능한지
- [ ] **환불 정책**: 환불 가능 여부 및 조건
- [ ] **만료 정책**: 크레딧/쿠폰 만료 기간
- [ ] **최소 과금 단위**: 반올림/절사 방식
- [ ] **사용량 확인 방법**: Dashboard URL 또는 API 엔드포인트

### 현재 상태 (2026-02-21)
- **Runware**: 기본 비활성화 (`VITE_RUNWARE_ENABLED=false`)
  - API 최소 요구: $5 크레딧
  - 실제 최소 충전: $20
  - 환불: 크레딧 형태만 가능
  - 재시도: 금지 (insufficient credits 시 즉시 실패)
- **BytePlus**: 활성화 (권장)
  - 무료 크레딧: 2M~5M 토큰 (비디오 적용 가능)
  - 종량제 (최소 충전 금액 확인 필요)

### 코드 구현 규칙
1. **Feature Flag**: 새 provider는 ENV 변수로 비활성화 (기본값: false)
2. **명시적 비용 안내**: 최소 충전 금액 + API 요구 조건 + 환불 정책
3. **재시도 금지**: insufficient credits 시 즉시 실패 처리 (무한 재시도 방지)

## 📚 LTX-2 공식 SDK 레퍼런스 (https://github.com/Lightricks/LTX-2)

### 패키지 구조
- `ltx-core`: 모델 구현 + 추론 유틸
- `ltx-pipelines`: 고수준 파이프라인
- `ltx-trainer`: LoRA 파인튜닝

### 파이프라인 선택
| 파이프라인 | 용도 |
|-----------|------|
| `TI2VidTwoStagesPipeline` | 최고 품질 (권장) |
| `DistilledPipeline` | 최고 속도 (8+4 steps) |
| `TI2VidOneStagePipeline` | 단일 패스 |
| `ICLoraPipeline` | Video-to-video |
| `KeyframeInterpolationPipeline` | 키프레임 보간 |

### TI2VidTwoStagesPipeline 생성자
```python
TI2VidTwoStagesPipeline(
    checkpoint_path: str,
    distilled_lora: list[LoraPathStrengthAndSDOps],  # strength 0.6 권장
    spatial_upsampler_path: str,
    gemma_root: str,
    loras: list[LoraPathStrengthAndSDOps],
    device: str = auto,
    quantization: QuantizationPolicy | None = None,
)
```

### TI2VidTwoStagesPipeline __call__
```python
pipeline(
    prompt: str,
    negative_prompt: str,
    seed: int,
    height: int, width: int,
    num_frames: int,
    frame_rate: float,
    num_inference_steps: int,
    video_guider_params: MultiModalGuiderParams,
    audio_guider_params: MultiModalGuiderParams,
    images: list[tuple[str, int, float]],  # (path, frame_idx, strength)
    tiling_config: TilingConfig | None = None,
    enhance_prompt: bool = False,
) -> tuple[Iterator[torch.Tensor], torch.Tensor]
```

### MultiModalGuiderParams 기본값
```python
MultiModalGuiderParams(
    cfg_scale=1.0,       # 권장 범위: 2.0~5.0
    stg_scale=0.0,       # 권장 범위: 0.5~1.5
    rescale_scale=0.0,
    modality_scale=1.0,
    stg_blocks=[29],
    skip_step=0,
)
```

### Sigma 스케줄 (공식)
```python
DISTILLED_SIGMA_VALUES        = [1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0]  # Stage1 (9값)
STAGE_2_DISTILLED_SIGMA_VALUES = [0.909375, 0.725, 0.421875, 0.0]  # Stage2 (4값)
```

### DistilledPipeline __call__
```python
pipeline(
    prompt, seed, height, width, num_frames, frame_rate,
    images: list[tuple[str, int, float]],
    tiling_config=None, enhance_prompt=False,
) -> tuple[Iterator[torch.Tensor], torch.Tensor]
# Stage1: height/2 x width/2 생성 → Stage2: 2x 업샘플 + 정제
```

### LoRA 로드 패턴
```python
from ltx_core.loader import LTXV_LORA_COMFY_RENAMING_MAP, LoraPathStrengthAndSDOps
distilled_lora=[LoraPathStrengthAndSDOps("distilled_lora.safetensors", 0.6, LTXV_LORA_COMFY_RENAMING_MAP)]
```

### dtype / 메모리
- 기본 dtype: `torch.bfloat16`
- FP8: `QuantizationPolicy.fp8_cast()` → VRAM 약 50% 절약
- `PYTORCH_ALLOC_CONF=expandable_segments:True` 필수

## 🏗️ Architecture Patterns

### Modal Job-Based Async Pattern
```python
# 1. Spawn pattern (prevents timeout)
@app.function(volumes={"/video-cache": video_cache})
def run_and_save(data: dict, job_id: str):
    # Long-running generation
    gen = VideoGenerator()
    result = gen.generate.remote(data)
    # Save to volume
    with open(f"/video-cache/{job_id}.mp4", "wb") as f:
        f.write(video_bytes)
    video_cache.commit()

# 2. ASGI web endpoint
@app.function()
@modal.asgi_app()
def web():
    @fast_app.post("/start")
    async def start_generation(request: Request):
        job_id = uuid.uuid4().hex[:8]
        run_and_save.spawn(data, job_id)  # Non-blocking
        return {"job_id": job_id}

    @fast_app.get("/status/{job_id}")
    def job_status(job_id: str):
        # Read from volume
        return {"status": "complete"}

    @fast_app.get("/download/{job_id}")
    def download_video(job_id: str):
        # Stream MP4 from volume
        return StreamingResponse(...)
```

### Safe Motion Mapper (Quality Guard)
**목적:** 자유형 프롬프트 대신 템플릿 기반 모션으로 LTX-2 품질 문제 방지 (눈 감김, 얼굴 변형)

```python
SAFE_MOTION_TEMPLATES = {
    "A": "quick head turn toward the listener",
    "B": "slight forward lean",
    "C": "raise one hand slightly below the chin (hand stays away from face)",
    "D": "micro nod once",
}
MOTION_HOLD_SUFFIX = ", then hold still, subtle breathing"

def safe_motion_mapper(dialogue: str) -> tuple:
    d = (dialogue or "").strip()
    if "!" in d:
        key, preset = "A", "A-head-turn"
    elif "?" in d:
        key, preset = "D", "D-micro-nod"
    elif len(d) >= 20:
        key, preset = "B", "B-forward-lean"
    else:
        key, preset = "C", "C-hand-raise"
    return SAFE_MOTION_TEMPLATES[key] + MOTION_HOLD_SUFFIX, preset
```

### Two-Stage FFmpeg Encoding (Lineart Preservation)
```python
# Stage 1: Initial encode
encode_video(frames_np, fps=24.0, output_path=out_path_initial)

# Stage 2: High-quality re-encode (crf=18, tune=animation)
ffmpeg -i initial.mp4 -c:v libx264 -preset fast -crf 18 \
       -tune animation -pix_fmt yuv420p -movflags +faststart \
       -c:a aac -b:a 128k final.mp4
```

### Frontend Engine Routing (브랜치2)
```typescript
// src/services/videoService.ts
export type VideoEngine = 'diffusers' | 'official' | 'seedance';

if (engine === 'official') {
  const OFFICIAL_API = 'https://hiyoonsh1--ltx-official-exp-web.modal.run';
  // Call main_official.py
} else if (engine === 'seedance') {
  const SEEDANCE_API = 'https://hiyoonsh1--seedance-experiment-web.modal.run';
  // Call main_seedance.py
}
```

## 🔧 Development Commands

### Frontend
```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 (http://localhost:5173)
npm run build        # TypeScript 체크 + 프로덕션 빌드
npm run lint         # ESLint 검사
```

### Modal Server Deployment (Windows UTF-8 필수)
```bash
# exp/official-sdk 브랜치
export PYTHONIOENCODING=utf-8 && python -m modal deploy modal-server/main_official.py

# 브랜치2 브랜치 (BytePlus)
cd modal-server
export PYTHONIOENCODING=utf-8
python -m modal deploy main_byteplus.py
```

**PowerShell 대안:**
```powershell
powershell -ExecutionPolicy Bypass -File modal-server/deploy_official.ps1
```

**배포 전 체크리스트:**
1. Modal Secret 등록 확인: `python -m modal secret list`
2. 브랜치 확인: `git branch --show-current`
3. 올바른 서버 파일 선택 (브랜치별로 다름)

**로그 확인:**
```bash
python -m modal app logs byteplus-proxy  # 브랜치2
python -m modal app logs ltx-video-service-v2  # main/exp branches
```

### Git Workflow
```bash
git status                    # 현재 브랜치 및 변경사항 확인
git push origin <branch>      # Cloudflare Pages 자동 배포
git log --oneline -5          # 최근 커밋 메시지 스타일 확인
```

## ⚠️ Common Issues & Solutions

### 1. Modal Server Timeout (2min+)
**원인:** FastAPI 의존성 누락 → 웹 서버가 시작되지 않음
**해결:**
```python
# ❌ WRONG
image = modal.Image.debian_slim().pip_install("requests", "Pillow")

# ✅ CORRECT
image = modal.Image.debian_slim().pip_install("fastapi", "requests", "Pillow")
```

### 2. CORS Error from Browser
**원인:** BytePlus/외부 API는 CORS 미지원 → Modal 프록시 필수
**해결:** Modal 서버를 중간 경유지로 유지 (브라우저에서 직접 호출 불가)

```python
# Modal 서버에 CORS 활성화
from fastapi.middleware.cors import CORSMiddleware

fast_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3. Cloudflare Not Reflecting Changes
**원인:** TypeScript 빌드 오류 또는 브라우저 캐시
**해결:**
- `npm run build` 로컬 검증
- 강제 새로고침 (Ctrl+Shift+R)
- 시크릿 모드에서 확인

### 4. TypeScript Duplicate Variable Error
```typescript
// ❌ WRONG - 중복 선언
const [videoEngine, setVideoEngine] = useState('official');  // Line 44
const [videoEngine, setVideoEngine] = useState('seedance');  // Line 113 - ERROR!

// ✅ CORRECT - 기존 state 업데이트
const [videoEngine, setVideoEngine] = useState<VideoEngine>(
  (localStorage.getItem('video_engine') as VideoEngine) || 'official'
);
```

### 5. Windows Encoding Error (CP949)
**원인:** Modal CLI 기본값이 CP949 → UTF-8 필수
**해결:** 항상 `export PYTHONIOENCODING=utf-8` 접두사 사용

### 6. Eye-Closing / Face Morphing (LTX-2)
**원인:** 자유형 프롬프트 + 외모 묘사가 모델 혼란 유발
**해결:** Safe Motion Mapper 사용 (모션 전용 템플릿) + negative prompts

### 7. BytePlus Image URL Error (InvalidParameter)
**원인:** BytePlus가 Modal Volume URL에 접근 불가
**해결:** Imgur/ImgBB 같은 공개 이미지 호스팅 사용 (300px 이상)

### 8. Modal Secret 미설정 에러
**증상:** `imgur_client_id_missing` 또는 500 에러
**해결:**
```bash
python -m modal secret create imgur-client-id IMGUR_CLIENT_ID=<your_id>
python -m modal deploy modal-server/main_byteplus.py  # 재배포
```

### 9. BytePlus Model Not Activated (404)
**에러:** `ModelNotOpen` 또는 404
**해결:** BytePlus 콘솔에서 모델 활성화
- https://console.byteplus.com → ModelArk → Models
- `seedance-1-0-pro-fast-251015` 활성화 필요

## 📁 File Structure
```
src/
├── App.tsx                    # 메인 UI (2000+ lines, 전체 워크플로우)
├── ExpLanding.tsx             # 랜딩 페이지
├── main.tsx                   # React entry point
├── types.ts                   # TypeScript 인터페이스
└── services/
    ├── geminiService.ts       # Gemini API (스크립트 분해, 이미지 생성)
    └── videoService.ts        # 비디오 생성 라우팅 (엔진 선택)

modal-server/
├── main.py                    # (deprecated) 구 diffusers 파이프라인
├── main_official.py           # exp/official-sdk: LTX-2 TI2VidTwoStagesPipeline
├── main_byteplus.py           # 브랜치2: BytePlus API 프록시 + Imgur 업로드
├── deploy_official.ps1        # PowerShell 배포 스크립트
├── BYTEPLUS_README.md         # BytePlus API 명세
├── SETUP_IMGUR.md             # Imgur Client ID 설정 가이드
└── SECURITY_NOTICE.md         # 보안 이슈 히스토리

tests/
├── test_byteplus_quick.py     # BytePlus E2E 테스트 (upload → task → poll)
└── test_upload_validation.py  # 업로드 검증 테스트 (포맷/크기 제한)
```

## 🧪 Testing

**E2E 테스트 (브랜치2):**
```bash
# BytePlus 전체 플로우 테스트
python test_byteplus_quick.py
# ✓ Upload → Task 생성 → Polling → 완료

# 업로드 검증 테스트
python test_upload_validation.py
# ✓ PNG/JPEG 허용, GIF 거부, 5MB 제한
```

**Manual Testing:**
```bash
# Health check
curl https://hiyoonsh1--byteplus-proxy-web.modal.run/health

# 모델 목록 확인
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://hiyoonsh1--byteplus-proxy-web.modal.run/api/v3/byteplus/models
```

## AI Self-Reflection & Auto-Fix Protocol

**Pre-Deployment Sanity Check:**
모든 코드 수정 후 배포(Push) 전, 다음 항목을 스스로 시뮬레이션한다.

1. **보안 체크**: API 키/Secret이 하드코딩되지 않았는가?
2. **VRAM 체크**: LTX-2 + LoRA(Rank 175) 조합이 A10G(24GB)에서 OOM을 일으키지 않는가?
3. **인코딩 검증**: 윈도우 환경의 CP949 충돌 가능성이 있는가? (UTF-8 강제 적용 여부)
4. **의존성 체크**: Modal 환경 구축에 필요한 라이브러리가 누락되지 않았는가?
5. **브랜치 체크**: 올바른 서버 파일을 수정했는가? (브랜치별로 다름)

**Auto-Fix Execution:**
검토 과정에서 오류 가능성이 발견되면, 사용자에게 보고하기 전 선제적으로 코드를 수정하여 '정상 작동' 상태를 만든 뒤 배포한다.

**Reflection Log:**
배포 시, "스스로 발견한 잠재적 오류 및 이를 해결하기 위해 수정한 내역"을 짧고 명확하게 요약 보고한다.