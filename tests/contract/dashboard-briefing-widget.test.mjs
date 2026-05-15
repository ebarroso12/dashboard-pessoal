/**
 * tests/contract/dashboard-briefing-widget.test.mjs
 *
 * TDD para o widget existente "Resumo Matinal" (widget-morning).
 * Verifica que o widget usa /api/briefing (não /api/morning-briefing),
 * que o erro é honesto, e que os botões funcionam corretamente.
 *
 * Run: node --test tests/contract/dashboard-briefing-widget.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

// ── Suite 1: Root cause — endpoint errado ─────────────────────────────────────

describe('dashboard.html — widget-morning: endpoint correto', () => {

  it('/api/morning-briefing NAO deve ser chamado em nenhuma funcao de carregamento', () => {
    // Auto-load IIFE e gerarBriefing nao devem chamar o endpoint quebrado
    const morningBriefingCalls = (html.match(/\/api\/morning-briefing/g) || []).length;
    assert.equal(
      morningBriefingCalls,
      0,
      `/api/morning-briefing ainda aparece ${morningBriefingCalls} vez(es) — este endpoint nao existe e causa 404.`
    );
  });

  it('gerarBriefing chama /api/briefing (endpoint real)', () => {
    // Busca a DEFINICAO da funcao, nao a chamada no botao
    const fnIdx = html.indexOf('window.gerarBriefing');
    const fnBlock = fnIdx >= 0 ? html.slice(fnIdx, fnIdx + 800) : '';
    assert.ok(fnBlock.includes('/api/briefing'),
      'gerarBriefing nao chama /api/briefing — widget vai continuar falhando.');
  });

  it('auto-load (IIFE 6h-10h) nao chama /api/morning-briefing', () => {
    assert.ok(!html.includes('/api/morning-briefing'),
      'IIFE auto-load ainda chama /api/morning-briefing (404).');
  });

});

// ── Suite 2: Widget HTML correto ──────────────────────────────────────────────

describe('dashboard.html — widget-morning: estrutura HTML', () => {

  it('#widget-morning existe', () => {
    assert.ok(html.includes('id="widget-morning"'),
      '#widget-morning nao encontrado — widget desapareceu do HTML.');
  });

  it('#morning-text existe para exibir o briefing', () => {
    assert.ok(html.includes('id="morning-text"'),
      '#morning-text ausente — briefing nao pode ser exibido.');
  });

  it('#morning-sub existe para timestamp/fontes', () => {
    assert.ok(html.includes('id="morning-sub"'),
      '#morning-sub ausente — timestamp/fontes nao aparecem.');
  });

  it('botao Fechar fecha o widget (display none)', () => {
    assert.ok(
      html.includes("widget-morning') .style.display='none'") ||
      html.includes('widget-morning").style.display="none"') ||
      html.includes("widget-morning')\\.style\\.display") ||
      html.includes("style.display='none'") && html.includes('widget-morning'),
      'Botao Fechar nao esconde widget-morning.'
    );
  });

  it('botao Enviar WA existe no widget', () => {
    assert.ok(html.includes('enviarBriefingWA'),
      'enviarBriefingWA ausente — botao Enviar WA nao funciona.');
  });

});

// ── Suite 3: Mensagem de erro honesta ─────────────────────────────────────────

describe('dashboard.html — widget-morning: erros honestos', () => {

  it('erro de timeout mostra mensagem clara sem stacktrace', () => {
    const fnIdx = html.indexOf('window.gerarBriefing');
    const fnBlock = fnIdx >= 0 ? html.slice(fnIdx, fnIdx + 1000) : '';
    assert.ok(
      fnBlock.includes('Briefing indispon') || fnBlock.includes('indispon') || fnBlock.includes('Timeout') || fnBlock.includes('timeout'),
      'Mensagem de erro nao e clara — usuario nao sabe o que aconteceu.'
    );
  });

  it('gerarBriefing trata catch e exibe estado honesto', () => {
    const fnIdx = html.indexOf('window.gerarBriefing');
    const fnBlock = fnIdx >= 0 ? html.slice(fnIdx, fnIdx + 1800) : '';
    assert.ok(fnBlock.includes('catch'),
      'gerarBriefing sem catch — erros vao silenciosamente travar o widget.');
  });

});

// ── Suite 4: enviarBriefingWA defensivo ───────────────────────────────────────

describe('dashboard.html — enviarBriefingWA: comportamento correto', () => {

  it('enviarBriefingWA verifica briefing antes de abrir WA', () => {
    const fnIdx = html.indexOf('window.enviarBriefingWA');
    const fnBlock = fnIdx >= 0 ? html.slice(fnIdx, fnIdx + 400) : '';
    assert.ok(
      fnBlock.includes('!texto') || fnBlock.includes('_briefingTexto') || fnBlock.includes('morning-text'),
      'enviarBriefingWA nao verifica se o briefing existe antes de abrir o WA.'
    );
  });

  it('enviarBriefingWA usa wa.me para envio', () => {
    const fnIdx = html.indexOf('window.enviarBriefingWA');
    const fnBlock = fnIdx >= 0 ? html.slice(fnIdx, fnIdx + 400) : '';
    assert.ok(fnBlock.includes('wa.me') || fnBlock.includes('whatsapp'),
      'enviarBriefingWA nao usa wa.me para abrir WhatsApp.');
  });

});
