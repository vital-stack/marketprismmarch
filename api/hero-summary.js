// Ticker hero summary — Claude Haiku 4.5 synthesis describing the narrative.
// Replaces the legacy single-narrative `story_claim` with a one-sentence
// reading of the active narratives, their regime/propagation, and how they
// square with the verdict. Fair-value percentages and "X times fundamentals"
// multiples are deliberately stripped from the input and forbidden in output —
// those metrics are surfaced elsewhere on the page.
//
// Cached at the edge for 10 min. Ticker state (verdict, narrative health,
// propagation, energy) shifts intraday as new articles land, so a 6h cache
// lagged the displayed narrative behind reality. 10 min still bounds cost to a
// few thousand LLM calls/day at typical traffic, since cost scales with users
// landing on ticker pages, not the full catalog.

const SYSTEM_PROMPT = `You are the Market Prism hero summarizer. Given a ticker's current narrative state, produce ONE sentence (max 30 words) describing the narrative — what story is being told about this ticker, how it's holding up, and where it's heading.

Rules:
- One sentence. Plain English. No markdown, no bullets, no em-dashes.
- The subject is THE NARRATIVE, not the stock price. Describe what the dominant story claims, how widely it is propagating, whether it is rising/fading/exhausted, and how it squares with the verdict.
- Must be internally consistent with the verdict. If verdict is "Narrative Trap" or "Narrative Risk", lean cautionary and do not call the narrative healthy. If "Structurally Supported" or "Verified", lean constructive. If "Monitoring" or empty, stay neutral and descriptive.
- Do NOT cite fair-value percentages, valuation gaps, P/E, or "X times fundamentals" multiples even if they appear in the input. Those metrics are shown elsewhere on the page.
- Other concrete details are fine when they sharpen the read: number of active narratives, narrative regime (Building/Pressure/Fading/Recovering), days to earnings, propagation breadth.
- Do not say "this stock", "this ticker", or restate the ticker symbol — it is shown next to the sentence.
- Never use: crash, guaranteed, certain, always, never, explosion, manipulation (use "stretched", "diverging", or "outpacing fundamentals" instead).
- Output the sentence only. No preface, no quotes, no trailing punctuation other than a period.`;

