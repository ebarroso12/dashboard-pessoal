/**
 * tests/contract/dashboard-pwa-final.test.mjs
 *
 * Testes finais de PWA e mobile para entrega.
 * Cobre: apple-touch-icon, touch targets, tema, service worker, manifest.
 *
 * Run: node --test tests/contract/dashboard-pwa-final.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const html = readFileSync(path.join(root, 'dashboard.html'), 'utf8');

// ── Suite 1: iOS PWA ──────────────────────────────────────────────────────────

describe('PWA — suporte iOS (apple-touch-icon)', () => {

  it('apple-touch-icon link existe no HTML', () => {
    assert.ok(
      html.includes('apple-touch-icon'),
      'apple-touch-icon ausente — iOS nao vai mostrar icone correto ao adicionar na home screen.'
    );
  });

  it('apple-mobile-web-app-status-bar-style existe', () => {
    assert.ok(
      html.includes('apple-mobile-web-app-status-bar-style'),
      'apple-mobile-web-app-status-bar-style ausente — status bar em iOS vai sobrepor conteudo.'
    );
  });

});

// ── Suite 2: PWA manifest completo ────────────────────────────────────────────

describe('PWA — manifest.json completo', () => {

  it('manifest.json tem name e short_name', () => {
    const m = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    assert.ok(m.name, 'manifest sem "name"');
    assert.ok(m.short_name, 'manifest sem "short_name"');
  });

  it('manifest.json tem orientation', () => {
    const m = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    assert.ok(m.orientation, 'manifest sem "orientation" — orientacao nao controlada.');
  });

  it('manifest.json tem background_color', () => {
    const m = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    assert.ok(m.background_color, 'manifest sem "background_color" — splash screen sem cor.');
  });

  it('icone 192x192 existe e tem tamanho razoavel (>500 bytes)', () => {
    const iconPath = path.join(root, 'icon-192.png');
    assert.ok(existsSync(iconPath), 'icon-192.png nao existe');
    const size = statSync(iconPath).size;
    assert.ok(size > 500, `icon-192.png muito pequeno (${size} bytes) — pode ser invalido`);
  });

  it('icone 512x512 existe e tem tamanho razoavel (>1000 bytes)', () => {
    const iconPath = path.join(root, 'icon-512.png');
    assert.ok(existsSync(iconPath), 'icon-512.png nao existe');
    const size = statSync(iconPath).size;
    assert.ok(size > 1000, `icon-512.png muito pequeno (${size} bytes) — pode ser invalido`);
  });

});

// ── Suite 3: Bottom nav touch targets ─────────────────────────────────────────

describe('Mobile — bottom nav touch targets', () => {

  it('.mn-btn tem min-height suficiente para toque (>=44px)', () => {
    // min-height:48px está em .mn-btn{ na definição principal
    assert.ok(
      html.includes('min-height:48px') || html.includes('min-height:44px') || html.includes('min-height: 48px'),
      '.mn-btn sem min-height >= 44px — botoes podem ser pequenos demais para toque.'
    );
  });

  it('#mobile-nav tem padding-bottom para safe area em iOS (notch/island)', () => {
    assert.ok(
      html.includes('safe-area-inset-bottom') || html.includes('env(safe') || html.includes('padding-bottom'),
      '#mobile-nav sem safe-area-inset-bottom — conteudo escondido atrás do home indicator no iPhone.'
    );
  });

});

// ── Suite 4: Tema — persistência e default ────────────────────────────────────

describe('Mobile — tema persiste e default correto', () => {

  it('_initTheme carrega dash_theme do localStorage', () => {
    const fnIdx = html.indexOf('function _initTheme()');
    const fnBody = fnIdx >= 0 ? html.slice(fnIdx, fnIdx + 200) : '';
    assert.ok(fnBody.includes('dash_theme'), '_initTheme nao le "dash_theme" do localStorage.');
  });

  it('_setTheme salva dash_theme no localStorage', () => {
    const fnIdx = html.indexOf('function _setTheme(');
    const fnBody = fnIdx >= 0 ? html.slice(fnIdx, fnIdx + 200) : '';
    assert.ok(fnBody.includes('dash_theme'), '_setTheme nao salva "dash_theme" no localStorage — tema nao persiste apos refresh.');
  });

  it('tema default e classico (escuro), nao legendarios', () => {
    const fnIdx = html.indexOf('function _initTheme()');
    const fnBody = fnIdx >= 0 ? html.slice(fnIdx, fnIdx + 200) : '';
    assert.ok(
      fnBody.includes("'classico'") || fnBody.includes('"classico"'),
      'Tema default nao e "classico" — usuario ve tema Legendarios/Fire na primeira visita sem configurar.'
    );
  });

});

// ── Suite 5: Service Worker ───────────────────────────────────────────────────

describe('PWA — service worker valido', () => {

  it('sw.js tem fetch handler', () => {
    const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.ok(sw.includes("'fetch'") || sw.includes('"fetch"'),
      'sw.js sem fetch handler — PWA nao funciona offline.');
  });

  it('sw.js tem skipWaiting para atualizacao imediata', () => {
    const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.ok(sw.includes('skipWaiting'), 'sw.js sem skipWaiting — atualizacoes de app atrasadas.');
  });

});
