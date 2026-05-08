-- Phase 1 verification.
-- Expected: every table below shows rls_enabled=true, policies=0.
-- That means RLS is on AND no role can read; only service_role bypasses RLS.

SELECT
  c.relname                     AS table_name,
  c.relrowsecurity              AS rls_enabled,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'ticker_snapshots_backup_20260505',
    'tracked_daily_plays_backup_20260505',
    'reuters_purge_backup_2026_05_01_articles',
    'reuters_purge_backup_2026_05_01_narrative_dots',
    'reuters_purge_backup_2026_05_01_narrative_analyses',
    'reuters_purge_backup_2026_05_01_figure_calls',
    'reuters_purge_backup_2026_05_01_figure_call_history',
    'reuters_purge_backup_2026_05_01_article_outcomes',
    'reuters_purge_backup_2026_05_01_article_signal_price_index',
    'reuters_purge_backup_2026_05_01_analyst_ticker_scores',
    'marketbeat_purge_backup_2026_05_01_articles',
    'marketbeat_purge_backup_2026_05_01_narrative_dots',
    'marketbeat_purge_backup_2026_05_01_narrative_analyses',
    'marketbeat_purge_backup_2026_05_01_figure_calls',
    'marketbeat_purge_backup_2026_05_01_article_outcomes',
    'marketbeat_purge_backup_2026_05_01_article_signal_price_index',
    'marketbeat_purge_backup_2026_05_01_analyst_ticker_scores'
  )
ORDER BY c.relname;

-- Expected output: 17 rows, rls_enabled=true, policy_count=0 for all.
