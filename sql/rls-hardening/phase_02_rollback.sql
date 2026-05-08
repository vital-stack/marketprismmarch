-- Phase 2 rollback. Disables RLS on the 4 internal/backend tables, restoring
-- pre-migration state. Apply only if Phase 2 caused an unforeseen regression.

BEGIN;

ALTER TABLE public.pipeline_health_alarms     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_outcomes_priors    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.polarity_backtest_results  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordination_pulse         DISABLE ROW LEVEL SECURITY;

COMMIT;
