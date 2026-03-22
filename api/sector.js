const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const supabaseUrl  = process.env.SUPABASE_URL  || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';

  let sector = '';

  // 1. Vercel populates req.query with named rewrite params (:sector)
  if (req.query && req.query.sector) {
    sector = decodeURIComponent(req.query.sector);
  }

  // 2. Try the original URL path
  if (!sector) {
    const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (last !== 'sector' && last !== 'api') {
      sector = decodeURIComponent(last);
    }
  }

  // 3. Try x-now-route-matches header
  if (!sector && req.headers && req.headers['x-now-route-matches']) {
    try {
      const matches = decodeURIComponent(req.headers['x-now-route-matches']);
      const m = matches.match(/sector=([^&]+)/);
      if (m) sector = decodeURIComponent(m[1]);
    } catch (_) {}
  }

  // 4. Query string ?s= as last resort
  if (!sector && req.query && req.query.s) {
    sector = decodeURIComponent(req.query.s);
  }

  // Sanitise — allow letters, numbers, spaces, ampersands, hyphens
  const safeSector = sector.replace(/[^A-Za-z0-9 &\-]/g, '').trim();

  let html;
  try {
    html = readFileSync(join(__dirname, '..', '_sector.html'), 'utf8');
  } catch {
    try {
      html = readFileSync(join(__dirname, '_sector.html'), 'utf8');
    } catch {
      html = readFileSync(join(process.cwd(), '_sector.html'), 'utf8');
    }
  }

  html = html.replace(
    "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SECTOR: '' };",
    `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', SECTOR: '${safeSector.replace(/'/g, "\\'")}' };`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
