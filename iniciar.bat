@echo off
title Dashboard Pessoal - Edson
color 0A
echo.
echo  ==========================================
echo    Dashboard Pessoal - Edson Barroso
echo  ==========================================
echo.

:: Verifica se Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo  ERRO: Node.js nao encontrado!
  echo.
  echo  Instale em: https://nodejs.org
  echo  Baixe a versao LTS e instale.
  echo.
  pause
  start https://nodejs.org
  exit /b 1
)

echo  Node.js encontrado!
echo  Iniciando servidor...
echo.

:: Vai para a pasta do script
cd /d "%~dp0"

:: Inicia o servidor
node server.js

pause
