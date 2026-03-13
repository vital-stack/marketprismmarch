const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const htmlPath = join(process.cwd(), 'index.html');
  let html = readFileSync(htmlPath, 'utf8');

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';

  html = html.replace(
    "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '' };",
    `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}' };`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
