-- Phase 3 rollback. Drops the new authenticated-only policies and re-creates
-- the prior wide-open anon+authenticated policies. Only run if Phase 3 caused
-- a dashboard regression you can reproduce.

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'ticker_subcategory','subcategory_polarity','ticker_polarity_override',
    'ticker_subcategory_polarity','subcategory_polarity_reference',
    'ticker_polarity_map','subcategory_polarity_summary',
    'source_tiers','ai_daily_picks'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   'Authenticated read ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      'Public read', t);
  END LOOP;
END $$;

COMMIT;
