/**
 * api/finance/autosync.js
 * Lê lancamentos_financeiros do Supabase e sincroniza dados_assistente
 * para que o widget de Finanças do dashboard exiba os dados corretos.
 * 
 * POST /api/finance/autosync
 * Headers: X-Webhook-Token: oc_edson_2026_secure
 */

import { adminFetch } from '../_supabase-admin.js';

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'oc_edson_2026_secure';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers['x-webhook-token'] || req.body?.token;
  if (token !== WEBHOOK_TOKEN) return res.status(401).json({ error: 'Token inválido' });

  try {
    const now = new Date();
    const mes = now.getUTCMonth() + 1;
    const ano = now.getUTCFullYear();
    const mesStr = `${ano}-${String(mes).padStart(2,'0')}`;

    // Buscar todos os lançamentos do mês atual
    const lancamentos = await adminFetch(
      `/lancamentos_financeiros?mes=eq.${mes}&ano=eq.${ano}&order=data.desc`
    );

    if (!Array.isArray(lancamentos)) {
      return res.status(500).json({ error: 'Erro ao buscar lançamentos', detail: lancamentos });
    }

    // Calcular totais
    const despesas = lancamentos
      .filter(l => l.tipo === 'despesa')
      .reduce((s, l) => s + parseFloat(l.valor || 0), 0);

    const receitas = lancamentos
      .filter(l => l.tipo === 'receita')
      .reduce((s, l) => s + parseFloat(l.valor || 0), 0);

    // Agrupar por categoria
    const porCategoria = {};
    lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
      const cat = l.categoria || 'outros';
      porCategoria[cat] = (porCategoria[cat] || 0) + parseFloat(l.valor || 0);
    });

    // Montar dados no formato esperado pelo widget
    const dados = {
      mes: mesStr,
      renda: receitas,
      despesas: despesas,
      saldo: receitas - despesas,
      categorias: porCategoria,
      lancamentos: lancamentos.map(l => ({
        id: l.id,
        type: l.tipo,
        item: l.descricao,
        amount: l.valor,
        category: l.categoria,
        date: l.data,
        obs: l.observacoes,
      })),
      total_lancamentos: lancamentos.length,
      atualizado_em: now.toISOString(),
    };

    // Sincronizar em dados_assistente
    await adminFetch('/dados_assistente', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        tipo: 'financeiro',
        dados,
        atualizado_em: now.toISOString(),
      }),
    });

    const fBRL = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    return res.status(200).json({
      ok: true,
      mes: mesStr,
      lancamentos: lancamentos.length,
      receitas: fBRL(receitas),
      despesas: fBRL(despesas),
      saldo: fBRL(receitas - despesas),
      message: `✅ Dashboard sincronizado!\n\n💰 Mês: ${mesStr}\n📥 Receitas: ${fBRL(receitas)}\n📤 Despesas: ${fBRL(despesas)}\n💵 Saldo: ${fBRL(receitas - despesas)}\n📊 ${lancamentos.length} lançamento(s)`,
    });

  } catch (e) {
    console.error('[finance/autosync] Erro:', e.message);
    return res.status(500).json({ error: 'Erro ao sincronizar', detail: e.message });
  }
}
