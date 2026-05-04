require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SB_URL = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZXdqc2NiaWdmd2ppYWVhdmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTUwNDksImV4cCI6MjA4Nzg5MTA0OX0.xLo3VVkQmItv9Q7vQ_U_i60FXQj8FzSogwVBfbAPbfU';

const clients = {}; // perfil -> { client, status }

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────
async function sb(path, opts = {}) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
        ...opts,
        headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': opts.prefer || 'return=minimal',
            ...(opts.headers || {})
        }
    });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return txt; }
}

const sbGet    = (path)        => sb(path);
const sbPatch  = (path, data)  => sb(path, { method: 'PATCH', body: JSON.stringify(data) });
const sbInsert = (path, data)  => sb(path, { method: 'POST',  body: JSON.stringify(data) });
const sbUpsert = (path, data)  => sb(path, { method: 'POST',  body: JSON.stringify(data), prefer: 'resolution=merge-duplicates,return=minimal' });
const sbDelete = (path)        => sb(path, { method: 'DELETE' });

// ─── INICIA CLIENTE WHATSAPP ──────────────────────────────────────────────────
async function initClient(perfil) {
    if (clients[perfil]) return;

    log(perfil, 'Inicializando...');
    await sbPatch(`wa_connections?perfil=eq.${perfil}`, { status: 'connecting', qr_image: null, updated_at: now() });

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: perfil, dataPath: './.wwebjs_auth' }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {})
        }
    });

    clients[perfil] = { client, status: 'connecting' };

    client.on('auth_failure', async (msg) => {
        log(perfil, `Falha de autenticação: ${msg}`);
        delete clients[perfil];
        await sbPatch(`wa_connections?perfil=eq.${perfil}`, { status: 'pending', qr_image: null, updated_at: now() });
    });

    client.on('qr', async (qr) => {
        log(perfil, 'QR gerado — aguardando scan...');
        const qrImg = await QRCode.toDataURL(qr, { width: 280, margin: 2, color: { dark: '#000', light: '#fff' } });
        clients[perfil].status = 'qr';
        await sbPatch(`wa_connections?perfil=eq.${perfil}`, { status: 'qr', qr_image: qrImg, updated_at: now() });
    });

    client.on('authenticated', async () => {
        log(perfil, 'Autenticado!');
        clients[perfil].status = 'authenticated';
        await sbPatch(`wa_connections?perfil=eq.${perfil}`, { status: 'authenticated', qr_image: null, updated_at: now() });
    });

    client.on('ready', async () => {
        const info = client.info;
        log(perfil, `Pronto! Número: +${info?.wid?.user}`);
        clients[perfil].status = 'connected';
        await sbPatch(`wa_connections?perfil=eq.${perfil}`, {
            status: 'connected',
            qr_image: null,
            phone: info?.wid?.user || '',
            display_name: info?.pushname || perfil,
            updated_at: now()
        });
        await syncChats(perfil);
    });

    client.on('disconnected', async (reason) => {
        log(perfil, `Desconectado: ${reason}`);
        clients[perfil].status = 'disconnected';
        delete clients[perfil];
        await sbPatch(`wa_connections?perfil=eq.${perfil}`, { status: 'disconnected', qr_image: null, updated_at: now() });
    });

    client.initialize().catch(async (e) => {
        log(perfil, `Erro ao inicializar: ${e.message}`);
        delete clients[perfil];
        // 'disconnected' para o loop não tentar de novo automaticamente
        await sbPatch(`wa_connections?perfil=eq.${perfil}`, { status: 'disconnected', qr_image: null, updated_at: now() });
    });
}

// ─── SINCRONIZA LISTA DE CHATS ────────────────────────────────────────────────
async function syncChats(perfil) {
    try {
        const client = clients[perfil]?.client;
        if (!client) return;
        log(perfil, 'Sincronizando lista de conversas...');

        const chats = await client.getChats();
        const rows = chats
            .filter(c => c.lastMessage)
            .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0))
            .slice(0, 60)
            .map(c => ({
                perfil,
                chat_id:        c.id._serialized,
                chat_name:      c.name || c.id.user,
                is_group:       c.isGroup,
                last_message:   (c.lastMessage?.body || '').substring(0, 120),
                last_message_ts: c.lastMessage ? new Date(c.lastMessage.timestamp * 1000).toISOString() : null,
                unread_count:   c.unreadCount || 0,
                updated_at:     now()
            }));

        for (const row of rows) {
            await sbUpsert('wa_chats', row);
        }
        log(perfil, `${rows.length} conversas sincronizadas`);
    } catch (e) {
        log(perfil, `Erro ao sincronizar chats: ${e.message}`);
    }
}

