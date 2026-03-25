const resolveTemplate = require('./_resolve-template');

module.exports = (req, res) => {
  try {
    const supabaseUrl  = process.env.SUPABASE_URL  || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';
    const anthropicKey = process.env.ANTHROPIC_KEY || '';
    const massiveApi   = process.env.MASSIVE_API   || '';

    let html = resolveTemplate('_daily.html');

    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };",
      `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Daily error: ' + err.message);
  }
};
