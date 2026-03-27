#!/usr/bin/env python3
"""UTF-8 인코딩 래퍼 - Modal 배포용"""
import sys
import os
import io

# UTF-8 강제 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
os.environ['PYTHONIOENCODING'] = 'utf-8'

if __name__ == "__main__":
    import subprocess
    result = subprocess.run(
        [sys.executable, "-m", "modal", "deploy", "main_byteplus.py"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        env={**os.environ, 'PYTHONIOENCODING': 'utf-8'},
        capture_output=False
    )
    sys.exit(result.returncode)
