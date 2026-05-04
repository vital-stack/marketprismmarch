# Ticker meme card endpoint

On-demand share-card generator for ticker pages. Two variants (bull / bear), one PNG per call, no caching.

## Routes

| Method | Path | Returns |
|---|---|---|
| GET  | `/api/tickers/:ticker/meme-card?variant=bull|bear`               | `image/png` (1080x1350) with `Content-Disposition: attachment; filename="{TICKER}_{variant}_{YYYYMMDD}.png"` |
| GET  | `/api/tickers/:ticker/meme-card?variant=bull|bear&format=json`   | `application/json` — the composed payload (`headline`, `supporting`, `closer`, `price`, `ticker`, `variant`). Used by the share modal so captions stay in sync with the rendered card. |
| POST | `/api/ticker-meme-card?ticker=NVDA`  body `{ "variant": "bull" }` | Same as the GET PNG response. |

`Cache-Control: no-store` on every response — every click hits the function fresh.

## Implementation

- `api/ticker-meme-card.js` — Edge runtime (`@vercel/og` requires it). Mirrors the `api/og-image.js` pattern: object-tree describing the layout, no JSX transform.
- Rewrite in `vercel.json`: `/api/tickers/:ticker/meme-card` → `/api/ticker-meme-card?ticker=:ticker`
- Frontend: `_ticker.html` exposes `window.MPMemeCard.{generate, openShare, closeShare, copyField}`. Two buttons in the action-bar trigger generate; "Share" links open the captions modal.

## Data sources

Adapted to the schema actually present in this repo (the spec referenced `earnings_releases`, `ticker_prices`, `trade_signals_master` which don't exist here):

| Spec | Actual source used |
|---|---|
| `narrative_scorecard` | `narrative_scorecard` (lookahead-bias filter applied client-side: `created_at <= snapshot_date + 2 days`) |
| `ticker_prices.close` | `narrative_scorecard.current_price` |
| `earnings_releases` | `earnings_context` (filter `last_earnings_date >= today - 90d`) |
| `trade_signals_master` + `signal_daily_outcomes` | substituted with `verdict` + `walsh_regime` + `narrative_energy_regime` from `narrative_scorecard` |
| Mean-reversion 30d probability | not in this repo's schema — skipped |

Per-narrative regime/propagation is pulled from `v_narrative_scorecard_deduped` for one supporting data point on the bull variant.

## Variant content rules

Both variants share the same layout. Content selection picks the strongest data points available and skips anything missing — never invents stats.

**BULL** — headline picks the largest absolute value among:
1. FVD discount (`fvd_pct < 0`)
2. EPS beat last quarter
3. Revenue beat last quarter

Supporting (max 5, in priority order): Walsh regime if bullish, narrative energy regime if bullish, energy remaining > 50, engine fair value, narrative mass score (vms), verdict, last EPS surprise (if not the headline), top narrative propagation.

**BEAR** — headline picks the largest absolute value among:
1. FVD premium (`fvd_pct > 0`)
2. EPS miss last quarter
3. Revenue miss last quarter

Supporting (max 5, in priority order): Walsh regime if bearish, narrative energy regime if bearish, energy remaining < 30, coordination score >= 0.6, suspicion score >= 0.6, decay rate, engine fair value, verdict, last EPS surprise (if not the headline).

If no headline candidate is available (e.g. an undervalued ticker requested as a bear card), the endpoint returns `404` with `{ "error": "No narrative data available for this ticker yet." }`.

## Constraints applied

- No em dashes anywhere in card text or share captions.
- Lookahead-bias filter on `narrative_scorecard` enforced client-side after fetch.
- Generic error messages on 500 — no DB internals leak to the response.
- No rate limit (consistent with the rest of `/api/`). Add Upstash + middleware if abuse appears.

## Visual QA

Open `tests/meme_card_qa.html` in the browser preview. It renders both variants for RDDT, AAPL, NVDA, TSLA in a grid against the current origin. Adjust the "Base URL" or "Tickers" inputs and click Reload. The "view JSON" link on each card opens the composed payload, useful for diffing what data drove the render.

## Adding a third variant later

The variant logic lives in two functions: `composeBull` / `composeBear`. To add a new variant (e.g. `regime-shift`):
1. Add a `composeRegimeShift(sc, narratives, earn)` function returning `{ headline, supporting }`.
2. Add the new key to the `ACCENT` map at the top of the file.
3. Add an entry to the variant validation in `handler` and the dispatch in `composeCard`.
4. Add closer lines for the variant.
