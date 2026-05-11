# OpenClaw vs server-vps.js — Analise de Responsabilidades

> Leitura pura. Nenhum codigo alterado.
> Data: 2026-05-11
> Fonte: docs/20, 21, 22 + leitura direta de server-vps.js, api/*, dashboard.html

---

## Tabela comparativa por funcao

| Funcao | OpenClaw/Vercel cobre? | server-vps.js cobre? | Criticidade | Impacto atual |
|--------|------------------------|----------------------|-------------|---------------|
| Receber audio/texto do WhatsApp | SIM — OpenClaw gateway → POST /api/webhook → `comandos` | NAO — sem `client.on('message')` | Alta | Funcionando |
| Responder comandos (agenda, tarefas, etc.) | SIM — /api/comandos | NAO | Alta | Funcionando |
| Assistente linguagem natural | SIM — /api/assistente | NAO | Alta | Funcionando |
| Enviar mensagem de saida pelo WhatsApp | SIM — api/lib/openclaw.js `sendWhatsApp()` | NAO (sem implementacao de envio) | Media | Funcionando |
| Supervisor IA / diagnosticos | SIM — /api/supervisor (agente Claude) | NAO | Media | Funcionando |
| Cron / morning briefing | SIM — /api/cron (Vercel) | NAO | Media | Funcionando |
| Gerenciar conexao WA (QR, auth, sessao) | NAO — OpenClaw gerencia a propria conexao internamente | SIM exclusivo — wa_connections | Media | Depende do VPS |
| Lista de conversas CRM (wa_chats) | NAO | SIM exclusivo — syncChats() | Baixa | Sem consumidor no dashboard |
| Analise de conversa via Claude (wa_analyses) | NAO | SIM exclusivo — processRequest() | Baixa | Sem consumidor no dashboard |
| Fila de pedidos de analise (wa_requests) | NAO — zero codigo de escrita | SIM exclusivo — polling | Baixa | Sem produtor no dashboard |

---

## O que depende EXCLUSIVAMENTE do server-vps.js

### 1. Gestao de sessao WhatsApp Web (`wa_connections`)
`server-vps.js` e o unico que faz o ciclo:
`pending → connecting → qr → authenticated → connected`

Sem ele, qualquer numero WA configurado no dashboard fica preso em `pending`
e nunca gera QR code.

**Porem:** OpenClaw tem sua propria conexao WA independente (WebSocket no
gateway `openclaw.n8ndredson.com`). O fluxo de comandos nao passa por
`wa_connections` — usa apenas o gateway OpenClaw.

### 2. Lista de conversas CRM (`wa_chats`)
Somente `server-vps.js` escreve nesta tabela. Nenhum arquivo do repo le.
O widget CRM que exibiria essa lista nao existe no dashboard.html atual.

### 3. Analise de conversas (`wa_analyses`)
Somente `server-vps.js` escreve. Nenhum arquivo do repo le.
O resultado das analises (gerado com custo de token Claude) fica na tabela
sem ser exibido em lugar algum.

### 4. Fila de analise (`wa_requests`)
Somente `server-vps.js` le e processa. Nenhum arquivo do repo escreve.
A fila nao tem produtor visivel — o widget que criaria pedidos nao foi
implementado no dashboard.html.

---

## O que funciona APENAS via OpenClaw (sem VPS)

- Todos os comandos por audio ou texto via WhatsApp (fluxo principal)
- Toda a API Vercel (`/api/webhook`, `/api/comandos`, `/api/assistente`, `/api/supervisor`)
- Widget "OpenClaw Voz" no dashboard (polling de `comandos`)
- Google Calendar, Gmail, Drive
- Financas, Tarefas, Metas (via Vercel)
- Monitor IA e Supervisor IA
- Cron e alertas

---

## Tabelas wa_* congeladas sem VPS

| Tabela | Estado sem VPS | Impacto no dashboard |
|--------|---------------|----------------------|
| `wa_connections` | Frozen — nenhum perfil conecta | Nenhum: sem widget que exiba |
| `wa_chats` | Frozen — lista de chats parada | Nenhum: sem widget que leia |
| `wa_analyses` | Frozen — nenhuma analise gravada | Nenhum: sem widget que leia |
| `wa_requests` | Frozen — fila nao processada | Nenhum: sem produtor de pedidos |

**Conclusao:** o congelamento dessas tabelas nao quebra nenhuma funcionalidade
visivel no dashboard hoje, porque nenhum widget do dashboard.html atual
consome essas tabelas diretamente.

---

## Funcionalidades do dashboard que dependem do VPS

**Zero funcionalidades ativas no dashboard dependem do server-vps.js hoje.**

O unico widget que referencia WhatsApp no dashboard usa:
- OpenClaw Voz: polling da tabela `comandos` via Supabase REST (Vercel)
- WhatsApp Contatos Rapidos: envia link `wa.me/` (nao usa server-vps.js)

---

## Veredicto

`server-vps.js` implementa um CRM de conversas WhatsApp (lista de chats,
analise por Claude, gestao de sessao) que **nao foi integrado ao dashboard**.
O frontend que consumiria `wa_chats`, `wa_analyses` e `wa_requests` nao existe.

O fluxo operacional principal — comandos via WhatsApp respondidos pelo
dashboard — **ja funciona 100% via OpenClaw + Vercel**, sem nenhuma dependencia
do `server-vps.js`.

| Decisao possivel | Consequencia |
|------------------|--------------|
| Manter server-vps.js parado | Nenhuma funcionalidade atual e perdida |
| Reativar server-vps.js | Habilita CRM de conversas, mas falta o frontend |
| Remover server-vps.js do repo | Limpa codigo morto; exige decisao sobre o CRM |

---

## Decisao registrada — 2026-05-11

**OpenClaw/Vercel e o fluxo oficial atual.**

- `server-vps.js` esta parado/desconectado e permanece assim por ora
- CRM (`wa_chats`, `wa_analyses`, `wa_connections`, `wa_requests`) nao esta
  integrado ao dashboard e vai para backlog tecnico
- Nao ressuscitar o VPS agora
- Proximo foco: fortalecer o fluxo OpenClaw/Vercel existente
