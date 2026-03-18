# Market Prism — Supabase Integration Report

> Generated 2026-03-18 · Covers all 4 HTML pages + API handlers

---

## Architecture Overview

```
Browser → Vercel Rewrite → API Handler (Node.js) → Injects env vars → Serves HTML
                                                                          ↓
                                                            Client JS → Supabase REST API
```

All pages use **direct Supabase REST calls** (no SDK). Env vars (`SUPABASE_URL`, `SUPABASE_ANON`) are injected server-side by API handlers via string replacement on a `<script id="__env_script">` tag.

---

## Routing & File Map

| Route | API Handler | HTML File | Env Vars Injected |
|-------|------------|-----------|-------------------|
| `/` (catch-all) | `api/index.js` | `_home.html` | `SUPABASE_URL`, `SUPABASE_ANON` |
| `/dashboard` | `api/dashboard.js` | `_template.html` | `SUPABASE_URL`, `SUPABASE_ANON`, `SCHOLAR_ENABLED` |
| `/ticker/:ticker` | `api/ticker.js` | `_ticker.html` | `SUPABASE_URL`, `SUPABASE_ANON`, `TICKER` |
| `/heatmap` | `api/heatmap.js` | `_heatmap.html` | `SUPABASE_URL`, `SUPABASE_ANON` |

---

## Supabase Tables/Views Used

| Table/View | Type | Used By |
|---|---|---|
| `v_dash_daily_story` | View | _home, _template, _ticker |
| `v_dash_narrative_health` | View | _template, _ticker |
| `ticker_pulse` | Table | _home, _template, _ticker, _heatmap |
| `ticker_snapshots` | Table | _ticker |
| `narrative_analyses` | Table | _ticker |
| `decay_metrics` | Table | _ticker |
| `v_dash_historical_analogs` | View | _ticker |
| `v_dash_move_drivers` | View | _ticker |
| `Sector Intelligence` | Table (quoted name) | _ticker |

---

## Page-by-Page Query Map

### `_home.html` — Landing Page

**Status: ✅ LIVE** (wired up via inline boot script)

| Section | Table | Columns | Filter | Notes |
|---------|-------|---------|--------|-------|
| Ticker tape | `v_dash_daily_story` | ticker, price, price_change_pct | story_claim not null | Top 11 tickers |
| Dashboard stats | `v_dash_daily_story` | — | — | Computed: count, breaking, traps |
| Mini heatmap | `ticker_pulse` | ticker, pulse_health_score | — | Top 16 by health |
| Featured card | `v_dash_daily_story` | ticker, price, story_claim, prism_verdict | — | First row |
| Live narratives feed | `v_dash_daily_story` | — | — | Rows 2–5 |
| Trading cards | `v_dash_daily_story` + `ticker_pulse` | — | — | Top 4 tickers |
| Detail preview | `v_dash_daily_story` + `ticker_pulse` | — | — | Top ticker hero |

**Static fallback**: All sections keep their hardcoded HTML if Supabase credentials are missing.

---

### `_template.html` — Dashboard (Daily Briefing)

**Status: ✅ MOSTLY LIVE** (some Daily Brief content remains static)

#### Live Queries

| Function | Table | Columns (abbreviated) | Filter | Limit | Purpose |
|----------|-------|----------------------|--------|-------|---------|
| `loadData()` | `v_dash_daily_story` | ticker, price, price_change_pct, narrative_state, prism_verdict, story_claim, pe_ratio, fair_value, sector_name + 6 more | story_claim not null | — | Main data feed |
| `loadData()` | `v_dash_narrative_health` | ticker, narrative_health, narrative_trend, attention_trend | — | — | Health overlay merged into DATA |
| `loadData()` | `ticker_pulse` | ticker, direction_forecast | — | — | Pulse overlay for bull/bear counts |
| `loadDiscoverHeatmap()` | `ticker_pulse` | ticker, pulse_health_score, direction_forecast, prevailing_verdict, trap_count | — | 200 | Mini heatmap grid |
| `generateReport()` | `v_dash_daily_story` | 18 columns | ticker=eq.{sym} | 1 | Report generation |

#### Sections Fed by DATA Array (live)

