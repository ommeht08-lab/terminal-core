@echo off
REM Launches the backend (FastAPI/uvicorn) and frontend (Next.js) together.
REM Usage: start.bat

setlocal

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"

echo Starting Quant Finance Model...
echo.

if exist "%BACKEND_DIR%\venv\Scripts\activate.bat" (
    echo Activating backend venv...
    start "Backend" cmd /k "cd /d "%BACKEND_DIR%" && call venv\Scripts\activate.bat && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
) else (
    echo No venv found in backend\ - using system Python.
    echo If this fails, run: python -m venv venv ^&^& venv\Scripts\activate ^&^& pip install -r requirements.txt
    start "Backend" cmd /k "cd /d "%BACKEND_DIR%" && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
)

start "Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo.
echo Backend and Frontend are launching in separate windows.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo Close each window to stop that service.

endlocal
