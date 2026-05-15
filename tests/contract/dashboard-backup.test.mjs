/**
 * tests/contract/dashboard-backup.test.mjs
 *
 * Testes TDD para o sistema de backup/restore pessoal.
 *
 * Run: node --test tests/contract/dashboard-backup.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

// ── Suite 1: Funcoes de export/import existem ─────────────────────────────────

describe('dashboard.html — backup: funcoes exportar e importar', () => {

  it('funcao exportarDados existe', () => {
    assert.ok(html.includes('function exportarDados') || html.includes('exportarDados=function') || html.includes('exportarDados ='),
      'exportarDados nao encontrada — export nao implementado.');
  });

  it('funcao importarDados existe', () => {
    assert.ok(html.includes('function importarDados') || html.includes('importarDados=function') || html.includes('importarDados ='),
      'importarDados nao encontrada — import nao implementado.');
  });

  it('funcao autoBackup existe', () => {
    assert.ok(html.includes('function autoBackup') || html.includes('autoBackup=function') || html.includes('autoBackup ='),
      'autoBackup nao encontrada — backup automatico nao implementado.');
  });

});

// ── Suite 2: Formato do backup ────────────────────────────────────────────────

describe('dashboard.html — backup: formato JSON correto', () => {

  it('backup inclui campo version', () => {
    assert.ok(html.includes("version:'1.0'") || html.includes('version:"1.0"') || html.includes("'version','1.0'"),
      'backup sem campo "version" — impossivel verificar compatibilidade ao importar.');
  });

  it('backup inclui campo exported_at (timestamp)', () => {
    assert.ok(html.includes('exported_at'),
      'backup sem timestamp — impossivel saber quando o backup foi feito.');
  });

  it('backup inclui tarefas no payload', () => {
    assert.ok(html.includes('dash_tasks') && html.includes('exportarDados'),
      'backup nao inclui tarefas (dash_tasks).');
  });

  it('backup inclui financeiro no payload', () => {
    assert.ok(html.includes('fin_pagamentos') && html.includes('exportarDados'),
      'backup nao inclui dados financeiros.');
  });

});

// ── Suite 3: UX — botoes e input ──────────────────────────────────────────────

describe('dashboard.html — backup: UI acessivel', () => {

  it('botao exportar existe no HTML', () => {
    assert.ok(
      html.includes('exportarDados()') || html.includes('exportarDados ()'),
      'Nenhum botao chama exportarDados() — usuario nao consegue exportar.'
    );
  });

  it('input file para importar existe', () => {
    assert.ok(
      html.includes('type="file"') && (html.includes('importarDados') || html.includes('accept=".json"')),
      'Sem input file ou sem ligacao com importarDados — usuario nao consegue importar.'
    );
  });

  it('importar pede confirmacao antes de sobrescrever', () => {
    // confirm() deve estar na funcao importarDados no script
    assert.ok(
      html.includes('confirm(') && html.includes('importarDados'),
      'importarDados nao pede confirmacao — pode sobrescrever dados sem aviso.'
    );
  });

});

// ── Suite 4: Auto-backup ──────────────────────────────────────────────────────

describe('dashboard.html — auto-backup: snapshot diario', () => {

  it('auto-backup usa prefixo dash_backup_ para as chaves', () => {
    assert.ok(html.includes('dash_backup_'),
      'auto-backup nao usa prefixo dash_backup_ — backups nao identificaveis.');
  });

  it('auto-backup limita a 7 backups', () => {
    const backupIdx = html.indexOf('autoBackup');
    const fnBlock = backupIdx >= 0 ? html.slice(backupIdx, backupIdx + 800) : '';
    assert.ok(
      fnBlock.includes('7') || fnBlock.includes('slice(-7') || fnBlock.includes('slice(0,7'),
      'auto-backup sem limite de 7 snapshots — localStorage pode encher.'
    );
  });

});
