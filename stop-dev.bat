@echo off
setlocal

set "APP_NAME=My ACGN Journey"
set "APP_PORT=5188"
set "ACGN_ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port=[int]$env:APP_PORT; $root=(Resolve-Path -LiteralPath $env:ACGN_ROOT).Path.TrimEnd([char]92).ToLowerInvariant(); $conns=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if(!$conns){Write-Host ($env:APP_NAME + ' is not running on port ' + $port + '.'); exit 0}; $stopped=0; foreach($id in $conns){ $proc=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $id); $cmd=($proc.CommandLine + '').ToLowerInvariant(); if($cmd.Contains($root) -or $cmd -match 'vite'){ Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped PID ' + $id + '.'); $stopped++ } else { Write-Warning ('Port ' + $port + ' is used by PID ' + $id + ', but it does not look like this project.'); Write-Warning $proc.CommandLine } }; if($stopped -eq 0){exit 1}; exit 0"

if errorlevel 1 (
  echo Nothing was stopped. Check whether another app is using port %APP_PORT%.
  pause
  exit /b 1
)

exit /b 0
