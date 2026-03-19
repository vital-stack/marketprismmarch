const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const supabaseUrl  = process.env.SUPABASE_URL  || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';
  const anthropicKey = process.env.ANTHROPIC_KEY || '';
  const massiveApi   = process.env.MASSIVE_API   || '';

  let html;
  try {
    html = readFileSync(join(__dirname, '_daily.html'), 'utf8');
  } catch {
    html = readFileSync(join(process.cwd(), '_daily.html'), 'utf8');
  }

  html = html.replace(
    "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };",
    `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
};
