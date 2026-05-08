-- Phase 3 — Tighten 9 reference / scoring tables to authenticated-only read.
-- These ARE read by the gated dashboard with the anon key today, but should
-- require login. Currently they have wide-open policies (qual:true, roles:PUBLIC).
-- Replace with `TO authenticated` SELECT policies.
--
-- Risk: low. Anyone reading these from the dashboard already has a JWT
--   (the dashboard is auth-gated server-side via requireAuth()).
-- Reversible: yes — see phase_03_rollback.sql

BEGIN;

-- ticker_subcategory
ALTER TABLE public.ticker_subcategory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"        ON public.ticker_subcategory;
DROP POLICY IF EXISTS "Allow public read"  ON public.ticker_subcategory;
DROP POLICY IF EXISTS "anon_read"          ON public.ticker_subcategory;
DROP POLICY IF EXISTS "authenticated_read" ON public.ticker_subcategory;
CREATE POLICY "Authenticated read ticker_subcategory"
  ON public.ticker_subcategory FOR SELECT TO authenticated USING (true);

-- subcategory_polarity
ALTER TABLE public.subcategory_polarity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"        ON public.subcategory_polarity;
DROP POLICY IF EXISTS "Allow public read"  ON public.subcategory_polarity;
DROP POLICY IF EXISTS "anon_read"          ON public.subcategory_polarity;
DROP POLICY IF EXISTS "authenticated_read" ON public.subcategory_polarity;
CREATE POLICY "Authenticated read subcategory_polarity"
  ON public.subcategory_polarity FOR SELECT TO authenticated USING (true);

-- ticker_polarity_override
ALTER TABLE public.ticker_polarity_override ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"        ON public.ticker_polarity_override;
DROP POLICY IF EXISTS "Allow public read"  ON public.ticker_polarity_override;
DROP POLICY IF EXISTS "anon_read"          ON public.ticker_polarity_override;
DROP POLICY IF EXISTS "authenticated_read" ON public.ticker_polarity_override;
CREATE POLICY "Authenticated read ticker_polarity_override"
  ON public.ticker_polarity_override FOR SELECT TO authenticated USING (true);

-- ticker_subcategory_polarity
ALTER TABLE public.ticker_subcategory_polarity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"        ON public.ticker_subcategory_polarity;
DROP POLICY IF EXISTS "Allow public read"  ON public.ticker_subcategory_polarity;
DROP POLICY IF EXISTS "anon_read"          ON public.ticker_subcategory_polarity;
DROP POLICY IF EXISTS "authenticated_read" ON public.ticker_subcategory_polarity;
CREATE POLICY "Authenticated read ticker_subcategory_polarity"
  ON public.ticker_subcategory_polarity FOR SELECT TO authenticated USING (true);

-- subcategory_polarity_reference
ALTER TABLE public.subcategory_polarity_reference ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"        ON public.subcategory_polarity_reference;
DROP POLICY IF EXISTS "Allow public read"  ON public.subcategory_polarity_reference;
DROP POLICY IF EXISTS "anon_read"          ON public.subcategory_polarity_reference;
DROP POLICY IF EXISTS "authenticated_read" ON public.subcategory_polarity_reference;
CREATE POLICY "Authenticated read subcategory_polarity_reference"
  ON public.subcategory_polarity_reference FOR SELECT TO authenticated USING (true);

-- ticker_polarity_map
ALTER TABLE public.ticker_polarity_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"        ON public.ticker_polarity_map;
DROP POLICY IF EXISTS "Allow public read"  ON public.ticker_polarity_map;
DROP POLICY IF EXISTS "anon_read"          ON public.ticker_polarity_map;
DROP POLICY IF EXISTS "authenticated_read" ON public.ticker_polarity_map;
CREATE POLICY "Authenticated read ticker_polarity_map"
  ON public.ticker_polarity_map FOR SELECT TO authenticated USING (true);

-- subcategory_polarity_summary
ALTER TABLE public.subcategory_polarity_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"        ON public.subcategory_polarity_summary;
DROP POLICY IF EXISTS "Allow public read"  ON public.subcategory_polarity_summary;
DROP POLICY IF EXISTS "anon_read"          ON public.subcategory_polarity_summary;
DROP POLICY IF EXISTS "authenticated_read" ON public.subcategory_polarity_summary;
CREATE POLICY "Authenticated read subcategory_polarity_summary"
  ON public.subcategory_polarity_summary FOR SELECT TO authenticated USING (true);

-- source_tiers
ALTER TABLE public.source_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"        ON public.source_tiers;
DROP POLICY IF EXISTS "Allow public read"  ON public.source_tiers;
DROP POLICY IF EXISTS "anon_read"          ON public.source_tiers;
DROP POLICY IF EXISTS "authenticated_read" ON public.source_tiers;
CREATE POLICY "Authenticated read source_tiers"
  ON public.source_tiers FOR SELECT TO authenticated USING (true);

-- ai_daily_picks
ALTER TABLE public.ai_daily_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read"        ON public.ai_daily_picks;
DROP POLICY IF EXISTS "Allow public read"  ON public.ai_daily_picks;
DROP POLICY IF EXISTS "anon_read"          ON public.ai_daily_picks;
DROP POLICY IF EXISTS "authenticated_read" ON public.ai_daily_picks;
CREATE POLICY "Authenticated read ai_daily_picks"
  ON public.ai_daily_picks FOR SELECT TO authenticated USING (true);

COMMIT;