async function fetchSupabase(path) {
  var url = process.env.SUPABASE_URL || '';
  var key = process.env.SUPABASE_ANON || '';
  if (!url || !key) return null;
  try {
    var res = await fetch(url + '/rest/v1/' + path, {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Strip fair-value percentages and "X times fundamentals" multiples from any
// freeform text we forward to the LLM. The model is also instructed to ignore
// these, but pre-filtering removes the temptation entirely.
function stripValuationFigures(text) {
  if (!text) return text;
  return String(text)
    // "trades at three times what fundamentals suggest" / "2.5x fair value"
    .replace(/\b(?:nearly|about|roughly|approximately|around)?\s*\d+(?:\.\d+)?\s*(?:x|times)\s+(?:what\s+(?:the\s+)?(?:underlying\s+)?(?:business\s+)?fundamentals?(?:\s+suggest(?:s)?)?(?:\s+(?:it'?s\s+)?worth)?|fundamentals?|fair\s+value|book|earnings|sales)\b/gi, 'above fundamentals')
    // "32% above fair value" / "trades 18% below fundamentals"
    .replace(/\b\d+(?:\.\d+)?\s*%\s*(?:above|below|over|under)\s+(?:fair\s+value|fundamentals?|estimated\s+value|intrinsic\s+value)\b/gi, 'diverging from fundamentals')
    // "fair value gap of 32%"
    .replace(/\b(?:fair\s+value\s+gap|valuation\s+gap|FVD)\s+of\s+\d+(?:\.\d+)?\s*%/gi, 'a valuation divergence')
    .replace(/\s{2,}/g, ' ');
}

function compactState(story, scorecard, health, narratives) {
  var s = story || {};
  var sc = scorecard || {};
  var h = health || {};
  var lines = [];
  if (s.ticker) lines.push('Ticker: ' + s.ticker);
  if (s.sector_name) lines.push('Sector: ' + s.sector_name);
  if (sc.verdict || s.prism_verdict) lines.push('Verdict: ' + (sc.verdict || s.prism_verdict));
  if (s.narrative_state) lines.push('Narrative state: ' + s.narrative_state);
  if (h.narrative_health != null) lines.push('Narrative health: ' + h.narrative_health);
  if (h.narrative_trend) lines.push('Narrative trend: ' + h.narrative_trend);
  if (s.days_to_earnings != null) lines.push('Days to earnings: ' + s.days_to_earnings);
  if (s.guidance_direction) lines.push('Guidance: ' + s.guidance_direction);
  if (s.story_claim) lines.push('Story claim: ' + stripValuationFigures(s.story_claim));
  if (s.forensic_rebuttal) lines.push('Forensic rebuttal: ' + stripValuationFigures(s.forensic_rebuttal));
  // Top narratives — let the LLM see what stories are actually circulating.
  if (narratives && narratives.length) {
    lines.push('Active narratives (most-cited first):');
    narratives.slice(0, 5).forEach(function(n, i) {
      var bits = [];
      if (n.narrative) bits.push(stripValuationFigures(n.narrative));
      if (n.narrative_energy_regime) bits.push('regime=' + n.narrative_energy_regime);
      if (n.energy_remaining != null) bits.push('energy=' + Number(n.energy_remaining).toFixed(0));
      if (n.propagation_pressure != null) bits.push('propagation=' + Number(n.propagation_pressure).toFixed(0));
      lines.push('  ' + (i + 1) + '. ' + bits.join(' · '));
    });
  }
  return lines.join('\n');
}

const rateLimit = require('./_rate-limit');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Rate limit AFTER the CORS preflight so OPTIONS isn't blocked.
  // Hero summary calls Claude — expensive, so cap aggressively.
  if (!rateLimit(req, res, 'hero-summary', 30)) return;

  var url = new URL(req.url, 'http://localhost');
  var ticker = (url.searchParams.get('ticker') || '').replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
  if (!ticker) {
    return res.status(400).json({ error: 'ticker required' });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return res.status(500).json({ error: 'AI summary not configured' });
  }

  var tFilter = 'ticker=eq.' + encodeURIComponent(ticker);
  var [storyRows, scoreRows, healthRows, narrativeRows] = await Promise.all([
    fetchSupabase('v_dash_daily_story?select=ticker,sector_name,narrative_state,prism_verdict,story_claim,forensic_rebuttal,days_to_earnings,guidance_direction,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1'),
    fetchSupabase('narrative_scorecard?select=ticker,verdict,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1'),
    fetchSupabase('v_dash_narrative_health?select=ticker,narrative_health,narrative_trend,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1'),
    fetchSupabase('v_narrative_scorecard_deduped?select=narrative,propagation_pressure,energy_remaining,narrative_energy_regime,snapshot_date&' + tFilter + '&order=snapshot_date.desc,propagation_pressure.desc.nullslast&limit=8')
  ]);

  var story = (storyRows && storyRows[0]) || null;
  var scorecard = (scoreRows && scoreRows[0]) || null;
  var health = (healthRows && healthRows[0]) || null;
  var narratives = narrativeRows || [];

  if (!story && !scorecard && !narratives.length) {
    return res.status(404).json({ error: 'no data for ticker', ticker: ticker });
  }

  var stateBlock = compactState(story, scorecard, health, narratives);
  var userMessage = 'Ticker dashboard state:\n\n' + stateBlock + '\n\nWrite the one-sentence hero summary now.';

  try {
    var apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!apiRes.ok) {
      var errBody = await apiRes.text().catch(function() { return ''; });
      console.error('Anthropic error', apiRes.status, errBody.slice(0, 300));
      return res.status(502).json({ error: 'AI service error (' + apiRes.status + ')' });
    }

    var data = await apiRes.json();
    var text = (data.content && data.content[0] && data.content[0].text || '').trim();
    if (!text) {
      return res.status(502).json({ error: 'empty AI response' });
    }
    // Defensive: collapse any stray newlines into a single sentence.
    text = text.replace(/\s+/g, ' ').trim();

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      ticker: ticker,
      summary: text,
      snapshot_date: (story && story.snapshot_date) || (scorecard && scorecard.snapshot_date) || null,
      model: 'claude-haiku-4-5'
    });
  } catch (err) {
    console.error('hero-summary error', err);
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
};
