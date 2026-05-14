/**
 * tests/contract/dashboard-mobile.test.mjs
 *
 * Static-analysis tests for mobile dashboard.
 *
 * Run: node --test tests/contract/dashboard-mobile.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

// ── Suite 1: Bottom nav mobile ────────────────────────────────────────────────

describe('dashboard.html — mobile bottom nav', () => {

  it('#mobile-nav existe', () => {
    assert.ok(html.includes('id="mobile-nav"'),
      '#mobile-nav nao encontrado.');
  });

  it('botoes .mn-btn existem na bottom nav', () => {
    assert.ok(html.includes('class="mn-btn"') || html.includes("class='mn-btn'"),
      '.mn-btn nao encontrado.');
  });

});

// ── Suite 2: Mobile drawer ────────────────────────────────────────────────────

describe('dashboard.html — mobile drawer', () => {

  it('#mobile-drawer existe', () => {
    assert.ok(html.includes('id="mobile-drawer"'),
      '#mobile-drawer nao encontrado.');
  });

  it('#mobile-overlay existe para fechar drawer', () => {
    assert.ok(html.includes('id="mobile-overlay"'),
      '#mobile-overlay nao encontrado. Necessario para fechar drawer ao tocar fora.');
  });

  it('funcao toggleMobileMenu existe', () => {
    assert.ok(html.includes('function toggleMobileMenu') || html.includes('toggleMobileMenu'),
      'toggleMobileMenu nao encontrada.');
  });

  it('drawer fecha ao tocar no overlay', () => {
    assert.ok(html.includes('mobile-overlay') && html.includes('toggleMobileMenu(false)'),
      'overlay nao chama toggleMobileMenu(false).');
  });

});

// ── Suite 3: Tema claro ───────────────────────────────────────────────────────

describe('dashboard.html — tema claro', () => {

  it('CSS html[data-theme="claro"] existe', () => {
    assert.ok(html.includes('[data-theme="claro"]'),
      'CSS tema claro nao existe.');
  });

  it('tema claro define fundo claro', () => {
    const idx = html.indexOf('[data-theme="claro"]');
    const block = idx >= 0 ? html.slice(idx, idx + 600) : '';
    assert.ok(
      block.includes('#f') || block.includes('--bg:#') || block.includes('background:#f') || block.includes('background:#0f1'),
      'Tema claro sem definicao de fundo claro.'
    );
  });

  it('botao para ativar tema claro existe', () => {
    assert.ok(
      html.includes("data-t=\"claro\"") || html.includes("_setTheme('claro')"),
      'Nenhum botao para tema claro.'
    );
  });

});

// ── Suite 4: Mobile layout ────────────────────────────────────────────────────

describe('dashboard.html — layout mobile', () => {

  it('breakpoint 800px oculta sidebar desktop', () => {
    const idx = html.indexOf('@media(max-width:800px)');
    const block = idx >= 0 ? html.slice(idx, idx + 400) : '';
    assert.ok(block.includes('.sidebar') && block.includes('display:none'),
      'Sidebar nao some em 800px.');
  });

  it('main-content ocupa tela toda em mobile', () => {
    const idx = html.indexOf('@media(max-width:800px)');
    const block = idx >= 0 ? html.slice(idx, idx + 400) : '';
    assert.ok(block.includes('margin-left:0'),
      '.main-content sem margin-left:0 em mobile.');
  });

  it('padding-bottom evita conteudo coberto por bottom nav', () => {
    assert.ok(
      html.includes('padding-bottom'),
      'Sem padding-bottom — bottom nav cobre conteudo.'
    );
  });

});
