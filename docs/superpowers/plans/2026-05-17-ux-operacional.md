# UX Operacional — Dashboard Pessoal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o dashboard em ferramenta diária extremamente rápida com 6 quick actions, painel "agora" operacional, feedback visual honesto e performance sem fetches duplicados.

**Architecture:** Todas as mudanças são em `dashboard.html` (vanilla JS + HTML, 12 419 linhas). Sem novos endpoints, sem novo banco, sem realtime. Quick actions usam funções já existentes (`addTask`, `_addTx`, `openCRMNew`, `gerarBriefing`, `infraScanNow`). Painel "Agora" agrega dados já carregados por outros widgets via variáveis globais.

**Tech Stack:** Vanilla JS, HTML/CSS, Vercel (static + serverless existentes)

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `dashboard.html` CSS (~linha 1379) | MODIFICAR | Adicionar estilos FAB speed-dial e Agora card |
| `dashboard.html` HTML (~linha 2551) | MODIFICAR | Inserir Agora card antes de `#widget-crm` |
| `dashboard.html` HTML (antes `</body>`) | MODIFICAR | Inserir FAB HTML + Quick Gasto sheet |
| `dashboard.html` JS (fim do script) | MODIFICAR | Adicionar `toggleQA`, `qaAction`, `updateAgoraCard`, fetch dedup |
| `dashboard.html` `loadCalendar()` (~linha 5499) | MODIFICAR | Expor próximo evento em `window._nextCalEvent` |
| `dashboard.html` bottom nav (~linha 12326) | MODIFICAR | Adicionar estado ativo nos botoes |

---

## Quick wins (podem ser feitos independentemente)

| Quick win | Impacto | Tempo |
|---|---|---|
| Task 1: FAB com 6 ações | ALTO -- reduz cliques para todas as ações principais | 30 min |
| Task 2: Painel Agora | ALTO -- visão operacional imediata ao abrir | 20 min |
| Task 3: Bottom nav ativo | MÉDIO -- UX mobile mais clara | 10 min |
| Task 4: Fetch dedup | MÉDIO -- elimina chamadas duplicadas em Google APIs | 20 min |

---

## Task 1: Quick Actions FAB (Speed Dial com 6 ações)

**Files:**
- Modify: `dashboard.html` — CSS, HTML antes de `</body>`, JS no fim do script

- [ ] **Step 1: Adicionar CSS do FAB**

Localizar o bloco `/* === FAB BUTTON === */` (linha ~1379) e adicionar APÓS a regra `#assistantFab:hover`:

```css
/* ── QUICK ACTIONS FAB ───────────────────────────────── */
#qa-fab{position:fixed;bottom:80px;right:16px;z-index:8000}
@media(min-width:769px){#qa-fab{bottom:24px}}
#qa-fab-btn{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#10b981);border:none;cursor:pointer;font-size:24px;color:#fff;box-shadow:0 4px 20px rgba(59,130,246,.45);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}
#qa-fab-btn.open{transform:rotate(45deg);box-shadow:0 4px 24px rgba(16,185,129,.5)}
#qa-menu{position:absolute;bottom:62px;right:0;display:flex;flex-direction:column;gap:8px;opacity:0;pointer-events:none;transform:translateY(10px);transition:opacity .2s,transform .2s}
#qa-menu.open{opacity:1;pointer-events:all;transform:translateY(0)}
.qa-item{display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--bg2);border:1px solid var(--border-h);border-radius:24px;padding:8px 14px 8px 10px;white-space:nowrap;box-shadow:0 2px 12px rgba(0,0,0,.35);font-size:.8rem;color:var(--text);transition:background .15s}
.qa-item:hover{background:var(--bg3);border-color:var(--accent)}
.qa-icon{font-size:16px;width:22px;text-align:center}
/* Agora card */
.agora-stat{flex:1;min-width:90px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:10px 12px;text-align:center;cursor:pointer;transition:border-color .15s}
.agora-stat:hover{border-color:var(--border-h)}
.agora-val{font-size:1.6rem;font-weight:800;color:var(--text);line-height:1}
.agora-lbl{font-size:.62rem;color:var(--muted2);margin-top:4px;text-transform:uppercase;letter-spacing:.06em}
```

