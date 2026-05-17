@echo off
setlocal

set "APP_PORT=5188"
set "ACGN_ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port=[int]$env:APP_PORT; $root=(Resolve-Path -LiteralPath $env:ACGN_ROOT).Path.TrimEnd([char]92).ToLowerInvariant(); $conn=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if(!$conn){exit 0}; $proc=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $conn.OwningProcess); $cmd=($proc.CommandLine + '').ToLowerInvariant(); if($cmd.Contains($root) -or $cmd -match 'vite'){exit 10}; exit 11"
set "PORT_STATUS=%ERRORLEVEL%"

if "%PORT_STATUS%"=="10" (
  call "%~dp0stop-dev.bat"
  exit /b %ERRORLEVEL%
)

if "%PORT_STATUS%"=="11" (
  echo Port %APP_PORT% is used by another process. The project was not started or stopped.
  pause
  exit /b 1
)

call "%~dp0start-dev.bat"
exit /b %ERRORLEVEL%
