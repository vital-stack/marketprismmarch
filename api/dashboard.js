const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';

  let html;
  try {
    html = readFileSync(join(__dirname, '_template.html'), 'utf8');
  } catch {
    html = readFileSync(join(process.cwd(), '_template.html'), 'utf8');
  }

  const scholarEnabled = process.env.ANTHROPIC_API_KEY ? 'true' : '';

  html = html.replace(
    "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '' };",
    `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', SCHOLAR_ENABLED: '${scholarEnabled}' };`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
