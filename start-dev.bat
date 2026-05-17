@echo off
setlocal

set "APP_NAME=My ACGN Journey"
set "APP_PORT=5188"
set "APP_URL=http://127.0.0.1:%APP_PORT%"
set "ACGN_ROOT=%~dp0"

cd /d "%ACGN_ROOT%" || (
  echo Failed to enter project folder.
  pause
  exit /b 1
)

where node >nul 2>nul || (
  echo Node.js was not found. Please install Node.js first:
  echo https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul || (
  echo npm was not found. Please reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

if not exist "%ACGN_ROOT%package.json" (
  echo package.json was not found in:
  echo %ACGN_ROOT%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port=[int]$env:APP_PORT; $root=(Resolve-Path -LiteralPath $env:ACGN_ROOT).Path.TrimEnd([char]92).ToLowerInvariant(); $conn=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if(!$conn){exit 0}; $proc=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $conn.OwningProcess); $cmd=($proc.CommandLine + '').ToLowerInvariant(); if($cmd.Contains($root) -or $cmd -match 'vite'){exit 10}; Write-Host ('Port ' + $port + ' is already used by PID ' + $conn.OwningProcess + '.'); Write-Host $proc.CommandLine; exit 11"
set "PORT_STATUS=%ERRORLEVEL%"

if "%PORT_STATUS%"=="10" (
  echo %APP_NAME% is already running at %APP_URL%
  start "" "%APP_URL%"
  exit /b 0
)

if "%PORT_STATUS%"=="11" (
  echo Please free port %APP_PORT% or change the Vite port in package.json and vite.config.js.
  pause
  exit /b 1
)

if not exist "%ACGN_ROOT%node_modules\" (
  echo Installing dependencies...
  npm install || (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting %APP_NAME%...
start "%APP_NAME% Dev Server" /D "%ACGN_ROOT%" cmd /c npm run dev

echo Waiting for %APP_URL% ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url=$env:APP_URL; for($i=0; $i -lt 40; $i++){ try { Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 1 | Out-Null; exit 0 } catch { Start-Sleep -Milliseconds 500 } }; exit 1"

if errorlevel 1 (
  echo The dev server is starting in a separate window. Open this URL when it is ready:
  echo %APP_URL%
  pause
  exit /b 0
)

start "" "%APP_URL%"
exit /b 0
