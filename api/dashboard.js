const resolveTemplate = require('./_resolve-template');

function parseCookies(header){
  const out = {};
  if (!header) return out;
  String(header).split(';').forEach(c => {
    const i = c.indexOf('=');
    if (i < 0) return;
    out[c.slice(0, i).trim()] = c.slice(i + 1).trim();
  });
  return out;
}

async function verifySupabaseToken(token, supabaseUrl, supabaseAnon){
  if (!supabaseUrl || !supabaseAnon || !token) return null;
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnon }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch (_e) {
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    const supabaseUrl  = process.env.SUPABASE_URL  || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';
    const anthropicKey = process.env.ANTHROPIC_KEY || '';
    const massiveApi   = process.env.MASSIVE_API   || '';

    // ── Hard gate: require a valid Supabase session OR a beta cookie ─────
    const cookies = parseCookies(req.headers && req.headers.cookie);
    const hasBeta = cookies.mp_beta === '1';
    let user = null;
    if (cookies.mp_session) {
      user = await verifySupabaseToken(cookies.mp_session, supabaseUrl, supabaseAnon);
    }
    if (!user && !hasBeta) {
      res.statusCode = 302;
      res.setHeader('Location', '/login?next=%2Fdashboard');
      res.setHeader('Cache-Control', 'no-store');
      return res.end();
    }

    let html = resolveTemplate('_template.html');

    // Inject Signal Lab tab partial
    try {
      const slTab = resolveTemplate('_signal_lab_tab.html');
      html = html.replace('<!-- SIGNAL_LAB_INJECT -->', function() { return slTab; });
    } catch (e) {
      console.warn('Signal Lab tab not found:', e.message);
    }

    // Inject Ticker Research tab partial
    try {
      const trTab = resolveTemplate('_ticker_tab.html');
      html = html.replace('<!-- TICKER_TAB_INJECT -->', function() { return trTab; });
    } catch (e) {
      console.warn('Ticker tab not found:', e.message);
    }

    const scholarEnabled = process.env.ANTHROPIC_KEY ? 'true' : '';

    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };",
      `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', SCHOLAR_ENABLED: '${scholarEnabled}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Authenticated/beta responses are user-specific — must not be cached by the CDN.
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Dashboard error: ' + err.message);
  }
};
