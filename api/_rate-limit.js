// In-memory per-IP rate limiter for Vercel serverless functions.
//
// Caveats:
// - State is per function instance. Cold starts and multi-region scaling
//   reset buckets, so a determined attacker spreading across regions could
//   exceed the nominal limits. Acceptable as a first line of defense; for
//   harder bot mitigation we'd swap this for Vercel KV / Upstash Redis.
// - Counts requests in a sliding window. Resets when the window expires.
// - IP detection follows x-forwarded-for first hop, then x-real-ip, then
//   socket fallback.
//
// Usage in a handler:
//
//   const rateLimit = require('./_rate-limit');
//   module.exports = async (req, res) => {
//     if (!rateLimit(req, res, 'live-quote', 120)) return;
//     // ... existing handler
//   };
//
// `scope` should be the endpoint name so different endpoints get separate
// buckets (one expensive endpoint hitting its limit doesn't block cheaper
// reads from the same IP).

const BUCKETS = new Map();
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute sliding window

function getIp(req) {
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  if (req.headers && req.headers['x-real-ip']) return String(req.headers['x-real-ip']).trim();
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return 'unknown';
}

function check(scope, ip, max, windowMs) {
  const key = scope + ':' + ip;
  const now = Date.now();
  const cutoff = now - windowMs;
  let times = BUCKETS.get(key);
  if (!times) times = [];
  // Drop expired timestamps.
  while (times.length && times[0] < cutoff) times.shift();
  if (times.length >= max) {
    BUCKETS.set(key, times);
    const retryAfter = Math.max(1, Math.ceil((times[0] + windowMs - now) / 1000));
    return { ok: false, retryAfter: retryAfter };
  }
  times.push(now);
  BUCKETS.set(key, times);
  // Periodically prune cold keys to keep memory bounded.
  if (BUCKETS.size > 5000 && Math.random() < 0.01) prune(cutoff);
  return { ok: true };
}

function prune(cutoff) {
  for (const [key, times] of BUCKETS) {
    while (times.length && times[0] < cutoff) times.shift();
    if (!times.length) BUCKETS.delete(key);
  }
}

// Main entry point. Returns true if the request is allowed; returns false
// after sending a 429 response if blocked.
function rateLimit(req, res, scope, max, windowMs) {
  const ip = getIp(req);
  const result = check(scope, ip, max, windowMs || DEFAULT_WINDOW_MS);
  if (!result.ok) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Retry-After', String(result.retryAfter));
    res.setHeader('X-RateLimit-Scope', scope);
    res.end(JSON.stringify({
      error: 'Rate limit exceeded. Slow down and try again shortly.',
      retryAfter: result.retryAfter
    }));
    return false;
  }
  return true;
}

module.exports = rateLimit;
module.exports.check = check;
module.exports.getIp = getIp;