- [ ] **Step 2: Adicionar HTML do FAB e sheet de gasto rápido**

Localizar `<!-- ── MOBILE BOTTOM NAV` (linha ~12325) e inserir ANTES:

```html
<!-- ── QUICK ACTIONS FAB ─────────────────────────────── -->
<div id="qa-fab">
  <div id="qa-menu">
    <div class="qa-item" onclick="qaAction('tarefa')"><span class="qa-icon">✅</span>Nova Tarefa</div>
    <div class="qa-item" onclick="qaAction('gasto')"><span class="qa-icon">💸</span>Novo Gasto</div>
    <div class="qa-item" onclick="qaAction('lead')"><span class="qa-icon">👥</span>Novo Lead CRM</div>
    <div class="qa-item" onclick="qaAction('briefing')"><span class="qa-icon">📤</span>Enviar Briefing</div>
    <div class="qa-item" onclick="qaAction('vidavirtual')"><span class="qa-icon">🔧</span>Nova OS VidaVirtual</div>
    <div class="qa-item" onclick="qaAction('monitor')"><span class="qa-icon">📊</span>Abrir Monitor</div>
  </div>
  <button id="qa-fab-btn" onclick="toggleQA()" aria-label="Ações rápidas">＋</button>
</div>

<!-- ── QUICK GASTO SHEET ──────────────────────────────── -->
<div id="qa-gasto-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:8100;align-items:flex-end;justify-content:center" onclick="if(event.target===this)closeQaGasto()">
  <div style="background:var(--bg2);border:1px solid var(--border-h);border-radius:16px 16px 0 0;padding:20px;width:100%;max-width:500px">
    <div style="font-size:.9rem;font-weight:600;color:var(--text);margin-bottom:16px">Novo Gasto Rápido</div>
    <input id="qa-gasto-valor" type="number" inputmode="decimal" placeholder="Valor (R$)" style="width:100%;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:1rem;margin-bottom:10px;box-sizing:border-box">
    <input id="qa-gasto-item" type="text" placeholder="Descricao" style="width:100%;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:.9rem;margin-bottom:14px;box-sizing:border-box" onkeydown="if(event.key==='Enter')confirmQaGasto()">
    <div style="display:flex;gap:10px">
      <button onclick="closeQaGasto()" style="flex:1;padding:10px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--muted2);cursor:pointer">Cancelar</button>
      <button onclick="confirmQaGasto()" style="flex:2;padding:10px;border-radius:8px;background:rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.35);color:#ef4444;cursor:pointer;font-weight:600">Registrar Gasto</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Adicionar JS das quick actions**

Localizar `document.addEventListener('DOMContentLoaded'` do CRM (linha ~12286) e adicionar ANTES:

```javascript
/* ── QUICK ACTIONS FAB ───────────────────────────────── */
let _qaOpen = false;
function toggleQA() {
  _qaOpen = !_qaOpen;
  document.getElementById('qa-fab-btn').classList.toggle('open', _qaOpen);
  document.getElementById('qa-menu').classList.toggle('open', _qaOpen);
}
function closeQA() {
  _qaOpen = false;
  document.getElementById('qa-fab-btn')?.classList.remove('open');
  document.getElementById('qa-menu')?.classList.remove('open');
}
function qaAction(action) {
  closeQA();
  switch(action) {
    case 'tarefa':
      showSection('clinica'); showPage('home');
      setTimeout(() => {
        const el = document.getElementById('taskInput');
        if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); el.focus(); }
      }, 300);
      break;
    case 'gasto':
      document.getElementById('qa-gasto-overlay').style.display = 'flex';
      setTimeout(() => document.getElementById('qa-gasto-valor')?.focus(), 100);
      break;
    case 'lead':
      if (typeof openCRMNew === 'function') openCRMNew('nurturing');
      break;
    case 'briefing':
      if (typeof enviarBriefingAgora === 'function') enviarBriefingAgora();
      break;
    case 'vidavirtual':
      window.open('https://vidavirtual-omega.vercel.app', '_blank', 'noopener');
      break;
    case 'monitor':
      showSection('infra'); showPage('home');
      setTimeout(() => { if (typeof infraScanNow === 'function') infraScanNow(); }, 400);
      break;
  }
}
function closeQaGasto() { document.getElementById('qa-gasto-overlay').style.display = 'none'; }
function confirmQaGasto() {
  const val = parseFloat(document.getElementById('qa-gasto-valor')?.value || '0');
  const item = (document.getElementById('qa-gasto-item')?.value || '').trim() || 'Gasto rapido';
  if (!val || val <= 0) { showToast('Informe um valor valido', '#ef4444'); return; }
  const d = new Date();
  const today = d.toISOString().slice(0, 10);
  if (typeof _addTx === 'function') {
    _addTx({ date: today, year: d.getFullYear(), month: d.getMonth(),
              type: 'despesa', item, amount: val,
              cat_id: 'outros', cat_label: 'Outros', source: 'quick' });
    showToast('Gasto registrado', '#22c55e');
  }
  closeQaGasto();
  document.getElementById('qa-gasto-valor').value = '';
  document.getElementById('qa-gasto-item').value = '';
}
document.addEventListener('click', e => {
  if (_qaOpen && !document.getElementById('qa-fab')?.contains(e.target)) closeQA();
});
```

- [ ] **Step 4: Verificar**

Abrir browser em https://dashboard-pessoal-edson.vercel.app. Deve aparecer botao "＋" no canto inferior direito. Clicar → abre speed dial com 6 itens. Clicar "Nova Tarefa" → scroll para task input. Clicar "Novo Gasto" → abre sheet com inputs. Clicar fora → fecha FAB.

- [ ] **Step 5: Commit**

```bash
git add dashboard.html
git commit -m "feat(ux): add quick actions FAB with speed dial and quick expense sheet"
git push origin main
```

---

## Task 2: Painel "Agora" — visão operacional

**Files:**
- Modify: `dashboard.html` (~linha 2551 antes de `#widget-crm`, e `loadCalendar` ~linha 5499)

