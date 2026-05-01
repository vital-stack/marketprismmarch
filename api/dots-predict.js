// POST /api/dots-predict
// Embeds the user's narrative, runs a pgvector similarity search against
// narrative_dots via the search_dots_by_embedding RPC, and returns an
// aggregated bullshit-probability + predicted-return forecast.
//
// Required env:
//   HUGGINGFACE_API_KEY            - HF inference token (free tier)
//   SUPABASE_URL                    - project URL
//   SUPABASE_SERVICE_ROLE_KEY       - service role (RPC reads narrative_dots)
//                                     falls back to SUPABASE_ANON if grant exists
//
// Required Supabase objects (apply once from sql/search_dots_by_embedding.sql):
//   - public.search_dots_by_embedding(...) returning narrative_dots rows
//   - read access for the role used by the env key

const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
// HF retired api-inference.huggingface.co. Canonical Inference-Providers
// pattern (matches what the official @huggingface/inference SDK calls):
//   {router}/{provider}/pipeline/{task}/{model}
const HF_URL =
  'https://router.huggingface.co/hf-inference/pipeline/feature-extraction/' + HF_MODEL;
const DEFAULT_K = 200;
const MAX_AGE_DAYS = 540;

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (_) { return Promise.resolve({}); }
  }
  return new Promise(function (resolve) {
    let data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () {
      try { resolve(JSON.parse(data || '{}')); } catch (_) { resolve({}); }
    });
    req.on('error', function () { resolve({}); });
  });
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function embedQuery(text, hfKey) {
  const r = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + hfKey,
      'Content-Type': 'application/json'
    },
    // Pipeline endpoint speaks HF-native shape: {inputs, options}.
    body: JSON.stringify({ inputs: text, options: { wait_for_model: true } })
  });
  if (!r.ok) {
    const body = await r.text().catch(function () { return ''; });
    throw new Error('HuggingFace embed failed (' + r.status + '): ' + body.slice(0, 300));
  }
  const j = await r.json();
  // Single string input on a sentence-transformers model returns a flat
  // 384-dim array. Batched input returns [[...], [...]]. Accept both.
  const vec = Array.isArray(j) && Array.isArray(j[0]) ? j[0] : j;
  if (!Array.isArray(vec) || vec.length !== 384) {
    throw new Error('Unexpected embedding shape (len=' + (Array.isArray(vec) ? vec.length : 'n/a') + ')');
  }
  return vec;
}

async function lookupSector(supabaseUrl, supabaseKey, ticker) {
  if (!ticker) return null;
  const url = supabaseUrl + '/rest/v1/ticker_industry_lookup?select=sector&ticker=eq.' + encodeURIComponent(ticker) + '&limit=1';
  const r = await fetch(url, {
    headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey, 'Accept': 'application/json' }
  });
  if (!r.ok) return null;
  const rows = await r.json().catch(function () { return []; });
  return (rows && rows[0] && rows[0].sector) || null;
}

async function searchDots(supabaseUrl, supabaseKey, queryVector, sector) {
  const url = supabaseUrl + '/rest/v1/rpc/search_dots_by_embedding';
  const body = {
    query_vector: queryVector,
    k: DEFAULT_K,
    filter_sector: sector || null,
    filter_max_age_days: MAX_AGE_DAYS
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const body = await r.text().catch(function () { return ''; });
    throw new Error('search_dots_by_embedding RPC failed (' + r.status + '): ' + body.slice(0, 300));
  }
  return r.json();
}

