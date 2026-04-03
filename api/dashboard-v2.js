const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

function readFile(filename) {
  const paths = [join(__dirname, filename), join(__dirname, '..', filename), join(process.cwd(), filename)];
  for (const p of paths) { if (existsSync(p)) return readFileSync(p, 'utf8'); }
  return '';
}

module.exports = (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';
    const anthropicKey = process.env.ANTHROPIC_KEY || '';
    const massiveApi   = process.env.MASSIVE_API   || '';
    const scholarEnabled = anthropicKey ? 'true' : '';

    let html = readFile('_dashboard_v2.html');

    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };",
      `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', SCHOLAR_ENABLED: '${scholarEnabled}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
    );

    // Inline all /lib/*.js modules server-side to avoid Vercel routing issues
    const modules = [
      'lib/mp-core.js', 'lib/mod-market-weather.js', 'lib/mod-daily-conviction.js',
      'lib/mod-trade-lanes.js', 'lib/mod-trading-cards.js', 'lib/mod-sectors-themes.js',
      'lib/mod-trading-calendar.js', 'lib/mod-ticker-snapshots.js', 'lib/mod-leaderboard.js'
    ];
    for (const m of modules) {
      const tag = '<script src="/' + m + '"></script>';
      const content = readFile(m);
      if (content && html.includes(tag)) {
        // Split closing tag to prevent HTML parser issues
        html = html.replace(tag, '<script>\n' + content + '\n</' + 'script>');
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Dashboard-v2 error: ' + err.message);
  }
};