| Section | Render Function | Source |
|---------|----------------|--------|
| Discover feed | `renderDiscover()` | DATA (live) |
| Ticker snapshots table | `renderSnap()` | DATA (live) |
| Trading cards gallery | `renderCardsGallery()` | DATA (live) |
| Daily signal cards | `renderDailySignalCards()` | DATA (live, fallback to 3 hardcoded) |
| Trading cards | `renderTradingCards()` | DATA (live, fallback to 3 hardcoded) |
| Meme/share cards | `renderMemes()` | DATA when available, else MEME_SEED |
| Sectors | `renderSectors()` | SECTOR_STATIC base + DATA overlay |
| Top movers | inline in `loadData()` | DATA (live) |
| Narrative breakdown | inline in `loadData()` | DATA (live) |
| Opportunity Matrix | `renderDailyOpportunityMatrix()` | DATA (live) — tickers with price < fair_value |
| Live Narratives panel | `renderDailyLiveNarratives()` | DATA (live) — top 4 movers |
| Market Pulse strip | `renderDailyMarketPulse()` | DATA (live) — SPY/QQQ + top movers |
| Sentiment bar | inline in `loadData()` | Computed from direction_forecast bull/bear ratio |
| Bull/Bear counts | inline in `loadData()` | ticker_pulse direction_forecast |

#### ⚠️ Still Hardcoded (no existing Supabase table)

| Section | Lines | Content | Why Static |
|---------|-------|---------|-----------|
| Daily Brief hero prose | 2488–2506 | Overnight picture, dominant narrative, trade setup | Editorial content — would need a `daily_briefs` table |
| Watch list | 2516–2531 | FOMC, Housing Starts times | Economic calendar — would need a `market_events` table |
| Weekly calendar | 2605–2610 | Mar 18–24 events | Same — no calendar table exists |
| SECTOR_STATIC | 3742+ | 8 sector definitions with CAGR, descriptions | Could partially derive from `Sector Intelligence` table |
| NHT_TICKERS | 4151–4290 | Narrative history for NVDA, PLTR, RDDT only | Would need time-series query per ticker from `v_dash_narrative_health` |
| Trading Calendar | 5188+ | User's queued cards | Uses localStorage (local only, not synced) |

---

### `_ticker.html` — Individual Ticker Page

**Status: ✅ FULLY LIVE** (all data from Supabase)

| Function | Table | Key Columns | Filter | Limit | Purpose |
|----------|-------|------------|--------|-------|---------|
| `loadHero()` | `v_dash_daily_story` | 40 cols (price, narrative_state, financials, sector data) | ticker=eq.{TICKER} | 1 | Main hero section |
| `loadHero()` | `v_dash_narrative_health` | narrative_health, narrative_trend, attention_trend | ticker=eq.{TICKER} | 1 | Trend badge overlay |
| `loadHero()` | `ticker_snapshots` | snapshot_date, price_close, price_change_pct | ticker=eq.{TICKER} | 1 | Fresher price overlay |
| `loadSectorIntelligence()` | `Sector Intelligence` | * (all — has quoted column names with spaces) | Client-side regex filter | — | Sector context panel |
| `loadChart()` | `v_dash_narrative_health` | snapshot_date, sentiment_score, narrative_trend | ticker=eq.{TICKER} | 365 | Sentiment overlay on chart |
| `loadChart()` | `decay_metrics` | snapshot_date, energy_remaining_pct, day_number | ticker=eq.{TICKER} | 365 | Energy exhaustion overlay |
| `loadChart()` | `ticker_snapshots` | snapshot_date, price_close | ticker=eq.{TICKER} | 365 | Fallback price history |
| `loadLifecycle()` | `v_dash_narrative_health` | energy_absolute, energy_regime, narrative_health + 2 | ticker=eq.{TICKER} | 1 | Lifecycle stage bar |
| `loadContagion()` | `narrative_analyses` | upstream_tickers, downstream_tickers, contagion_risk + 3 | ticker=eq.{TICKER} | 1 | Supply chain map |
| `loadPrerequisites()` | `narrative_analyses` | prerequisites_json, prerequisites_met, prerequisites_total | ticker=eq.{TICKER} | 1 | Validation checklist |
| `loadParallels()` | `v_dash_historical_analogs` | analog_ticker, analog_move, recovery_days + 3 | ticker=eq.{TICKER} | 3 | Historical analogs |
| `loadMoveDrivers()` | `v_dash_move_drivers` | driver, impact_pct, driver_class | ticker=eq.{TICKER} | 6 | What's moving the stock |
| `loadNarratives()` | `narrative_analyses` | 20 columns (narrative_text, verdict, quality signals) | ticker=eq.{TICKER} | 30 | Trending narratives |
| `loadNarratives()` | `ticker_snapshots` | snapshot_date, price_close | ticker=eq.{TICKER} | 365 | Price-at-time lookup |
| `loadPulse()` | `ticker_pulse` | 28 columns (health, drift, coordination, sentiment) | ticker=eq.{TICKER} | 1 | Diagnosis strip + heatmap |
| `loadStoriesFeed()` | `narrative_analyses` | narrative_text, verdict, sentiment_score + 3 | ticker=eq.{TICKER} | 50 | Stories sidebar feed |

