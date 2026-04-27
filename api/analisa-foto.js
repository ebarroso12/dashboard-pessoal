/**
 * Dashboard Pessoal — /api/analisa-foto
 * Edson Barroso © 2026
 *
 * Recebe uma imagem em base64 (nota fiscal / cupom / extrato)
 * e usa o Claude Haiku Vision para extrair itens, valores e categorias.
 *
 * POST body: { image: "<base64 string>", mime?: "image/jpeg" }
 * Resposta:  { itens: [{descricao, valor, categoria}], estabelecimento, data, total }
 * Fallback:  { itens: [], fallback: true, motivo: "..." }
 */

const CATEGORIAS_VALIDAS = [
  'alimentacao', 'moradia', 'transporte', 'saude',
  'educacao', 'lazer', 'vestuario', 'servicos',
  'mercado', 'farmacia', 'outros', 'receita',
];

const PROMPT_SISTEMA = `Você é um assistente especializado em análise de notas fiscais, cupons e extratos financeiros.
Sua tarefa é extrair todas as despesas/itens com seus valores e classificar em categorias.

Categorias disponíveis: alimentacao, moradia, transporte, saude, educacao, lazer, vestuario, servicos, mercado, farmacia, outros, receita

Regras:
- Extraia TODOS os itens individuais que aparecem na imagem
- Para cada item: descrição curta (máx 40 chars), valor numérico em reais, categoria
- Se for uma nota de supermercado/mercado, use categoria "mercado"
- Se for farmácia/drogaria, use "farmacia"
- Se for restaurante/lanchonete/delivery, use "alimentacao"
- Se for posto/combustível, use "transporte"
- Se não conseguir identificar, use "outros"
- Devolva APENAS JSON válido, sem explicações, sem markdown, sem bloco de código

Formato obrigatório:
{
  "estabelecimento": "Nome do estabelecimento ou null",
  "data": "DD/MM/AAAA ou null",
  "total": 0.00,
  "itens": [
    { "descricao": "Nome do item", "valor": 0.00, "categoria": "categoria" }
  ]
}`;

async function callClaude(apiKey, base64Image, mimeType) {
  const payload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType || 'image/jpeg',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: PROMPT_SISTEMA,
          },
        ],
      },
    ],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

function parseClaudeResponse(claudeRes) {
  const text = claudeRes?.content?.[0]?.text || '';
  if (!text) throw new Error('Resposta vazia do Claude');

  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  const itens = (parsed.itens || []).map((item) => ({
    descricao: String(item.descricao || '').substring(0, 60),
    valor:     parseFloat(item.valor) || 0,
    categoria: CATEGORIAS_VALIDAS.includes(item.categoria) ? item.categoria : 'outros',
  })).filter((item) => item.valor > 0);

  return {
    estabelecimento: parsed.estabelecimento || null,
    data:            parsed.data || null,
    total:           parseFloat(parsed.total) || itens.reduce((s, i) => s + i.valor, 0),
    itens,
  };
}

// ── Handler principal (Vercel ES Module) ─────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Método não permitido' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY || '';

  if (!apiKey) {
    res.status(200).json({
      itens:    [],
      fallback: true,
      motivo:   'ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente no Vercel e tente novamente.',
    });
    return;
  }

  try {
    const body = req.body || {};
    const { image, mime } = body;

    if (!image) {
      res.status(400).json({ error: 'Campo "image" (base64) é obrigatório' });
      return;
    }

    // Remove prefixo data URL se presente (ex: "data:image/jpeg;base64,")
    const base64Clean = image.replace(/^data:[^;]+;base64,/, '');
    const mimeType    = mime || (image.startsWith('data:') ? image.split(';')[0].split(':')[1] : 'image/jpeg');

    const claudeRes = await callClaude(apiKey, base64Clean, mimeType);

    if (claudeRes.error) {
      console.error('Erro Anthropic API:', claudeRes.error);
      res.status(200).json({
        itens:    [],
        fallback: true,
        motivo:   `Erro na API: ${claudeRes.error.message || claudeRes.error.type || 'desconhecido'}`,
      });
      return;
    }

    const resultado = parseClaudeResponse(claudeRes);
    res.status(200).json(resultado);

  } catch (err) {
    console.error('Erro /api/analisa-foto:', err);
    res.status(200).json({
      itens:    [],
      fallback: true,
      motivo:   `Erro interno: ${err.message}`,
    });
  }
}
