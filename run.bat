@echo off
title IT-NEXUS Local Tutor Server
echo ====================================================
echo   IT-NEXUS // LOCAL IT TUTOR & LEARNING ROADMAP
echo ====================================================
echo.
echo [1/2] Launching your web browser...
start http://localhost:8000
echo.
echo [2/2] Starting local Python server...
echo.
python -m uvicorn backend.app:app --app-dir "C:\Users\Kate\.gemini\antigravity\scratch\local-it-chatbot" --port 8000 --reload
echo.
echo Server stopped.
pause
