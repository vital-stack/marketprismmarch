// Session cookie endpoint. Mints HttpOnly cookies that the server can read,
// since the rest of the site stores Supabase auth in localStorage only.
//
// POST { access_token }      -> verify with Supabase, set mp_session (24h)
// POST { beta:true, expires } -> set mp_beta until expires (matches localStorage 'mp-beta-expires')
// DELETE                     -> clear both cookies

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON = process.env.SUPABASE_ANON || '';

const SESSION_MAX_AGE = 60 * 60 * 24;          // 24h, mirrors client mp_auth window
const BETA_MAX_AGE_CAP = 60 * 60 * 24 * 7;     // hard cap of 7d for beta cookies

function buildCookie(name, value, maxAgeSeconds) {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join('; ');
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function verifySupabaseToken(token) {
  if (!SUPABASE_URL || !SUPABASE_ANON || !token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON,
      },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch (_e) {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [clearCookie('mp_session'), clearCookie('mp_beta')]);
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (_e) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (body.access_token) {
    const user = await verifySupabaseToken(body.access_token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    res.setHeader('Set-Cookie', buildCookie('mp_session', body.access_token, SESSION_MAX_AGE));
    return res.status(200).json({ ok: true, user_id: user.id });
  }

  if (body.beta === true) {
    let maxAge = BETA_MAX_AGE_CAP;
    if (body.expires) {
      const ms = new Date(body.expires).getTime() - Date.now();
      if (Number.isFinite(ms) && ms > 0) maxAge = Math.min(Math.floor(ms / 1000), BETA_MAX_AGE_CAP);
    }
    res.setHeader('Set-Cookie', buildCookie('mp_beta', '1', maxAge));
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Missing access_token or beta flag' });
};
