@echo off
title CoopXV-extract Service Manager
color 0A

REM Auto-detect current folder
set "SERVICE_EXE=%~dp0WinSW-x64.exe"
set "APP_PATH=%~dp0coopxv-extract.exe"

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
echo 6. Exit
echo.
echo ========================================
set /p choice=Enter your choice (1-6): 

if "%choice%"=="1" goto INSTALL
if "%choice%"=="2" goto START
if "%choice%"=="3" goto STOP
if "%choice%"=="4" goto UNINSTALL
if "%choice%"=="5" goto STATUS
if "%choice%"=="6" goto EXIT
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

:EXIT
cls
echo.
echo Thank you for using CoopXV-extract Service Manager!
echo.
timeout /t 2 >nul
exit