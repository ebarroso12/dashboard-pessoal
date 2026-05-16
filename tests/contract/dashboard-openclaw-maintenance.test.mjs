/**
 * tests/contract/dashboard-openclaw-maintenance.test.mjs
 *
 * Static-analysis tests for the OpenClaw maintenance tab in widget-infra-ia.
 *
 * Run: node --test tests/contract/dashboard-openclaw-maintenance.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

describe('dashboard.html — OpenClaw maintenance tab: estrutura', () => {

  it('tab button itab-openclaw existe', () => {
    assert.ok(html.includes('id="itab-openclaw"'), 'Falta botao de tab itab-openclaw');
  });

  it('panel infra-tab-openclaw existe', () => {
    assert.ok(html.includes('id="infra-tab-openclaw"'), 'Falta painel infra-tab-openclaw');
  });

  it('notice banner "Runbook assistido" presente', () => {
    assert.ok(html.includes('Runbook assistido'), 'Falta banner "Runbook assistido" no panel');
  });

  it('status row URL Publica existe com id correto', () => {
    assert.ok(html.includes('id="oc-maint-url-status"'), 'Falta oc-maint-url-status');
  });

  it('status row API Vercel existe com id correto', () => {
    assert.ok(html.includes('id="oc-maint-ws-status"'), 'Falta oc-maint-ws-status');
  });

  it('status row WhatsApp marcado como manual', () => {
    assert.ok(html.includes('Requer teste manual'), 'Falta aviso de teste manual para WhatsApp');
  });

  it('botao Testar agora chama ocTestUrl', () => {
    assert.ok(html.includes('ocTestUrl()'), 'Falta chamada a ocTestUrl');
  });

  it('link Abrir painel aponta para openclaw.n8ndredson.com', () => {
    assert.ok(
      html.includes('href="https://openclaw.n8ndredson.com"'),
      'Falta link correto para openclaw.n8ndredson.com'
    );
  });

  it('botao Gerar relatorio chama ocGerarRelatorio', () => {
    assert.ok(html.includes('ocGerarRelatorio()'), 'Falta chamada a ocGerarRelatorio');
  });

  it('botao Copiar todos chama ocCopiarTodos', () => {
    assert.ok(html.includes('ocCopiarTodos('), 'Falta chamada a ocCopiarTodos');
  });

  it('div oc-maint-report existe e inicia oculto', () => {
    assert.ok(html.includes('id="oc-maint-report"'), 'Falta div oc-maint-report');
    const reportIdx = html.indexOf('id="oc-maint-report"');
    const snippet = html.slice(reportIdx, reportIdx + 80);
    assert.ok(snippet.includes('display:none'), 'oc-maint-report nao inicia oculto');
  });

});

describe('dashboard.html — OpenClaw maintenance tab: seguranca', () => {

  it('nenhum token webhook exposto no HTML', () => {
    const count = (html.match(/oc_edson_2026_secure/g) || []).length;
    assert.equal(count, 0, `Token "oc_edson_2026_secure" aparece ${count} vez(es). Remova.`);
  });

  it('nenhuma service_role key exposta no HTML', () => {
    assert.ok(!html.includes('service_role'), 'service_role key encontrada no HTML publico.');
  });

  it('panel nao contem SSH automatizado', () => {
    assert.ok(!html.includes("onclick=\"ssh "), 'Panel tem botao SSH automatizado.');
    assert.ok(!html.includes('exec ssh'),      'Panel tem exec ssh automatizado.');
  });

  it('panel nao contem docker restart automatizado (apenas clipboard)', () => {
    const panelStart = html.indexOf('id="infra-tab-openclaw"');
    const panelEnd   = html.indexOf('id="oc-maint-report"', panelStart) + 200;
    const panel      = html.slice(panelStart, panelEnd);
    assert.ok(
      !panel.includes('fetch') || panel.includes('clipboard'),
      'Panel pode ter fetch de restart automatizado.'
    );
    assert.ok(panel.includes('clipboard.writeText'), 'Botoes devem usar clipboard.writeText');
  });

  it('relatorio nao expoe tokens ou service_role', () => {
    const reportFnIdx = html.indexOf('window.ocGerarRelatorio');
    const reportFn    = html.slice(reportFnIdx, reportFnIdx + 800);
    assert.ok(
      !reportFn.includes('service_role'),
      'ocGerarRelatorio referencia service_role'
    );
    assert.ok(
      !reportFn.includes('localStorage.getItem'),
      'ocGerarRelatorio le localStorage (pode expor tokens)'
    );
    assert.ok(
      reportFn.includes('nao incluidas'),
      'ocGerarRelatorio nao avisa sobre dados sensiveis excluidos'
    );
  });

});

describe('dashboard.html — OpenClaw maintenance tab: checklist e comandos', () => {

  it('checklist de recuperacao presente', () => {
    assert.ok(html.includes('Checklist de Recuperacao'), 'Falta checklist de recuperacao');
  });

  it('comando docker ps documentado e copiavel', () => {
    assert.ok(
      html.includes('docker ps -a | grep -i openclaw'),
      'Falta comando docker ps'
    );
  });

  it('comando docker logs documentado e copiavel', () => {
    assert.ok(
      html.includes('docker logs openclaw --tail=100'),
      'Falta comando docker logs'
    );
  });

  it('comando docker restart tem aviso de risco', () => {
    assert.ok(
      html.includes('docker restart openclaw'),
      'Falta comando docker restart'
    );
    assert.ok(
      html.includes('risco moderado'),
      'Falta aviso de risco no comando docker restart'
    );
  });

  it('comando curl documentado e copiavel', () => {
    assert.ok(
      html.includes('curl -I https://openclaw.n8ndredson.com'),
      'Falta comando curl'
    );
  });

});

describe('dashboard.html — OpenClaw maintenance tab: regressao', () => {

  it('nao ha cards estaticos fake no #oc-feed', () => {
    assert.ok(
      !html.includes('Teste de conexao OpenClaw'),
      'Cards estaticos fake no oc-feed. Remova.'
    );
  });

  it('contador inicial nao e hardcoded como 1', () => {
    assert.ok(
      !html.includes('1 comando recebido'),
      'Contador hardcoded "1 comando recebido". Deve ser 0.'
    );
  });

});
