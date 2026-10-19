@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
echo Progress Energo - Konveyer ID
python -c "import fastapi, uvicorn, docx, multipart" 2>nul || python -m pip install -r requirements.txt
start "" http://localhost:8010
python -m uvicorn app.main:app --port 8010
pause
