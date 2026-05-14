/**
 * tests/contract/dashboard-fake-metrics.test.mjs
 *
 * Verifica que widgets de redes sociais nao exibem metricas hardcoded fake
 * quando OAuth nao esta conectado. Cada KPI deve mostrar "--" ou string vazia.
 *
 * Run: node --test tests/contract/dashboard-fake-metrics.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

function hasIdWithValue(id, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`id="${id}"[^>]*>${escaped}<`).test(html);
}

// ── Suite: Instagram ──────────────────────────────────────────────────────────

describe('dashboard.html — Instagram: sem metricas fake', () => {

  it('#ig-followers nao exibe 15.5K hardcoded', () => {
    assert.equal(hasIdWithValue('ig-followers', '15.5K'), false,
      '#ig-followers ainda mostra "15.5K" fake — substituir por "--"');
  });

  it('#ig-engage nao exibe 9.2% hardcoded', () => {
    assert.equal(hasIdWithValue('ig-engage', '9.2%'), false,
      '#ig-engage ainda mostra "9.2%" fake — substituir por "--"');
  });

  it('#ig-followers-d nao exibe "+258 esta semana" hardcoded', () => {
    assert.ok(!html.includes('+258 esta semana'),
      '#ig-followers-d ainda mostra "+258 esta semana" fake');
  });

});

// ── Suite: Facebook ───────────────────────────────────────────────────────────

describe('dashboard.html — Facebook: sem metricas fake', () => {

  it('#fb-likes nao exibe 5.4K hardcoded', () => {
    assert.equal(hasIdWithValue('fb-likes', '5.4K'), false,
      '#fb-likes ainda mostra "5.4K" fake — substituir por "--"');
  });

  it('#fb-posts nao exibe 24 hardcoded', () => {
    assert.equal(hasIdWithValue('fb-posts', '24'), false,
      '#fb-posts ainda mostra "24" fake — substituir por "--"');
  });

  it('#fb-engage nao exibe 4.8% hardcoded', () => {
    assert.equal(hasIdWithValue('fb-engage', '4.8%'), false,
      '#fb-engage ainda mostra "4.8%" fake — substituir por "--"');
  });

});

// ── Suite: Google Meu Negocio ─────────────────────────────────────────────────

describe('dashboard.html — GMB: sem metricas fake', () => {

  it('#gmb-views nao exibe 1.2K hardcoded', () => {
    assert.equal(hasIdWithValue('gmb-views', '1.2K'), false,
      '#gmb-views ainda mostra "1.2K" fake — substituir por "--"');
  });

  it('#gmb-clicks nao exibe 471 hardcoded', () => {
    assert.equal(hasIdWithValue('gmb-clicks', '471'), false,
      '#gmb-clicks ainda mostra "471" fake — substituir por "--"');
  });

  it('#gmb-searches nao exibe 2.3K hardcoded', () => {
    assert.equal(hasIdWithValue('gmb-searches', '2.3K'), false,
      '#gmb-searches ainda mostra "2.3K" fake — substituir por "--"');
  });

  it('#gmb-rating nao exibe 4.5 ★ hardcoded', () => {
    assert.equal(hasIdWithValue('gmb-rating', '4.5 ★'), false,
      '#gmb-rating ainda mostra "4.5 ★" fake — substituir por "--"');
  });

  it('barras de origem GMB nao exibem percentuais fake', () => {
    assert.ok(!html.includes('>65%<'),
      'Barra "Pesquisa direta" ainda mostra "65%" fake');
  });

});

// ── Suite: YouTube ────────────────────────────────────────────────────────────

describe('dashboard.html — YouTube: sem metricas fake', () => {

  it('#yt-subs nao exibe 390 hardcoded', () => {
    assert.equal(hasIdWithValue('yt-subs', '390'), false,
      '#yt-subs ainda mostra "390" fake — substituir por "--"');
  });

  it('#yt-views nao exibe 165 hardcoded', () => {
    assert.equal(hasIdWithValue('yt-views', '165'), false,
      '#yt-views ainda mostra "165" fake — substituir por "--"');
  });

  it('#yt-watch nao exibe 4 hardcoded', () => {
    assert.equal(hasIdWithValue('yt-watch', '4'), false,
      '#yt-watch ainda mostra "4" fake — substituir por "--"');
  });

  it('#yt-likes nao exibe 5 hardcoded', () => {
    assert.equal(hasIdWithValue('yt-likes', '5'), false,
      '#yt-likes ainda mostra "5" fake — substituir por "--"');
  });

  it('#yt-subs-d nao exibe "+13 este mes" hardcoded', () => {
    assert.ok(!html.includes('+13 este m'),
      '#yt-subs-d ainda mostra "+13 este mês" fake');
  });

});
