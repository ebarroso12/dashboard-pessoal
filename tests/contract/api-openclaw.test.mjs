/**
 * tests/contract/api-openclaw.test.mjs
 *
 * Verifica o protocolo WebSocket em api/lib/openclaw.js.
 * Inspecao estatica do source — sem deps externas, sem servidor real.
 *
 * Run: node --test tests/contract/api-openclaw.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../../api/lib/openclaw.js'), 'utf8');

test('usa auth.token (nao authToken) no connect frame', () => {
  assert.ok(
    src.includes('auth: { token: TOKEN }'),
    "deve usar 'auth: { token: TOKEN }' — protocolo OpenClaw 2026"
  );
  assert.ok(
    !src.includes('authToken: TOKEN'),
    "nao deve usar 'authToken: TOKEN' — protocolo antigo"
  );
});

test('nao usa scopes legados control ou chat', () => {
  assert.ok(
    !src.includes("'control'"),
    "nao deve ter scope 'control' — invalido no OpenClaw 2026"
  );
  assert.ok(
    !src.includes("'chat'"),
    "nao deve ter scope 'chat' — invalido no OpenClaw 2026"
  );
});

test('usa scopes operator.* corretos', () => {
  const expected = [
    'operator.admin',
    'operator.read',
    'operator.write',
    'operator.approvals',
    'operator.pairing',
  ];
  for (const scope of expected) {
    assert.ok(
      src.includes(`'${scope}'`),
      `deve conter scope '${scope}'`
    );
  }
});

test('tem handler ws.on(close) para falhar rapido em auth failure', () => {
  assert.ok(
    src.includes("ws.on('close'") || src.includes('ws.on("close"'),
    "deve ter ws.on('close') para rejeitar imediatamente em 1008 sem esperar 15s"
  );
});
