const resolveTemplate = require('./_resolve-template');

// Normalize a Supabase URL: ensure https:// prefix, strip trailing slash.
// Without this, a value like "myproj.supabase.co" makes supabase-js issue
// a request to a relative path, which iOS Safari surfaces as "Load failed".
function normalizeSupabaseUrl(raw) {
  let url = String(raw || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/+$/, '');
}

// Escape a string for safe inclusion inside a single-quoted JS literal.
function jsEscape(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

module.exports = (req, res) => {
  try {
    const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const supabaseAnon = (process.env.SUPABASE_ANON || '').trim();

    let html = resolveTemplate('_login.html');

    html = html.replace(
      "window.__login_env = { SUPABASE_URL: '', SUPABASE_ANON: '' };",
      `window.__login_env = { SUPABASE_URL: '${jsEscape(supabaseUrl)}', SUPABASE_ANON: '${jsEscape(supabaseAnon)}' };`
    );

    // Disable caching so a stale HTML payload can't keep an old (broken)
    // env-var snapshot in front of users after a config fix.
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Login error: ' + err.message);
  }
};