- [ ] **Step 1: Expor próximo evento do calendar**

Localizar `function loadCalendar()` (~linha 5499). Dentro da função, após `const events = data.events || [];`, adicionar:

```javascript
    window._nextCalEvent = events.find(e => e.start && new Date(e.start) > new Date()) || null;
    updateAgoraCard();
```

- [ ] **Step 2: Inserir HTML do card Agora**

Localizar `<div class="card" id="widget-crm"` (linha ~2552) e inserir ANTES:

```html
<!-- ── PAINEL AGORA ──────────────────────────────────── -->
<div class="card" id="widget-agora" data-widget-id="agora" data-section="clinica" style="grid-column:span 4">
  <div class="card-head">
    <div class="c-icon" style="background:linear-gradient(135deg,#0ea5e9,#6366f1);box-shadow:0 0 14px rgba(99,102,241,.3)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </div>
    <div><div class="c-title">Agora</div><div class="c-sub" id="agora-sub">Carregando...</div></div>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;padding:12px 16px 14px">
    <div class="agora-stat" onclick="showSection('clinica');document.getElementById('widget-tasks')?.scrollIntoView({behavior:'smooth'})" title="Tarefas pendentes">
      <div class="agora-val" id="agora-tarefas-val">—</div>
      <div class="agora-lbl">Tarefas</div>
    </div>
    <div class="agora-stat" onclick="showSection('infra');document.getElementById('widget-vidavirtual')?.scrollIntoView({behavior:'smooth'})" title="OS atrasadas VidaVirtual">
      <div class="agora-val" id="agora-os-val">—</div>
      <div class="agora-lbl">OS Atrasadas</div>
    </div>
    <div class="agora-stat" onclick="showSection('infra');document.getElementById('widget-supervisor-ia')?.scrollIntoView({behavior:'smooth'})" title="Alertas ativos">
      <div class="agora-val" id="agora-alertas-val">—</div>
      <div class="agora-lbl">Alertas</div>
    </div>
    <div class="agora-stat" style="flex:2;min-width:160px" title="Proximo evento Google Calendar">
      <div class="agora-val" style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" id="agora-evento-val">—</div>
      <div class="agora-lbl">Proximo evento</div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Adicionar JS do Agora card**

Adicionar antes do `/* Init mini widget on page load */` do CRM (linha ~12285):

```javascript
/* ── PAINEL AGORA ────────────────────────────────────── */
function updateAgoraCard() {
  const sub = document.getElementById('agora-sub');
  if (sub) sub.textContent = 'Atualizado ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});

  try {
    const tasks = typeof loadTasks === 'function' ? loadTasks() : [];
    const pending = tasks.filter(t => !t.done && !t.completed && !t.concluida).length;
    const el = document.getElementById('agora-tarefas-val');
    if (el) { el.textContent = pending; el.style.color = pending > 3 ? '#f59e0b' : pending > 0 ? '#60a5fa' : '#22c55e'; }
  } catch(e) {}

  try {
    const osEl = document.getElementById('vv-os-atrasadas');
    const atrasadas = osEl ? (parseInt(osEl.textContent) || 0) : 0;
    const el = document.getElementById('agora-os-val');
    if (el) { el.textContent = atrasadas; el.style.color = atrasadas > 0 ? '#ef4444' : '#22c55e'; }
  } catch(e) {}

  try {
    const alerts = typeof loadAlerts === 'function' ? loadAlerts().filter(a => !a.resolved) : [];
    const el = document.getElementById('agora-alertas-val');
    if (el) { el.textContent = alerts.length; el.style.color = alerts.length > 0 ? '#ef4444' : '#22c55e'; }
  } catch(e) {}

  try {
    const ev = window._nextCalEvent;
    const el = document.getElementById('agora-evento-val');
    if (el && ev) {
      const t = ev.start ? new Date(ev.start).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : '';
      el.textContent = (t ? t + ' ' : '') + (ev.title || ev.summary || 'Evento');
      el.style.color = 'var(--text)';
    } else if (el) {
      el.textContent = 'Sem eventos proximos';
      el.style.color = 'var(--muted2)';
    }
  } catch(e) {}
}
setInterval(updateAgoraCard, 30000);
document.addEventListener('DOMContentLoaded', () => setTimeout(updateAgoraCard, 2000));
```

- [ ] **Step 4: Chamar updateAgoraCard onde os dados mudam**

Localizar `function saveTasks(t)` (linha ~4623) e adicionar `updateAgoraCard();` ao final:

```javascript
function saveTasks(t){ LS.set('dash_tasks',t); renderTasks(); sbSyncTarefas(); updateAgoraCard(); }
```

Localizar `function resolveAlert(id)` (linha ~10393) e adicionar `updateAgoraCard();` após `renderAlerts();`.

Localizar o bloco onde `vvLoad` atualiza `#vv-os-atrasadas` (linha ~10616) e adicionar `updateAgoraCard();` após o `set('vv-os-atrasadas', ...)`.

