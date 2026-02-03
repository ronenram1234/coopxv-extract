@echo off
title CoopXV-extract Service Manager
color 0A

REM Auto-detect current folder
set "SERVICE_EXE=%~dp0WinSW-x64.exe"
set "APP_PATH=%~dp0coopxv-extract.exe"
set "LOG_PATH=%~dp0..\logs"

:MENU
cls
echo ========================================
echo   CoopXV-extract Service Manager
echo ========================================
echo.
echo App Location: %APP_PATH%
echo.
echo 1. Install Service
echo 2. Start Service
echo 3. Stop Service
echo 4. Uninstall Service
echo 5. Check Service Status
echo 6. View Live Logs
echo 7. Exit
echo.
echo ========================================
set /p choice=Enter your choice (1-7): 

if "%choice%"=="1" goto INSTALL
if "%choice%"=="2" goto START
if "%choice%"=="3" goto STOP
if "%choice%"=="4" goto UNINSTALL
if "%choice%"=="5" goto STATUS
if "%choice%"=="6" goto LOGS
if "%choice%"=="7" goto EXIT
echo Invalid choice! Please try again.
timeout /t 2 >nul
goto MENU

:INSTALL
cls
echo ========================================
echo   Installing CoopXV-extract Service...
echo ========================================
echo.
"%SERVICE_EXE%" install
if %errorlevel% equ 0 (
    echo Service installed successfully!
    echo Starting service...
    "%SERVICE_EXE%" start
    echo Service started!
) else (
    echo Installation failed!
)
echo.
pause
goto MENU

:START
cls
echo ========================================
echo   Starting CoopXV-extract Service...
echo ========================================
echo.
"%SERVICE_EXE%" start
echo.
pause
goto MENU

:STOP
cls
echo ========================================
echo   Stopping CoopXV-extract Service...
echo ========================================
echo.
"%SERVICE_EXE%" stop
echo.
pause
goto MENU

:UNINSTALL
cls
echo ========================================
echo   Uninstalling CoopXV-extract Service...
echo ========================================
echo.
echo WARNING: This will permanently remove the service!
set /p confirm=Are you sure? (Y/N): 
if /i "%confirm%" NEQ "Y" goto MENU
echo.
"%SERVICE_EXE%" stop
"%SERVICE_EXE%" uninstall
echo.
echo Service uninstalled successfully!
echo.
pause
goto MENU

:STATUS
cls
echo ========================================
echo   CoopXV-extract Service Status
echo ========================================
echo.
"%SERVICE_EXE%" status
echo.
sc query CoopXV-extract
echo.
pause
goto MENU

:LOGS
cls
echo ========================================
echo   Live Logs (Press Ctrl+C to stop)
echo ========================================
echo.
echo Looking for log files in: %LOG_PATH%
echo.

REM Find the most recent log file
for /f "delims=" %%i in ('dir /b /od "%LOG_PATH%\*.log" 2^>nul') do set "LATEST_LOG=%%i"

if not defined LATEST_LOG (
    echo No log files found!
    pause
    goto MENU
)

echo Showing: %LATEST_LOG%
echo.
echo ----------------------------------------
echo.

REM Use PowerShell to tail the log file
powershell -Command "Get-Content '%LOG_PATH%\%LATEST_LOG%' -Wait -Tail 20"

goto MENU

:EXIT
cls
echo.
echo Thank you for using CoopXV-extract Service Manager!
echo.
timeout /t 2 >nul
exit