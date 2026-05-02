// Shared auth gate. Every gated route (dashboard, ticker pages, heatmap,
// methodology, case studies, signal studies, etc.) runs this first. If the
// request lacks both a valid Supabase session cookie (mp_session) and the
// short-lived beta cookie (mp_beta), the request is 302'd to /login with
// ?next= preserved so login flow can return the user to where they tried to go.
//
// Helper returns:
//   - false  -> already responded; the route handler must return immediately.
//   - { user, hasBeta } -> request is authorized; route may continue.
//
// Pattern in each route:
//   const requireAuth = require('./_require-auth');
//   module.exports = async (req, res) => {
//     const auth = await requireAuth(req, res);
//     if (!auth) return;
//     // ... existing handler
//   };

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

module.exports = async function requireAuth(req, res, options){
  const opts = options || {};
  const supabaseUrl  = process.env.SUPABASE_URL  || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';

  const cookies = parseCookies(req.headers && req.headers.cookie);
  const hasBeta = cookies.mp_beta === '1';
  let user = null;
  if (cookies.mp_session) {
    user = await verifySupabaseToken(cookies.mp_session, supabaseUrl, supabaseAnon);
  }
  if (user || hasBeta) {
    return { user: user, hasBeta: hasBeta };
  }

  // Not authorized — redirect to /login?next=<original path>.
  const nextPath = opts.next || (req.url || '/dashboard');
  res.statusCode = 302;
  res.setHeader('Location', '/login?next=' + encodeURIComponent(nextPath));
  res.setHeader('Cache-Control', 'no-store');
  res.end();
  return false;
};
