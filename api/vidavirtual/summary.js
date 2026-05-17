function vvFetch(path) {
  const url = process.env.VIDAVIRTUAL_SUPABASE_URL || '';
  const key = process.env.VIDAVIRTUAL_SERVICE_ROLE_KEY || '';
  return fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
}

function parseCount(data) {
  if (!Array.isArray(data) || data.length === 0) return 0;
  return parseInt(data[0].count, 10) || 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ts = new Date().toISOString();
  const key = process.env.VIDAVIRTUAL_SERVICE_ROLE_KEY || '';

  if (!key) {
    return res.status(200).json({ status: 'nao_configurado', ts });
  }

  try {
    const now = new Date().toISOString();
    const [rOs, rOsAtr, rApar, rPag] = await Promise.all([
      vvFetch(`ordens_servico?select=count&status=eq.aberta`),
      vvFetch(`ordens_servico?select=count&status=eq.aberta&data_prometida=lt.${now}`),
      vvFetch(`aparelhos?select=count&status=eq.aguardando_peca`),
      vvFetch(`pagamentos?select=count&status=eq.pendente`),
    ]);

    if (rOs.status === 401) {
      return res.status(200).json({ status: 'erro_auth', ts });
    }

    if (!rOs.ok) {
      return res.status(200).json({
        status: 'sem_dados',
        os_abertas: 0,
        os_atrasadas: 0,
        aparelhos_aguardando: 0,
        pagamentos_pendentes: 0,
        ts,
      });
    }

    // protected by outer try/catch — .json() throwing returns 'offline'
    const [osAb, osAtr, apar, pag] = await Promise.all([
      rOs.json().then(parseCount),
      rOsAtr.ok ? rOsAtr.json().then(parseCount) : Promise.resolve(0),
      rApar.ok ? rApar.json().then(parseCount) : Promise.resolve(0),
      rPag.ok ? rPag.json().then(parseCount) : Promise.resolve(0),
    ]);

    if (osAb === 0 && osAtr === 0 && apar === 0 && pag === 0) {
      return res.status(200).json({
        status: 'sem_dados',
        os_abertas: 0,
        os_atrasadas: 0,
        aparelhos_aguardando: 0,
        pagamentos_pendentes: 0,
        ts,
      });
    }

    return res.status(200).json({
      status: 'ok',
      os_abertas: osAb,
      os_atrasadas: osAtr,
      aparelhos_aguardando: apar,
      pagamentos_pendentes: pag,
      ts,
    });

  } catch (e) {
    return res.status(200).json({ status: 'offline', ts });
  }
}