// ─── PROCESSA PEDIDO DE ANÁLISE ───────────────────────────────────────────────
async function processRequest(req) {
    const { id, perfil, chat_id, chat_name, chat_type, quantidade, tipo_analise, pergunta_custom } = req;
    log(perfil, `Analisando "${chat_name}" (${tipo_analise}, ${quantidade} msgs)...`);

    await sbPatch(`wa_requests?id=eq.${id}`, { status: 'processing' });

    try {
        if (tipo_analise === 'sync_chats') {
            await syncChats(perfil);
            await sbDelete(`wa_requests?id=eq.${id}`);
            return;
        }

        const c = clients[perfil];
        if (!c || c.status !== 'connected') throw new Error(`Perfil "${perfil}" não conectado`);

        const chat = await c.client.getChatById(chat_id);
        const msgs = await chat.fetchMessages({ limit: quantidade });

        const conversa = msgs.map(m => {
            const dt    = new Date(m.timestamp * 1000).toLocaleString('pt-BR');
            const autor = m.fromMe ? 'Eu' : (m._data?.notifyName || m.from.split('@')[0]);
            return `[${dt}] ${autor}: ${m.body || '[mídia/arquivo]'}`;
        }).join('\n');

        const instrucoes = {
            resumo:   'Faça um resumo claro e objetivo do que foi discutido. Organize por tópicos.',
            tarefas:  'Liste todas as tarefas, pendências e compromissos com responsável e prazo quando mencionados.',
            urgentes: 'Identifique os assuntos mais importantes e urgentes que precisam de atenção imediata.',
            datas:    'Extraia todas as datas, horários, prazos e compromissos em ordem cronológica.',
            completo: '**1. Resumo geral**\n**2. Tarefas e pendências**\n**3. Assuntos urgentes**\n**4. Datas e compromissos**\n**5. Conclusão**',
            pergunta: `Responda com base na conversa: ${pergunta_custom}`
        };

        const resp = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: 'Você analisa conversas de WhatsApp. Responda em português brasileiro. Seja objetivo e bem organizado. O usuário é médico — trate assuntos de saúde com atenção.',
            messages: [{ role: 'user', content: `${chat_type === 'grupo' ? 'Grupo' : 'Conversa'} "${chat_name}" — ${msgs.length} mensagens:\n\n${conversa}\n\n---\n\n${instrucoes[tipo_analise] || instrucoes.resumo}` }]
        });

        const resultado = resp.content[0].text;

        await sbInsert('wa_analyses', {
            chat_name, chat_type,
            tipo_analise: tipo_analise === 'pergunta' ? `pergunta: ${pergunta_custom}` : tipo_analise,
            msgs_count: msgs.length,
            resultado,
            perfil
        });

        await sbDelete(`wa_requests?id=eq.${id}`);
        log(perfil, `✅ "${chat_name}" analisado com sucesso`);

    } catch (e) {
        log(perfil, `❌ Erro: ${e.message}`);
        await sbPatch(`wa_requests?id=eq.${id}`, { status: 'error' });
    }
}

// ─── LOOP PRINCIPAL ───────────────────────────────────────────────────────────
async function mainLoop() {
    try {
        // 1. Novos pedidos de conexão
        const pendConn = await sbGet('wa_connections?status=eq.pending&select=perfil');
        if (Array.isArray(pendConn)) {
            for (const c of pendConn) {
                if (!/^[a-zA-Z0-9_-]+$/.test(c.perfil)) {
                    await sbPatch(`wa_connections?perfil=eq.${encodeURIComponent(c.perfil)}`, { status: 'disconnected', updated_at: now() });
                    continue;
                }
                if (!clients[c.perfil]) await initClient(c.perfil);
            }
        }

        // 2. Pedidos de análise pendentes
        const pendReqs = await sbGet('wa_requests?status=eq.pending&select=*&order=created_at.asc&limit=3');
        if (Array.isArray(pendReqs)) {
            for (const req of pendReqs) {
                await processRequest(req);
            }
        }
    } catch (e) {
        console.error('Loop error:', e.message);
    }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const log = (perfil, msg) => console.log(`[${new Date().toLocaleTimeString('pt-BR')}] [${perfil}] ${msg}`);

// ─── STARTUP ──────────────────────────────────────────────────────────────────
async function startup() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   WHATSAPP CLAUDE SERVER  🤖                 ║');
    console.log('║   Dashboard: dashboard-pessoal-edson.vercel  ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // Reconecta perfis que já estavam conectados
    const saved = await sbGet('wa_connections?status=in.(connected,authenticated,connecting)&select=perfil,status');
    if (Array.isArray(saved) && saved.length > 0) {
        console.log(`Reconectando ${saved.length} perfil(s) salvo(s)...\n`);
        for (const c of saved) {
            if (!/^[a-zA-Z0-9_-]+$/.test(c.perfil)) {
                console.log(`Perfil inválido ignorado: "${c.perfil}"`);
                await sbPatch(`wa_connections?perfil=eq.${encodeURIComponent(c.perfil)}`, { status: 'disconnected', updated_at: now() });
                continue;
            }
            await sbPatch(`wa_connections?perfil=eq.${c.perfil}`, { status: 'pending', updated_at: now() });
            await initClient(c.perfil);
            await new Promise(r => setTimeout(r, 3000));
        }
    } else {
        console.log('Nenhum perfil salvo. Conecte um número pelo dashboard.\n');
    }

    setInterval(mainLoop, 3000);
    console.log('✅ Servidor ativo. Aguardando comandos do dashboard...\n');
}

startup().catch(console.error);
