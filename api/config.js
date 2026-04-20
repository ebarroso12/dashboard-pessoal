export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
        googleId:     process.env.GOOGLE_CLIENT_ID     || '',
        googleSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        metaId:       process.env.META_APP_ID          || '',
        google: {
          clientId:     process.env.GOOGLE_CLIENT_ID     || '',
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
                  hasSecret:    !!(process.env.GOOGLE_CLIENT_SECRET)
            },
                meta: {
      appId: process.env.META_APP_ID || ''
        },
            ga4PropertyId: process.env.GA4_PROPERTY_ID || ''
        });
        }
