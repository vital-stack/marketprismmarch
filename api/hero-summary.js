// Ticker hero summary — Claude Haiku 4.5 synthesis describing the narrative.
// Produces a 2-3 sentence editorial paragraph that lives directly below the
// deterministic deriveState() label in the ticker page narrative strip.
//
// Inputs include recent narrative_analyses article text (last 3 days), the
// full narrative_scorecard signals (state, coordination, regime, sentiment),
// daily_fair_value, and earnings context. The synthesized state label is
// passed in explicitly so the LLM can avoid restating it. Fair-value
// percentages are now allowed (and expected) in output — the second sentence
// is supposed to quantify the narrative/fundamentals disconnect.
//
// Cached at the edge for 10 min. Ticker state shifts intraday as new articles
// land, so a longer cache lags the displayed narrative behind reality. 10 min
// bounds cost to a few thousand LLM calls/day at typical traffic since the
// cost scales with users landing on ticker pages, not the full catalog.

const SYSTEM_PROMPT = `You are writing a 2-3 sentence editorial summary for a stock ticker page. The reader is a retail trader who wants to understand what's happening to this stock right now and whether they should care.

Sentence 1 — Lead with what's dominating discourse. If multiple articles share a theme, name it specifically (use proper nouns from the articles). If they conflict, describe the conflict.

Sentence 2 — Quantify the disconnect between narrative and fundamentals. Reference the fair value gap, recent earnings if applicable, and narrative health (use the narrative regime / walsh_regime to characterize whether the story is fresh or fading).

Sentence 3 (optional) — If the institutional signal is meaningful (narrative_state = WHALE_ACCUMULATION or DISTRIBUTION, or strong coordination), add the institutional read in plain English.

Hard rules:
- Never use em dashes. Use commas, periods, or " - " (hyphen with spaces) instead.
- Maximum 3 sentences. Tighter is better.
- Use specifics from the articles when possible (proper nouns, numbers, themes). Avoid abstract phrases like "competing narratives" if you can name what's competing.
- Never invent facts not in the inputs. No rumors, no quotes, no analyst names unless they're in the article text.
- A synthesized state label is shown directly above this paragraph (e.g. "Smart money behind a story"). Do NOT restate or paraphrase it — show what is happening, do not declare it.
- Do not say "this stock", "this ticker", or restate the ticker symbol — they are shown adjacent to the paragraph.
- Read like a Bloomberg analyst wrote it. Not breathless, not robotic.
- Banned words: crash, guaranteed, certain, always, never, explosion, manipulation. Use "stretched", "diverging", or "outpacing fundamentals" instead.

Output ONLY the paragraph. No headers, no quotes around it, no preamble.`;

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

// Derive a coordination-class enum from the numeric coordination_score so the
// LLM input vocabulary matches the deriveState() rules on the frontend.
function coordinationClass(score) {
  if (score == null) return null;
  if (score >= 60) return 'LIKELY_COORDINATED';
  if (score >= 30) return 'SUSPICIOUS_PATTERN';
  if (score >= 10) return 'ORGANIC_SPREAD';
  return 'ORGANIC';
}

