// Endpoint dual: TOPs Legendários + Notícias de IA
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tipo = req.query.tipo || 'tops';
  if (tipo === 'news') {
    return handleNews(req, res);
  }
  return handleTops(req, res);
}

// ── TOPS LEGENDÁRIOS ─────────────────────────────────────────────────
async function handleTops(req, res) {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
  try {
    const page    = parseInt(req.query.page || 1);
    const country = req.query.country || '';
    const url     = `https://www.loslegendarios.org/top?country=${country}&page=${page}`;
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
    const events = parseTopsHTML(html).filter(e => e.date >= today);
    res.status(200).json({ ok: true, events, page, country });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, events: [] });
  }
}

function parseTopsHTML(html) {
  const events = [];
  const blocks = html.split('<div class="card">');
  const seen   = new Set();
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b.includes('card-img-top')) continue;
    const nameM = b.match(/class="card-img-top"[^>]*alt="([^"]+)"/);
    if (!nameM) continue;
    const name  = nameM[1].trim();
    const dateM = b.match(/datetime="(\d{4}-\d{2}-\d{2})/);
    if (!dateM) continue;
    const date  = dateM[1];
    const topM  = b.match(/class="card-title fs-35"[^>]*>([^<]+)</);
    const top   = topM ? topM[1].trim() : '';
    const pAll  = [...b.matchAll(/<p class="card-text"[^>]*>([^<]+)<\/p>/g)];
    const location = pAll.length >= 2 ? pAll[pAll.length-1][1].trim() : (pAll[0] ? pAll[0][1].trim() : '');
    const linkM = b.match(/href="(https?:\/\/ticketandgo[^"]+)"/);
    const link  = linkM ? linkM[1] : '';
    const imgM  = b.match(/src="(https?:\/\/www\.loslegendarios\.org\/storage\/tracks\/[^"]+)"/);
    const img   = imgM ? imgM[1] : '';
    const flagM = b.match(/class="info"[\s\S]*?<img[^>]+alt="([^"]+)"/);
    const country = flagM ? flagM[1] : 'Brasil';
    const key = name + date;
    if (!seen.has(key)) { seen.add(key); events.push({ name, date, location, top, link, img, country }); }
  }
  return events;
}

// ── NOTÍCIAS DE IA ───────────────────────────────────────────────────
const NEWS_SOURCES = {
  vb:    'https://feeds.feedburner.com/venturebeat/SZYF',
  tc:    'https://techcrunch.com/category/artificial-intelligence/feed/',
  verge: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
  mit:   'https://www.technologyreview.com/feed/',
  google:'https://blog.google/technology/ai/rss/',
  hf:    'https://huggingface.co/blog/feed.xml',
};

async function handleNews(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
  const source = req.query.source || 'vb';
  const feedUrl = NEWS_SOURCES[source];
  if (!feedUrl) return res.status(400).json({ ok: false, error: 'source inválido', items: [] });

  try {
    const resp = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DashboardPersonal/1.0)',
        'Accept':     'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const xml   = await resp.text();
    const items = parseRSS(xml).slice(0, 7);
    res.status(200).json({ ok: true, items, source });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, items: [] });
  }
}

function parseRSS(xml) {
  const items  = [];
  const blocks = xml.split(/<item[\s>]/);
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];

    // Título (CDATA ou texto simples)
    const titleM = b.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                   b.match(/<title[^>]*>([^<]+)<\/title>/);
    const title = titleM ? titleM[1].trim() : '';
    if (!title) continue;

    // Link
    const linkM = b.match(/<link[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) ||
                  b.match(/<link[^>]*>([^<]+)<\/link>/) ||
                  b.match(/<link[^>]+href="([^"]+)"/);
    const link  = linkM ? linkM[1].trim() : '';

    // Data
    const dateM = b.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/) ||
                  b.match(/<published[^>]*>([^<]+)<\/published>/);
    const date  = dateM ? dateM[1].trim() : '';

    // Descrição (remove HTML)
    const descM = b.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                  b.match(/<description[^>]*>([\s\S]*?)<\/description>/);
    const desc  = descM ? descM[1].replace(/<[^>]*>/g, '').replace(/\s+/g,' ').trim().slice(0, 160) : '';

    // Imagem (media:content, enclosure, ou img dentro da descrição)
    const imgM = b.match(/media:content[^>]+url="([^"]+)"/) ||
                 b.match(/<enclosure[^>]+url="([^"]+)"/) ||
                 (descM && descM[1].match(/<img[^>]+src="([^"]+)"/));
    const img   = imgM ? imgM[1] : '';

    items.push({ title, link, date, desc, img });
  }
  return items;
}
