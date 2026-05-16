# OpenClaw Recovery Runbook

**Servico:** OpenClaw (gateway WhatsApp)
**Infraestrutura:** Container Docker no Hostinger VPS, gerenciado via EasyPanel
**URL publica:** https://openclaw.n8ndredson.com
**Ultima revisao:** 2026-05-16

---

## Escopo e limites deste runbook

Em uma emergencia, comece pelo passo A e siga a ordem.

Este runbook cobre tres camadas distintas -- cada uma requer verificacao independente:

| Camada | O que verifica | Como verificar |
|---|---|---|
| URL publica / HTTP | O servidor HTTP responde | `curl -I` (secao F) |
| WebSocket / API | O protocolo WS aceita conexoes | Script Node.js (secao G) |
| WhatsApp real | Mensagens chegam e saem | Teste manual no dispositivo |

> **Atencao:** HTTP 200 e WebSocket 101 nao garantem que o WhatsApp esta funcionando.
> Somente um teste manual de envio/recepcao de mensagem confirma o canal WhatsApp.

---

## A. Verificar se o container existe

```bash
docker ps -a | grep -i openclaw
```

Resultados esperados:

| Saida | Significado |
|---|---|
| Linha com `Up X hours/minutes` | Container rodando normalmente |
| Linha com `Exited (X)` ou `Created` | Container parado -- veja secao C |
| Sem saida | Container removido ou nome diferente -- veja secao D, recriar via EasyPanel |

---

## B. Ver logs do container

```bash
docker logs openclaw --tail=100
```

Mensagens de log e causas:

| Mensagem no log | Causa provavel |
|---|---|
| `invalid request frame` | Token errado ou protocolo incompativel com a versao atual |
| `device identity mismatch` | Device ID mudou ou sessao WhatsApp expirou -- reautenticar |
| `ECONNREFUSED` | Gateway URL incorreta ou servico de destino offline |
| `Authentication failed` | Token invalido -- verificar variavel de ambiente (secao E) |
| `WebSocket connection failed` | Rede ou proxy bloqueando conexoes WebSocket |

---

## C. Reiniciar o container

> **AVISO: acao manual de risco moderado.**
> Confirme o nome exato do container em `docker ps -a` antes de executar.
> Reiniciar interrompe conexoes ativas e pode causar perda de mensagens em transito.

```bash
docker restart openclaw
```

Verificar apos reinicio:

```bash
docker ps | grep openclaw
```

Resultado esperado: linha com `Up X seconds` indica que o container subiu com sucesso.

---

## D. Se nao souber o nome exato do container

Liste todos os containers para identificar o nome ou ID correto:

```bash
docker ps -a
```

Localize o container do OpenClaw pela imagem ou pela coluna `NAMES`.
Use o nome ou ID encontrado no lugar de `openclaw`:

```bash
CONTAINER=openclaw  # altere para o nome correto
docker restart "$CONTAINER"
```

Se o container nao aparecer na lista, ele foi removido. Recrie-o via EasyPanel no painel do Hostinger VPS.

---

## E. Verificar porta e variaveis de ambiente

```bash
docker inspect openclaw | grep -A 5 '"Ports"'
```

> **ATENCAO: este comando exibe valores de tokens e variaveis sensiveis no terminal. Nao compartilhe a saida em tickets, capturas de tela ou chats.**

```bash
docker exec openclaw env | grep -E 'OPENCLAW|GATEWAY|TOKEN|DEVICE'
```

Variaveis de ambiente esperadas:

| Variavel | Descricao |
|---|---|
| `OPENCLAW_TOKEN` | Token de autenticacao do OpenClaw |
| `OPENCLAW_GATEWAY_TOKEN` | Token do gateway de mensagens |
| `GATEWAY_URL` | URL do gateway de mensagens |
| `DEVICE_ID` | Identificador do dispositivo WhatsApp vinculado |
| `OPERATOR_TOKEN` | Token do operador para chamadas internas |

