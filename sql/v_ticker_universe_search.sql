-- v_ticker_universe_search
--
-- Backs the global ticker search bar at /search.
--
-- Joins ticker_industry_lookup (the searchable universe with ticker, name,
-- sector, industry) with the most-recent narrative_scorecard row per ticker
-- (nrs, verdict, snapshot_date) so the client can do one read instead of
-- two and avoid the latest-date probe.
--
-- Read-only; no triggers; safe to drop and recreate.
--
-- Apply with:
--   psql "$DATABASE_URL" -f sql/v_ticker_universe_search.sql
-- or via the Supabase SQL editor.

CREATE OR REPLACE VIEW public.v_ticker_universe_search AS
SELECT
  til.ticker,
  til.name,
  til.sector,
  til.industry,
  ns.nrs,
  ns.verdict,
  ns.snapshot_date AS scored_at
FROM public.ticker_industry_lookup AS til
LEFT JOIN LATERAL (
  SELECT nrs, verdict, snapshot_date
  FROM public.narrative_scorecard
  WHERE ticker = til.ticker
  ORDER BY snapshot_date DESC
  LIMIT 1
) AS ns ON TRUE
WHERE til.ticker IS NOT NULL;

-- Expose to the anon role used by PostgREST so the read-only browser client
-- can SELECT from it via /rest/v1/v_ticker_universe_search.
GRANT SELECT ON public.v_ticker_universe_search TO anon, authenticated;
