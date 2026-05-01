-- v_ticker_universe_search
--
-- Backs the global ticker search bar at /search and the per-ticker page
-- search at the top of /_ticker.
--
-- Universe spine = ticker_forecast UNION ticker_industry_lookup so tickers
-- with a live pre-computed forecast (BABA, NIO, NVO, ARM, T, IONQ, etc.)
-- appear in search even when they have not yet been backfilled into the
-- lookup table. Joins ticker_industry_lookup left for ticker/name/sector/
-- industry, and narrative_scorecard left-lateral for the most-recent
-- nrs/verdict/snapshot_date so the client can do one read.
--
-- Read-only; no triggers; safe to drop and recreate.
--
-- Apply with:
--   psql "$DATABASE_URL" -f sql/v_ticker_universe_search.sql
-- or via the Supabase SQL editor.

CREATE OR REPLACE VIEW public.v_ticker_universe_search AS
WITH universe AS (
  SELECT ticker FROM public.ticker_forecast WHERE ticker IS NOT NULL
  UNION
  SELECT ticker FROM public.ticker_industry_lookup WHERE ticker IS NOT NULL
)
SELECT
  u.ticker,
  til.name,
  til.sector,
  til.industry,
  ns.nrs,
  ns.verdict,
  ns.snapshot_date AS scored_at
FROM universe u
LEFT JOIN public.ticker_industry_lookup til ON til.ticker = u.ticker
LEFT JOIN LATERAL (
  SELECT nrs, verdict, snapshot_date
  FROM public.narrative_scorecard
  WHERE ticker = u.ticker
  ORDER BY snapshot_date DESC
  LIMIT 1
) AS ns ON TRUE;

-- Expose to the anon role used by PostgREST so the read-only browser client
-- can SELECT from it via /rest/v1/v_ticker_universe_search.
GRANT SELECT ON public.v_ticker_universe_search TO anon, authenticated;
