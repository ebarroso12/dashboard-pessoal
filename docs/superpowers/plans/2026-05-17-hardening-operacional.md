# Hardening + Operação Real — Dashboard Pessoal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover anon key CRM do HTML público, fortalecer o health panel e garantir loading states honestos sem refatorar a arquitetura.

**Architecture:** FASE 1 cria `api/crm.js` (service_role server-side) e atualiza o dashboard para usar esse proxy em vez de chamar o Supabase CRM diretamente. FASE 2 adiciona VidaVirtual, CRM e alerts ao painel de infra existente com novos tipos de scan. FASE 3+4 adiciona loading timeout guard para os dois widgets que ficam presos.

**Tech Stack:** Vercel serverless ESM, Supabase REST API, dashboard.html vanilla JS (12 419 linhas)

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `api/crm.js` | CRIAR | Proxy backend CRM — GET leads, POST create/update/move |
| `dashboard.html` ln 12016-12017 | REMOVER | Constantes `CRM_SB_URL` e `CRM_SB_KEY` |
| `dashboard.html` fn `crmFetch` | MODIFICAR | Chama `/api/crm` em vez de Supabase direto |
| `dashboard.html` fn `crmUpdateStatus` | MODIFICAR | Chama `/api/crm` action=move |
| `dashboard.html` fn `saveCRMEdit` | MODIFICAR | Chama `/api/crm` action=create ou update |
| `dashboard.html` ln 9017-9027 | MODIFICAR | Adiciona 3 serviços ao `_infraServices` |
| `dashboard.html` fn `infraScanNow` | MODIFICAR | Adiciona tipos `json_ok` e `json_status` |
| `dashboard.html` fn `iaAnalyzeNow` | MODIFICAR | Adiciona fix messages para novos serviços |
| `dashboard.html` fn `vvLoad` | MODIFICAR | Timeout fallback 15s |
| `dashboard.html` fn `gerarBriefing` | MODIFICAR | Timeout fallback 25s |

---

## Riscos e quick wins

**Quick wins (sem dependência entre si):**
- Task 3 (health panel) — nenhuma dependência, 5 min, zero risco
- Task 4 (loading timeout) — cirúrgico, 10 min, zero risco

**Requer sequência:**
- Task 1 antes de Task 2 — proxy deve existir antes de atualizar o frontend
- Task 2 requer env var `CRM_SUPABASE_SERVICE_ROLE_KEY` configurada no Vercel antes do deploy

**Risco principal:** Task 2 é cirurgia em 12 419 linhas de HTML. Sempre verificar com `git diff` antes de commitar.

---

## FASE 1 — HARDENING

### Task 1: Criar api/crm.js — proxy backend para CRM

