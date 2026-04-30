// Daily Plays — Top AI Picks via Claude API
// Vercel Serverless Function (Node.js runtime)
//
// Strategy: The pipeline produces a deterministic daily snapshot keyed by
// snapshot_date. We cache Claude's ranking in-memory by that date so the model
// is called at most a few times per day (once per cold function instance),
// regardless of dashboard traffic. To persist across cold starts, swap the
// CACHE Map for a Supabase table read/write keyed by snapshot_date.

const CACHE = new Map(); // key = snapshot_date, value = {picks, generated_at, model}
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h safety cap

const RATE_LIMIT = {};
const RATE_WINDOW = 60 * 1000;
const MAX_REQUESTS = 10;

function rateCheck(ip) {
  var now = Date.now();
  if (!RATE_LIMIT[ip]) RATE_LIMIT[ip] = [];
  RATE_LIMIT[ip] = RATE_LIMIT[ip].filter(function(t) { return now - t < RATE_WINDOW; });
  if (RATE_LIMIT[ip].length >= MAX_REQUESTS) return false;
  RATE_LIMIT[ip].push(now);
  return true;
}

const SYSTEM_PROMPT = `You are the Market Prism senior signal analyst. You receive a compact JSON list of tickers with forensic signals derived from the narrative scorecard pipeline. Your job is to surface the 10 highest-conviction trades for the day across ALL setup types — day trade, swing, momentum, earnings, value, or trap shorts.

You are NOT re-sorting by a single metric. You synthesize across signals. Prefer tickers that light up on multiple independent dimensions (e.g. Clear Path + low NRS + positive WKS + narrative energy), over tickers strong on only one axis.

SIGNAL GLOSSARY (use these terms in your thesis lines, never invent new ones):
- nrs: Narrative Risk Score (0-100, higher = more forensic risk)
- wks_score: Keyword sentiment (-100 to +100, + bullish, - bearish)
- walsh_regime: CLEAR_PATH (bullish), PERSISTENT (bearish entrenchment), DRIFT (quiet short), or null
- narrative_energy_absolute: raw energy (>500 = momentum present, >1000 = explosive)
- fvd_pct: fair-value deviation (negative = undervalued)
- verdict: "Narrative Trap" / "Structurally Supported" / etc
- half_life: narrative decay window in days (<15 = fast-moving)
- coordination_score: coordinated-coverage signal (0-100, >30 = suspicious)
- drift_score: off-narrative price drift (0-100, >60 = divergence)

OUTPUT FORMAT — respond ONLY with a JSON array, no prose, no markdown fences. Exactly 10 entries:
[
  {
    "ticker": "NVDA",
    "action": "Long" | "Short" | "Watch",
    "direction": "BULLISH" | "BEARISH" | "NEUTRAL",
    "conviction": 1-100,
    "thesis": "One sentence, under 140 chars, lead with the cross-signal pattern. No hype words."
  },
  ...
]

RULES:
- Return valid JSON only. No leading text, no trailing text, no code fences.
- Rank by conviction descending.
- Never use the words: crash, violent, guaranteed, certain, moonshot, explosion.
- Thesis must reference at least two distinct signals (e.g. "Clear Path regime with NRS 18 and +42 WKS"). Numbers belong in the thesis.
- Do NOT recommend position sizing or stops. This is signal synthesis, not financial advice.
- If fewer than 10 tickers meet a reasonable conviction bar, return what you have — do not pad.`;

