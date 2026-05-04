@echo off
title Publicar Dashboard no Vercel
color 0B
echo.
echo  ==========================================
echo    Dashboard Pessoal — Edson Barroso
echo    Publicando no Vercel (producao)...
echo  ==========================================
echo.
cd /d "%~dp0"

:: ── PRE-CHECK: lembra das variaveis de ambiente ──────────────
echo  LEMBRETE: As seguintes variaveis devem estar no Vercel:
echo.
echo    GOOGLE_CLIENT_ID      = (ver Vercel dashboard)
echo    GOOGLE_CLIENT_SECRET  = (ver Vercel dashboard)
echo    ANTHROPIC_API_KEY     = (ver Vercel dashboard)
echo    WEBHOOK_TOKEN         = (ver Vercel dashboard)
echo    META_APP_ID           = (ver Vercel dashboard)
echo    GA4_PROPERTY_ID       = (ver Vercel dashboard)
echo.
echo  Verifique em: https://vercel.com/edsonbarroso-7705s-projects/dashboard-pessoal-edson/settings/environment-variables
echo.
echo  ──────────────────────────────────────────
echo.

:: ── DEPLOY ───────────────────────────────────────────────────
where vercel >nul 2>nul
if %errorlevel% == 0 (
  echo  Usando Vercel CLI instalado...
  vercel --prod --yes
  if %errorlevel% neq 0 (
    echo.
    echo  ERRO: Falha na publicacao com Vercel CLI!
    echo  Codigo de saida: %errorlevel%
    pause
    exit /b %errorlevel%
  )
  goto fim
)

where npx >nul 2>nul
if %errorlevel% == 0 (
  echo  Usando npx vercel...
  npx vercel@latest --prod --yes
  if %errorlevel% neq 0 (
    echo.
    echo  ERRO: Falha na publicacao com npx vercel!
    echo  Codigo de saida: %errorlevel%
    pause
    exit /b %errorlevel%
  )
  goto fim
)

echo  ERRO: Vercel CLI nao encontrado!
echo.
echo  Instale com: npm install -g vercel
echo.
pause
exit /b 1

:fim
echo.
echo  ==========================================
echo    Publicacao concluida com sucesso!
echo  ==========================================
echo.
echo  URL: https://dashboard-pessoal-edson.vercel.app
echo.
echo  POS-DEPLOY (so na primeira vez apos este update):
echo    1. Google Cloud Console ^> OAuth 2.0 ^> Authorized redirect URIs:
echo       Adicione: https://dashboard-pessoal-edson.vercel.app/dashboard.html
echo    2. Abra o dashboard e clique em "Conectado" (Calendar widget)
echo    3. Autorize o acesso — refresh_token sera salvo no Supabase
echo    4. A partir dai o Google Calendar nunca mais pedira reconexao
echo.
pause
