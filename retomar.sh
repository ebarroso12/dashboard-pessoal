#!/bin/bash
# ══════════════════════════════════════════════════════════
# SCRIPT DE RETOMADA — Dashboard Dr. Edson Barroso
# Execute: bash retomar.sh
# ══════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   DASHBOARD DR. EDSON BARROSO — RETOMADA DE SESSÃO   ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# ── Info do projeto ──────────────────────────────────────
echo "📁 PROJETO LOCAL:"
echo "   C:\\Users\\e-bar\\OneDrive\\Documentos\\Claude\\Projects\\dashboardpessoal\\"
echo ""
echo "🌐 URLS:"
echo "   Dashboard: https://dashboard-pessoal-edson.vercel.app/"
echo "   Login:     https://dashboard-pessoal-edson.vercel.app/login.html"
echo "   GitHub:    https://github.com/ebarroso12/dashboard-pessoal"
echo ""

# ── Último backup ────────────────────────────────────────
BACKUP_DIR="$(dirname "$0")/backups"
ULTIMO=$(ls -1t "$BACKUP_DIR" 2>/dev/null | head -1)
echo "💾 ÚLTIMO BACKUP: $ULTIMO"
if [ -n "$ULTIMO" ]; then
  echo "   $(cat "$BACKUP_DIR/$ULTIMO/CONTEXTO_SESSAO.md" 2>/dev/null | grep "## O QUE FOI FEITO" -A 30 | head -25)"
fi
echo ""

# ── Status do git ────────────────────────────────────────
REPO="/c/Users/e-bar/AppData/Local/Temp/dashboard-pessoal"
if [ -d "$REPO/.git" ]; then
  echo "📦 GIT STATUS:"
  cd "$REPO"
  git log --oneline -5
  echo ""
  echo "   Branch atual: $(git branch --show-current)"
  echo "   Último commit: $(git log -1 --format='%ai — %s')"
else
  echo "⚠️  Repo git não encontrado em $REPO"
  echo "   Clone com: gh repo clone ebarroso12/dashboard-pessoal /c/Users/e-bar/AppData/Local/Temp/dashboard-pessoal"
fi
echo ""

# ── Pendências ───────────────────────────────────────────
echo "⚠️  PENDÊNCIAS CONHECIDAS:"
echo "   1. ANTHROPIC_API_KEY inválida no Vercel → Supervisor IA offline"
echo "      → Verificar/atualizar em: vercel.com → dashboard-pessoal → Settings → Env Vars"
echo "   2. Meta (Facebook) pega página errada"
echo "      → Limpar cache e reconectar: ver CONTEXTO_SESSAO.md"
echo "   3. Google Calendar / Analytics / GMB / YouTube → token expirado"
echo "      → Clicar 'Conectar Google' no dashboard"
echo ""
echo "📋 Contexto completo: $BACKUP_DIR/$ULTIMO/CONTEXTO_SESSAO.md"
echo ""
echo "══════════════════════════════════════════════════════════"
echo " Para continuar, cole o conteúdo de CONTEXTO_SESSAO.md   "
echo " no chat do Claude Code para ele lembrar onde paramos.   "
echo "══════════════════════════════════════════════════════════"
