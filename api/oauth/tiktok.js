// GET /oauth/tiktok — recebe callback OAuth do TikTok e repassa ao dashboard via postMessage
export default function handler(req, res) {
  const { code = '', error = '' } = req.query || {};
  const success = !!code && !error;
  const origin  = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(oauthPage(success, code, error, origin));
}

function oauthPage(success, code, error, origin) {
  const emoji  = success ? '✅' : '❌';
  const title  = success ? 'TikTok conectado!' : 'Erro na autenticação TikTok';
  const detail = success ? 'Pode fechar esta janela.' : (error || 'Tente novamente.');
  const color  = success ? '#69c9d0' : '#ff4d6d';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>TikTok OAuth — Dashboard</title>
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
      window.opener.postMessage(
        {type:'tiktok_oauth_callback',code:${JSON.stringify(code)},error:${JSON.stringify(error)}},
        ${JSON.stringify(origin)}
      );
    }
  }catch(e){}
  setTimeout(()=>window.close(),1600);
</script></body></html>`;
}