**Additional data source**: Yahoo Finance via `allorigins.win` CORS proxy for price chart (falls back to `ticker_snapshots` if unavailable).

**Ticker extraction**: Server-side via `api/ticker.js` (from rewrite params, URL path, or headers) + client-side fallback from `location.pathname`.

---

### `_heatmap.html` — Heatmap Grid

**Status: ✅ FULLY LIVE**

| Function | Table | Key Columns | Filter | Limit | Purpose |
|----------|-------|------------|--------|-------|---------|
| `fetchData()` | `ticker_pulse` | 21 columns (ticker, pulse_health_score, direction_forecast, prevailing_verdict, decay_status, etc.) | — | 500 | Full heatmap grid |

---

## Known Issues & Fixes Applied

### Fixed ✅

| Issue | File | Fix |
|-------|------|-----|
| Clearbit logo API dead (403) | All files | Replaced with Google Favicon API + colored-initial fallbacks |
| `direction_forecast` never fetched for bull/bear counts | `_template.html` | Added `ticker_pulse` overlay fetch in `loadData()` |
| `narrative_state` checked on `ticker_pulse` (wrong table) | `_template.html` | Removed dead condition in `loadDiscoverHeatmap()` |
| Ticker page empty — wrong ticker extraction from Vercel rewrite | `api/ticker.js` + `_ticker.html` | Multi-source extraction: `req.query.ticker`, URL path, headers, `?t=` param; client rejects literal "TICKER" |
| All static content on landing page | `_home.html` | Added Supabase boot script that overlays live data |
| Hardcoded Opportunity Matrix, Live Narratives, Market Pulse | `_template.html` | Added `renderDailyOpportunityMatrix()`, `renderDailyLiveNarratives()`, `renderDailyMarketPulse()` |
| Sentiment bar fixed at 64% | `_template.html` | Now computed from actual bull/bear ratio |

### Remaining ⚠️ (Would Need New Tables)

| Content | File | What's Needed |
|---------|------|--------------|
| Daily Brief prose (overnight picture, narrative, trade setup) | `_template.html` | A `daily_briefs` table with date-keyed editorial content |
| Economic watch list (FOMC, Housing Starts) | `_template.html` | A `market_events` table with timestamps + impact levels |
| Weekly calendar | `_template.html` | Same `market_events` table |
| Full sector definitions (CAGR, descriptions, momentum) | `_template.html` | Expand `Sector Intelligence` table or create `sector_summaries` |
| Narrative History for all tickers (currently only 3) | `_template.html` | Time-series query from `v_dash_narrative_health` per ticker |
| Trading Calendar sync | `_template.html` | Currently localStorage only — would need a `user_watchlist` table |

---

## Config / Design Data (Static by Design)

These are intentionally hardcoded and do NOT need Supabase:

| Data | Files | Purpose |
|------|-------|---------|
| `MP_DOMAINS` / `DOMAIN_MAP` | All files | Ticker → company domain for favicon lookup |
| `LOGO_COLORS` | All files | 6 color pairs for fallback logo initials |
| `SECTOR_MAP` | `_template.html` | Ticker → sector category mapping |
| `TRADING_CARD_COLORS` | `_template.html` | 5 card color palettes |
| `regimeToStage` mapping | `_ticker.html` | Energy regime → lifecycle stage labels |
| Status scoring thresholds | `_ticker.html` | Pulse metric → status label logic |

---

## Error Handling Patterns

| Pattern | Used In | Behavior |
|---------|---------|----------|
| Config check + throw | All pages | Shows "Config error" message if env vars missing |
| `.catch(() => [])` | `_ticker.html` (all loaders) | Silent fail, returns empty array, UI shows "No data" |
| `try/catch` with error display | `_template.html` `loadData()` | Shows error message in feed + renders static fallbacks |
| `sbFetch` with status check | `_ticker.html`, `_heatmap.html` | Throws with table name + HTTP status + body excerpt |
| Static HTML fallback | `_home.html` | Keeps hardcoded content if Supabase unavailable |
