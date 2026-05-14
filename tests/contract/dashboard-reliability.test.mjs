/**
 * tests/contract/dashboard-reliability.test.mjs
 *
 * Static-analysis tests for reliability fixes in dashboard.html.
 * Verifies absence of false-positive states and unsafe patterns.
 *
 * Run: node --test tests/contract/dashboard-reliability.test.mjs
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFn(name, nextName) {
  const start = html.indexOf(`async function ${name}(`);
  const end = nextName ? html.indexOf(`async function ${nextName}(`) : html.length;
  return start >= 0 && end > start ? html.slice(start, end) : '';
}

// ── Suite 1: Status inicial dos widgets sociais ───────────────────────────────

describe('dashboard.html — status inicial dos widgets sociais', () => {

  const socialWidgets = [
    { id: 'ig-status',  name: 'Instagram' },
    { id: 'fb-status',  name: 'Facebook' },
    { id: 'gmb-status', name: 'Google Meu Negocio' },
    { id: 'yt-status',  name: 'YouTube' },
    { id: 'ga-status',  name: 'Google Analytics' },
  ];

  for (const { id, name } of socialWidgets) {
    it(`${name} (#${id}) nao deve iniciar com tag-live hardcoded no HTML`, () => {
      // Padrao exato no HTML: class="c-tag tag-live" id="ig-status"
      const hasHardcodedLive = html.includes(`tag-live" id="${id}"`);
      assert.equal(
        hasHardcodedLive,
        false,
        `#${id} inicializa como "live" hardcoded — falso positivo sem dados reais. Mudar para tag-demo.`
      );
    });
  }

});

// ── Suite 2: loadGmail sem pre-checagem de token local ────────────────────────

describe('dashboard.html — loadGmail: sem dependencia de googleTokens local', () => {

  it('loadGmail nao pre-checa googleTokens?.refresh_token antes do fetch', () => {
    const fnBody = extractFn('loadGmail', 'loadDrive');
    assert.ok(fnBody.length > 0, 'funcao loadGmail nao encontrada');

    const fetchIdx = fnBody.indexOf("'/api/google/gmail'");
    assert.ok(fetchIdx > 0, 'fetch da API nao encontrado em loadGmail');

    const beforeFetch = fnBody.slice(0, fetchIdx);
    assert.ok(
      !beforeFetch.includes('googleTokens?.refresh_token'),
      'loadGmail verifica googleTokens?.refresh_token ANTES de chamar a API — causa falso "desconectado" quando localStorage esta vazio mas Supabase tem token valido.'
    );
  });

  it('loadGmail define status como "live" somente apos resposta OK da API', () => {
    const fnBody = extractFn('loadGmail', 'loadDrive');
    assert.ok(fnBody.length > 0, 'funcao loadGmail nao encontrada');

    const fetchIdx = fnBody.indexOf("'/api/google/gmail'");
    const liveBeforeFetch = fnBody.slice(0, fetchIdx).includes("tag-live");
    assert.equal(
      liveBeforeFetch,
      false,
      'loadGmail seta status "live" ANTES de receber resposta da API — falso positivo em tela de carregamento.'
    );
  });

});

// ── Suite 3: loadDrive sem pre-checagem de token local ───────────────────────

describe('dashboard.html — loadDrive: sem dependencia de googleTokens local', () => {

  it('loadDrive nao pre-checa googleTokens?.refresh_token antes do fetch', () => {
    const fnBody = extractFn('loadDrive', 'loadInstagram');
    assert.ok(fnBody.length > 0, 'funcao loadDrive nao encontrada');

    const fetchIdx = fnBody.indexOf("'/api/google/drive'");
    assert.ok(fetchIdx > 0, 'fetch da API nao encontrado em loadDrive');

    const beforeFetch = fnBody.slice(0, fetchIdx);
    assert.ok(
      !beforeFetch.includes('googleTokens?.refresh_token'),
      'loadDrive verifica googleTokens?.refresh_token ANTES de chamar a API — causa falso "desconectado" quando localStorage esta vazio mas Supabase tem token valido.'
    );
  });

  it('loadDrive define status como "live" somente apos resposta OK da API', () => {
    const fnBody = extractFn('loadDrive', 'loadInstagram');
    assert.ok(fnBody.length > 0, 'funcao loadDrive nao encontrada');

    const fetchIdx = fnBody.indexOf("'/api/google/drive'");
    const liveBeforeFetch = fnBody.slice(0, fetchIdx).includes("tag-live");
    assert.equal(
      liveBeforeFetch,
      false,
      'loadDrive seta status "live" ANTES de receber resposta da API — falso positivo em tela de carregamento.'
    );
  });

});

// ── Suite 4: AbortSignal.timeout nos fetches Google ──────────────────────────

describe('dashboard.html — fetches Google com timeout', () => {

  it('fetch de loadGmail tem AbortSignal.timeout(8000)', () => {
    const fnBody = extractFn('loadGmail', 'loadDrive');
    assert.ok(fnBody.length > 0, 'funcao loadGmail nao encontrada');
    assert.ok(
      fnBody.includes('AbortSignal.timeout(8000)'),
      'loadGmail nao tem AbortSignal.timeout(8000) — fetch pode travar indefinidamente.'
    );
  });

  it('fetch de loadDrive tem AbortSignal.timeout(8000)', () => {
    const fnBody = extractFn('loadDrive', 'loadInstagram');
    assert.ok(fnBody.length > 0, 'funcao loadDrive nao encontrada');
    assert.ok(
      fnBody.includes('AbortSignal.timeout(8000)'),
      'loadDrive nao tem AbortSignal.timeout(8000) — fetch pode travar indefinidamente.'
    );
  });

});

// ── Suite 5: Health Supabase nao depende de widget_scripts ───────────────────

describe('dashboard.html — health Supabase: endpoint honesto', () => {

  it('health check do Supabase nao usa tabela widget_scripts', () => {
    assert.ok(
      !html.includes('widget_scripts'),
      'Health check usa /rest/v1/widget_scripts — tabela pode nao existir, causando falso negativo. Usar /api/token/status.'
    );
  });

});