- [ ] **Step 5: Verificar**

Abrir dashboard. Widget "Agora" aparece no topo da secao Clinica com 4 stats. Clicar em "Tarefas" → scroll para widget de tarefas. Clicar em "OS Atrasadas" → scroll para VidaVirtual. Valores atualizam quando tarefas ou alertas mudam.

- [ ] **Step 6: Commit**

```bash
git add dashboard.html
git commit -m "feat(ux): add operational now panel with live task, alert and OS counters"
git push origin main
```

---

## Task 3: Mobile bottom nav — estado ativo + "+" atalho

**Files:**
- Modify: `dashboard.html` — bottom nav (~linha 12325) e `showSection()` function

- [ ] **Step 1: Adicionar CSS para estado ativo**

Localizar `/* === MOBILE NAV === */` ou `#mobile-nav` no CSS e adicionar:

```css
.mn-btn.active { color: var(--accent) !important; }
.mn-btn.active svg { stroke: var(--accent) !important; }
```

Se nao encontrar o seletor, buscar `.mn-btn` no CSS e adicionar a regra `.active` após.

- [ ] **Step 2: Atualizar showSection para marcar botao ativo**

Localizar `function showSection(` e dentro da função, após o código de mostrar/ocultar widgets, adicionar:

```javascript
  document.querySelectorAll('.mn-btn').forEach(b => b.classList.remove('active'));
  const map = { clinica: 0, marketing: 2, infra: 3 };
  const idx = map[sec];
  if (idx !== undefined) {
    const btns = document.querySelectorAll('.mn-btn');
    if (btns[idx]) btns[idx].classList.add('active');
  }
```

