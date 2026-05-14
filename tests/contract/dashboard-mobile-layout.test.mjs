/**
 * tests/contract/dashboard-mobile-layout.test.mjs
 *
 * Verifica que o CSS mobile tem todas as regras obrigatórias
 * para impedir sidebar, overflow horizontal e cards espremidos.
 *
 * Run: node --test tests/contract/dashboard-mobile-layout.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

function getMobileBlock() {
  const idx = html.indexOf('@media(max-width:800px)');
  return idx >= 0 ? html.slice(idx, idx + 600) : '';
}

const mob = getMobileBlock();

describe('dashboard.html — CSS mobile obrigatorio', () => {

  it('.sidebar tem display:none!important no breakpoint 800px', () => {
    assert.ok(mob.includes('.sidebar{display:none!important') || mob.includes('.sidebar { display:none !important'),
      '.sidebar sem display:none!important em <=800px — sidebar aparece no celular.');
  });

  it('.main-content tem margin-left:0!important em mobile', () => {
    assert.ok(mob.includes('margin-left:0!important') || mob.includes('margin-left: 0 !important'),
      '.main-content sem margin-left:0!important — conteudo espremido por margin do sidebar.');
  });

  it('html e body tem overflow-x:hidden em mobile', () => {
    assert.ok(
      mob.includes('overflow-x:hidden') || html.includes('overflow-x:hidden!important'),
      'Sem overflow-x:hidden — scroll horizontal possivel em mobile.');
  });

  it('.main-content tem width:100% em mobile', () => {
    assert.ok(
      mob.includes('width:100%') || mob.includes('max-width:100%'),
      '.main-content sem width:100% — pode nao ocupar tela inteira.');
  });

  it('.card tem min-width:0 para nao estourar layout em mobile', () => {
    assert.ok(
      mob.includes('min-width:0') || html.includes('min-width:0'),
      '.card sem min-width:0 — cards podem causar overflow horizontal.');
  });

  it('#mobile-nav tem display:flex!important em mobile', () => {
    assert.ok(mob.includes('#mobile-nav{display:flex!important') || mob.includes("'#mobile-nav'") || mob.includes('mobile-nav') && mob.includes('flex'),
      '#mobile-nav nao visivel em mobile.');
  });

});
