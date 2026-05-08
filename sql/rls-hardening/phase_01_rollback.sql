-- Phase 1 rollback. Disables RLS on the backup tables, restoring pre-migration
-- state (anon-readable). Apply only if Phase 1 caused an unforeseen regression.

BEGIN;

ALTER TABLE public.ticker_snapshots_backup_20260505                          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_daily_plays_backup_20260505                       DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.reuters_purge_backup_2026_05_01_articles                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_narrative_dots            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_narrative_analyses        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_figure_calls              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_figure_call_history       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_article_outcomes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_article_signal_price_index DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_analyst_ticker_scores     DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.marketbeat_purge_backup_2026_05_01_articles               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_narrative_dots         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_narrative_analyses     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_figure_calls           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_article_outcomes       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_article_signal_price_index DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_analyst_ticker_scores  DISABLE ROW LEVEL SECURITY;

COMMIT;
