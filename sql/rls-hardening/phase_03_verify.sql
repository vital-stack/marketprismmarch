-- Phase 3 verification.
-- Expected: every table has rls_enabled=true and exactly one policy named
-- "Authenticated read <table>" scoped to the `authenticated` role.

SELECT
  c.relname                                                        AS table_name,
  c.relrowsecurity                                                 AS rls_enabled,
  p.polname                                                        AS policy_name,
  p.polcmd                                                         AS cmd,
  p.polroles::regrole[]::text                                      AS roles,
  pg_get_expr(p.polqual, p.polrelid)                               AS qual
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'ticker_subcategory','subcategory_polarity','ticker_polarity_override',
    'ticker_subcategory_polarity','subcategory_polarity_reference',
    'ticker_polarity_map','subcategory_polarity_summary',
    'source_tiers','ai_daily_picks'
  )
ORDER BY c.relname, p.polname;

-- Expected: 9 rows, each with cmd='r' (SELECT), roles='{authenticated}',
-- qual='true', and a policy_name starting with "Authenticated read".

-- Live-app sanity: open https://marketprism.co/dashboard, ticker pages,
-- Daily Plays, Leaderboard. No 401/403 from the rows above's tables in
-- the Network tab.

-- Anon-side sanity (proves the lockdown works):
-- Run from a fresh anon REST call, e.g. curl with the anon key:
--   curl -H "apikey: $ANON" \
--        "https://kugfvlagaetiqtdwdfmk.supabase.co/rest/v1/ticker_subcategory?select=*&limit=1"
-- Expected: empty array [] (RLS blocks; result is not 401, just zero rows).
