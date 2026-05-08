-- Phase 4 verification. THE BIG ONE.
-- After applying phase_04_lock_crown_jewels.sql:
--
-- (A) Database-side check: every crown-jewel table either has zero policies
--     (= service_role only) or exactly one "Authenticated read" policy
--     scoped to the `authenticated` role.

SELECT
  c.relname                                                        AS table_name,
  c.relrowsecurity                                                 AS rls_enabled,
  COALESCE(json_agg(json_build_object(
    'name', p.polname,
    'cmd',  p.polcmd,
    'roles', p.polroles::regrole[]::text,
    'qual', pg_get_expr(p.polqual, p.polrelid)
  )) FILTER (WHERE p.polname IS NOT NULL), '[]'::json) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'narrative_scorecard','narrative_analyses','ticker_snapshots',
    'figure_calls','narrative_dots','analyst_ticker_scores',
    'prediction_scores','search_query_log','source_registry',
    'macro_narrative_events'
  )
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- Expected:
--   narrative_scorecard      → 1 policy "Authenticated read narrative_scorecard"
--   narrative_analyses       → 1 policy "Authenticated read narrative_analyses"
--   ticker_snapshots         → 1 policy "Authenticated read ticker_snapshots"
--   macro_narrative_events   → 1 policy "Authenticated read macro_narrative_events"
--   figure_calls             → 0 policies (service_role only)
--   narrative_dots           → 0 policies (service_role only)
--   analyst_ticker_scores    → 0 policies (service_role only)
--   prediction_scores        → 0 policies (service_role only)
--   search_query_log         → 0 policies (service_role only)
--   source_registry          → 0 policies (service_role only)


-- (B) Anon-side check (the reason we did all this).
-- Run from a terminal with the anon key:
--
--   ANON='<your-anon-key>'
--   curl -s -H "apikey: $ANON" \
--        "https://kugfvlagaetiqtdwdfmk.supabase.co/rest/v1/narrative_scorecard?select=ticker&limit=1"
--
-- Expected: empty array []. Pre-migration this returned a row.
--
-- Repeat for: ticker_snapshots, narrative_analyses, narrative_dots,
-- figure_calls, analyst_ticker_scores, prediction_scores. All should
-- return [].


-- (C) Live-app verification. As a logged-in user, click through:
--   /dashboard
--   /ticker/NVDA  (or any ticker)
--   /signal-lab
--   /leaderboard
--   /daily
--   /heatmap
--   Trading Cards tab
-- Watch the Network tab. ANY 401/403 on requests to /rest/v1/<tablename>
-- means a policy is too tight — run phase_04_rollback.sql immediately
-- and report which table/endpoint failed so we can adjust before retrying.
