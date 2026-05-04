#!/bin/bash
echo ""
echo "  =========================================="
echo "    Dashboard Pessoal - Edson Barroso"
echo "  =========================================="
echo ""

if ! command -v node &> /dev/null; then
  echo "  ERRO: Node.js não encontrado!"
  echo "  Instale em: https://nodejs.org"
  exit 1
fi

cd "$(dirname "$0")"
echo "  Iniciando servidor..."
node server.js
