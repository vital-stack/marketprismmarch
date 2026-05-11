-- Per-user ticker watchlists. Apply once in Supabase SQL editor.
--
-- Access model:
--   - Reads/writes gated by RLS: auth.uid() = user_id.
--   - API layer (api/watchlist.js) additionally enforces an active subscription
--     before allowing writes; reads stay open to any logged-in user so a lapsed
--     subscription HIDES the watchlist on the dashboard rather than DROPPING the
--     saved rows. The rows survive in the DB and reappear on resubscribe.
--   - Service role bypasses RLS by default for backups / admin tooling.
--
-- Reversible: DROP TABLE public.user_watchlists CASCADE;

CREATE TABLE IF NOT EXISTS public.user_watchlists (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker     text        NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  note       text,
  PRIMARY KEY (user_id, ticker),
  CONSTRAINT user_watchlists_ticker_shape CHECK (ticker ~ '^[A-Z0-9.\-]{1,10}$')
);

CREATE INDEX IF NOT EXISTS user_watchlists_user_added_idx
  ON public.user_watchlists (user_id, added_at DESC);

ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own watchlist" ON public.user_watchlists;
CREATE POLICY "Users select own watchlist"
  ON public.user_watchlists
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own watchlist" ON public.user_watchlists;
CREATE POLICY "Users insert own watchlist"
  ON public.user_watchlists
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own watchlist" ON public.user_watchlists;
CREATE POLICY "Users update own watchlist"
  ON public.user_watchlists
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own watchlist" ON public.user_watchlists;
CREATE POLICY "Users delete own watchlist"
  ON public.user_watchlists
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
