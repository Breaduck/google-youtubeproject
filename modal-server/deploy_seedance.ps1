[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
Set-Location "C:\Users\hiyoo\OneDrive\바탕 화면\video-saas"
python -m modal deploy modal-server/main_seedance.py
