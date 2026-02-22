#!/usr/bin/env python3
"""UTF-8 인코딩으로 BytePlus Modal 서버 배포"""
import os
import sys
import subprocess

# UTF-8 인코딩 강제
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Modal deploy 실행
result = subprocess.run(
    [sys.executable, '-m', 'modal', 'deploy', 'main_byteplus.py'],
    cwd=os.path.dirname(__file__),
    encoding='utf-8',
    errors='replace'
)

sys.exit(result.returncode)
