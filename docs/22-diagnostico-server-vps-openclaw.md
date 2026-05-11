# Diagnostico: server-vps.js — Estado e Conectividade

> Leitura pura. Nenhum código executado ou alterado.
> Data: 2026-05-11

---

## Como server-vps.js deveria rodar

`server-vps.js` e um processo Node.js de longa duração (daemon) que deveria
rodar **no VPS Hostinger**, fora do Vercel. Sua arquitetura:

```
VPS Hostinger
└─ Node.js (processo permanente)
   └─ server-vps.js
      ├─ Conecta ao WhatsApp via whatsapp-web.js + Puppeteer (headless)
      ├─ Salva sessao local em ./.wwebjs_auth/
      ├─ Loop a cada 3s → polling Supabase (wa_connections, wa_requests)
      └─ Chama Anthropic API para analises de conversa
```

O modo de execução esperado no VPS seria:
```
pm2 start server-vps.js --name wa-server
```
ou equivalente com `forever`, `nodemon`, ou serviço systemd.

---

## Evidências de que NÃO está conectado a este repositório

### 1. Nenhum script de inicialização o menciona

| Script | Comando executado |
|--------|------------------|
| `iniciar.bat` | `node server.js` (servidor local de dev) |
| `iniciar.sh` | `node server.js` (servidor local de dev) |
| `publicar.bat` | `vercel --prod` (deploy Vercel apenas) |
| `retomar.sh` | Nenhum `node` executado — só exibe status |

`server-vps.js` não aparece em nenhum script de inicialização do repo.

### 2. Dependências ausentes no package.json

`server-vps.js` exige 4 pacotes com `require()`:

| Pacote | Presente no package.json | Presente em node_modules/ |
|--------|--------------------------|---------------------------|
| `dotenv` | Nao | Nao |
| `whatsapp-web.js` | Nao | Nao |
| `qrcode` | Nao | Nao |
| `@anthropic-ai/sdk` | Nao | Nao |

`package.json` tem apenas `ws: ^8.20.0`, usado exclusivamente por
`api/lib/openclaw.js` (cliente WebSocket para o gateway OpenClaw).

### 3. Conflito ESM/CJS impede execução local

`package.json` declara `"type": "module"` (ESM).
`server-vps.js` usa sintaxe CommonJS (`require()`, sem `import`).

Executar `node server-vps.js` neste diretório falha imediatamente:
```
ReferenceError: require is not defined in ES module scope
```

O mesmo problema ocorreu com `server.js` — resolvido criando `server.cjs`.
`server-vps.js` não tem equivalente `.cjs` neste repo.

### 4. Pasta de sessão WhatsApp ausente

`whatsapp-web.js` cria `.wwebjs_auth/` ao autenticar pela primeira vez.
Esta pasta **não existe** no diretório do projeto. Isso indica que
`server-vps.js` nunca foi executado com sucesso a partir deste repositório.

### 5. Nenhuma configuração de processo (PM2 / systemd / Docker)

Não existe no repo:
- `ecosystem.config.js` ou qualquer config PM2
- `docker-compose.yml` ou `Dockerfile`
- Arquivo `.service` do systemd
- Qualquer referência a `pm2`, `forever` ou `nodemon` no `package.json`

### 6. vercel.json não roteia para server-vps.js

O arquivo `vercel.json` lista 18 rotas — nenhuma aponta para `server-vps.js`.
Ele não é uma função serverless e não pode ser deployado no Vercel.

---

## Modelo de deploy inferido

`server-vps.js` foi projetado para ser **copiado manualmente ao VPS** e
executado de forma independente, com seu próprio `package.json` local
(sem `"type": "module"`) e os 4 pacotes instalados separadamente.

O repo nao tem rastreabilidade desse deploy:
- Sem Dockerfile
- Sem script de upload/deploy para o VPS
- Sem arquivo de configuração de processo
- A sessao WA (`.wwebjs_auth/`) ficaria no VPS, nao no repo

---

## Evidências do estado no retomar.sh

`retomar.sh` lista pendências conhecidas da sessão anterior:
```
1. ANTHROPIC_API_KEY inválida no Vercel → Supervisor IA offline
2. Meta (Facebook) pega página errada
3. Google Calendar / Analytics / GMB / YouTube → token expirado
```
`server-vps.js` e WhatsApp CRM **nao aparecem como pendência**.
Isso pode indicar que o VPS estava funcionando na época do script, ou que
o problema ainda nao tinha sido identificado.

---

## Riscos se server-vps.js estiver parado

| Funcionalidade | Impacto |
|----------------|---------|
| WhatsApp Web (wa_connections) | `status=pending` nunca vira `connected`; QR nao e gerado |
| Lista de conversas (wa_chats) | Frozen no ultimo sync bem-sucedido |
| Analises de conversa (wa_requests) | Fila cresce, nunca processada |
| Resultados de analise (wa_analyses) | Nunca gravados |
| Anthropic API (analises) | Nao chamada — custo zero |

O fluxo OpenClaw (`/api/webhook` → `comandos`) **nao e afetado** — roda
100% no Vercel e nao depende do `server-vps.js`.

---

## Verificação manual necessária

Para confirmar o estado real, o usuario precisa fazer **uma das seguintes**:

### Opcao A — SSH no VPS
```bash
ssh usuario@hostinger-vps
pm2 list              # ve processos PM2
pm2 logs wa-server    # ve logs do servidor WA
ps aux | grep server-vps  # procura pelo processo
```

### Opcao B — Inspecao do Supabase
Abrir o painel Supabase (`jaewjscbigfwjiaeavft.supabase.co`) e verificar:

1. Tabela `wa_connections`:
   - Existe alguma linha?
   - Qual o `status` e o `updated_at` mais recente?
   - Se `updated_at` > 10 minutos atras e `status` continua `connecting`,
     o processo provavelmente travou

2. Tabela `wa_chats`:
   - Existe alguma linha?
   - Qual e o `updated_at` mais recente?

3. Tabela `wa_requests`:
   - Ha linhas com `status=pending` antigas (> 1h)?
   - Se sim, o processador esta parado

### Opcao C — Painel EasyPanel no VPS
EasyPanel gerencia containers Docker no Hostinger.
Se `server-vps.js` foi encapsulado como container, o status visivel la
e a fonte mais confiavel.

---

## Resumo executivo

`server-vps.js` nao tem nenhum mecanismo de inicializacao, deployment ou
monitoramento rastreavel neste repositorio. E um artefato projetado para
viver no VPS de forma independente.

Nao ha como confirmar se esta rodando apenas pela leitura do repo.
A unica verificacao possivel e via SSH, painel EasyPanel, ou inspecao
das tabelas `wa_*` no Supabase.
