// Shared auth gate. Every gated route (dashboard, ticker pages, heatmap,
// methodology, case studies, signal studies, etc.) runs this first. If the
// request lacks both a valid Supabase session cookie (mp_session) and the
// short-lived beta cookie (mp_beta), the request is 302'd to /login with
// ?next= preserved so login flow can return the user to where they tried to go.
//
// Env-controlled subscription enforcement (kill switch):
//   ENFORCE_SUBSCRIPTION = "true"  → require active/trialing subscription
//                                    for mp_session users (mp_beta still
//                                    bypasses, by design)
//   ENFORCE_SUBSCRIPTION = unset/"" → legacy behavior: any logged-in user passes
//   ADMIN_USER_IDS = "uuid1,uuid2"  → comma-separated UUIDs that bypass the
//                                    subscription check (use sparingly; meant
//                                    for the operator's own accounts during
//                                    rollout)
//
// Helper returns:
//   - false  -> already responded; the route handler must return immediately.
//   - { user, hasBeta, subscription } -> request is authorized; route may continue.
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

// In-memory subscription cache, per Vercel function instance. 30-second TTL.
// Cold starts re-fetch; not a correctness issue, just a small extra hop.
// This caps the dashboard's auth-overhead on warm instances at ~50ms (one JWT
// verify) for repeat requests within 30s, instead of doubling to ~100ms with
// the new subscription fetch on every request.
const SUB_CACHE = new Map();
const SUB_CACHE_TTL_MS = 30 * 1000;

async function getActiveSubscription(userId, supabaseUrl, supabaseAnon, jwt){
  if (!userId || !supabaseUrl || !supabaseAnon || !jwt) return null;
  const cached = SUB_CACHE.get(userId);
  const now = Date.now();
  if (cached && now - cached.t < SUB_CACHE_TTL_MS) return cached.sub;
  try {
    // RLS policy "Users see own subscriptions" (auth.uid() = user_id) means
    // this query returns at most the caller's own row.
    const url = `${supabaseUrl}/rest/v1/subscriptions`
      + `?select=status,current_period_end`
      + `&user_id=eq.${encodeURIComponent(userId)}`
      + `&order=current_period_end.desc.nullslast`
      + `&limit=1`;
    const r = await fetch(url, {
      headers: { apikey: supabaseAnon, Authorization: `Bearer ${jwt}` }
    });
    if (!r.ok) {
      SUB_CACHE.set(userId, { t: now, sub: null });
      return null;
    }
    const rows = await r.json();
    const sub = (rows && rows[0]) || null;
    SUB_CACHE.set(userId, { t: now, sub });
    // Cap cache size to keep memory bounded on long-lived instances.
    if (SUB_CACHE.size > 2000) {
      const firstKey = SUB_CACHE.keys().next().value;
      if (firstKey) SUB_CACHE.delete(firstKey);
    }
    return sub;
  } catch (_e) {
    return null;
  }
}

function isAdminUser(userId){
  const raw = process.env.ADMIN_USER_IDS || '';
  if (!raw) return false;
  return raw.split(',').map(s => s.trim()).filter(Boolean).includes(userId);
}

function isSubscriptionActive(sub){
  if (!sub) return false;
  const status = String(sub.status || '').toLowerCase();
  if (status !== 'active' && status !== 'trialing') return false;
  // Optional belt-and-suspenders: if current_period_end is in the past,
  // treat as expired even if status hasn't been webhook-updated yet.
  if (sub.current_period_end) {
    const t = new Date(sub.current_period_end).getTime();
    if (Number.isFinite(t) && t < Date.now()) return false;
  }
  return true;
}

module.exports = async function requireAuth(req, res, options){
  const opts = options || {};
  const supabaseUrl  = process.env.SUPABASE_URL  || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';
  const enforceSub   = String(process.env.ENFORCE_SUBSCRIPTION || '').toLowerCase() === 'true';

  const cookies = parseCookies(req.headers && req.headers.cookie);
  const hasBeta = cookies.mp_beta === '1';
  let user = null;
  if (cookies.mp_session) {
    user = await verifySupabaseToken(cookies.mp_session, supabaseUrl, supabaseAnon);
  }

  // Beta cookie holders bypass the subscription check by design — beta is for
  // testers/press/operators with a valid code. (The code itself is now
  // server-validated in api/session.js, so this is no longer a wide door.)
  if (hasBeta) {
    return { user: user, hasBeta: true, subscription: null };
  }

  // Logged-in path. Enforce subscription only if the kill switch is on.
  if (user) {
    if (!enforceSub) {
      // Legacy behavior — preserved while the kill switch is off so this
      // ships without locking anyone out.
      return { user: user, hasBeta: false, subscription: null };
    }

    if (isAdminUser(user.id)) {
      return { user: user, hasBeta: false, subscription: { status: 'admin_allowlist' } };
    }

    const sub = await getActiveSubscription(user.id, supabaseUrl, supabaseAnon, cookies.mp_session);
    if (isSubscriptionActive(sub)) {
      return { user: user, hasBeta: false, subscription: sub };
    }

    // Logged in but no active subscription → send to /pricing, not /login.
    res.statusCode = 302;
    res.setHeader('Location', '/pricing?reason=subscription_required');
    res.setHeader('Cache-Control', 'no-store');
    res.end();
    return false;
  }

  // Not authorized at all — redirect to /login?next=<original path>.
  const nextPath = opts.next || (req.url || '/dashboard');
  res.statusCode = 302;
  res.setHeader('Location', '/login?next=' + encodeURIComponent(nextPath));
  res.setHeader('Cache-Control', 'no-store');
  res.end();
  return false;
};
