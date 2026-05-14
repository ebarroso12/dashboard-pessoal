/**
 * tests/contract/dashboard-mobile.test.mjs
 *
 * Static-analysis tests for mobile dashboard improvements.
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

// ── Suite 1: Mobile FAB ───────────────────────────────────────────────────────

describe('dashboard.html — mobile FAB: botao flutuante', () => {

  it('elemento #mobFab existe no HTML', () => {
    assert.ok(html.includes('id="mobFab"') || html.includes("id='mobFab'"),
      'Botao flutuante #mobFab nao encontrado. Adicionar <button id="mobFab">.');
  });

  it('.mob-fab tem position:fixed no CSS', () => {
    assert.ok(html.includes('mob-fab') && html.includes('position:fixed'),
      '.mob-fab sem position:fixed — botao nao vai flutuar.');
  });

  it('.mob-fab visivel apenas em mobile (display:none por padrao, display:flex no breakpoint)', () => {
    assert.ok(html.includes('.mob-fab{display:none') || html.includes('.mob-fab {display:none'),
      '.mob-fab deve estar oculto por padrao e visivel apenas em <=800px.');
  });

});

// ── Suite 2: Mobile Drawer ────────────────────────────────────────────────────

describe('dashboard.html — mobile drawer: gaveta de navegacao', () => {

  it('elemento #mobDrawer existe', () => {
    assert.ok(html.includes('id="mobDrawer"') || html.includes("id='mobDrawer'"),
      '#mobDrawer nao encontrado. Adicionar drawer mobile.');
  });

  it('elemento #mobOverlay existe', () => {
    assert.ok(html.includes('id="mobOverlay"') || html.includes("id='mobOverlay'"),
      '#mobOverlay nao encontrado. Necessario para fechar drawer ao tocar fora.');
  });

  it('.mob-drawer tem transform:translateX para animacao', () => {
    assert.ok(html.includes('translateX'),
      '.mob-drawer sem transform:translateX — sem animacao de entrada.');
  });

});

// ── Suite 3: JS mobile ────────────────────────────────────────────────────────

describe('dashboard.html — JS mobile: funcoes de menu', () => {

  it('funcao openMobDrawer existe', () => {
    assert.ok(html.includes('function openMobDrawer'),
      'funcao openMobDrawer nao encontrada.');
  });

  it('funcao closeMobDrawer existe', () => {
    assert.ok(html.includes('function closeMobDrawer'),
      'funcao closeMobDrawer nao encontrada.');
  });

  it('closeMobDrawer chamado ao clicar no overlay', () => {
    assert.ok(html.includes('mobOverlay') && html.includes('closeMobDrawer'),
      'overlay nao esta conectado ao closeMobDrawer.');
  });

});

// ── Suite 4: Tema claro ───────────────────────────────────────────────────────

describe('dashboard.html — tema claro: CSS variaveis', () => {

  it('css html[data-theme="claro"] existe', () => {
    assert.ok(html.includes('[data-theme="claro"]') || html.includes("[data-theme='claro']"),
      'CSS para tema claro nao existe. Adicionar html[data-theme="claro"] com variaveis.');
  });

  it('tema claro define fundo claro (--bg com valor claro)', () => {
    const claroIdx = html.indexOf('[data-theme="claro"]');
    const claroBlock = claroIdx >= 0 ? html.slice(claroIdx, claroIdx + 500) : '';
    assert.ok(
      claroBlock.includes('#f1f5f9') || claroBlock.includes('#f8fafc') || claroBlock.includes('#ffffff') || claroBlock.includes('--bg:#f'),
      'Tema claro nao define cor de fundo clara (--bg).'
    );
  });

  it('botao de tema claro existe na theme-bar ou mob-theme-bar', () => {
    assert.ok(
      html.includes("data-t=\"claro\"") || html.includes("data-mt=\"claro\"") ||
      html.includes("_setTheme('claro')"),
      'Nenhum botao para ativar tema claro.'
    );
  });

});

// ── Suite 5: Mobile layout ────────────────────────────────────────────────────

describe('dashboard.html — mobile layout: breakpoint 800px', () => {

  it('padding-bottom no .main-content em mobile para nao cobrir FAB', () => {
    const mobileIdx = html.indexOf('@media(max-width:800px)');
    const mobileBlock = mobileIdx >= 0 ? html.slice(mobileIdx, mobileIdx + 300) : '';
    assert.ok(
      mobileBlock.includes('padding-bottom') || html.indexOf('padding-bottom', mobileIdx) < mobileIdx + 600,
      '.main-content sem padding-bottom em mobile — FAB vai cobrir conteudo.'
    );
  });

});
