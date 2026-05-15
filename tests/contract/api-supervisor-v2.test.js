/**
 * tests/contract/api-supervisor-v2.test.js
 *
 * TDD para Supervisor IA v2 — GPT-4.1-mini operacional.
 * Cobre: system prompt, classificacao de severidade, fluxo SCAN→RELATORIO,
 * timeout nas chamadas, botao exportar relatorio, UX badges.
 *
 * Run: node --test tests/contract/api-supervisor-v2.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');
const supervisor = readFileSync(path.join(__dirname, '../../api/supervisor.js'), 'utf8');

// ── Suite 1: System prompt operacional ───────────────────────────────────────

describe('api/supervisor.js — system prompt v2 operacional', () => {

  it('system prompt inclui classificacao de severidade', () => {
    assert.ok(
      supervisor.includes('CRÍTICO') || supervisor.includes('critico') || supervisor.includes('severidade'),
      'SYSTEM prompt sem classificacao de severidade (CRÍTICO/MÉDIO/AVISO/INFORMATIVO).'
    );
  });

  it('system prompt inclui fluxo SCAN → DIAGNÓSTICO → REPARO → RELATÓRIO', () => {
    assert.ok(
      (supervisor.includes('SCAN') || supervisor.includes('scan')) &&
      (supervisor.includes('DIAGNÓSTICO') || supervisor.includes('diagnostico') || supervisor.includes('diagn')),
      'SYSTEM prompt sem fluxo estruturado SCAN→DIAGNÓSTICO→REPARO→RELATÓRIO.'
    );
  });

  it('system prompt menciona categorias de erro especificas', () => {
    assert.ok(
      supervisor.includes('timeout') || supervisor.includes('token') || supervisor.includes('endpoint'),
      'SYSTEM prompt sem categorias de erro especificas (timeout, token, endpoint).'
    );
  });

  it('system prompt instrui a nunca fazer operacoes destrutivas', () => {
    assert.ok(
      supervisor.includes('SQL') || supervisor.includes('destrutiv') || supervisor.includes('deletar') || supervisor.includes('schema'),
      'SYSTEM prompt sem restricao a operacoes destrutivas.'
    );
  });

});

// ── Suite 2: Timeout na chamada OpenAI ────────────────────────────────────────

describe('api/supervisor.js — timeout na chamada OpenAI', () => {

  it('chamada OpenAI tem AbortSignal.timeout ou timeout configurado', () => {
    assert.ok(
      supervisor.includes('AbortSignal.timeout') || supervisor.includes('timeout:') || supervisor.includes('signal:'),
      'Chamada OpenAI sem timeout — supervisor pode travar em chamada pendente.'
    );
  });

  it('usa modelo gpt-4.1-mini', () => {
    assert.ok(supervisor.includes('gpt-4.1-mini'),
      'Supervisor nao usa gpt-4.1-mini.');
  });

});

// ── Suite 3: UX dashboard — botoes e badges ───────────────────────────────────

describe('dashboard.html — supervisor UX v2', () => {

  it('botao Exportar Relatorio existe no widget supervisor', () => {
    assert.ok(
      html.includes('exportarRelatorio') || html.includes('exportar-relatorio') || html.includes('Exportar Relatório'),
      'Botao "Exportar Relatório" ausente no widget Supervisor.'
    );
  });

  it('CSS para badge de severidade existe', () => {
    assert.ok(
      html.includes('sv-badge') || html.includes('sev-critico') || html.includes('severidade') ||
      html.includes('badge-critico') || html.includes('sv-severity'),
      'CSS de badges de severidade ausente no Supervisor.'
    );
  });

  it('botao Auto-Reparo existe com prompt adequado', () => {
    assert.ok(
      html.includes('Auto-Reparo') || html.includes('auto-reparo') || html.includes('autoReparo'),
      'Botao Auto-Reparo ausente no Supervisor.'
    );
  });

});

// ── Suite 4: Ferramenta verificar_saude_servicos com timeout ─────────────────

describe('api/supervisor.js — tool verificar_saude_servicos', () => {

  it('verificar_saude_servicos usa AbortSignal.timeout para pings', () => {
    const toolFn = supervisor.slice(
      supervisor.indexOf('async function tool_verificar_saude_servicos'),
      supervisor.indexOf('async function tool_registrar_incidente')
    );
    assert.ok(
      toolFn.includes('AbortSignal.timeout') || toolFn.includes('timeout('),
      'tool_verificar_saude_servicos sem timeout nos pings — pode travar.'
    );
  });

  it('verificar_saude_servicos checa OPENAI_API_KEY alem de ANTHROPIC', () => {
    assert.ok(
      supervisor.includes('OPENAI_API_KEY') || supervisor.includes('OPENAI_KEY'),
      'Health check nao verifica OPENAI_API_KEY — supervisor reporta falso positivo em env vars.'
    );
  });

});

// ── Suite 5: Seguranca — sem loops infinitos ──────────────────────────────────

describe('api/supervisor.js — seguranca operacional', () => {

  it('loop agente tem limite maximo de iteracoes (MAX_ITER)', () => {
    assert.ok(supervisor.includes('MAX_ITER'),
      'Loop do agente sem MAX_ITER — risco de loop infinito.');
  });

  it('nao executa SQL destrutivo nas ferramentas', () => {
    assert.ok(
      !supervisor.includes('DROP TABLE') && !supervisor.includes('DELETE FROM') && !supervisor.includes('TRUNCATE'),
      'Supervisor contem SQL destrutivo — risco de perda de dados.'
    );
  });

});
