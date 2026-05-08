-- Phase 4 rollback. Restores the prior wide-open policies verbatim, undoing
-- the lockdown of the crown-jewel tables. Apply ONLY if Phase 4 caused a
-- dashboard regression. After rollback the tables are anon-readable again
-- (the security gap returns) — your priority is dashboard uptime over the
-- security improvement at that point.

BEGIN;

-- narrative_scorecard
DROP POLICY IF EXISTS "Authenticated read narrative_scorecard" ON public.narrative_scorecard;
CREATE POLICY "Allow public read"
  ON public.narrative_scorecard FOR SELECT TO PUBLIC USING (true);

-- narrative_analyses
DROP POLICY IF EXISTS "Authenticated read narrative_analyses" ON public.narrative_analyses;
CREATE POLICY "Public read"
  ON public.narrative_analyses FOR SELECT TO PUBLIC USING (true);

-- ticker_snapshots
DROP POLICY IF EXISTS "Authenticated read ticker_snapshots" ON public.ticker_snapshots;
CREATE POLICY "Allow public read"
  ON public.ticker_snapshots FOR SELECT TO PUBLIC USING (true);

-- figure_calls
CREATE POLICY "Public read figure_calls"
  ON public.figure_calls FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Service write figure_calls"
  ON public.figure_calls FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

-- narrative_dots
CREATE POLICY "Service role full access on narrative_dots"
  ON public.narrative_dots FOR ALL TO PUBLIC USING (true);

-- analyst_ticker_scores
CREATE POLICY "Service role full access on analyst_ticker_scores"
  ON public.analyst_ticker_scores FOR ALL TO PUBLIC USING (true);

-- prediction_scores
CREATE POLICY "Service role full access on prediction_scores"
  ON public.prediction_scores FOR ALL TO PUBLIC USING (true);

-- search_query_log
CREATE POLICY "Service role full access on search_query_log"
  ON public.search_query_log FOR ALL TO PUBLIC USING (true);

-- source_registry
CREATE POLICY "Service role full access on source_registry"
  ON public.source_registry FOR ALL TO PUBLIC USING (true);

-- macro_narrative_events
DROP POLICY IF EXISTS "Authenticated read macro_narrative_events" ON public.macro_narrative_events;
CREATE POLICY "Service role full access on macro_narrative_events"
  ON public.macro_narrative_events FOR ALL TO PUBLIC USING (true);

COMMIT;
