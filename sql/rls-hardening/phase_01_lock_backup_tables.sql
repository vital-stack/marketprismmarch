-- Phase 1 — Lock 17 old purge / dated backup tables.
-- These are explicitly named *_backup_* and not referenced by any live
-- code path. After this migration, only the service_role can read them.
-- (RLS enabled with no SELECT policy = no role except service_role can read.)
--
-- Risk: zero. Live app does not query these tables.
-- Reversible: yes — see phase_01_rollback.sql

BEGIN;

ALTER TABLE public.ticker_snapshots_backup_20260505                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_daily_plays_backup_20260505                       ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reuters_purge_backup_2026_05_01_articles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_narrative_dots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_narrative_analyses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_figure_calls              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_figure_call_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_article_outcomes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_article_signal_price_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuters_purge_backup_2026_05_01_analyst_ticker_scores     ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.marketbeat_purge_backup_2026_05_01_articles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_narrative_dots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_narrative_analyses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_figure_calls           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_article_outcomes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_article_signal_price_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketbeat_purge_backup_2026_05_01_analyst_ticker_scores  ENABLE ROW LEVEL SECURITY;

COMMIT;