Se alguma variavel estiver ausente ou com valor incorreto, corrija no EasyPanel e reinicie o container (secao C).

---

## F. Testar URL publica (camada HTTP)

```bash
curl -I https://openclaw.n8ndredson.com
```

Respostas HTTP e significados:

| Codigo HTTP | Significado |
|---|---|
| `200 OK` | Servidor HTTP responde -- camada HTTP operacional |
| `301` / `302` | Redirecionamento -- verifique se o destino final responde |
| `502 Bad Gateway` | Proxy (nginx/Caddy) nao consegue alcancar o container |
| `503 Service Unavailable` | Container parado ou nao aceitando conexoes |
| `000` / timeout | DNS nao resolve ou porta bloqueada por firewall |

> **Importante:** HTTP 200 nao garante que o WhatsApp esta funcionando.
> Este teste confirma apenas que o servidor HTTP na URL publica responde.
> Para verificar o canal WhatsApp, faca um teste manual de envio e recepcao de mensagem.

---

## G. Testar WebSocket (camada WS/API)

Codigos de status WebSocket:

| Codigo | Significado |
|---|---|
| `101 Switching Protocols` | Handshake WebSocket bem-sucedido -- camada WS operacional |
| `1008 Policy Violation` | Token invalido ou autenticacao recusada |
| `1006 Abnormal Closure` | Conexao encerrada sem handshake completo -- rede/proxy pode estar bloqueando |
| Timeout sem resposta | DNS, firewall ou proxy nao permite WebSocket |

Script de teste (Node.js):

```bash
# Instale o pacote ws se nao estiver disponivel
npm install ws
```

```javascript
const WebSocket = require('ws');

const url = 'wss://openclaw.n8ndredson.com';
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('WebSocket conectado (codigo 101) -- handshake OK');
  ws.close();
});

ws.on('error', (err) => {
  console.error('Erro de conexao WebSocket:', err.message);
});

ws.on('close', (code, reason) => {
  console.log('Conexao encerrada. Codigo:', code, '| Motivo:', reason.toString() || '(sem motivo)');
});

setTimeout(() => {
  console.error('Timeout: sem resposta em 10 segundos');
  ws.terminate();
}, 10000);
```

> **Nota:** Se o gateway exigir token no handshake WebSocket, o script retornara 1008 sem autenticacao. Isso e esperado -- significa que o servidor esta online mas rejeita conexoes sem credenciais.

> **Importante:** WebSocket 101 confirma apenas que o servidor aceita conexoes WS.
> Somente o WhatsApp real pode confirmar envio e recepcao de mensagens.
> Para isso, envie uma mensagem de teste pelo numero vinculado e verifique se chegou.

---

## H. Variaveis criticas -- onde configurar

**Container (VPS Hostinger):** Configure via EasyPanel. As variaveis sao injetadas no container no momento do deploy ou reinicio.

**Dashboard Vercel:** A variavel `WEBHOOK_TOKEN` autentica as chamadas OpenClaw -> `/api/webhook`. Configure no painel do Vercel em Settings > Environment Variables.

> **Nenhum valor de token deve ser registrado neste documento.**
> Use apenas os nomes das variaveis listados na secao E.

> **Redeploy obrigatorio no Vercel apos alterar variaveis de ambiente.**
> Variaveis novas ou alteradas so entram em vigor apos um novo deploy ser concluido.

---

## I. Checklist de recuperacao

Execute na ordem. Cada item deve estar OK antes de avancar.

- [ ] Container online: `docker ps | grep openclaw` mostra `Up`
- [ ] Logs sem erro critico: `docker logs openclaw --tail=50` sem `Authentication failed`, `device identity mismatch` ou `invalid request frame` persistentes
- [ ] URL publica responde: `curl -I https://openclaw.n8ndredson.com` retorna HTTP 200
- [ ] Dashboard mostra OpenClaw online: widget no dashboard reflete status operacional (poll a cada 4s via tabela `comandos` no Supabase). Alternativa: verifique a tabela `comandos` no Supabase diretamente para confirmar recepcao de comandos.
- [ ] WhatsApp responde a teste manual: envie uma mensagem pelo numero vinculado e confirme recepcao

