# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

핵심 지표 (North Star)
- **생성 비용:** 8초 영상 기준 307원 (BytePlus SeeDANCE API, 환율 1,460원/$)
- **품질 우선:** 표정 & 움직임 해결 최우선 (비용 2배 투자)

협업 가이드 (Communication Rules)
- **선제적 질문:** 요구사항이 모호하거나 비용/품질 트레이드오프가 발생할 경우 즉시 질문할 것.
- **최적 제안:** 더 저렴하거나 효율적인 방식이 있다면 작업 전 대표님께 먼저 제안할 것.
- **토큰 효율:** 항상 최고로 효율적으로 탐색할 것. 불필요한 서술을 지양하고 핵심 코드와 정보 위주로 응답하여 토큰 사용량을 최소화할 것.
- 항상 cloud flare에 자동배포하기
- **Billing Gate (필수):** 외부 API 연동 전 `docs/BILLING_GATE.md` 체크리스트 확인 필수. 최소 충전/환불/무료크레딧 적용범위 확인 없이 결제 유도 금지.

## 🚫 Anti-Patterns (절대 금지)

**대용량 파일 작업 시:**
- ❌ Read 전체 읽기 시도 → 에러 → Grep 재검색 (2배 토큰 낭비)
- ✅ 처음부터 Grep으로 필요한 부분 검색 → offset/limit로 Read

**다중 작업 시:**
- ❌ Task 생성 → 하나씩 처리하며 매번 파일 읽기 반복
- ✅ Grep으로 모든 위치 파악 → 병렬 Edit 실행

**구현 완료 기준:**
- ❌ TypeScript 에러 없음 = 완료
- ✅ 사용자 의도대로 실제 동작 확인 = 완료
  - 예: "연결된 느낌" → CSS만 수정 말고 시각적 효과 검증 필요
  - 예: "겹치지 않게" → 반응형만 만들지 말고 실제 겹침 해결 확인

**검색 효율:**
- ❌ 여러 키워드로 반복 검색 (preset, template, 깔끔한 흰색...)
- ✅ 한 번에 OR 패턴 검색: `"preset|template|깔끔한 흰색|네온"`

작업 품질 원칙 (Quality Standards)
- **완전한 구현:** 기능 추가 시 반드시 모든 옵션을 완전하게 구현할 것. 일부만 구현하거나 뼈대만 만드는 것 금지.
  - 예: 음성 선택 기능이면 모든 음성을 실제로 작동하도록 구현
  - 예: API 선택 기능이면 모든 provider를 완전히 연동
- **책임감 있는 검증:** 구현 후 반드시 직접 코드를 읽고 누락된 부분이 없는지 확인할 것.
- **사용자 입력 보존:** 사용자가 입력한 텍스트(스크립트, 프롬프트 등)는 **절대 임의로 수정 금지**.
  - 600자든 3만자든 입력받은 내용을 **토씨 하나 바꾸지 말고** 그대로 사용
  - Gemini API 호출 시 사용자 입력을 재작성/요약/변경하지 않도록 프롬프트 설계
  - 분석은 별도로 하되, 원본 텍스트는 반드시 보존
- **중도 포기 금지:** 작업 중 임의로 마무리하거나 생략하지 말 것. 끝까지 완수.

## 🧩 코드 모듈화 원칙 (Modularization)

**App.tsx에 직접 추가 금지. 새 기능은 반드시 분리된 컴포넌트로 작성.**

**새 모달/팝업 추가 시:**
```
위치: src/components/modals/
패턴:
- props로 상태와 콜백 전달
- App.tsx에서는 조건부 렌더링만
```

**새 뷰/섹션 추가 시:**
```
위치: src/components/ 또는 src/views/
패턴:
- 독립적인 컴포넌트로 분리
- 필요한 props만 전달
```

**기존 코드 수정 시:**
- 50줄 이상 추가되면 → 컴포넌트 분리 검토
- 인라인 JSX가 길어지면 → 별도 컴포넌트로 추출

**현재 모달 구조:**
```
src/components/modals/
├── BatchModal.tsx        (배치 생성)
├── ExportPopup.tsx       (영상 추출)
├── VideoGenerationPopup.tsx (영상 설정)
├── RegenerateModal.tsx   (이미지 재생성)
└── StyleDescModal.tsx    (스타일 설명)
```

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


**Pre-Deployment Sanity Check:**
모든 코드 수정 후 배포(Push) 전, 다음 항목을 스스로 시뮬레이션한다.

1. **보안 체크**: API 키/Secret이 하드코딩되지 않았는가?
2. **인코딩 검증**: 윈도우 환경의 CP949 충돌 가능성이 있는가? (UTF-8 강제 적용 여부)
3. **의존성 체크**: Modal 환경 구축에 필요한 라이브러리가 누락되지 않았는가?
4. **브랜치 체크**: 올바른 서버 파일을 수정했는가? (브랜치별로 다름)

**Auto-Fix Execution:**
검토 과정에서 오류 가능성이 발견되면, 사용자에게 보고하기 전 선제적으로 코드를 수정하여 '정상 작동' 상태를 만든 뒤 배포한다.
