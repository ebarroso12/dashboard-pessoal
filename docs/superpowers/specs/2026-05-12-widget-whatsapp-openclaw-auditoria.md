# Ficha de Auditoria — Widget WhatsApp / OpenClaw

> Data: 2026-05-13
> Escopo: analise estatica. Sem alteracao de codigo, banco ou deploy.
> Arquivos lidos: dashboard.html, api/whatsapp/test.js, api/lib/openclaw.js

---

## 1. Fonte real dos dados do widget

O widget tem dois fluxos distintos:

**Leitura do feed (historico de comandos):**
- Frontend faz polling direto na Supabase REST API a cada 4s
- URL: `https://jaewjscbigfwjiaeavft.supabase.co/rest/v1/comandos?select=*&order=ts.desc&limit=20`
- Anon key hardcoded no JS (dashboard.html linha 8420)
- NAO passa pelo `/api/webhook` GET — va direto ao banco

**Escrita (inbound, comandos recebidos):**
- n8n ou OpenClaw fazem POST para `/api/webhook`
- `api/webhook.js` valida token e insere na tabela `comandos` do Supabase

**Envio outbound (test.js):**
- `api/lib/openclaw.js` chama `graph.facebook.com/v19.0/{phoneId}/messages`
- Meta Business API — operacional

---

## 2. Ultimo evento registrado

Impossivel determinar via analise estatica. O que aparece no widget ao carregar sao 3 registros ESTATICOS hardcoded no HTML (dashboard.html linhas 2437-2494), nao dados do Supabase. Todos mostram "16:06" e "Teste de conexao OpenClaw" com resposta fake "Dashboard conectado com sucesso!". O contador na rodape tambem esta hardcoded: "1 comando recebido" (linha 2506). Para saber o ultimo evento real, e necessario consultar a tabela `comandos` no Supabase.

---

## 3. Canal atual usado

| Direcao | Canal real |
|---|---|
| Outbound (envio) | Meta WA Business API via `api/lib/openclaw.js` |
| Inbound (recepcao) | OpenClaw como interface humana -> n8n -> POST `/api/webhook` |
| Leitura frontend | Supabase REST direto (polling 4s) |

O nome `openclaw.js` e o comentario "via OpenClaw WebSocket" em `test.js` sao legados. O codigo usa exclusivamente Meta API para envio.

---

## 4. Dependencias

| Dependencia | Tipo | Status |
|---|---|---|
| `SUPABASE_ANON_KEY` | Hardcoded no JS linha 8420 | Anon key publica por design, mas exposta em source |
| `WEBHOOK_TOKEN` | Hardcoded no HTML linhas 2423, 2431 como `oc_edson_2026_secure` | **Exposto publicamente** |
| `WA_BUSINESS_TOKEN` | Env var Vercel | Necessaria para envio outbound |
| `WA_BUSINESS_PHONE_ID` | Fallback hardcoded `656678347527144` em `openclaw.js:10` | Funciona mas deveria ser so env |
| `PHONE_BRIEFING` | Env var Vercel | Sem ela, `alerts.js` silencia sem erro |
| n8n configurado | Externo | Necessario para inbound funcionar |
| Tabela `comandos` | Supabase | Deve existir com colunas: id, tipo, texto, resposta, de, ts, status |

---

## 5. Estados de erro

- `ocPoll()` (dashboard.html linha 8531) tem `catch(e) { /* servidor local offline - silencia */ }` — qualquer falha de rede, 401 ou Supabase indisponivel e engolida sem feedback visual
- Status badge nunca exibe "Erro" ou "Offline" — so muda para "Online" quando chega dado NOVO, e fica "Aguardando" (com texto em branco na init) nos demais casos
- Se Supabase retornar erro HTTP, widget continua mostrando conteudo estatico sem indicacao de problema
- `api/whatsapp/test.js` retorna sempre HTTP 200, mesmo em falha — diferencia via campo `ok` no JSON

---

## 6. Falso funcionamento possivel

**Problema principal:** o HTML do widget ja vem com 3 cards estaticos pre-renderizados no `#oc-feed` que imitam comandos reais recebidos. Eles mostram:
- Tipo: "Audio"
- Horario: "16:06"
- Texto: "Teste de conexao OpenClaw"
- Resposta: "Dashboard conectado com sucesso! Pode enviar audios pelo WhatsApp agora."

Esses 3 cards existem no source HTML e nao sao removidos automaticamente. `ocPoll()` so remove o placeholder `#oc-empty` quando chega dado real — nao limpa os cards estaticos. O `clearOCFeed()` remove todos os filhos de `#oc-feed` exceto `#oc-empty`, portanto o usuario pode limpа-los manualmente, mas ao recarregar a pagina eles voltam.

Cenarios de falso funcionamento:
1. Supabase `comandos` vazio — widget exibe 3 registros fake como se fossem comandos recebidos
2. n8n parado ou desconfigured — widget exibe historico antigo do Supabase (ou os 3 fakes se tabela vazia) sem indicar que canal esta inativo
3. `ocPoll()` falhando silenciosamente — widget nunca notifica, fica em "Aguardando" com conteudo desatualizado
4. Contador "1 comando recebido" hardcoded no HTML — usuario ve "1 comando" mesmo sem nenhum dado real

---

## 7. Veredito

**CRITICO COM RISCO**

- Feed inicial e 100% fake — 3 cards estaticos hardcoded enganam o usuario sobre estado real do canal
- Falha silenciosa em `ocPoll()` impede diagnostico de problemas no Supabase ou rede
- Token `oc_edson_2026_secure` exposto em texto claro no HTML publico (linhas 2423 e 2431), permitindo que qualquer pessoa com acesso ao source injete comandos autenticados em `/api/webhook`
- Nome do arquivo e comentarios legados ("OpenClaw WebSocket") criam confusao sobre arquitetura real (Meta API)

O canal outbound (Meta WA API) esta tecnicamente funcional. O widget de historico e o canal inbound sao os problemas.

---

## 8. Proxima correcao minima recomendada

Tres mudancas cirurgicas, por prioridade:

**1. Remover os 3 cards estaticos fake do HTML** (dashboard.html linhas 2437-2494)
Deixar apenas o placeholder `#oc-empty` no `#oc-feed`. Corrigir contador de "1 comando recebido" para "0 comandos recebidos". Custo: remover ~60 linhas de HTML, sem logica.

**2. Tornar erro de poll visivel** (`ocPoll()` linha 8531)
Substituir `catch(e) { /* silencia */ }` por `catch(e) { ocSetStatus(false); }`. Assim o badge mostra "Aguardando" com visual correto quando Supabase esta inacessivel. Custo: 1 linha.

**3. Trocar token hardcoded no HTML** (linhas 2423, 2431)
Remover `value="oc_edson_2026_secure"` do input e do bloco `<code>`. Substituir por instrucao textual: "use o valor de WEBHOOK_TOKEN configurado no Vercel". Nao ha como esconder o token de um campo de formulario publico — a solucao e nao mostrar o token real na UI de configuracao. Custo: 2 linhas HTML.