function aggregate(neighbors) {
  if (!Array.isArray(neighbors) || !neighbors.length) {
    return { bullshit: null, p5: null, p10: null, p20: null, weights: [], resolved: [] };
  }
  const resolved = neighbors.filter(function (n) { return n.return_5d != null; });
  if (!resolved.length) {
    return { bullshit: null, p5: null, p10: null, p20: null, weights: [], resolved: [] };
  }
  const now = Date.now();
  const weights = resolved.map(function (n) {
    const ageDays = (now - new Date(n.observed_at).getTime()) / 86400000;
    const recencyW = Math.pow(0.5, Math.max(0, ageDays) / 365);
    const sim = Math.max(0, Math.min(1, Number(n.similarity) || 0));
    const simW = sim * sim;
    return recencyW * simW;
  });
  const totalW = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
  function wMean(col) {
    let sum = 0, wSum = 0;
    for (let i = 0; i < resolved.length; i++) {
      const v = resolved[i][col];
      if (v == null || isNaN(Number(v))) continue;
      sum += Number(v) * weights[i];
      wSum += weights[i];
    }
    return wSum > 0 ? sum / wSum : null;
  }
  return {
    bullshit: wMean('bullshit_probability'),
    p5:  wMean('return_5d'),
    p10: wMean('return_10d'),
    p20: wMean('return_20d'),
    weights: weights,
    resolved: resolved
  };
}

module.exports = async function (req, res) {
  try {
    if (req.method !== 'POST') {
      return send(res, 405, { error: 'Method not allowed — POST required.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON || '';
    const hfKey = process.env.HUGGINGFACE_API_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return send(res, 500, { error: 'Supabase env not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).' });
    }
    if (!hfKey) {
      return send(res, 500, { error: 'HUGGINGFACE_API_KEY env var not set — needed to embed the query.' });
    }

    const body = await readBody(req);
    const ticker = (body.ticker || '').toString().toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 10);
    const narrativeText = (body.narrativeText || '').toString().trim();

    if (!ticker) return send(res, 400, { error: 'Missing ticker.' });
    if (!narrativeText) return send(res, 400, { error: 'Missing narrativeText.' });
    if (narrativeText.length < 10) return send(res, 400, { error: 'narrativeText too short (need at least a sentence).' });
    if (narrativeText.length > 4000) return send(res, 400, { error: 'narrativeText too long (max 4000 chars).' });

    // 1. Embed
    let queryVector;
    try {
      queryVector = await embedQuery(narrativeText, hfKey);
    } catch (e) {
      return send(res, 502, { error: e.message || 'Embedding failed.' });
    }

    // 2. Sector hint (best-effort; null is fine)
    let sector = null;
    try { sector = await lookupSector(supabaseUrl, supabaseKey, ticker); } catch (_) {}

    // 3. RPC similarity search
    let neighbors;
    try {
      neighbors = await searchDots(supabaseUrl, supabaseKey, queryVector, sector);
    } catch (e) {
      return send(res, 500, { error: e.message || 'Vector search failed.' });
    }
    if (!neighbors || !neighbors.length) {
      return send(res, 200, {
        ticker: ticker,
        narrative_text: narrativeText,
        warning: 'no_similar_dots',
        n_similar_dots: 0,
        n_resolved_neighbors: 0,
        neighbors: []
      });
    }

    // 4. Aggregate
    const agg = aggregate(neighbors);

    // 5. Build response
    const round2 = function (v) { return v == null ? null : Math.round(Number(v) * 100) / 100; };
    return send(res, 200, {
      ticker: ticker,
      narrative_text: narrativeText,
      sector_hint: sector,
      bullshit_probability: agg.bullshit == null ? 0.5 : Math.round(agg.bullshit * 100) / 100,
      confidence: Math.min(1, agg.resolved.length / 100),
      n_similar_dots: neighbors.length,
      n_resolved_neighbors: agg.resolved.length,
      predicted_5d_return:  round2(agg.p5),
      predicted_10d_return: round2(agg.p10),
      predicted_20d_return: round2(agg.p20),
      neighbor_examples: neighbors.slice(0, 3).map(function (n) {
        return {
          ticker: n.ticker,
          narrative: n.narrative_text ? n.narrative_text.slice(0, 200) : null,
          observed_at: n.observed_at,
          speaker: n.speaker_id,
          return_5d: n.return_5d,
          return_10d: n.return_10d,
          return_20d: n.return_20d,
          similarity: n.similarity == null ? null : Math.round(Number(n.similarity) * 100) / 100
        };
      }),
      warning: agg.resolved.length > 0 && agg.resolved.length < 30 ? 'sparse_neighborhood' : null,
      updated: new Date().toISOString()
    });
  } catch (err) {
    return send(res, 500, { error: (err && err.message) || 'Unknown error.' });
  }
};
