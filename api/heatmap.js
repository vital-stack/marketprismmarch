const resolveTemplate = require('./_resolve-template');
const requireAuth = require('./_require-auth');

module.exports = async (req, res) => {
  try {
    const auth = await requireAuth(req, res, { next: '/heatmap' });
    if (!auth) return;

    const supabaseUrl  = process.env.SUPABASE_URL  || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';

    let html = resolveTemplate('_heatmap.html');

    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '' };",
      `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}' };`
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Heatmap error: ' + err.message);
  }
};
