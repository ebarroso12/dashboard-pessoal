export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const page    = parseInt(req.query.page || 1);
    const country = req.query.country || '';   // '' = todos, 'BR' = só Brasil

    const url = `https://www.loslegendarios.org/top?country=${country}&page=${page}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; DashboardPersonal/1.0)',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const html  = await resp.text();
    const today = new Date().toISOString().split('T')[0];
    const events = parseCards(html).filter(e => e.date >= today);

    res.status(200).json({ ok: true, events, page, country });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, events: [] });
  }
}

function parseCards(html) {
  const events = [];
  // Cada bloco começa depois de <div class="card">
  const blocks = html.split('<div class="card">');

  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b.includes('card-img-top')) continue;

    // Nome do track: alt do img.card-img-top
    const nameM = b.match(/class="card-img-top"[^>]*alt="([^"]+)"/);
    if (!nameM) continue;
    const name = nameM[1].trim();

    // Data ISO: datetime="YYYY-MM-DD HH:MM:SS"
    const dateM = b.match(/datetime="(\d{4}-\d{2}-\d{2})/);
    if (!dateM) continue;
    const date = dateM[1];

    // Número do TOP (opcional)
    const topM = b.match(/class="card-title fs-35"[^>]*>([^<]+)</);
    const top  = topM ? topM[1].trim() : '';

    // Localização: último <p class="card-text">
    const pAll = [...b.matchAll(/<p class="card-text"[^>]*>([^<]+)<\/p>/g)];
    const location = pAll.length >= 2
      ? pAll[pAll.length - 1][1].trim()
      : (pAll[0] ? pAll[0][1].trim() : '');

    // Link para ingresso (ticketandgo)
    const linkM = b.match(/href="(https?:\/\/ticketandgo[^"]+)"/);
    const link  = linkM ? linkM[1] : '';

    // Imagem do track
    const imgM = b.match(/src="(https?:\/\/www\.loslegendarios\.org\/storage\/tracks\/[^"]+)"/);
    const img  = imgM ? imgM[1] : '';

    // País (alt da bandeirinha dentro de .info)
    const flagM = b.match(/class="info"[\s\S]*?<img[^>]+alt="([^"]+)"/);
    const country = flagM ? flagM[1] : 'Brasil';

    events.push({ name, date, location, top, link, img, country });
  }

  // Remove duplicatas nome+data
  const seen = new Set();
  return events.filter(e => {
    const k = e.name + e.date;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
