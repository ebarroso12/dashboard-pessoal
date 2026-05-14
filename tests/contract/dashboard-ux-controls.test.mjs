/**
 * tests/contract/dashboard-ux-controls.test.mjs
 *
 * Static-analysis tests for UX control fixes in dashboard.html.
 * Covers: widget controls, modal reliability, closeOut fallback, AI timeout.
 *
 * Run: node --test tests/contract/dashboard-ux-controls.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

// ── Suite 1: initLayoutControls deve vincular handlers a botoes existentes ────

describe('dashboard.html — initLayoutControls: handlers nos botoes estaticos', () => {

  it('guard de card-ctrl-grp nao deve retornar sem vincular handlers', () => {
    const fnStart = html.indexOf('function initLayoutControls()');
    const fnBody = fnStart >= 0 ? html.slice(fnStart, fnStart + 1500) : '';
    assert.ok(fnBody.length > 0, 'funcao initLayoutControls nao encontrada');

    // Padrao do bug: retorna imediatamente ao encontrar .card-ctrl-grp existente
    const hasBrokenGuard = fnBody.includes(".card-ctrl-grp'))return;");
    assert.equal(
      hasBrokenGuard,
      false,
      'initLayoutControls retorna imediatamente quando .card-ctrl-grp ja existe — handlers NUNCA vinculados aos botoes estaticos do HTML.'
    );
  });

  it('card-remove-btn existente deve receber removeWidget como handler', () => {
    const fnStart = html.indexOf('function initLayoutControls()');
    const fnBody = fnStart >= 0 ? html.slice(fnStart, fnStart + 1500) : '';
    assert.ok(fnBody.length > 0, 'funcao initLayoutControls nao encontrada');

    // Quando .card-ctrl-grp ja existe, removeWidget deve ser vinculado ao xb
    // O padrao correto inclui card-ctrl-grp E removeWidget no mesmo bloco
    const ctrlGrpIdx = fnBody.indexOf('.card-ctrl-grp');
    const removeWidgetIdx = fnBody.indexOf('removeWidget', ctrlGrpIdx);
    assert.ok(
      ctrlGrpIdx >= 0 && removeWidgetIdx > ctrlGrpIdx,
      'removeWidget nao aparece no bloco de card-ctrl-grp — botao X dos widgets sem handler.'
    );
  });

  it('card-resize-btn existente deve receber cycleWidgetSize como handler', () => {
    const fnStart = html.indexOf('function initLayoutControls()');
    const fnBody = fnStart >= 0 ? html.slice(fnStart, fnStart + 1500) : '';
    assert.ok(fnBody.length > 0, 'funcao initLayoutControls nao encontrada');

    const ctrlGrpIdx = fnBody.indexOf('.card-ctrl-grp');
    const resizeIdx = fnBody.indexOf('cycleWidgetSize', ctrlGrpIdx);
    assert.ok(
      ctrlGrpIdx >= 0 && resizeIdx > ctrlGrpIdx,
      'cycleWidgetSize nao aparece no bloco de card-ctrl-grp — botao resize dos widgets sem handler.'
    );
  });

});

// ── Suite 2: finBackdrop sem ID duplicado ─────────────────────────────────────

describe('dashboard.html — finBackdrop: ID unico no DOM', () => {

  it('id="finBackdrop" nao deve aparecer no HTML estatico — apenas versao JS-criada ativa', () => {
    // O IIFE na linha ~7358 cria o finBackdrop correto dinamicamente com onclick handler.
    // Versoes estaticas no HTML causam IDs duplicados e comportamento imprevisivel.
    const count = (html.match(/id="finBackdrop"/g) || []).length;
    assert.equal(
      count,
      0,
      `id="finBackdrop" aparece ${count} vez(es) no HTML estatico — todas as duplicatas devem ser renomeadas para id="finBackdrop-static".`
    );
  });

});

// ── Suite 3: closeOut com fallback real ───────────────────────────────────────

describe('dashboard.html — closeOut: fallback real via closeModal', () => {

  it('closeOut deve chamar closeModal(id) em vez de ser no-op', () => {
    const fnStart = html.indexOf('function closeOut(');
    const fnBody = fnStart >= 0 ? html.slice(fnStart, fnStart + 150) : '';
    assert.ok(fnBody.length > 0, 'funcao closeOut nao encontrada');

    assert.ok(
      fnBody.includes('closeModal'),
      'closeOut e no-op (corpo vazio) — fechar backdrop via onclick no elemento nao faz nada. Deve chamar closeModal(id).'
    );
  });

});

// ── Suite 4: chamarIA com timeout para prevenir loading infinito ──────────────

describe('dashboard.html — chamarIA: AbortSignal.timeout previne loading infinito', () => {

  it('chamarIA deve ter AbortSignal.timeout no fetch', () => {
    const fnStart = html.indexOf('async function chamarIA(');
    const fnBody = fnStart >= 0 ? html.slice(fnStart, fnStart + 500) : '';
    assert.ok(fnBody.length > 0, 'funcao chamarIA nao encontrada');

    assert.ok(
      fnBody.includes('AbortSignal.timeout'),
      'chamarIA sem AbortSignal.timeout — fetch sem timeout deixa modal em "Consultando IA..." indefinidamente se servidor nao responder.'
    );
  });

});
