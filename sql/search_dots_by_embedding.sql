-- search_dots_by_embedding
--
-- Backs POST /api/dots-predict (the narrative-validation search at /search).
--
-- Given a 384-dim query vector (from sentence-transformers/all-MiniLM-L6-v2,
-- the same model used to embed the corpus), returns the top-k nearest
-- chain-tip dots by cosine similarity, with optional sector / cycle-phase /
-- recency filters.
--
-- Read-only; SECURITY DEFINER not used (RLS applies to caller's role).
--
-- Apply with:
--   psql "$DATABASE_URL" -f sql/search_dots_by_embedding.sql
-- or via the Supabase SQL editor.
--
-- Required: pgvector extension enabled, narrative_dots.embedding column
-- exists (vector(384)), is_chain_tip column exists (boolean).

CREATE OR REPLACE FUNCTION public.search_dots_by_embedding(
  query_vector vector(384),
  k int DEFAULT 200,
  filter_sector text DEFAULT NULL,
  filter_cycle_phase text DEFAULT NULL,
  filter_max_age_days int DEFAULT 540
)
RETURNS TABLE (
  dot_hash text,
  ticker text,
  narrative_text text,
  observed_at timestamptz,
  speaker_id text,
  speaker_authority numeric,
  sector text,
  cycle_phase text,
  market_regime text,
  return_5d numeric,
  return_10d numeric,
  return_20d numeric,
  return_5d_narrative numeric,
  bullshit_probability numeric,
  ground_truth_label boolean,
  similarity numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    d.dot_hash,
    d.ticker,
    d.narrative_text,
    d.observed_at,
    d.speaker_id,
    d.speaker_authority,
    d.sector,
    d.cycle_phase,
    d.market_regime,
    d.return_5d,
    d.return_10d,
    d.return_20d,
    d.return_5d_narrative,
    d.bullshit_probability,
    d.ground_truth_label,
    1 - (d.embedding <=> query_vector) AS similarity
  FROM public.narrative_dots d
  WHERE d.is_chain_tip = TRUE
    AND d.embedding IS NOT NULL
    AND (filter_sector IS NULL OR d.sector = filter_sector)
    AND (filter_cycle_phase IS NULL OR d.cycle_phase = filter_cycle_phase)
    AND d.observed_at >= NOW() - (filter_max_age_days || ' days')::interval
  ORDER BY d.embedding <=> query_vector
  LIMIT k;
$$;

-- Allow the API role(s) to call the RPC. Service role inherits this; the
-- anon grant is included so the function can be called even when a project
-- only exposes the anon key — it still goes through RLS on narrative_dots.
GRANT EXECUTE ON FUNCTION public.search_dots_by_embedding(
  vector(384), int, text, text, int
) TO anon, authenticated, service_role;

-- Recommended (not part of this file): an IVFFLAT or HNSW index on
-- narrative_dots.embedding for sub-second cosine searches at corpus scale.
-- Example, run once after data is loaded:
--   CREATE INDEX IF NOT EXISTS narrative_dots_embedding_ivfflat
--     ON public.narrative_dots
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);
