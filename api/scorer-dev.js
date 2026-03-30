const resolveTemplate = require('./_resolve-template');

module.exports = (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';
    const scorerApiUrl = process.env.SCORER_API_URL || '';

    let html = resolveTemplate('_scorer_dev.html');

    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCORER_API_URL: '' };",
      `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', SCORER_API_URL: '${scorerApiUrl}' };`
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Scorer dev error: ' + err.message);
  }
};
