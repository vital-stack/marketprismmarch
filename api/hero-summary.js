// Ticker hero summary — Claude Haiku 4.5 synthesis of the page state.
// Replaces the legacy single-narrative `story_claim` with a one-sentence
// reading that considers verdict, valuation gap, narrative health, and the
// rebuttal/claim text already in v_dash_daily_story.
//
// Cached at the edge per (ticker, snapshot_date) effective key. Snapshots land
// once a day, so s-maxage=21600 (6h) keeps cost bounded to a few hundred
// invocations/day across the whole catalog.

const SYSTEM_PROMPT = `You are the Market Prism hero summarizer. Given a ticker's current dashboard state, produce ONE sentence (max 30 words) that captures what an investor should take away from the page right now.

Rules:
- One sentence. Plain English. No markdown, no bullets, no em-dashes.
- Must be internally consistent with the verdict. If verdict is "Narrative Trap" or "Narrative Risk", the sentence must lean cautionary; do not call coverage benign.
- If verdict is "Structurally Supported" or "Verified", lean constructive.
- If verdict is "Monitoring" or empty, stay neutral and descriptive.
- Reference at most one concrete number (e.g. valuation gap, narrative count, days to earnings) when it sharpens the read.
- Do not say "this stock", "this ticker", or restate the ticker symbol — it is shown next to the sentence.
- Never use: crash, guaranteed, certain, always, never, explosion, manipulation (use "stretched" or "diverging" instead).
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

function compactState(story, scorecard, health) {
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
  if (sc.fvd_pct != null) lines.push('Valuation gap (FVD %): ' + Number(sc.fvd_pct).toFixed(1));
  if (sc.nrs != null) lines.push('NRS: ' + sc.nrs);
  if (sc.coordination_score != null) lines.push('Coordination: ' + sc.coordination_score);
  if (s.days_to_earnings != null) lines.push('Days to earnings: ' + s.days_to_earnings);
  if (s.guidance_direction) lines.push('Guidance: ' + s.guidance_direction);
  if (s.story_claim) lines.push('Existing story claim: ' + s.story_claim);
  if (s.forensic_rebuttal) lines.push('Forensic rebuttal: ' + s.forensic_rebuttal);
  return lines.join('\n');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

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
  var [storyRows, scoreRows, healthRows] = await Promise.all([
    fetchSupabase('v_dash_daily_story?select=ticker,sector_name,narrative_state,prism_verdict,story_claim,forensic_rebuttal,days_to_earnings,guidance_direction,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1'),
    fetchSupabase('narrative_scorecard?select=ticker,verdict,fvd_pct,nrs,coordination_score,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1'),
    fetchSupabase('v_dash_narrative_health?select=ticker,narrative_health,narrative_trend,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1')
  ]);

  var story = (storyRows && storyRows[0]) || null;
  var scorecard = (scoreRows && scoreRows[0]) || null;
  var health = (healthRows && healthRows[0]) || null;

  if (!story && !scorecard) {
    return res.status(404).json({ error: 'no data for ticker', ticker: ticker });
  }

  var stateBlock = compactState(story, scorecard, health);
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

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
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
