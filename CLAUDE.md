핵심 지표 (North Star)
- **생성 비용:** 8초 영상 기준 54원 (Aggressive Quality Mode, 환율 1,450원/$)
- **품질 우선:** 표정 & 움직임 해결 최우선 (비용 2배 투자)

협업 가이드 (Communication Rules)
- **선제적 질문:** 요구사항이 모호하거나 비용/품질 트레이드오프가 발생할 경우 즉시 질문할 것.
- **최적 제안:** 더 저렴하거나 효율적인 방식이 있다면 작업 전 대표님께 먼저 제안할 것.
- **토큰 효율:** 항상 최고로 효율적으로 탐색할 것. 불필요한 서술을 지양하고 핵심 코드와 정보 위주로 응답하여 토큰 사용량을 최소화할 것.
- 항상 cloud flare에 자동배포하기

## ⚙️ Current Configuration (Aggressive Quality Mode)
- **Model:** LTX-2 Distilled + LoRA Rank 175 FP8 (1.79 GB)
- **Steps:** 20 (2배 증가, 품질 우선)
- **Guidance Scale:** 3.0 (프롬프트 강화)
- **Image Conditioning:** 0.85 (움직임 자유도)
- **Prompt:** "Cinematic motion, natural character movement, high dynamic range, subtle motion"
- **Cost:** ~₩54 per 8초 video (84초 생성 시간)

## 📦 Repository & Backup
- **Main Repo:** `https://github.com/Breaduck/google-youtubeproject`
- **Modal API:** `https://hiyoonsh1--ltx-video-service-distilled-1080p-web-app.modal.run`
- **Cloudflare Pages:** `https://google-youtubeproject.pages.dev`
- **Sync Rule:** 유의미한 코드 수정이나 최적화 작업이 끝나면, 작업 내역을 요약하여 위 레포지토리로 반드시 `git push` 할 것.
- **Auto Deploy:** GitHub push → Cloudflare Pages 자동 배포 (1-2분)
- **Modal Deploy 필수:** `modal-server/main.py` 수정 시 git push와 동시에 반드시 `python -m modal deploy modal-server/main.py` 실행할 것. (deploy.ps1 사용: `powershell -ExecutionPolicy Bypass -File modal-server/deploy.ps1`)
- **Structure:** 로컬 `video-saas` 폴더의 작업물을 레포지토리 구조에 맞춰 일관성 있게 관리할 것.

AI Self-Reflection & Auto-Fix Protocol
Pre-Deployment Sanity Check: 모든 코드 수정 후 배포(Push) 전, 다음 항목을 스스로 시뮬레이션한다.
VRAM 체크: LTX-2 + LoRA(Rank 175) 조합이 A10G(24GB)에서 OOM을 일으키지 않는가?
인코딩 검증: 윈도우 환경의 CP949 충돌 가능성이 있는가? (UTF-8 강제 적용 여부)
의존성 체크: Modal 환경 구축에 필요한 라이브러리가 누락되지 않았는가?
Auto-Fix Execution: 검토 과정에서 오류 가능성이 발견되면, 사용자에게 보고하기 전 선제적으로 코드를 수정하여 '정상 작동' 상태를 만든 뒤 배포한다.
Reflection Log: 배포 시, "스스로 발견한 잠재적 오류 및 이를 해결하기 위해 수정한 내역"을 짧고 명확하게 요약 보고한다.