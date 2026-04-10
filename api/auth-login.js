// Server-side fallback for Supabase password sign-in.
//
// Why this exists: on iOS Safari we have seen the client-side
// supabase.auth.signInWithPassword() call surface as "TypeError: Load failed".
// That happens when the browser cannot reach *.supabase.co directly — most
// commonly because of a content blocker, an iOS Lockdown Mode profile, or a
// network that filters the Supabase domain. Proxying the request through our
// own origin lets those users still authenticate.
//
// The endpoint takes { email, password }, forwards them to Supabase's
// /auth/v1/token?grant_type=password endpoint with the anon key, and returns
// the resulting session JSON. The browser then calls supabase.auth.setSession()
// with the returned tokens.

function normalizeSupabaseUrl(raw) {
  let url = String(raw || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/+$/, '');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      // Hard cap so a malicious client can't exhaust memory.
      if (data.length > 64 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const supabaseAnon = (process.env.SUPABASE_ANON || '').trim();

  if (!supabaseUrl || !supabaseAnon) {
    res.status(500).json({ error: 'Auth service not configured' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid request body' });
    return;
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const upstream = await fetch(
      supabaseUrl + '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnon,
          'Authorization': 'Bearer ' + supabaseAnon,
        },
        body: JSON.stringify({ email: email, password: password }),
      }
    );

    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch (e) { payload = { error: 'Unexpected response from auth provider' }; }

    if (!upstream.ok) {
      // Pass through Supabase's error shape so the client can show a useful
      // message ("Invalid login credentials", etc.).
      const message =
        (payload && (payload.error_description || payload.msg || payload.error)) ||
        'Sign in failed';
      res.status(upstream.status).json({ error: message });
      return;
    }

    // Successful sign-in: return only the fields the client needs to call
    // supabase.auth.setSession().
    res.status(200).json({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_in: payload.expires_in,
      token_type: payload.token_type,
      user: payload.user || null,
    });
  } catch (err) {
    res.status(502).json({
      error: 'Could not reach authentication service. Please try again.',
    });
  }
};
