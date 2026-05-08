-- Phase 4 — Crown jewels. Lock the 10 forensic-engine tables that are wide
-- open today. After this migration, anon-key callers can't dump these tables.
-- Authenticated dashboard reads keep working because the dashboard is
-- auth-gated server-side (api/_require-auth.js), so users always have a
-- valid JWT when their browser hits Supabase REST.
--
-- WARNING: This is the highest-risk phase. Apply during a low-traffic
-- window (weekend evening, US markets closed). Have phase_04_rollback.sql
-- open in another tab. Watch the dashboard network tab for 401/403.
--
-- Reversible: yes — phase_04_rollback.sql restores the prior wide-open
-- policies verbatim.

BEGIN;

-- ── narrative_scorecard (3.5M rows; 33 client refs in gated dashboards) ──
DROP POLICY IF EXISTS "Allow public read" ON public.narrative_scorecard;
CREATE POLICY "Authenticated read narrative_scorecard"
  ON public.narrative_scorecard
  FOR SELECT TO authenticated USING (true);

-- ── narrative_analyses (read by gated _template, _ticker, _signal_lab) ──
DROP POLICY IF EXISTS "Public read" ON public.narrative_analyses;
CREATE POLICY "Authenticated read narrative_analyses"
  ON public.narrative_analyses
  FOR SELECT TO authenticated USING (true);

-- ── ticker_snapshots (used by gated dashboards; old _home.html reference is dead) ──
DROP POLICY IF EXISTS "Allow public read" ON public.ticker_snapshots;
CREATE POLICY "Authenticated read ticker_snapshots"
  ON public.ticker_snapshots
  FOR SELECT TO authenticated USING (true);

-- ── figure_calls (no client-side refs found; backend service-role only) ──
DROP POLICY IF EXISTS "Public read figure_calls" ON public.figure_calls;
DROP POLICY IF EXISTS "Service write figure_calls" ON public.figure_calls;
-- Intentionally no replacement policy: service_role bypasses RLS by default,
-- so backend writers/readers keep working. No anon, no authenticated read.

-- ── narrative_dots (3.5M rows; not directly read from client, used via views) ──
DROP POLICY IF EXISTS "Service role full access on narrative_dots" ON public.narrative_dots;
-- No replacement: service_role only. The 10 SECURITY DEFINER views that
-- read narrative_dots will be converted to security_invoker in Phase 5,
-- making them require an authenticated session as well.

-- ── analyst_ticker_scores (no direct client-side refs) ──
DROP POLICY IF EXISTS "Service role full access on analyst_ticker_scores" ON public.analyst_ticker_scores;

-- ── prediction_scores (no direct client-side refs) ──
DROP POLICY IF EXISTS "Service role full access on prediction_scores" ON public.prediction_scores;

-- ── search_query_log (server-side only) ──
DROP POLICY IF EXISTS "Service role full access on search_query_log" ON public.search_query_log;

-- ── source_registry (server-side only) ──
DROP POLICY IF EXISTS "Service role full access on source_registry" ON public.source_registry;

-- ── macro_narrative_events ─────────────────────────────────────────────
-- 2 client refs found; if dashboard breaks here, switch this to
-- "Authenticated read macro_narrative_events" instead of dropping the policy.
DROP POLICY IF EXISTS "Service role full access on macro_narrative_events"
  ON public.macro_narrative_events;
CREATE POLICY "Authenticated read macro_narrative_events"
  ON public.macro_narrative_events
  FOR SELECT TO authenticated USING (true);

COMMIT;
