-- Phase 5 verification.
-- Expected: every view below has security_invoker=true.

SELECT
  c.relname AS view_name,
  COALESCE(
    (SELECT option_value
     FROM pg_options_to_table(c.reloptions)
     WHERE option_name = 'security_invoker'),
    'false') AS security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN (
    'v_ticker_polarity_lookup','v_win_probability_model_lineage',
    'v_ticker_primary_polarity','v_dot_bullshit_alerts',
    'v_ticker_universe_search','v_ticker_polarity_signal',
    'v_trade_decision_engine','v_pipeline_health_alarms_open',
    'v_dot_chain_tips','v_ticker_polarity_current'
  )
ORDER BY c.relname;

-- Expected: 10 rows, security_invoker='true' for all.

-- Anon-side check: a view that reads narrative_dots should now return [].
--   ANON='<your-anon-key>'
--   curl -s -H "apikey: $ANON" \
--        "https://kugfvlagaetiqtdwdfmk.supabase.co/rest/v1/v_dot_bullshit_alerts?limit=1"
-- Expected: empty array [].

-- Live-app sanity: any dashboard panel that reads from these views must
-- still return data when accessed as a logged-in user. The Signal Lab
-- bullshit-alerts panel and the trade-decision-engine widget are the
-- ones to spot-check.
