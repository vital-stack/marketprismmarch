-- Phase 5 rollback. Flips security_invoker back to false on the 10 views,
-- restoring the SECURITY DEFINER behavior. Apply only if Phase 5 broke
-- a dashboard panel that reads from these views.

BEGIN;

ALTER VIEW public.v_ticker_polarity_lookup        SET (security_invoker = false);
ALTER VIEW public.v_win_probability_model_lineage SET (security_invoker = false);
ALTER VIEW public.v_ticker_primary_polarity       SET (security_invoker = false);
ALTER VIEW public.v_dot_bullshit_alerts           SET (security_invoker = false);
ALTER VIEW public.v_ticker_universe_search        SET (security_invoker = false);
ALTER VIEW public.v_ticker_polarity_signal        SET (security_invoker = false);
ALTER VIEW public.v_trade_decision_engine         SET (security_invoker = false);
ALTER VIEW public.v_pipeline_health_alarms_open   SET (security_invoker = false);
ALTER VIEW public.v_dot_chain_tips                SET (security_invoker = false);
ALTER VIEW public.v_ticker_polarity_current       SET (security_invoker = false);

COMMIT;
