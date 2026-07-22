@echo off
REM SPDX-License-Identifier: AGPL-3.0-or-later
REM
REM neoma - self-contained setup for Windows.
REM
REM Download THIS file on its own and double-click it (or run from a terminal):
REM it fetches neoma, installs everything, builds it, opens your browser and
REM serves the app. No cloning or other steps required.
REM
REM The only prerequisite is Node.js 20+ (https://nodejs.org). Git is used if
REM available; otherwise the project is downloaded as a zip via PowerShell.
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "REPO_URL=https://github.com/infinitumio/neoma.git"
set "ZIP_URL=https://github.com/infinitumio/neoma/archive/refs/heads/main.zip"
if "%NEOMA_DIR%"=="" set "NEOMA_DIR=neoma"

echo neoma - setup
echo =============

REM 1. Node.js must be present and recent enough (fail early, before downloading).
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js is not installed.
  echo     Install Node 20 or newer ^(LTS^) from https://nodejs.org/ and run this again.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
set "NODE_TRIM=%NODE_VER:v=%"
for /f "tokens=1 delims=." %%a in ("%NODE_TRIM%") do set "NODE_MAJOR=%%a"
if %NODE_MAJOR% LSS 20 (
  echo [X] Node %NODE_VER% found, but neoma needs Node 20 or newer.
  echo     Update from https://nodejs.org/ and run this again.
  pause
  exit /b 1
)
echo [OK] Node %NODE_VER%

REM 2. Fetch the project (skip if it's already here).
if exist "%NEOMA_DIR%\package.json" (
  echo [OK] Using existing copy in .\%NEOMA_DIR%
  goto :run
)

where git >nul 2>nul
if not errorlevel 1 (
  echo -^> Cloning neoma into .\%NEOMA_DIR% ...
  git clone --depth 1 "%REPO_URL%" "%NEOMA_DIR%"
  if errorlevel 1 ( echo [X] Clone failed. & pause & exit /b 1 )
  goto :run
)

echo -^> Downloading neoma into .\%NEOMA_DIR% ...
powershell -NoProfile -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile 'neoma.zip';" ^
  "Expand-Archive -Path 'neoma.zip' -DestinationPath '.' -Force;" ^
  "Get-ChildItem -Directory -Filter 'neoma-*' | Select-Object -First 1 | Rename-Item -NewName '%NEOMA_DIR%';" ^
  "Remove-Item 'neoma.zip'"
if errorlevel 1 (
  echo [X] Download failed. Install Git from https://git-scm.com and run this again.
  pause
  exit /b 1
)

:run
REM 3. Hand off to the project's own bootstrap (install + build + serve).
cd /d "%NEOMA_DIR%"
echo [OK] Project ready in %CD%
echo.
call start.bat
endlocal
