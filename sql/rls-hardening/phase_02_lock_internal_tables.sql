-- Phase 2 — Lock 4 internal/backend-only tables.
-- These are not referenced by any client-side HTML (verified via grep).
-- Service-role backend code reading them keeps working because service_role
-- bypasses RLS by default.
--
-- Risk: very low. If you see any 401/403 in dashboard network tab after
--   applying this, run phase_02_rollback.sql.

BEGIN;

-- pipeline_health_alarms: backend monitoring only
ALTER TABLE public.pipeline_health_alarms ENABLE ROW LEVEL SECURITY;

-- article_outcomes_priors: backend ML pipeline
ALTER TABLE public.article_outcomes_priors ENABLE ROW LEVEL SECURITY;

-- polarity_backtest_results: backend ML pipeline
ALTER TABLE public.polarity_backtest_results ENABLE ROW LEVEL SECURITY;

-- coordination_pulse: 1 client reference exists but lives in dead code
-- (the homepage v2 dropped the legacy minit ticker that queried it).
-- Re-verify before applying — see phase_02_verify.sql for the check.
ALTER TABLE public.coordination_pulse ENABLE ROW LEVEL SECURITY;

COMMIT;
