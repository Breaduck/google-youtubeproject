# 브랜치2 - SeeDANCE API 실험

## 목적
LTX-2 (exp/official-sdk)와 비교하여 SeeDANCE API의 비용/품질/속도를 검증

## 구조

### Modal 서버
- **파일:** `modal-server/main_seedance.py`
- **앱 이름:** `seedance-experiment`
- **GPU:** 불필요 (CPU 2.0 코어만)
- **API:** laozhang.ai (기본) 또는 BytePlus 공식

### 엔드포인트
```
https://hiyoonsh1--seedance-experiment-web.modal.run
├── GET  /health
├── POST /start          (job_id 반환)
├── GET  /status/{job_id}
└── GET  /download/{job_id}
```

## 배포

### 1. Modal Secret 설정 (최초 1회)
```bash
modal secret create seedance-api-key SEEDANCE_API_KEY=sk-xxxxx
```

**API 키 발급:**
- laozhang.ai: https://www.laozhang.ai/ 회원가입 후 API 키 발급
- BytePlus: https://console.byteplus.com/ (공식, 더 비쌈)

### 2. 배포
```powershell
powershell -ExecutionPolicy Bypass -File modal-server/deploy_seedance.ps1
```

## 비용 비교 (3초 960x544 기준)

| 엔진 | 비용 | 생성 시간 | 인프라 |
|------|------|----------|--------|
| LTX-2 (exp/official-sdk) | ₩31 | ~31s | A100-80GB |
| SeeDANCE laozhang | ₩44 (추정) | ~10s | API only |
| SeeDANCE BytePlus | ₩65 | ~10s | API only |

## 프론트 연결

### videoService.ts 수정 (선택사항)
```typescript
const SEEDANCE_API = 'https://hiyoonsh1--seedance-experiment-web.modal.run';

// engine 파라미터로 전환
if (engine === 'seedance') {
  const startRes = await fetch(`${SEEDANCE_API}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  // ... (exp/official-sdk와 동일한 폴링 로직)
}
```

## 주요 차이점

| 항목 | LTX-2 | SeeDANCE |
|------|-------|----------|
| 모델 로딩 | 필요 (30s) | 불필요 |
| GPU | A100 80GB | 없음 |
| VAE decode | 로컬 | 서버 처리 |
| 2단계 인코딩 | 있음 (crf=18) | API 직접 반환 |
| Safe Motion Mapper | 있음 | 있음 (동일) |
| 커스텀 프롬프트 | 완전 제어 | API 제약 있음 |

## 테스트 시나리오

1. **동일 입력 A/B 테스트**
   - 같은 이미지 + dialogue + seed
   - LTX-2 vs SeeDANCE 결과 비교
   - 비용/시간/품질 측정

2. **200샷 워크로드 시뮬레이션**
   - 3초 × 200개 = 10분 영상
   - LTX-2: ₩31 × 200 = ₩6,200 (총 ~103분)
   - SeeDANCE: ₩44 × 200 = ₩8,800 (총 ~33분)

3. **품질 검증**
   - 선화 보존 (라인아트 뭉개짐)
   - 얼굴 안정성 (temporal drift)
   - 눈 감김 이슈
   - 제스처 정확도

## 환경 변수 (Modal)

```python
# main_seedance.py에서 사용
SEEDANCE_API_BASE = "https://api.laozhang.ai/v1"  # 기본값
SEEDANCE_PROVIDER = "laozhang"  # 또는 "byteplus"
SEEDANCE_API_KEY = (Modal Secret에서 자동 주입)
```

## 다음 단계

1. ✅ 브랜치2 생성 (완료)
2. ✅ main_seedance.py 작성 (완료)
3. ⏳ API 키 발급 및 Secret 설정
4. ⏳ 배포 후 /health 확인
5. ⏳ 테스트 1회 실행 (비용/품질 검증)
6. ⏳ 프론트 연결 (선택)