// Mirror the frontend's deriveState() so we can pass the synthesized state
// label to the LLM and instruct it not to restate.
// priceChangePct: today's % change. Used to gate the "Quiet" label so a
// large-cap with sparse news but a +3% tape doesn't get labeled Quiet.
function synthesizedStateLabel(sc, priceChangePct) {
  // Universal fallback — never returns "Insufficient signal" so the LLM hint
  // stays in lockstep with the frontend deriveState() catch-all.
  if (!sc) return 'Mixed signals';
  var ns = sc.narrative_state || null;
  var cc = coordinationClass(sc.coordination_score);
  var wr = sc.walsh_regime || null;
  var ner = (sc.narrative_energy_regime || '').toString();
  var freshEnergy = /critical/i.test(ner) && !/sub/i.test(ner);
  var s = sc.current_sentiment;
  var tone = (s == null || !isFinite(s)) ? null : (s > 0.30 ? 'BULLISH' : s < -0.30 ? 'BEARISH' : 'MIXED');
  // See deriveState() in _ticker.html for the rationale — both signals must
  // explicitly agree before the Quiet label fires; nulls default to FALSE.
  var nea = sc.narrative_energy_absolute != null && isFinite(Number(sc.narrative_energy_absolute))
    ? Number(sc.narrative_energy_absolute) : null;
  var lowEnergy = nea != null && nea < 100;
  var dailyAbsPct = priceChangePct != null && isFinite(Number(priceChangePct))
    ? Math.abs(Number(priceChangePct)) : null;
  var priceIsQuiet = dailyAbsPct != null && dailyAbsPct < 1;

  if (ns === 'WHALE_ACCUMULATION' && cc === 'LIKELY_COORDINATED') return 'Smart money behind a story';
  if (ns === 'WHALE_ACCUMULATION') return 'Quiet accumulation';
  if (ns === 'DISTRIBUTION' && (cc === 'LIKELY_COORDINATED' || cc === 'SUSPICIOUS_PATTERN') && tone === 'BULLISH') return 'Whales selling into hype';
  if (ns === 'DISTRIBUTION' && wr === 'EXHAUSTING') return 'Smart money exiting';
  if (ns === 'DISTRIBUTION' && freshEnergy) return 'Distribution into strength';
  if (ns === 'DISTRIBUTION') return 'Quiet distribution';
  if (ns === 'RETAIL_PUMP' && cc === 'LIKELY_COORDINATED') return 'Manufactured pump';
  if (ns === 'RETAIL_PUMP' && cc === 'SUSPICIOUS_PATTERN') return 'Suspicious retail activity';
  if (ns === 'RETAIL_PUMP') return 'Retail momentum';
  if (wr === 'EXHAUSTING') return 'Narrative collapsing';
  if (ns === 'DORMANT' && lowEnergy && priceIsQuiet) return 'Quiet';
  if (cc === 'LIKELY_COORDINATED') return 'Coordinated narrative';
  // Falls through to "Mixed signals" when ns is null/unclassified but other
  // scorecard fields are present (e.g. major tickers like AAPL with rich
  // coverage but no specific narrative state). See _ticker.html deriveState().
  return 'Mixed signals';
}

