# deploy.ps1 - 통합 자동 배포 스크립트
# 사용법: .\deploy.ps1 "커밋 메시지"
# 기본 메시지: auto: deploy $(date)

param(
    [string]$msg = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

Set-Location "C:\Users\hiyoo\OneDrive\바탕 화면\video-saas"

# ── 1. 변경된 파일 확인 (modal-server 포함 여부) ──────────────────────
$modalChanged = (git diff --name-only HEAD 2>$null) + (git diff --cached --name-only 2>$null) + `
                (git status --short 2>$null | ForEach-Object { $_.Substring(3) }) |
                Where-Object { $_ -match "^modal-server/" }

# ── 2. Git add & commit & push ────────────────────────────────────────
Write-Host "`n[1/3] Git staging..." -ForegroundColor Cyan
git add -A

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "변경사항 없음. 배포 스킵." -ForegroundColor Yellow
    exit 0
}

if (-not $msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $msg = "auto: deploy $timestamp"
}

Write-Host "[2/3] Committing: $msg" -ForegroundColor Cyan
git commit -m $msg

Write-Host "[3/3] Pushing to GitHub → Cloudflare 자동 배포 트리거..." -ForegroundColor Cyan
git push

Write-Host "`n✓ GitHub push 완료 → Cloudflare Pages 배포 진행 중 (1-2분)" -ForegroundColor Green

# ── 3. Modal deploy (modal-server 변경 시에만) ────────────────────────
if ($modalChanged) {
    Write-Host "`n[Modal] modal-server 변경 감지 → Modal 배포 시작..." -ForegroundColor Cyan
    python -m modal deploy modal-server/main_official.py
    Write-Host "✓ Modal 배포 완료" -ForegroundColor Green
} else {
    Write-Host "`n[Modal] modal-server 변경 없음 → 스킵" -ForegroundColor DarkGray
}

Write-Host "`n=== 배포 완료 ===" -ForegroundColor Green
Write-Host "Cloudflare: https://google-youtubeproject.pages.dev" -ForegroundColor White
Write-Host "Modal API:  https://hiyoonsh1--ltx-official-exp-web.modal.run" -ForegroundColor White
