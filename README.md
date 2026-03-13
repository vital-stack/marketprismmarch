# Forensic Market Engine

Live narrative intelligence feed — pulls directly from Supabase on every page load.
Snapshot: **Mar 13, 2026** · 169 tickers · Walsh Engine

---

## Deploy to Vercel (5 minutes)

### 1 — Push to GitHub

```bash
git init
git add .
git commit -m "init"
gh repo create forensic-market-engine --public --push
```

### 2 — Import into Vercel

1. Go to vercel.com/new
2. Click Import next to your forensic-market-engine repo
3. Framework preset: Other (it's plain HTML)
4. Click Deploy

### 3 — Add environment variables

In Vercel → your project → Settings → Environment Variables:

| Key            | Where to find it                                      |
|----------------|-------------------------------------------------------|
| SUPABASE_URL   | Supabase → Settings → API → Project URL               |
| SUPABASE_ANON  | Supabase → Settings → API → anon public key           |

### 4 — Redeploy

Deployments → Redeploy. Live in ~30 seconds.

---

## How it works

Browser hits Vercel Edge (middleware.js), which injects your env vars into the HTML,
then the page fetches v_dash_daily_story_rows directly from Supabase REST API.
Data is always live — no redeploy needed when data updates.

---

## File structure

```
forensic-market-engine/
├── index.html       # Full UI
├── middleware.js    # Vercel Edge: injects env vars
├── vercel.json      # Routing
├── .env.example     # Key template
├── .gitignore
└── README.md
```

No npm. No build step. No framework.
