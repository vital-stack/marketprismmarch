-- Phase 2 verification.
-- Expected: rls_enabled=true, policy_count=0 for all 4 tables.

SELECT
  c.relname                     AS table_name,
  c.relrowsecurity              AS rls_enabled,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'pipeline_health_alarms',
    'article_outcomes_priors',
    'polarity_backtest_results',
    'coordination_pulse'
  )
ORDER BY c.relname;

-- After running migration: 4 rows, rls_enabled=true, policy_count=0.

-- Live-app sanity: open https://marketprism.co/dashboard as a logged-in
-- user and click through Daily Plays, a ticker page, Signal Lab, Trading
-- Cards, Leaderboard. No 401/403 should appear in the network tab.
