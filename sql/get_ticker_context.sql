-- get_ticker_context
--
-- Backs the three "context cards" rendered above the bullshit-probability
-- hero on /search:
--   1. Last earnings (beat/miss + guidance)
--   2. P/E vs GICS sector (with smart fallback to dashboard_sector / canonical_sector)
--   3. Market Prism fair value (when |days_to_earnings| <= 5, also acts as the
--      "projected price" anchor in the proximity warning)
--
-- All three are surfaced as separate keys in one JSONB blob so the API can
-- get everything in a single round-trip and the frontend conditionally
-- renders cards based on null vs non-null values.
--
-- Read-only; safe to drop and recreate.

CREATE OR REPLACE FUNCTION public.get_ticker_context(ticker_in text)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  WITH
  t AS (SELECT UPPER(ticker_in) AS sym),
  classification AS (
    SELECT * FROM public.v_ticker_canonical_sector
    WHERE ticker = (SELECT sym FROM t)
    LIMIT 1
  ),
  snap AS (
    SELECT * FROM public.ticker_snapshots
    WHERE ticker = (SELECT sym FROM t)
    ORDER BY snapshot_date DESC LIMIT 1
  ),
  earn AS (
    SELECT * FROM public.earnings_context
    WHERE ticker = (SELECT sym FROM t)
    ORDER BY snapshot_date DESC LIMIT 1
  ),
  scorecard AS (
    SELECT fair_value, fvd_pct, current_price
    FROM public.narrative_scorecard
    WHERE ticker = (SELECT sym FROM t) AND fair_value IS NOT NULL
    ORDER BY snapshot_date DESC LIMIT 1
  ),
  -- Map our canonical/GICS sector names to the names actually used in
  -- sector_pe_benchmarks (which uses its own naming: Technology not
  -- Information Technology, Healthcare not Health Care, REITs not Real
  -- Estate, etc).
  gics_to_bench AS (
    SELECT * FROM (VALUES
      ('Information Technology', 'Technology'),
      ('Communication Services', 'Communications'),
      ('Health Care',            'Healthcare'),
      ('Real Estate',            'REITs'),
      ('Consumer Discretionary', 'Consumer Discretionary'),
      ('Consumer Staples',       'Consumer Staples'),
      ('Energy',                 'Energy'),
      ('Financials',             'Financials'),
      ('Industrials',            'Industrials'),
      ('Materials',              'Materials'),
      ('Utilities',              'Utilities')
    ) AS m(gics, bench)
  ),
  -- Best-match benchmark: try dashboard_sector first (e.g. NVDA or AMD ->
  -- Semiconductors), then canonical_sector, then GICS-mapped. First
  -- non-null wins.
  bench_resolved AS (
    SELECT
      COALESCE(
        (SELECT b.sector FROM public.sector_pe_benchmarks b
          WHERE b.sector = (SELECT dashboard_sector FROM classification)
            AND b.keyword IS NULL AND b.sic_industry IS NULL
          ORDER BY sample_end DESC LIMIT 1),
        (SELECT b.sector FROM public.sector_pe_benchmarks b
          WHERE b.sector = (SELECT canonical_sector FROM classification)
            AND b.keyword IS NULL AND b.sic_industry IS NULL
          ORDER BY sample_end DESC LIMIT 1),
        (SELECT b.sector FROM public.sector_pe_benchmarks b
          WHERE b.sector = (SELECT bench FROM gics_to_bench
                            WHERE gics = (SELECT gics_sector FROM classification))
            AND b.keyword IS NULL AND b.sic_industry IS NULL
          ORDER BY sample_end DESC LIMIT 1)
      ) AS bench_sector
  ),
  pe_bench AS (
    SELECT median_pe, p25_pe, p75_pe, growth_tier, sample_end, sector
    FROM public.sector_pe_benchmarks
    WHERE sector = (SELECT bench_sector FROM bench_resolved)
      AND keyword IS NULL AND sic_industry IS NULL
    ORDER BY sample_end DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'ticker', (SELECT sym FROM t),
    'classification', jsonb_build_object(
      'gics_sector',      (SELECT gics_sector FROM classification),
      'dashboard_sector', (SELECT dashboard_sector FROM classification),
      'sic_sector',       (SELECT sic_sector FROM classification)
    ),
    'earnings', jsonb_build_object(
      'last_date',            (SELECT last_earnings_date FROM earn),
      'next_date',            (SELECT next_earnings_date FROM earn),
      'days_to_earnings',     (SELECT days_to_earnings FROM earn),
      'position',             (SELECT earnings_position FROM earn),
      'eps_surprise_pct',     (SELECT eps_surprise_pct FROM earn),
      'revenue_surprise_pct', (SELECT revenue_surprise_pct FROM earn),
      'guidance_direction',   (SELECT guidance_direction FROM earn)
    ),
    'valuation', jsonb_build_object(
      'pe',                   (SELECT pe_implied FROM snap),
      'pe_own_5y_median',     (SELECT pe_median_5y FROM snap),
      'eps_ttm',              (SELECT eps_ttm FROM snap),
      'sector_label',         (SELECT sector FROM pe_bench),
      'sector_median_pe',     (SELECT median_pe FROM pe_bench),
      'sector_p25_pe',        (SELECT p25_pe FROM pe_bench),
      'sector_p75_pe',        (SELECT p75_pe FROM pe_bench),
      'sector_growth_tier',   (SELECT growth_tier FROM pe_bench),
      'sector_pe_sample_end', (SELECT sample_end FROM pe_bench)
    ),
    'fair_value', jsonb_build_object(
      'fv',            (SELECT fair_value FROM scorecard),
      'current_price', (SELECT current_price FROM scorecard),
      'fvd_pct',       (SELECT fvd_pct FROM scorecard)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_ticker_context(text) TO anon, authenticated, service_role;
