const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

function readFile(filename) {
  const candidates = [
    join(__dirname, filename),
    join(__dirname, '..', filename),
    join(process.cwd(), filename),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  return '';
}

module.exports = (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';
    const anthropicKey = process.env.ANTHROPIC_KEY || '';
    const massiveApi   = process.env.MASSIVE_API   || '';
    const scholarEnabled = process.env.ANTHROPIC_KEY ? 'true' : '';

    let html = readFile('_dashboard_v2.html');

    // Inject env vars
    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };",
      `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', SCHOLAR_ENABLED: '${scholarEnabled}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
    );

    // Inline JS modules server-side (replace <script src="/lib/..."> with inline content)
    const moduleFiles = [
      'lib/mp-core.js',
      'lib/mod-market-weather.js',
      'lib/mod-daily-conviction.js',
      'lib/mod-trade-lanes.js',
      'lib/mod-trading-cards.js',
      'lib/mod-sectors-themes.js',
      'lib/mod-trading-calendar.js',
      'lib/mod-ticker-snapshots.js',
      'lib/mod-leaderboard.js',
    ];

    // Replace the marker with all inlined scripts
    const marker = '<!-- INLINE_MODULES -->';
    if (html.includes(marker)) {
      let inlined = '';
      for (const f of moduleFiles) {
        const content = readFile(f);
        if (content) {
          inlined += `<script>\n// === ${f} ===\n${content}\n</` + `script>\n`;
        }
      }
      html = html.replace(marker, inlined);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Dashboard-v2 error: ' + err.message);
  }
};
