# Claude Code Instructions — Daily Brief + Live Prices Integration
# Market Prism · marketprismmarch repo
# Run these tasks in order. Read each file before editing it.

---

## CONTEXT

This is a Vercel serverless repo. The pattern for every page is:
1. An HTML file at the repo root (e.g. `_template.html`)
2. An API handler in `/api/` that reads the HTML file, injects env vars
   into the `window.__env` block, and serves it as a response
3. `vercel.json` maps URL routes to those API handlers

The env var injection works by string-replacing the `window.__env` line in
the HTML with real values from `process.env`. The string in the HTML and the
first argument of `html.replace()` in the API handler must match exactly.

Only touch the files explicitly listed in each task.

---

## TASK 1 — Add new env vars to env.example

Edit `env.example`. Add these two lines after the existing SUPABASE_ANON line:

```
# Anthropic API key — used by Claude to write daily briefing prose from live data
ANTHROPIC_KEY=sk-ant-YOUR-KEY-HERE

# Massive.com (formerly Polygon.io) API key — used for real-time stock prices
MASSIVE_API=YOUR-MASSIVE-KEY-HERE
```

---

## TASK 2 — Create _daily.html

Create a new file `_daily.html` at the repo root.
Copy the full contents from `daily_brief_as_daily.html` provided alongside
these instructions. Do not modify the content.

Confirm the file contains this exact window.__env block:
```html
<script id="__env_script">window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };</script>
```

---

## TASK 3 — Create api/daily.js

Create `/api/daily.js` with this exact content:

```javascript
const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const supabaseUrl  = process.env.SUPABASE_URL  || '';
  const supabaseAnon = process.env.SUPABASE_ANON || '';
  const anthropicKey = process.env.ANTHROPIC_KEY || '';
  const massiveApi   = process.env.MASSIVE_API   || '';

  let html;
  try {
    html = readFileSync(join(__dirname, '_daily.html'), 'utf8');
  } catch {
    html = readFileSync(join(process.cwd(), '_daily.html'), 'utf8');
  }

  html = html.replace(
    "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };",
    `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
};
```

---

## TASK 4 — Register the route in vercel.json

Edit `vercel.json`. Add two things:

1. Add this rewrite BEFORE the catch-all "/(.*)" rule:
```json
{ "source": "/daily", "destination": "/api/daily" }
```

2. Add this entry inside the "functions" object:
```json
"api/daily.js": {
  "includeFiles": "../_daily.html"
}
```

Final vercel.json should look like this:
```json
{
  "rewrites": [
    { "source": "/api/scholar",    "destination": "/api/scholar" },
    { "source": "/ticker/:ticker", "destination": "/api/ticker" },
    { "source": "/dashboard",      "destination": "/api/dashboard" },
    { "source": "/heatmap",        "destination": "/api/heatmap" },
    { "source": "/daily",          "destination": "/api/daily" },
    { "source": "/(.*)",           "destination": "/api/index"  }
  ],
  "functions": {
    "api/index.js":     { "includeFiles": "../_home.html" },
    "api/dashboard.js": { "includeFiles": "../_template.html" },
    "api/ticker.js":    { "includeFiles": "../_ticker.html" },
    "api/heatmap.js":   { "includeFiles": "../_heatmap.html" },
    "api/daily.js":     { "includeFiles": "../_daily.html" }
  }
}
```

---

## TASK 5 — Inject MASSIVE_API and ANTHROPIC_KEY into the main dashboard

This makes live ticker prices and Claude available across all existing pages
that use _template.html (main dashboard, discover, sector pulse, snapshots etc.)

### 5a — Edit api/dashboard.js

Add these two lines after the existing `supabaseAnon` line:
```javascript
const anthropicKey = process.env.ANTHROPIC_KEY || '';
const massiveApi   = process.env.MASSIVE_API   || '';
```

Update the html.replace() call to include the new keys:
```javascript
html = html.replace(
  "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '' };",
  `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', SCHOLAR_ENABLED: '${scholarEnabled}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
);
```

### 5b — Edit _template.html

Find the window.__env script block (search for `__env_script`).
Update it to match the new replacement target string exactly:
```html
<script id="__env_script">window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };</script>
```

The string in _template.html and the first argument of html.replace() in
api/dashboard.js must be identical — that is how the injection works.

---

## DONE

- /daily is live with full Supabase + Claude + Massive support
- All existing dashboard pages now have MASSIVE_API and ANTHROPIC_KEY
  available in window.__env for live ticker price calls
