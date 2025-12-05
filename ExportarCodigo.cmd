@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$root=(Get-Location).Path;" ^
  "$exclude='(\\node_modules\\|\\android\\|\\ios\\|\\\.git\\|\\dist\\|\\build\\|\\coverage\\|\\\.expo\\)';" ^
  "Get-ChildItem -Recurse -File |" ^
  "  Where-Object { $_.Extension -in '.ts','.tsx' -and $_.FullName -notmatch $exclude -and $_.Name -notmatch '\.d\.ts$' } |" ^
  "  Sort-Object FullName |" ^
  "  ForEach-Object { $rel=$_.FullName.Substring($root.Length+1); ''; '/* ===== FILE: '+$rel+' ===== */'; ''; Get-Content -LiteralPath $_.FullName -Raw } |" ^
  "  Set-Content -Path .\all_code.txt -Encoding utf8 -Force"

if errorlevel 1 (
  echo ERRO ao gerar all_code.txt
  pause
) else (
  start "" notepad.exe .\all_code.txt
)
