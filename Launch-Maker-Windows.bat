@echo off
setlocal
cd /d "%~dp0"
title Maker Studio - Local Server

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found on PATH.
    echo Please install Node.js 22 LTS from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

if not exist "node_modules\tsx" (
    echo First-time setup: installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo Retrying install with --legacy-peer-deps...
        call npm install --legacy-peer-deps
        if errorlevel 1 (
            echo.
            echo Dependency installation failed.
            pause
            exit /b 1
        )
    )
)

set "OPEN_APP_CMD=$u='http://localhost:3000'; $cands=@((Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),(Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),(Join-Path $env:LocalAppData 'Google\Chrome\Application\chrome.exe'),(Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),(Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')); $b=$cands|Where-Object{$_ -and (Test-Path $_)}|Select-Object -First 1; if($b){Start-Process $b -ArgumentList ('--app='+$u),'--start-maximized'}else{Start-Process $u}"

powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
    echo Maker Studio is already running at http://localhost:3000. Opening standalone app window...
    powershell -NoProfile -Command "%OPEN_APP_CMD%"
    exit /b 0
)

echo Starting Maker Studio on http://localhost:3000 ...
echo Keep this window open while using the app. Close it to stop the server.
echo.

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 60; $i++) { try { Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 1 | Out-Null; %OPEN_APP_CMD%; break } catch { Start-Sleep -Milliseconds 500 } }"

call npm run dev
if errorlevel 1 (
    echo.
    echo Maker Studio server exited with an error.
    pause
)
