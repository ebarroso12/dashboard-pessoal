/**
 * Dashboard Pessoal - Servidor Local
 * Edson Barroso © 2026
 *
 * Funções:
 *  - Serve o dashboard.html em http://localhost:8080
 *  - Recebe callbacks OAuth do Google e repassa ao dashboard via postMessage
 *  - Troca code por tokens (Google) mantendo client_secret seguro no servidor
 *  - Renova tokens Google automaticamente via refresh_token
 *  - Recebe comandos de voz do OpenClaw via WhatsApp (POST /api/webhook)
 *  - Retorna feed de comandos de voz ao dashboard (GET /api/comandos)
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');
const qs    = require('querystring');

const PORT = 8080;
const DIR  = __dirname;

// ── Config — lê sempre do disco (sem cache) ───────────────
const CONFIG_PATH = path.join(DIR, 'config.json');
function getConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch(e) { return { google: {}, meta: {} }; }
}

// ── OpenClaw Comandos de Voz ──────────────────────────────
const COMANDOS_PATH = path.join(DIR, 'comandos.json');

function getComandos() {
  try { return JSON.parse(fs.readFileSync(COMANDOS_PATH, 'utf8')); }
  catch { return []; }
}

function saveComando(entry) {
  const list = getComandos();
  const novo = {
    id:       Date.now(),
    ts:       new Date().toISOString(),
    tipo:     entry.tipo     || 'voz',
    texto:    entry.texto    || '',
    resposta: entry.resposta || '',
    de:       entry.de       || 'WhatsApp',
    status:   entry.status   || 'ok',
  };
  list.unshift(novo);
  fs.writeFileSync(COMANDOS_PATH, JSON.stringify(list.slice(0, 50), null, 2));
  return novo;
}

// ── MIME types ────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

// ── Helpers ───────────────────────────────────────────────
function sendJSON(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:' + PORT,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function googlePost(endpoint, params) {
  return new Promise((resolve, reject) => {
    const body = qs.stringify(params);
    const options = {
      hostname: 'oauth2.googleapis.com',
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Página de callback OAuth ──────────────────────────────
function oauthPage(success, code, error) {
  const emoji  = success ? '✅' : '❌';
  const title  = success ? 'Conectado com sucesso!' : 'Erro na autenticação';
  const detail = success ? 'Pode fechar esta janela.' : (error || 'Tente novamente.');
  const color  = success ? '#00e5b5' : '#ff4d6d';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>OAuth - Dashboard</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#07080f;color:#eef2ff;
    display:flex;align-items:center;justify-content:center;height:100vh}
  .box{text-align:center;padding:40px 50px;background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.08);border-radius:18px;max-width:360px}
  .emoji{font-size:3rem;margin-bottom:16px}
  h2{color:${color};font-size:1.2rem;margin-bottom:10px}
  p{color:#8892aa;font-size:.88rem;line-height:1.5}
  .bar{height:3px;background:${color};border-radius:2px;margin-top:24px;
    animation:shrink 1.5s linear forwards}
  @keyframes shrink{from{width:100%}to{width:0}}
</style></head><body>
<div class="box">
  <div class="emoji">${emoji}</div>
  <h2>${title}</h2>
  <p>${detail}</p>
  <div class="bar"></div>
</div>
<script>
  try{
    if(window.opener){
      window.opener.postMessage({
        type:'google_oauth_callback',
        code:${JSON.stringify(code||'')},
        error:${JSON.stringify(error||'')}
      },'http://localhost:${PORT}');
    }
  }catch(e){}
  setTimeout(()=>window.close(),1600);
</script></body></html>`;
}

// ── Servidor ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query    = parsed.query;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  'http://localhost:' + PORT,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── GET /oauth/google ─ recebe callback do Google
  if (pathname === '/oauth/google') {
    const code  = query.code  || '';
    const error = query.error || '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(oauthPage(!!code && !error, code, error));
    return;
  }

  // ── GET /oauth/tiktok ─ recebe callback do TikTok
  if (pathname === '/oauth/tiktok') {
    const code  = query.code  || '';
    const error = query.error || '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(oauthPage(!!code && !error, null, error).replace(
      "type:'google_oauth_callback'",
      "type:'tiktok_oauth_callback'"
    ).replace(
      `code:${JSON.stringify(code||'')}`,
      `code:${JSON.stringify(code||'')}`
    ));
    return;
  }

  // ── POST /api/tiktok/token ─ troca code por tokens
  if (pathname === '/api/tiktok/token' && req.method === 'POST') {
    const body = await readBody(req);
    const { code } = body;
    const cfg = getConfig();
    if (!cfg.tiktok?.clientKey || !cfg.tiktok?.clientSecret) {
      sendJSON(res, 400, { error: 'TikTok clientKey e clientSecret não configurados' });
      return;
    }
    try {
      const params = new URLSearchParams({
        client_key:    cfg.tiktok.clientKey,
        client_secret: cfg.tiktok.clientSecret,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  `http://localhost:${PORT}/oauth/tiktok`,
      });
      const ttRes = await new Promise((resolve, reject) => {
        const body = params.toString();
        const options = {
          hostname: 'open.tiktokapis.com',
          path: '/v2/oauth/token/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
          },
        };
        const r = https.request(options, res => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
        });
        r.on('error', reject); r.write(body); r.end();
      });
      sendJSON(res, ttRes.error ? 400 : 200, ttRes);
    } catch(e) { sendJSON(res, 500, { error: String(e) }); }
    return;
  }

  // ── POST /api/google/token ─ troca code por tokens
  if (pathname === '/api/google/token' && req.method === 'POST') {
    const body = await readBody(req);
    const { code, code_verifier } = body;
    const cfg = getConfig();
    if (!cfg.google?.clientId || !cfg.google?.clientSecret) {
      sendJSON(res, 400, { error: 'client_id e client_secret não configurados em config.json' });
      return;
    }
    const tokens = await googlePost('/token', {
      code,
      client_id:     cfg.google.clientId,
      client_secret: cfg.google.clientSecret,
      code_verifier,
      grant_type:    'authorization_code',
      redirect_uri:  `http://localhost:${PORT}/oauth/google`,
    });
    sendJSON(res, tokens.error ? 400 : 200, tokens);
    return;
  }

  // ── POST /api/google/refresh ─ renova access token
  if (pathname === '/api/google/refresh' && req.method === 'POST') {
    const body = await readBody(req);
    const { refresh_token } = body;
    const cfg = getConfig();
    if (!cfg.google?.clientId || !cfg.google?.clientSecret) {
      sendJSON(res, 400, { error: 'Credenciais não configuradas' });
      return;
    }
    const tokens = await googlePost('/token', {
      refresh_token,
      client_id:     cfg.google.clientId,
      client_secret: cfg.google.clientSecret,
      grant_type:    'refresh_token',
    });
    sendJSON(res, tokens.error ? 400 : 200, tokens);
    return;
  }

  // ── GET /api/config ─ retorna config pública (sem secrets)
  if (pathname === '/api/config') {
    const cfg = getConfig();
    sendJSON(res, 200, {
      google: {
        clientId:  cfg.google?.clientId  || '',
        hasSecret: !!cfg.google?.clientSecret,
        scopes:    cfg.google?.scopes    || [],
      },
      ga4PropertyId: cfg.ga4PropertyId || '',
      tiktok: {
        clientKey: cfg.tiktok?.clientKey || '',
      },
      meta: {
        appId: cfg.meta?.appId || '',
      },
    });
    return;
  }

  // ── GET /api/comandos ─ retorna feed de comandos OpenClaw
  if (pathname === '/api/comandos') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify(getComandos()));
    return;
  }

  // ── POST /api/webhook ─ recebe comando do OpenClaw
  if (pathname === '/api/webhook' && req.method === 'POST') {
    // Aceita CORS de qualquer origem (OpenClaw é externo)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token');

    const body = await readBody(req);
    const cfg  = getConfig();
    const tokenEsperado = cfg.webhookToken || '';
    const tokenRecebido = (req.headers['x-webhook-token'] || body.token || '');

    // Valida token de segurança
    if (tokenEsperado && tokenRecebido !== tokenEsperado) {
      sendJSON(res, 401, { error: 'Token inválido' });
      console.log('⚠️  OpenClaw webhook: token inválido recebido');
      return;
    }

    // Salva comando
    const novo = saveComando({
      tipo:     body.tipo     || (body.audio ? 'voz' : 'texto'),
      texto:    body.texto    || body.text    || '',
      resposta: body.resposta || body.response || '',
      de:       body.de       || body.from    || 'WhatsApp',
      status:   body.status   || 'ok',
    });

    console.log(`🦞 OpenClaw [${novo.tipo.toUpperCase()}]: "${novo.texto.substring(0, 60)}..."`);
    sendJSON(res, 200, { ok: true, id: novo.id });
    return;
  }

  // ── POST /api/analisa-foto ─ analisa imagem de nota fiscal
  if (pathname === '/api/analisa-foto' && req.method === 'POST') {
    try {
      const handler = require('./api/analisa-foto');
      await handler(req, res);
    } catch (e) {
      sendJSON(res, 500, { itens: [], fallback: true, motivo: String(e) });
    }
    return;
  }

  // ── Static files ──────────────────────────────────────
  let filePath = path.normalize(path.join(DIR, pathname === '/' ? 'dashboard.html' : pathname));
  if (!filePath.startsWith(DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Arquivo não encontrado: ' + pathname); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'text/plain',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const hr = '─'.repeat(48);
  console.log('\n' + hr);
  console.log('  🚀  Dashboard Pessoal — Edson Barroso');
  console.log(hr);
  console.log(`\n  ✅  Servidor rodando!`);
  console.log(`  🌐  Acesse: \x1b[36mhttp://localhost:${PORT}\x1b[0m\n`);
  console.log('  📋  Para parar o servidor: Ctrl + C');
  console.log('\n' + hr + '\n');

  // Abre navegador automaticamente
  const { exec } = require('child_process');
  const cmds = { win32:'start', darwin:'open', linux:'xdg-open' };
  const cmd = cmds[process.platform];
  if (cmd) exec(`${cmd} http://localhost:${PORT}`, ()=>{});
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n⚠️  Porta ${PORT} já está em uso.`);
    console.log(`   O dashboard já pode estar rodando.`);
    console.log(`   Acesse: http://localhost:${PORT}\n`);
  } else {
    console.error('Erro no servidor:', err);
  }
});