---

## J. Troubleshooting

### "invalid request frame" nos logs

**Causa:** Token enviado no handshake nao corresponde ao esperado pelo servidor, ou o cliente esta usando uma versao de protocolo incompativel.

**Acao:**
1. Verifique as variaveis `OPENCLAW_TOKEN` e `OPENCLAW_GATEWAY_TOKEN` no EasyPanel (secao E).
2. Confirme que a versao do cliente OpenClaw e compativel com o servidor.
3. Reinicie o container apos corrigir (secao C).

---

### "device identity mismatch" nos logs

**Causa:** O `DEVICE_ID` configurado nao corresponde ao dispositivo WhatsApp atualmente vinculado, ou a sessao expirou e o QR code precisa ser relido.

**Acao:**
1. Verifique o valor de `DEVICE_ID` no EasyPanel.
2. Se a sessao expirou, reautentique lendo o QR code novamente pelo painel do OpenClaw.
3. Atualize `DEVICE_ID` se o dispositivo fisico mudou.

---

### Token errado no webhook do dashboard (Vercel sem redeploy)

**Causa:** `WEBHOOK_TOKEN` foi alterado no Vercel mas nenhum redeploy foi executado, entao a funcao serverless ainda usa o valor antigo.

**Acao:**
1. Acesse o painel do Vercel > Settings > Environment Variables e confirme o valor correto.
2. Execute um novo deploy (Deployments > Redeploy, ou faca um push no repositorio).
3. Aguarde o deploy concluir antes de testar novamente.

---

### Container parado sem motivo aparente

**Causa provavel:** Limite de memoria ou CPU atingido, OOM killer do Linux encerrou o processo, ou o EasyPanel aplicou uma atualizacao automatica.

**Acao:**
1. Verifique logs do container: `docker logs openclaw --tail=100` -- procure por `Killed` ou `OOMKilled`.
2. Verifique recursos do host: `free -h` e `top -b -n1 | head -20`.
3. Reinicie o container (secao C).
4. Se recorrente, ajuste os limites de memoria no EasyPanel ou investigue vazamentos de memoria.

---

### Dashboard nao ve OpenClaw online (tabela `comandos` vazia)

**Causa:** O OpenClaw nao esta escrevendo na tabela `comandos` do Supabase, ou o webhook `/api/webhook` esta rejeitando as chamadas (token invalido, Vercel sem redeploy).

**Acao:**
1. Confirme que o container esta rodando (secao A).
2. Verifique se `WEBHOOK_TOKEN` no Vercel esta correto e se o redeploy foi feito (secao H).
3. Consulte a tabela `comandos` no Supabase diretamente para ver se ha registros recentes.
4. Verifique os logs do Vercel em Functions para erros nas chamadas `/api/webhook`.

---

### DNS ou proxy quebrado

**Causa:** O registro DNS de `openclaw.n8ndredson.com` nao resolve, ou o proxy reverso (nginx/Caddy no EasyPanel) esta misconfigured ou parado.

**Acao:**
1. Teste resolucao DNS: `nslookup openclaw.n8ndredson.com` ou `dig openclaw.n8ndredson.com`.
2. Se DNS nao resolve, verifique as configuracoes de DNS no provedor do dominio.
3. Se DNS resolve mas a URL nao responde, verifique o status do proxy reverso no EasyPanel.
4. Verifique se o container esta expondo a porta correta: `docker inspect openclaw | grep -A 5 '"Ports"'` (secao E).
5. Confirme que o firewall do Hostinger VPS permite trafego nas portas 80 e 443.
