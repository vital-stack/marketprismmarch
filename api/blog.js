const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const supabaseUrl  = process.env.SUPABASE_URL  || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';

  let html;
  try {
    html = readFileSync(join(__dirname, '_blog.html'), 'utf8');
  } catch {
    html = readFileSync(join(process.cwd(), '_blog.html'), 'utf8');
  }

  html = html.replace(
    "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '' };",
    `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}' };`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
