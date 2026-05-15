/**
 * tests/contract/dashboard-mobile-pwa.test.mjs
 *
 * Testa correções mobile (cards overflow) e requisitos PWA.
 *
 * Run: node --test tests/contract/dashboard-mobile-pwa.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const html = readFileSync(path.join(root, 'dashboard.html'), 'utf8');

function getMobileBlock() {
  const idx = html.indexOf('@media(max-width:800px)');
  return idx >= 0 ? html.slice(idx, idx + 800) : '';
}
const mob = getMobileBlock();

// ── Suite 1: Correção de cards com grid-column inline ─────────────────────────

describe('dashboard.html — mobile: cards com grid-column inline', () => {

  it('CSS mobile reset de [style*="grid-column"] existe', () => {
    assert.ok(
      mob.includes('[style*="grid-column"]') || mob.includes("style*='grid-column'"),
      'Sem reset CSS para [style*="grid-column"] — cards com span inline vao estourar em mobile.'
    );
  });

  it('CSS mobile reset de [style*="grid-row"] existe', () => {
    assert.ok(
      mob.includes('[style*="grid-row"]') || mob.includes("style*='grid-row'"),
      'Sem reset CSS para [style*="grid-row"] — cards com row span vao quebrar layout.'
    );
  });

  it('.goals-grid tem 1 coluna em mobile', () => {
    assert.ok(mob.includes('.goals-grid'),
      '.goals-grid sem override em mobile — goals aparecem em 3 colunas no celular.');
  });

  it('.card-foot-row tem flex-wrap em mobile', () => {
    assert.ok(mob.includes('flex-wrap'),
      '.card-foot-row sem flex-wrap — botoes vao transbordar em telas estreitas.');
  });

  it('img e canvas tem max-width:100% em mobile', () => {
    assert.ok(mob.includes('img') && mob.includes('max-width:100%'),
      'img/canvas sem max-width:100% — imagens vao estourar width do card.');
  });

});

// ── Suite 2: PWA — manifest ───────────────────────────────────────────────────

describe('PWA — manifest.json', () => {

  it('manifest.json existe na raiz do projeto', () => {
    assert.ok(
      existsSync(path.join(root, 'manifest.json')) || existsSync(path.join(root, 'public/manifest.json')),
      'manifest.json nao encontrado. Chrome nao vai oferecer "Instalar app".'
    );
  });

  it('manifest.json tem campo display:standalone', () => {
    const mPath = existsSync(path.join(root, 'manifest.json'))
      ? path.join(root, 'manifest.json')
      : path.join(root, 'public/manifest.json');
    if (!existsSync(mPath)) { assert.fail('manifest.json nao existe'); return; }
    const m = readFileSync(mPath, 'utf8');
    assert.ok(m.includes('standalone'), 'manifest sem display:standalone — nao instala como app.');
  });

  it('manifest.json tem start_url', () => {
    const mPath = existsSync(path.join(root, 'manifest.json'))
      ? path.join(root, 'manifest.json')
      : path.join(root, 'public/manifest.json');
    if (!existsSync(mPath)) { assert.fail('manifest.json nao existe'); return; }
    const m = readFileSync(mPath, 'utf8');
    assert.ok(m.includes('start_url'), 'manifest sem start_url.');
  });

  it('manifest.json tem icons com 192 e 512', () => {
    const mPath = existsSync(path.join(root, 'manifest.json'))
      ? path.join(root, 'manifest.json')
      : path.join(root, 'public/manifest.json');
    if (!existsSync(mPath)) { assert.fail('manifest.json nao existe'); return; }
    const m = readFileSync(mPath, 'utf8');
    assert.ok(m.includes('192') && m.includes('512'), 'manifest sem icones 192 e 512.');
  });

});

// ── Suite 3: PWA — HTML meta tags ─────────────────────────────────────────────

describe('PWA — HTML meta tags', () => {

  it('<link rel="manifest"> existe no HTML', () => {
    assert.ok(html.includes('rel="manifest"'),
      'Link para manifest.json ausente no HTML.');
  });

  it('<meta name="theme-color"> existe no HTML', () => {
    assert.ok(html.includes('theme-color'),
      'meta theme-color ausente — Chrome usa para colorir barra do app.');
  });

  it('<meta name="mobile-web-app-capable"> ou "apple-mobile-web-app-capable" existe', () => {
    assert.ok(
      html.includes('mobile-web-app-capable') || html.includes('apple-mobile-web-app-capable'),
      'meta mobile-web-app-capable ausente — necessario para iOS/Android.');
  });

});

// ── Suite 4: PWA — Service Worker ─────────────────────────────────────────────

describe('PWA — service worker', () => {

  it('sw.js existe na raiz', () => {
    assert.ok(existsSync(path.join(root, 'sw.js')),
      'sw.js nao encontrado — necessario para PWA instalavel.');
  });

  it('HTML registra service worker', () => {
    assert.ok(
      html.includes('serviceWorker') && html.includes('sw.js'),
      'HTML nao registra service worker — PWA nao vai funcionar.'
    );
  });

});
