# Claude Code Instructions — Daily Brief Integration
# Market Prism · marketprismmarch repo
# Run these tasks in order. Read each file before editing it.

---

## CONTEXT

This is a Vercel serverless repo. The pattern for every page is:
1. An HTML file at the repo root (e.g. `_template.html`)
2. An API handler in `/api/` that reads the HTML file, injects env vars
   into the `window.__env` block, and serves it as a response
3. `vercel.json` maps URL routes to those API handlers

The env var injection works by string-replacing this exact line in the HTML:
  `window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '' };`
with the real values from `process.env`.

---

## TASK 1 — Add new env vars to env.example

Edit `env.example`. Add these three lines after the existing SUPABASE_ANON line:

```
# Anthropic API key — used by Claude to write daily briefing prose from live data
ANTHROPIC_KEY=sk-ant-YOUR-KEY-HERE

# Massive.com (formerly Polygon.io) API key — used for real-time stock prices
MASSIVE_API=YOUR-MASSIVE-KEY-HERE
```

---

## TASK 2 — Create _daily.html

Create a new file `_daily.html` at the repo root.
Copy the full contents from the file I am providing below (see END OF FILE marker).

The `window.__env` block in this file must be exactly this string
(the API handler will replace it at serve time):
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
  const supabaseUrl  = process.env.SUPABASE_URL   || '';
  const supabaseAnon = process.env.SUPABASE_ANON  || '';
  const anthropicKey = process.env.ANTHROPIC_KEY  || '';
  const massiveApi   = process.env.MASSIVE_API    || '';

  let html;
  try {
    html = readFileSync(join(__dirname, '_daily.html'), 'utf8');
  } catch {
    html = readFileSync(join(process.cwd(), '_daily.html'), 'utf8');
  }

  // Inject all env vars into the window.__env block
  html = html.replace(
    "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };",
    `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store'); // always fresh — it's a daily brief
  res.status(200).send(html);
};
```

---

## TASK 4 — Register the route in vercel.json

Edit `vercel.json`. Add two things:

1. Add this rewrite BEFORE the catch-all `"/(.*)"` rule:
```json
{ "source": "/daily", "destination": "/api/daily" }
```

2. Add this function config inside the `"functions"` object:
```json
"api/daily.js": {
  "includeFiles": "../_daily.html"
}
```

Final vercel.json should look like:
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
    "api/index.js": {
      "includeFiles": "../_home.html"
    },
    "api/dashboard.js": {
      "includeFiles": "../_template.html"
    },
    "api/ticker.js": {
      "includeFiles": "../_ticker.html"
    },
    "api/heatmap.js": {
      "includeFiles": "../_heatmap.html"
    },
    "api/daily.js": {
      "includeFiles": "../_daily.html"
    }
  }
}
```

---

## TASK 5 — Add MASSIVE_API to existing api/dashboard.js

The main dashboard also needs the Massive key for future live price work.
Edit `api/dashboard.js`:

1. Add this line after the existing supabaseAnon line:
```javascript
const massiveApi   = process.env.MASSIVE_API    || '';
const anthropicKey = process.env.ANTHROPIC_KEY  || '';
```

2. Update the string replacement to include the new keys:
```javascript
html = html.replace(
  "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '' };",
  `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', SCHOLAR_ENABLED: '${scholarEnabled}', ANTHROPIC_KEY: '${anthropicKey}', MASSIVE_API: '${massiveApi}' };`
);
```

3. Also update `_template.html` — find the `window.__env` script block and
   change it to match the new replacement target string:
```html
<script id="__env_script">window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', SCHOLAR_ENABLED: '', ANTHROPIC_KEY: '', MASSIVE_API: '' };</script>
```

---

## TASK 6 — Add nav link to Daily Brief in _template.html

In `_template.html`, find the sidebar nav items section (look for `.nav-items`).
Add this nav item after the existing "Daily Brief" button:

```html
<a class="nav-item" href="/daily">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"/>
  </svg>
  Daily Brief
</a>
```

---

## TASK 7 — Verify CLAUDE.md standards are met in _daily.html

Read `CLAUDE.md` carefully, then audit `_daily.html` for:
- [ ] All body text is minimum 13px
- [ ] All labels/eyebrows are minimum 11px  
- [ ] All prices/numbers are minimum 16px
- [ ] Hero font is Instrument Serif, not Inter/DM Sans
- [ ] Color variables match CLAUDE.md (--mp-text-primary is #FFFFFF not #E8ECF4)
- [ ] Card borders use border-radius: 16px
- [ ] window.__env block matches the exact replacement string in api/daily.js

Fix any violations found. Do not change anything that already passes.

---

## DESIGN STANDARDS REMINDER (from CLAUDE.md)

These apply to _daily.html and any edits to _template.html:

- --mp-text-primary:   #FFFFFF
- --mp-text-secondary: rgba(255,255,255,0.7)
- --mp-text-tertiary:  #A0A8B0
- --mp-surface:        #0C1018
- --mp-obsidian:       #080B11
- --mp-green:          #00DE94  (bullish)
- --mp-red:            #FF4D4D  (bearish)
- --mp-cyan:           #00AEFF  (brand/neutral)
- --mp-teal:           #38C8B8  (supported)
- Card border-radius: 16px
- Card border: 1px solid rgba(255,255,255,0.06)
- Body font: Inter (fallback DM Sans)
- Mono font: Geist Mono (fallback DM Mono)
- Hero font: Instrument Serif

---

## FILE TO CREATE: _daily.html

Paste the full contents of the attached daily_brief.html here as _daily.html.
The file is provided separately. Do not modify its content except for Task 7 fixes.
