/**
 * tests/contract/dashboard-openclaw-widget.test.mjs
 *
 * Static-analysis tests for the OpenClaw widget in dashboard.html.
 * Verifies absence of known critical issues without a browser.
 *
 * Run: node --test tests/contract/dashboard-openclaw-widget.test.mjs
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

describe('dashboard.html — widget OpenClaw: conteudo estatico fake', () => {

  it('nao deve conter cards hardcoded "Teste de conexao OpenClaw" no #oc-feed', () => {
    // O feed deve arrancar vazio. Cards estaticos enganam o usuario sobre
    // comandos reais recebidos.
    const hasFakeCard = html.includes('Teste de conexão OpenClaw');
    assert.equal(
      hasFakeCard,
      false,
      'dashboard.html contem cards estaticos fake no #oc-feed. Remova-os.'
    );
  });

  it('contador inicial deve mostrar 0 comandos, nao 1', () => {
    // "1 comando recebido" hardcoded no HTML induz leitura errada quando
    // o Supabase esta vazio.
    const hasWrongCount = html.includes('1 comando recebido');
    assert.equal(
      hasWrongCount,
      false,
      'Contador inicial esta hardcoded como "1 comando recebido". Deve ser "0 comandos recebidos".'
    );
  });

});

describe('dashboard.html — widget OpenClaw: erro silencioso no polling', () => {

  it('ocPoll nao pode ter catch silencioso sem chamar ocSetStatus', () => {
    // Catch vazio impede diagnostico de falha do Supabase ou rede.
    // O catch deve chamar ocSetStatus(false) para sinalizar falha ao usuario.
    const hasSilentCatch = html.includes('/* servidor local offline — silencia */');
    assert.equal(
      hasSilentCatch,
      false,
      'ocPoll tem catch silencioso. O catch deve chamar ocSetStatus(false).'
    );
  });

});

describe('dashboard.html — widget OpenClaw: token exposto publicamente', () => {

  it('oc_edson_2026_secure nao deve aparecer no HTML publico', () => {
    // Token de webhook exposto no source permite que qualquer pessoa
    // injete comandos autenticados via /api/webhook.
    const tokenCount = (html.match(/oc_edson_2026_secure/g) || []).length;
    assert.equal(
      tokenCount,
      0,
      `Token "oc_edson_2026_secure" aparece ${tokenCount} vez(es) no HTML publico. Remova todas as ocorrencias.`
    );
  });

});
