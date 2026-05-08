-- Phase 5 — Convert 10 SECURITY DEFINER views to security_invoker.
--
-- WHY THIS PHASE EXISTS:
-- Views in PostgreSQL run with the privileges of their CREATOR by default
-- (SECURITY DEFINER behavior). That means even after Phase 4 locks
-- narrative_dots etc., a view that reads those tables still bypasses RLS
-- and serves data to anon callers.
--
-- security_invoker = true makes the view run with the CALLER's privileges,
-- so the view inherits whatever RLS the caller would face when querying
-- the underlying tables directly. After this migration, anon callers see
-- empty results from these views; authenticated callers (logged-in users)
-- get real data.
--
-- Risk: medium. If a view is referenced from a public marketing page with
--   the anon key, that page will start returning empty lists. We've grepped
--   for these views — only `v_ticker_universe_search` had a client-side ref
--   and it lives in dead code (the legacy minit ticker that was removed
--   when _home_v2.html went live).
--
-- Reversible: yes — phase_05_rollback.sql flips security_invoker back off.

BEGIN;

ALTER VIEW public.v_ticker_polarity_lookup        SET (security_invoker = true);
ALTER VIEW public.v_win_probability_model_lineage SET (security_invoker = true);
ALTER VIEW public.v_ticker_primary_polarity       SET (security_invoker = true);
ALTER VIEW public.v_dot_bullshit_alerts           SET (security_invoker = true);
ALTER VIEW public.v_ticker_universe_search        SET (security_invoker = true);
ALTER VIEW public.v_ticker_polarity_signal        SET (security_invoker = true);
ALTER VIEW public.v_trade_decision_engine         SET (security_invoker = true);
ALTER VIEW public.v_pipeline_health_alarms_open   SET (security_invoker = true);
ALTER VIEW public.v_dot_chain_tips                SET (security_invoker = true);
ALTER VIEW public.v_ticker_polarity_current       SET (security_invoker = true);

COMMIT;
