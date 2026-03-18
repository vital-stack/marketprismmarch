const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const supabaseUrl  = process.env.SUPABASE_URL  || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';

  // Extract ticker — try multiple sources because Vercel rewrites may
  // change req.url to the destination path (/api/ticker instead of /ticker/NVDA)
  let ticker = '';

  // 1. Vercel populates req.query with named rewrite params (:ticker)
  if (req.query && req.query.ticker) {
    ticker = req.query.ticker;
  }

  // 2. Try the original URL path (works when req.url preserves the source)
  if (!ticker) {
    const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    // Skip if the last segment is the function name itself
    if (last !== 'ticker' && last !== 'api') {
      ticker = last;
    }
  }

  // 3. Try x-now-route-matches header (Vercel internal routing metadata)
  if (!ticker && req.headers && req.headers['x-now-route-matches']) {
    try {
      const matches = decodeURIComponent(req.headers['x-now-route-matches']);
      const m = matches.match(/ticker=([^&]+)/);
      if (m) ticker = decodeURIComponent(m[1]);
    } catch (_) {}
  }

  // 4. Try query string ?t=NVDA as last resort
  if (!ticker && req.query && req.query.t) {
    ticker = req.query.t;
  }

  // Sanitise — only allow alphanumeric + dot + hyphen
  const safeTicker = ticker.replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();

  let html;
  try {
    html = readFileSync(join(__dirname, '..', '_ticker.html'), 'utf8');
  } catch {
    try {
      html = readFileSync(join(__dirname, '_ticker.html'), 'utf8');
    } catch {
      html = readFileSync(join(process.cwd(), '_ticker.html'), 'utf8');
    }
  }

  html = html.replace(
    "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', TICKER: '' };",
    `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', TICKER: '${safeTicker}' };`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
