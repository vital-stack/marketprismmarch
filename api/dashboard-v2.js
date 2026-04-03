const resolveTemplate = require('./_resolve-template');

module.exports = (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';
    const anthropicKey = process.env.ANTHROPIC_KEY || '';
    const massiveApi   = process.env.MASSIVE_API   || '';

    let html = resolveTemplate('_dashboard_v2.html');

    const scholarEnabled = process.env.ANTHROPIC_KEY ? 'true' : '';

    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };",
      `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', SCHOLAR_ENABLED: '${scholarEnabled}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Dashboard-v2 error: ' + err.message);
  }
};
