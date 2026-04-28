const resolveTemplate = require('./_resolve-template');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON = process.env.SUPABASE_ANON || '';

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(/;\s*/).forEach(function(p){
    const i = p.indexOf('=');
    if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1));
  });
  return out;
}

async function verifySupabaseToken(token) {
  if (!SUPABASE_URL || !SUPABASE_ANON || !token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON,
      },
    });
    return r.ok;
  } catch (_e) {
    return false;
  }
}

module.exports = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);

    let authed = false;
    if (cookies.mp_beta === '1') {
      authed = true;
    } else if (cookies.mp_session) {
      authed = await verifySupabaseToken(cookies.mp_session);
    }

    if (!authed) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Location', '/login?next=' + encodeURIComponent('/api/market-sharing-reports'));
      return res.status(302).end();
    }

    let html = resolveTemplate('_market_sharing_reports.html');

    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '' };",
      `window.__env = { SUPABASE_URL: '${SUPABASE_URL}', SUPABASE_ANON: '${SUPABASE_ANON}' };`
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Market sharing reports error: ' + err.message);
  }
};