function pickCompact(r) {
  // Trim to the fields Claude actually needs. Keeps input tokens low.
  return {
    ticker: r.ticker,
    price: r.price,
    nrs: r.nrs,
    wks: r.wks_score,
    regime: r.walsh_regime,
    energy: r.narrative_energy_absolute,
    energy_regime: r.narrative_energy_regime,
    mass: r.narrative_mass_score,
    coord: r.coordination_score,
    drift: r.drift_score,
    half_life: r.half_life,
    fvd: r.fvd_pct,
    vms: r.vms,
    verdict: r.verdict,
    conf: r.verdict_confidence,
    dte: r._earn ? r._earn.days_to_earnings : null,
    surprise: r._earn ? r._earn.earnings_surprise_pct : null
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  ip = ip.split(',')[0].trim();
  if (!rateCheck(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again shortly.' });
  }

  var body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  var snapshotDate = (body && body.snapshot_date) ? String(body.snapshot_date) : '';
  var rows = (body && Array.isArray(body.rows)) ? body.rows : [];
  if (!snapshotDate || !rows.length) {
    return res.status(400).json({ error: 'snapshot_date and rows[] required' });
  }

  // Cache hit
  var cached = CACHE.get(snapshotDate);
  if (cached && (Date.now() - cached.generated_at) < CACHE_TTL_MS) {
    return res.status(200).json({
      picks: cached.picks,
      snapshot_date: snapshotDate,
      model: cached.model,
      cached: true
    });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY || '';
  if (!apiKey) {
    return res.status(500).json({ error: 'AI picks not configured (no ANTHROPIC_API_KEY / ANTHROPIC_KEY in env).' });
  }

  // Pre-filter: only send tickers that have at least one meaningful signal.
  // Cuts input tokens ~5-10x without losing the interesting candidates.
  var candidates = rows.filter(function(r) {
    if (!r || !r.ticker) return false;
    return (r.walsh_regime === 'CLEAR_PATH')
      || (r.walsh_regime === 'PERSISTENT' && r.nrs > 40)
      || (r.narrative_energy_absolute > 500)
      || (r.fvd_pct != null && r.fvd_pct < -5)
      || (r.verdict === 'Narrative Trap' || r.verdict === 'Narrative Risk')
      || (r.half_life < 15)
      || (r.drift_score > 60)
      || (r._earn && r._earn.days_to_earnings != null && Math.abs(r._earn.days_to_earnings) <= 7);
  }).slice(0, 120).map(pickCompact); // cap at 120 to bound tokens

  if (!candidates.length) {
    return res.status(200).json({ picks: [], snapshot_date: snapshotDate, model: null });
  }

  var userMessage = 'Snapshot date: ' + snapshotDate + '\n\nCandidate tickers (JSON):\n' + JSON.stringify(candidates);

  var MODEL_CHAIN = ['claude-sonnet-4-6', 'claude-haiku-4-5'];

  async function callAnthropic(model) {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
  }

  try {
    var response = null;
    var lastErrText = '';
    var lastStatus = 0;
    var modelUsed = null;

    for (var i = 0; i < MODEL_CHAIN.length; i++) {
      var model = MODEL_CHAIN[i];
      response = await callAnthropic(model);
      if (!response.ok && response.status >= 500 && response.status < 600) {
        await new Promise(function(r){ setTimeout(r, 800); });
        response = await callAnthropic(model);
      }
      if (response.ok) { modelUsed = model; break; }
      lastStatus = response.status;
      lastErrText = await response.text();
      console.error('Anthropic API error:', model, lastStatus, lastErrText);
      if (lastStatus < 500 || lastStatus >= 600) break;
    }

    if (!response || !response.ok) {
      return res.status(502).json({ error: 'AI service error (' + lastStatus + ')' });
    }

    var data = await response.json();
    var text = data.content && data.content[0] ? data.content[0].text : '';

    // Extract JSON array from the response (model should return raw JSON, but
    // fall back to a bracket-slice in case it wraps the array).
    var picks = null;
    try {
      picks = JSON.parse(text);
    } catch (e) {
      var start = text.indexOf('[');
      var end = text.lastIndexOf(']');
      if (start >= 0 && end > start) {
        try { picks = JSON.parse(text.slice(start, end + 1)); } catch (e2) { picks = null; }
      }
    }

    if (!Array.isArray(picks)) {
      return res.status(502).json({ error: 'AI returned unparseable response' });
    }

    // Sanitize: keep only known fields, clamp lengths
    var clean = picks.filter(function(p){ return p && p.ticker; }).slice(0, 10).map(function(p){
      return {
        ticker: String(p.ticker).toUpperCase().slice(0, 8),
        action: ['Long','Short','Watch'].indexOf(p.action) >= 0 ? p.action : 'Watch',
        direction: ['BULLISH','BEARISH','NEUTRAL'].indexOf(p.direction) >= 0 ? p.direction : 'NEUTRAL',
        conviction: Math.max(0, Math.min(100, Number(p.conviction) || 0)),
        thesis: String(p.thesis || '').slice(0, 180)
      };
    });

    CACHE.set(snapshotDate, { picks: clean, generated_at: Date.now(), model: modelUsed });

    return res.status(200).json({
      picks: clean,
      snapshot_date: snapshotDate,
      model: modelUsed,
      cached: false
    });
  } catch (err) {
    console.error('Top AI Picks error:', err);
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
};
