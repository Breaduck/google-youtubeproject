import sys
import os
import subprocess

# UTF-8 인코딩 강제 설정
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'replace')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'replace')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# modal deploy 실행
result = subprocess.run([sys.executable, '-m', 'modal', 'deploy', 'main.py'],
                       cwd=os.path.dirname(__file__),
                       env=os.environ)
sys.exit(result.returncode)
