@echo off
REM SPDX-License-Identifier: AGPL-3.0-or-later
REM
REM neoma - one-shot setup for Windows.
REM Goes from a fresh clone to a running app: checks Node, installs
REM dependencies, builds the production bundle, opens your browser, and serves.
REM
REM   Double-click start.bat, or run it from a terminal.
REM
setlocal enabledelayedexpansion
cd /d "%~dp0"

if "%PORT%"=="" set "PORT=4173"
set "URL=http://localhost:%PORT%"

echo neoma - one-shot setup
echo ======================

REM 1. Node.js must be present and recent enough.
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js is not installed.
  echo     Install Node 20 or newer ^(LTS^) from https://nodejs.org/ and run start.bat again.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
set "NODE_TRIM=%NODE_VER:v=%"
for /f "tokens=1 delims=." %%a in ("%NODE_TRIM%") do set "NODE_MAJOR=%%a"
if %NODE_MAJOR% LSS 20 (
  echo [X] Node %NODE_VER% found, but neoma needs Node 20 or newer.
  echo     Update from https://nodejs.org/ and run start.bat again.
  pause
  exit /b 1
)
echo [OK] Node %NODE_VER%

REM 2. Install dependencies (skip if already present).
if exist node_modules (
  echo [OK] Dependencies already installed ^(delete node_modules to reinstall^)
) else (
  echo -^> Installing dependencies...
  if exist package-lock.json (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo [X] Dependency installation failed.
    pause
    exit /b 1
  )
)

REM 3. Build the production bundle.
echo -^> Building...
call npm run build
if errorlevel 1 (
  echo [X] Build failed.
  pause
  exit /b 1
)

REM 4. Open the browser after a short delay so the server is ready.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process '%URL%'"

echo.
echo [OK] neoma is running at %URL%
echo     Press Ctrl+C to stop.
echo.

REM 5. Serve the built app (blocks until Ctrl+C).
call npm run preview -- --port %PORT% --strictPort

endlocal