**Files:**
- Create: `api/crm.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
// api/crm.js
// Proxy server-side para o CRM Kanban.
// Remove anon key do frontend — usa service_role para bypass de RLS.

const CRM_URL       = 'https://zlrydmfwsobheajaeael.supabase.co';
const ALLOWED_ORIGIN = 'https://dashboard-pessoal-edson.vercel.app';

function crmSB(path, opts = {}) {
  const key = (process.env.CRM_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key) throw new Error('CRM_SUPABASE_SERVICE_ROLE_KEY nao configurado');
  return fetch(`${CRM_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(8000),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = (process.env.CRM_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key) return res.status(500).json({ ok: false, error: 'CRM_SUPABASE_SERVICE_ROLE_KEY nao configurado' });

  try {
    // GET — lista leads + contacts
    if (req.method === 'GET') {
      const [lRes, cRes] = await Promise.all([
        crmSB('/whatsapp_leads?select=*&order=created_at.desc'),
        crmSB('/whatsapp_contacts?select=*'),
      ]);
      const leads    = lRes.ok ? await lRes.json() : [];
      const contacts = cRes.ok ? await cRes.json() : [];
      const map = {};
      contacts.forEach(c => { map[c.id] = c; });
      return res.status(200).json({
        ok:    true,
        leads: leads.map(l => ({ ...l, _contact: map[l.contact_id] || {} })),
      });
    }

    if (req.method === 'POST') {
      const { action, payload = {} } = req.body || {};

      // action=create — INSERT contact + lead
      if (action === 'create') {
        const { contactId, leadId, name, status, interesse, resumo, now } = payload;
        await crmSB('/whatsapp_contacts', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ id: contactId, name: name || 'Sem nome', phone: '' }),
        });
        await crmSB('/whatsapp_leads', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ id: leadId, contact_id: contactId, status, interesse, resumo, created_at: now, updated_at: now }),
        });
        return res.status(200).json({ ok: true });
      }

      // action=update — PATCH lead + opcionalmente contact name
      if (action === 'update') {
        const { leadId, contactId, name, status, interesse, resumo, now } = payload;
        const ops = [
          crmSB(`/whatsapp_leads?id=eq.${leadId}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ status, interesse, resumo, updated_at: now }),
          }),
        ];
        if (contactId && name) {
          ops.push(crmSB(`/whatsapp_contacts?id=eq.${contactId}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ name }),
          }));
        }
        await Promise.all(ops);
        return res.status(200).json({ ok: true });
      }

      // action=move — PATCH status apenas (drag-drop)
      if (action === 'move') {
        const { leadId, status, now } = payload;
        await crmSB(`/whatsapp_leads?id=eq.${leadId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status, updated_at: now }),
        });
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: `action desconhecida: ${action}` });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message });
  }
}
```

- [ ] **Step 2: Validar localmente que o arquivo é ESM válido**

```bash
node --input-type=module < api/crm.js 2>&1 | head -5
# Expected: nenhum erro de parse (vai falhar em runtime por falta de env, mas não em parse)
```

- [ ] **Step 3: Adicionar env var no Vercel**

No painel Vercel > projeto `dashboard-pessoal-edson` > Settings > Environment Variables:
- `CRM_SUPABASE_SERVICE_ROLE_KEY` = service_role key do projeto `zlrydmfwsobheajaeael`

- [ ] **Step 4: Commitar apenas api/crm.js**

```bash
git add api/crm.js
git commit -m "feat(crm): add server-side proxy endpoint for CRM CRUD"
git push origin main
```

- [ ] **Step 5: Aguardar deploy e validar GET /api/crm**

```bash
curl -s "https://dashboard-pessoal-edson.vercel.app/api/crm" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok:', d.get('ok'), '| leads:', len(d.get('leads',[])))"
# Expected: ok: True | leads: 1 (ou mais)
```

- [ ] **Step 6: Validar POST create via proxy**

```bash
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
curl -s -X POST -H "Content-Type: application/json" \
  "https://dashboard-pessoal-edson.vercel.app/api/crm" \
  -d "{\"action\":\"create\",\"payload\":{\"contactId\":\"test-c-001\",\"leadId\":\"test-l-001\",\"name\":\"Teste Proxy\",\"status\":\"nurturing\",\"interesse\":\"teste\",\"resumo\":\"validacao\",\"now\":\"$NOW\"}}"
# Expected: {"ok":true}
```

- [ ] **Step 7: Limpar dado de teste**

```bash
SRK="<CRM_SUPABASE_SERVICE_ROLE_KEY>"
curl -s -X DELETE \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  "https://zlrydmfwsobheajaeael.supabase.co/rest/v1/whatsapp_leads?id=eq.test-l-001"
curl -s -X DELETE \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  "https://zlrydmfwsobheajaeael.supabase.co/rest/v1/whatsapp_contacts?id=eq.test-c-001"
```

---

### Task 2: Atualizar dashboard.html — CRM usa proxy, remover anon key

**Files:**
- Modify: `dashboard.html` (linhas 12016-12017, funções `crmFetch`, `crmUpdateStatus`, `saveCRMEdit`)

**Pré-requisito:** Task 1 deployada e validada.

- [ ] **Step 1: Remover CRM_SB_URL e CRM_SB_KEY (linhas 12016-12017)**

Localizar e remover exatamente:
```javascript
const CRM_SB_URL  = 'https://zlrydmfwsobheajaeael.supabase.co';
const CRM_SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscnlkbWZ3c29iaGVhamFlYWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQ2NTEsImV4cCI6MjA5MzQ4MDY1MX0.wNA7iFkwIBhPAJO6x5Y3xqeyxGUFAmM1a551Grhcu2E';
```

- [ ] **Step 2: Substituir função crmFetch (buscar por `async function crmFetch()`)**

Substituir:
```javascript
async function crmFetch() {
  try {
    const headers = { apikey: CRM_SB_KEY, Authorization: 'Bearer ' + CRM_SB_KEY };
    const [lRes, cRes] = await Promise.all([
      fetch(CRM_SB_URL + '/rest/v1/whatsapp_leads?select=*&order=created_at.desc', { headers }),
      fetch(CRM_SB_URL + '/rest/v1/whatsapp_contacts?select=*', { headers }),
    ]);
    const leads    = lRes.ok ? await lRes.json() : [];
    const contacts = cRes.ok ? await cRes.json() : [];
    crmContacts = {};
    contacts.forEach(c => { crmContacts[c.id] = c; });
    crmLeads = leads.map(l => ({
      ...l,
      _contact: crmContacts[l.contact_id] || {},
    }));
  } catch(e) { console.error('CRM fetch error', e); }
}
```

Por:
```javascript
async function crmFetch() {
  try {
    const r = await fetch('/api/crm', { signal: AbortSignal.timeout(8000) });
    const data = r.ok ? await r.json() : { ok: false, leads: [] };
    crmLeads = data.leads || [];
    crmContacts = {};
    crmLeads.forEach(l => { if (l._contact) crmContacts[l.contact_id] = l._contact; });
  } catch(e) { console.error('CRM fetch error', e); }
}
```

- [ ] **Step 3: Substituir função crmUpdateStatus (buscar por `async function crmUpdateStatus(`)**

Substituir:
```javascript
async function crmUpdateStatus(leadId, newStatus) {
  const lead = crmLeads.find(l => l.id === leadId);
  if (!lead || lead.status === newStatus) return;
  lead.status = newStatus;
  lead.updated_at = new Date().toISOString();
  try {
    await fetch(CRM_SB_URL + '/rest/v1/whatsapp_leads?id=eq.' + leadId, {
      method: 'PATCH',
      headers: {
        apikey: CRM_SB_KEY,
        Authorization: 'Bearer ' + CRM_SB_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: newStatus, updated_at: lead.updated_at }),
    });
  } catch(e) { console.error('CRM update error', e); }
  crmUpdateMiniStats();
}
```

Por:
```javascript
async function crmUpdateStatus(leadId, newStatus) {
  const lead = crmLeads.find(l => l.id === leadId);
  if (!lead || lead.status === newStatus) return;
  lead.status = newStatus;
  lead.updated_at = new Date().toISOString();
  try {
    await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', payload: { leadId, status: newStatus, now: lead.updated_at } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch(e) { console.error('CRM move error', e); }
  crmUpdateMiniStats();
}
```

- [ ] **Step 4: Substituir função saveCRMEdit (buscar por `async function saveCRMEdit()`)**

Substituir todo o bloco `saveCRMEdit` por:
```javascript
async function saveCRMEdit() {
  const name      = (document.getElementById('crm-edit-name').value || '').trim();
  const status    = document.getElementById('crm-edit-status').value;
  const interesse = document.getElementById('crm-edit-interesse').value;
  const resumo    = document.getElementById('crm-edit-resumo').value;
  const now       = new Date().toISOString();
  try {
    if (_crmEditId) {
      const lead = crmLeads.find(l => l.id === _crmEditId);
      await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', payload: { leadId: _crmEditId, contactId: lead?.contact_id, name, status, interesse, resumo, now } }),
        signal: AbortSignal.timeout(8000),
      });
      if (lead) {
        lead.status = status; lead.interesse = interesse; lead.resumo = resumo; lead.updated_at = now;
        if (lead._contact) lead._contact.name = name || lead._contact.name;
      }
    } else {
      const contactId = crypto.randomUUID();
      const leadId    = crypto.randomUUID();
      await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', payload: { contactId, leadId, name, status, interesse, resumo, now } }),
        signal: AbortSignal.timeout(8000),
      });
      crmLeads.unshift({
        id: leadId, contact_id: contactId, status, interesse, resumo,
        created_at: now, updated_at: now,
        _contact: { id: contactId, name: name || 'Sem nome', phone: '' },
      });
    }
    closeCRMEdit();
    const q = document.getElementById('crm-search-inp');
    crmRenderBoard(q ? q.value : '');
    crmUpdateMiniStats();
  } catch(e) { console.error('CRM save error', e); }
}
```

- [ ] **Step 5: Verificar que CRM_SB_KEY não aparece mais no arquivo**

```bash
grep -n "CRM_SB_KEY\|CRM_SB_URL\|zlrydmfwsobheajaeael" dashboard.html
# Expected: nenhuma linha retornada
```

- [ ] **Step 6: Verificar que /api/crm aparece onde esperado**

```bash
grep -n "/api/crm" dashboard.html
# Expected: 3 ocorrências (crmFetch, crmUpdateStatus, saveCRMEdit)
```

- [ ] **Step 7: Commitar**

```bash
git add dashboard.html
git commit -m "fix(crm): replace client-side Supabase calls with server proxy, remove anon key from HTML"
git push origin main
```

- [ ] **Step 8: Validar CRM em produção após deploy**

Abrir `https://dashboard-pessoal-edson.vercel.app` no browser > seção Clínica > widget CRM.
- Mini-stats devem mostrar contagem real
- Clicar "Abrir Kanban" → leads aparecem
- Criar novo lead → aparece no board
- Editar lead → nome salva
- Drag-drop → status muda

---

## FASE 2 — HEALTH PANEL

### Task 3: Adicionar VidaVirtual, CRM e alerts ao painel de infra

**Files:**
- Modify: `dashboard.html` (linhas 9017-9027 e bloco `infraScanNow` linhas ~9057-9095 e `fixes` ~9125-9135)

**Pré-requisito:** Task 1 deployada (CRM endpoint precisa existir para o scan funcionar).

- [ ] **Step 1: Adicionar 3 serviços ao array `_infraServices` (linha 9026)**

Localizar:
```javascript
  { id:'calendar', name:'Google Calendar', url:'', icon:'📅', type:'google' }
];
```

Substituir por:
```javascript
  { id:'calendar',    name:'Google Calendar', url:'', icon:'📅', type:'google' },
  { id:'vidavirtual', name:'VidaVirtual',      url:'https://dashboard-pessoal-edson.vercel.app/api/vidavirtual/summary', icon:'📱', type:'json_status' },
  { id:'crm',         name:'CRM Leads',        url:'https://dashboard-pessoal-edson.vercel.app/api/crm',                 icon:'👥', type:'json_ok' },
  { id:'alerts',      name:'Alertas',           url:'https://dashboard-pessoal-edson.vercel.app/api/alerts',              icon:'🔔', type:'json_ok' },
];
```

- [ ] **Step 2: Adicionar handlers para novos tipos no bloco `infraScanNow`**

Localizar o bloco `else if (svc.type==='google')` e adicionar ANTES do `else {` final:

```javascript
      } else if (svc.type==='json_ok') {
        const r = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
        const d = r.ok ? await r.json().catch(() => ({})) : {};
        ok = r.ok && d.ok !== false;
        note = (Date.now()-start) + 'ms';
      } else if (svc.type==='json_status') {
        const r = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
        const d = r.ok ? await r.json().catch(() => ({})) : {};
        ok = r.ok && (d.status === 'ok' || d.status === 'sem_dados');
        note = d.status ? '(' + d.status + ') ' + (Date.now()-start) + 'ms' : (Date.now()-start) + 'ms';
```

- [ ] **Step 3: Adicionar fix messages no objeto `fixes` (em `iaAnalyzeNow`, linha ~9125)**

Localizar:
```javascript
      calendar:{d:'Token Google expirado',s:'Clique em Reconectar Google'}
    };
```

Substituir por:
```javascript
      calendar:    {d:'Token Google expirado',     s:'Clique em Reconectar Google'},
      vidavirtual: {d:'VidaVirtual indisponivel',  s:'Verificar env VIDAVIRTUAL_SERVICE_ROLE_KEY no Vercel'},
      crm:         {d:'CRM proxy nao responde',     s:'Verificar env CRM_SUPABASE_SERVICE_ROLE_KEY no Vercel'},
      alerts:      {d:'Alertas nao respondem',      s:'Verificar tabela dashboard_alerts no Supabase jaewjscbigfwjiaeavft'},
    };
```

- [ ] **Step 4: Commitar**

```bash
git add dashboard.html
git commit -m "feat(infra): add VidaVirtual, CRM and alerts to health panel"
git push origin main
```

- [ ] **Step 5: Validar**

Abrir dashboard > seção Infra > clicar "Scan Agora".
- Deve aparecer card VidaVirtual, CRM Leads, Alertas
- VidaVirtual deve mostrar 🟢 Online com status entre parênteses
- CRM deve mostrar 🟢 Online
- Alerts deve mostrar 🟢 Online

---

## FASE 3+4 — UX + ESTABILIDADE

### Task 4: Loading timeout guard para VidaVirtual e Briefing

**Files:**
- Modify: `dashboard.html` (funções `vvLoad` e `gerarBriefing` — buscar por nome)

- [ ] **Step 1: Adicionar utilitário `_withTimeout` no bloco de funções utilitárias**

Localizar a linha com `function showToast(` (em torno de linha 5225) e adicionar ANTES:

```javascript
function _withTimeout(ms, onTimeout) {
  const t = setTimeout(onTimeout, ms);
  return () => clearTimeout(t);
}
```

- [ ] **Step 2: Aplicar timeout ao vvLoad — localizar `async function vvLoad(`**

O padrão atual: a função chama `/api/vidavirtual/summary`, mostra `vv-loading`, então mostra `vv-data` ou `vv-error` ou `vv-no-config`.

Adicionar no início do bloco `try` dentro de `vvLoad`:

```javascript
  const _clearTimeout = _withTimeout(15000, () => {
    document.getElementById('vv-loading').style.display = 'none';
    const errEl = document.getElementById('vv-error');
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'VidaVirtual: tempo esgotado — tente novamente.'; }
  });
```

E no bloco `finally` (ou após o `catch`), chamar `_clearTimeout()`.

Se a função não tiver `finally`, adicionar:
```javascript
  } catch(e) {
    _clearTimeout();
    // ... resto do catch existente
  }
  // Se não há finally, adicionar após o catch:
  _clearTimeout();
```

- [ ] **Step 3: Aplicar timeout ao gerarBriefing — localizar `async function gerarBriefing(`**

Adicionar no início da função:

```javascript
  const _clearBriefingTimeout = _withTimeout(25000, () => {
    const textEl = document.getElementById('morning-text');
    const subEl  = document.getElementById('morning-sub');
    if (textEl) textEl.textContent = 'Tempo esgotado ao gerar briefing. Tente novamente.';
    if (subEl)  subEl.textContent  = '';
  });
```

Chamar `_clearBriefingTimeout()` no `finally` ou `catch`.

- [ ] **Step 4: Commitar**

```bash
git add dashboard.html
git commit -m "fix(ux): add loading timeout guard to VidaVirtual and Briefing widgets"
git push origin main
```

- [ ] **Step 5: Validar**

Para testar o timeout de VidaVirtual: desconectar da internet, abrir dashboard, clicar atualizar no widget VidaVirtual. Após 15s deve aparecer mensagem de timeout em vez de loading infinito.

Para testar o timeout de Briefing: mesmo procedimento. Após 25s deve mostrar mensagem de erro.

---

## Ordem de implementação recomendada

```
Task 1 (api/crm.js)          ← sem risco, arquivo novo
  └── adicionar env no Vercel
Task 2 (dashboard.html CRM)  ← após Task 1 deployada
Task 3 (health panel)        ← independente, quick win
Task 4 (loading timeout)     ← independente, quick win
```

Tasks 3 e 4 podem ser feitas em qualquer ordem, independentes de 1 e 2.

---

## Riscos restantes após este plano

| Risco | Severidade | Ação futura |
|---|---|---|
| `SB_ANON` hardcoded no HTML (ln 3993) — acesso read-only a `comandos` | MÉDIO | Avaliar se tabela `comandos` tem RLS. Não urgente. |
| Meta #131037 intermitente para PHONE_BRIEFING | PLATAFORMA | Aprovar display name no Meta Business Manager |
| RLS do Supabase principal permissiva para anon em algumas tabelas | MÉDIO | Auditar policies após esta fase |
