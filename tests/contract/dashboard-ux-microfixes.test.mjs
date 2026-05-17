/**
 * tests/contract/dashboard-ux-microfixes.test.mjs
 *
 * Static-analysis tests for FASE MICRO-ATRITOS UX fixes.
 * Covers: loading timeout, empty states, touch targets, morning-sub.
 *
 * Run: node --test tests/contract/dashboard-ux-microfixes.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

// ── Suite 1: Loading timeout guard ───────────────────────────────────────────

describe('dashboard.html — loading timeout guard', () => {

  it('texto fallback "Indisponível no momento" deve existir no script', () => {
    assert.ok(
      html.includes('Indisponível no momento'),
      'Fallback "Indisponível no momento" não encontrado — widgets sem conexão ficam presos em "Carregando..." indefinidamente.'
    );
  });

  it('loading guard deve monitorar ig-reach', () => {
    const guardIdx = html.indexOf('Indisponível no momento');
    assert.ok(guardIdx >= 0, 'Fallback não encontrado');
    const context = html.slice(Math.max(0, guardIdx - 600), guardIdx + 200);
    assert.ok(
      context.includes('ig-reach'),
      'ig-reach não incluído no loading guard — permanece "Carregando..." quando Instagram não conectado.'
    );
  });

  it('loading guard deve monitorar ga-sessions', () => {
    const guardIdx = html.indexOf('Indisponível no momento');
    assert.ok(guardIdx >= 0, 'Fallback não encontrado');
    const context = html.slice(Math.max(0, guardIdx - 600), guardIdx + 200);
    assert.ok(
      context.includes('ga-sessions'),
      'ga-sessions não incluído no loading guard — permanece "Carregando..." quando GA não conectado.'
    );
  });

  it('loading guard deve usar setTimeout de 10000ms', () => {
    const guardIdx = html.indexOf('Indisponível no momento');
    assert.ok(guardIdx >= 0, 'Fallback não encontrado');
    const context = html.slice(Math.max(0, guardIdx - 600), guardIdx + 50);
    assert.ok(
      context.includes('10000'),
      'Loading guard sem setTimeout(fn, 10000) — timeout pode ser diferente do padrão acordado de 10s.'
    );
  });

});

// ── Suite 2: Estados vazios padronizados ─────────────────────────────────────

describe('dashboard.html — estados vazios padronizados', () => {

  it('setWidgetState default empty deve ser "Nenhum dado disponível" e nao "Sem dados"', () => {
    assert.ok(
      !html.includes("empty:'Sem dados'"),
      'setWidgetState ainda usa "Sem dados" como padrão — padronizar para "Nenhum dado disponível".'
    );
  });

  it('setWidgetState default empty deve conter "Nenhum dado dispon"', () => {
    assert.ok(
      html.includes('Nenhum dado dispon'),
      'setWidgetState não usa "Nenhum dado disponível" como padrão — widgets vazios sem conexão mostram mensagem vaga.'
    );
  });

  it('drive-list empty deve ter mensagem específica, nao usar default', () => {
    assert.ok(
      html.includes("'drive-list', 'empty', '"),
      'drive-list empty sem mensagem específica — mostra padrão genérico em vez de contexto útil.'
    );
  });

});

// ── Suite 3: morning-sub initial text ────────────────────────────────────────

describe('dashboard.html — morning-sub nao deve inicializar como loading', () => {

  it('morning-sub nao deve conter "Carregando briefing do dia..."', () => {
    assert.ok(
      !html.includes('id="morning-sub">Carregando briefing do dia...'),
      'morning-sub inicia com "Carregando briefing do dia..." — subtítulo exibe loading quando nada está carregando (widget acionado manualmente).'
    );
  });

});

// ── Suite 4: Touch targets ≥ 44px ────────────────────────────────────────────

describe('dashboard.html — touch targets minimos', () => {

  it('.sb-link deve ter min-height de ao menos 44px', () => {
    const sbLinkStart = html.indexOf('.sb-link{');
    const sbLinkBlock = sbLinkStart >= 0 ? html.slice(sbLinkStart, sbLinkStart + 500) : '';
    assert.ok(sbLinkBlock.length > 0, '.sb-link nao encontrado no CSS');
    assert.ok(
      sbLinkBlock.includes('min-height:44px') || sbLinkBlock.includes('min-height: 44px'),
      '.sb-link sem min-height:44px — links da sidebar abaixo do tamanho mínimo de toque em mobile.'
    );
  });

  it('.drawer-close deve ter min-height de ao menos 44px', () => {
    // A definição principal tem width: e height: — buscar pelo bloco que contém esses atributos
    const mainDefIdx = html.indexOf('\n.drawer-close{');
    const block = mainDefIdx >= 0 ? html.slice(mainDefIdx, mainDefIdx + 200) : '';
    assert.ok(block.length > 0, '.drawer-close definição principal nao encontrada no CSS');
    assert.ok(
      block.includes('44px') && (block.includes('height:44px') || block.includes('min-height:44px')),
      '.drawer-close com 36px — botão fechar drawer abaixo de 44px mínimo para toque.'
    );
  });

  it('.crm-close deve ter height de ao menos 44px', () => {
    const idx = html.indexOf('.crm-close{');
    const block = idx >= 0 ? html.slice(idx, idx + 150) : '';
    assert.ok(block.length > 0, '.crm-close nao encontrado no CSS');
    assert.ok(
      block.includes('44px'),
      '.crm-close com 30px — botão fechar modal CRM abaixo de 44px mínimo para toque.'
    );
  });

});

// ── Suite 5: crm-mini-sub nao persistente ────────────────────────────────────

describe('dashboard.html — crm-mini-sub nao persiste em loading', () => {

  it('crm-mini-sub deve estar no loading guard OU crmUpdateMiniStats chamado no DOMContentLoaded', () => {
    const guardIdx = html.indexOf('Indisponível no momento');
    const context = guardIdx >= 0 ? html.slice(Math.max(0, guardIdx - 600), guardIdx + 200) : '';
    const inGuard = context.includes('crm-mini-sub');

    const domLoadIdx = html.indexOf("'DOMContentLoaded'") >= 0
      ? html.indexOf("'DOMContentLoaded'")
      : html.indexOf('"DOMContentLoaded"');
    const domBlock = domLoadIdx >= 0 ? html.slice(domLoadIdx, domLoadIdx + 400) : '';
    const inDomLoad = domBlock.includes('crmUpdateMiniStats');

    assert.ok(
      inGuard || inDomLoad,
      'crm-mini-sub persiste "Carregando..." indefinidamente — não está no loading guard nem é atualizado no DOMContentLoaded.'
    );
  });

});
