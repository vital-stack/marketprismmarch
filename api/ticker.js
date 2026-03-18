const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const supabaseUrl  = process.env.SUPABASE_URL  || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';

  // Extract ticker from the URL path /ticker/NVDA
  const parts  = (req.url || '').split('?')[0].split('/').filter(Boolean);
  const ticker = parts[parts.length - 1] || '';
  // Sanitise — only allow alphanumeric + dot + hyphen
  const safeTicker = ticker.replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();

  let html;
  try {
    html = readFileSync(join(__dirname, '_ticker.html'), 'utf8');
  } catch {
    html = readFileSync(join(process.cwd(), '_ticker.html'), 'utf8');
  }

  html = html.replace(
    "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', TICKER: '' };",
    `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', TICKER: '${safeTicker}' };`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