- [ ] **Step 3: Verificar**

No mobile (ou DevTools com viewport estreito), clicar em cada aba do bottom nav. O botao correspondente deve ficar azul/accent. O botao "+" do FAB permanece no canto inferior direito sobreposto ao bottom nav.

- [ ] **Step 4: Commit**

```bash
git add dashboard.html
git commit -m "fix(ux): add active state to mobile bottom nav buttons"
git push origin main
```

---

## Task 4: Performance — fetch dedup e timeouts padronizados

**Files:**
- Modify: `dashboard.html` — adicionar cache de fetch, padronizar timeout em fetches sem AbortSignal

- [ ] **Step 1: Adicionar utilitário de fetch com dedup**

Adicionar ANTES do bloco `/* ─── SUPABASE SYNC */` (linha ~3991):

```javascript
/* ── FETCH DEDUP — evita chamadas duplicadas na mesma sessao ── */
const _fetchOnce = {};
async function fetchOnce(url, opts = {}, ttlMs = 30000) {
  const key = url + (opts.body || '');
  const now = Date.now();
  if (_fetchOnce[key] && now - _fetchOnce[key].ts < ttlMs) {
    return _fetchOnce[key].data;
  }
  const r = await fetch(url, opts);
  const data = r.ok ? await r.json().catch(() => null) : null;
  if (data) _fetchOnce[key] = { ts: now, data };
  return data;
}
function invalidateFetch(urlPrefix) {
  Object.keys(_fetchOnce).forEach(k => { if (k.startsWith(urlPrefix)) delete _fetchOnce[k]; });
}
```

- [ ] **Step 2: Aplicar fetchOnce no token/status (chamado por multiplos widgets)**

Localizar todas as chamadas a `fetch('/api/token/status')` (buscar no HTML). Para cada ocorrencia que apenas le o status (sem efeitos colaterais), substituir:

```javascript
// Antes:
const r = await fetch('/api/token/status');

// Depois:
const statusData = await fetchOnce('/api/token/status', {}, 60000);
```

Ajustar o código subsequente para usar `statusData` diretamente em vez de `r.json()`.

- [ ] **Step 3: Padronizar timeout em fetches de calendario e gmail**

Localizar `fetch('/api/google/calendar',` e confirmar que tem `signal: AbortSignal.timeout(...)`. Se nao tiver, adicionar `signal: AbortSignal.timeout(10000)` nos options do fetch.

Localizar `fetch('/api/google/gmail',` e fazer o mesmo.

Buscar por `fetch('/api/google/drive',` e fazer o mesmo.

- [ ] **Step 4: Verificar com DevTools**

Abrir DevTools Network tab. Recarregar dashboard. Verificar que `/api/token/status` aparece no maximo 1-2 vezes (nao 5-6 como antes). Verificar que todos os fetch de Google APIs tem timeout configurado (olhar nos Request Headers ou no código).

- [ ] **Step 5: Commit**

```bash
git add dashboard.html
git commit -m "perf(ux): add fetch dedup cache and standardize API timeouts"
git push origin main
```

---

## Self-review

**Spec coverage:**
- Mobile-first real: ✅ Task 1 (FAB mobile), Task 3 (bottom nav ativo)
- Quick actions: ✅ Task 1 (6 ações via FAB + sheet gasto)
- Feedback visual: ✅ Task 1 (`showToast` em cada ação), Task 2 (cores por severidade no Agora card)
- Painel operacional: ✅ Task 2 (Agora card com 4 stats clicaveis)
- Performance: ✅ Task 4 (fetchOnce dedup + timeout standardization)

**Gaps identificados:**
- "swipe" entre secoes: nao incluido -- requer gestao de touch events complexa, deixar para fase seguinte
- "nova OS VidaVirtual": implementado como link externo (open tab) -- nao e possivel criar OS dentro do dashboard sem backend VidaVirtual

**Ordem de prioridade:**
1. Task 1 (FAB) -- maior redução de cliques
2. Task 2 (Agora) -- visao operacional imediata
3. Task 3 (bottom nav) -- quick win 10 min
4. Task 4 (performance) -- elimina fetches redundantes