function compactState(story, scorecard, health, narratives, fairValue, articles) {
  var s = story || {};
  var sc = scorecard || {};
  var h = health || {};
  var fv = fairValue || {};
  var lines = [];

  // Header — ticker, sector, fundamentals.
  if (s.ticker) lines.push('Ticker: ' + s.ticker);
  if (s.sector_name) lines.push('Sector: ' + s.sector_name);
  if (s.price != null) lines.push('Current price: $' + Number(s.price).toFixed(2));
  if (fv.fair_value != null) {
    var fvPrice = Number(fv.fair_value);
    var pricePct = s.price ? ((fvPrice - Number(s.price)) / Number(s.price) * 100) : null;
    lines.push('Fair value: $' + fvPrice.toFixed(2)
      + (pricePct != null ? ' (' + (pricePct >= 0 ? '+' : '') + pricePct.toFixed(1) + '% from current)' : ''));
  } else if (sc.fvd_pct != null) {
    var fvd = Number(sc.fvd_pct);
    lines.push('Fair-value gap: ' + (fvd >= 0 ? '+' : '') + fvd.toFixed(1) + '%');
  }
  if (s.days_to_earnings != null) lines.push('Days to earnings: ' + s.days_to_earnings + ' (negative = post-earnings)');
  if (s.earnings_surprise_pct != null) lines.push('Last earnings surprise: ' + Number(s.earnings_surprise_pct).toFixed(1) + '%');
  if (s.guidance_direction) lines.push('Guidance: ' + s.guidance_direction);

  // Narrative signals.
  lines.push('');
  lines.push('Narrative signals:');
  if (sc.narrative_state) lines.push('- State: ' + sc.narrative_state);
  var cc = coordinationClass(sc.coordination_score);
  if (cc) lines.push('- Coordination: ' + cc + (sc.coordination_score != null ? ' (' + Math.round(sc.coordination_score) + ')' : ''));
  if (sc.walsh_regime) lines.push('- Walsh regime: ' + sc.walsh_regime);
  if (sc.narrative_energy_regime) lines.push('- Energy regime: ' + sc.narrative_energy_regime);
  if (sc.current_sentiment != null) {
    var cs = Number(sc.current_sentiment);
    var tone = cs > 0.30 ? 'BULLISH' : cs < -0.30 ? 'BEARISH' : 'MIXED';
    lines.push('- Aggregate sentiment: ' + tone + ' (' + cs.toFixed(2) + ')');
  }
  if (sc.verdict || s.prism_verdict) lines.push('- Verdict: ' + (sc.verdict || s.prism_verdict));
  if (h.narrative_trend) lines.push('- Trend: ' + h.narrative_trend);
  if (sc.half_life != null) lines.push('- Narrative half-life (days remaining): ' + Math.round(Number(sc.half_life)));

  // Synthesized state — the deterministic label rendered above this paragraph.
  // Surfaced explicitly so the LLM doesn't restate it. Pass today's price
  // change so the Quiet rule stays in sync with the frontend.
  var stateLabel = synthesizedStateLabel(sc, s.price_change_pct);
  lines.push('');
  lines.push('Synthesized state label (already shown above the paragraph — DO NOT restate): "' + stateLabel + '"');

  // Recent article narratives (raw text, capped).
  if (articles && articles.length) {
    lines.push('');
    lines.push('Recent article narratives (' + articles.length + ' articles in last 3 days):');
    articles.slice(0, 10).forEach(function(a) {
      var bits = [];
      if (a.source_outlet) bits.push(a.source_outlet);
      if (a.sentiment_score != null) {
        var sScore = Number(a.sentiment_score);
        bits.push(sScore > 0.30 ? 'BULLISH' : sScore < -0.30 ? 'BEARISH' : 'MIXED');
      }
      var txt = (a.narrative_text || '').toString().replace(/\s+/g, ' ').trim().slice(0, 200);
      lines.push('- [' + bits.join(', ') + ']: ' + txt);
    });
  } else if (narratives && narratives.length) {
    // Fallback to the deduped scorecard narratives view if narrative_analyses
    // returns nothing fresh.
    lines.push('');
    lines.push('Active narratives (most-cited first):');
    narratives.slice(0, 5).forEach(function(n, i) {
      var bits = [];
      if (n.narrative) bits.push(n.narrative);
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
  // narrative_analyses query — last 3 days, up to 10 rows. Uses snapshot_date
  // which is the per-article scrape date. Empty result is fine; compactState
  // falls back to the deduped scorecard narratives view.
  var sinceISO = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  var [storyRows, scoreRows, healthRows, narrativeRows, fvRows, articleRows] = await Promise.all([
    fetchSupabase('v_dash_daily_story?select=ticker,sector_name,price,price_change_pct,narrative_state,prism_verdict,story_claim,forensic_rebuttal,days_to_earnings,guidance_direction,earnings_surprise_pct,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1'),
    fetchSupabase('narrative_scorecard?select=ticker,verdict,narrative_state,coordination_score,walsh_regime,narrative_energy_regime,narrative_energy_absolute,current_sentiment,fvd_pct,half_life,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1'),
    fetchSupabase('v_dash_narrative_health?select=ticker,narrative_health,narrative_trend,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1'),
    fetchSupabase('v_narrative_scorecard_deduped?select=narrative,propagation_pressure,energy_remaining,narrative_energy_regime,snapshot_date&' + tFilter + '&order=snapshot_date.desc,propagation_pressure.desc.nullslast&limit=8'),
    fetchSupabase('daily_fair_value?select=fair_value,fv_low,fv_high,verdict,snapshot_date&' + tFilter + '&order=snapshot_date.desc&limit=1'),
    fetchSupabase('narrative_analyses?select=narrative_text,source_outlet,sentiment_score,snapshot_date&' + tFilter + '&snapshot_date=gte.' + sinceISO + '&order=snapshot_date.desc&limit=10')
  ]);

  var story = (storyRows && storyRows[0]) || null;
  var scorecard = (scoreRows && scoreRows[0]) || null;
  var health = (healthRows && healthRows[0]) || null;
  var narratives = narrativeRows || [];
  var fairValue = (fvRows && fvRows[0]) || null;
  var articles = articleRows || [];

  if (!story && !scorecard && !narratives.length && !articles.length) {
    return res.status(404).json({ error: 'no data for ticker', ticker: ticker });
  }

  var stateBlock = compactState(story, scorecard, health, narratives, fairValue, articles);
  var userMessage = 'Ticker dashboard state:\n\n' + stateBlock + '\n\nWrite the 2-3 sentence editorial paragraph now.';

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
        max_tokens: 360,
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
