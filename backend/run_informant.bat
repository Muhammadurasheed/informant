@echo off
echo [Informant] Activating Conda environment...
call conda activate informant
if %ERRORLEVEL% NEQ 0 (
    echo [Error] Failed to activate conda environment 'informant'.
    pause
    exit /b %ERRORLEVEL%
)
echo [Informant] Starting Backend Server...
python run.py
pause
