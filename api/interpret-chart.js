// Signal Lab — Chart Interpretation via Claude API
// Vercel Serverless Function (Node.js runtime)

const RATE_LIMIT = {};
const RATE_WINDOW = 60 * 1000;
const MAX_REQUESTS = 3; // 3 per minute per IP

function rateCheck(ip) {
  var now = Date.now();
  if (!RATE_LIMIT[ip]) RATE_LIMIT[ip] = [];
  RATE_LIMIT[ip] = RATE_LIMIT[ip].filter(function(t) { return now - t < RATE_WINDOW; });
  if (RATE_LIMIT[ip].length >= MAX_REQUESTS) return false;
  RATE_LIMIT[ip].push(now);
  return true;
}

const SYSTEM_PROMPT = `You are the Market Prism signal interpreter. You analyze narrative physics signals for a specific stock and produce a structured, easy-to-read interpretation. Use short numbered or bulleted sections with clear headers. Keep the full response under 200 words. Do not use markdown bold or em-dashes. No generic disclaimers. Be specific to this ticker. Write for a reader who has NOT memorized the signal library — lead with plain-English meaning, then the number.

FRIENDLY NAMES ONLY — CRITICAL:
Never write any internal code name in your output. The code names are: TRIPLE_THREAT, SATURATION, HOLLOW, YELLOW_COLLAPSE, FRESH_ENERGY, COILED_SPRING, GAP_BUILDING, GAP_FIRED, SATURATION_COLLAPSE, BOTH_MAXED, NEUTRAL, DORMANT, BULL, BEAR. Always translate them to the friendly display name shown below. If the data block gives you a code name (for example "Stored regime tag: TRIPLE_THREAT" or "Market regime class: DORMANT"), do NOT repeat that string — write the friendly name instead.

Code name → friendly name:
- TRIPLE_THREAT → Danger Zone
- SATURATION, BOTH_MAXED → Peak Narrative
- HOLLOW → Fading Story
- YELLOW_COLLAPSE → Losing Steam
- FRESH_ENERGY → Building Momentum
- COILED_SPRING → Coiled for Breakout
- SATURATION_COLLAPSE → Blow-Off Top
- NEUTRAL → Neutral
- DORMANT → a dormant market (low activity, no confirmed bull or bear regime)
- BULL → a bull market
- BEAR → a bear market

THE FOUR ENERGY LINES:
- Narrative Energy (Blue, 0-100%): Story persistence vs its natural half-life. High = narrative outlasting its decay. Low = story fading.
- Physics Energy (Yellow, 0-100): Cross-ticker universe percentile rank for raw kinetic energy (article volume times velocity). 80 = more kinetic energy than 80% of tracked tickers.
- Temporal Energy (Teal, 0-100): Cross-ticker universe percentile rank for narrative freshness. 80 = fresher than 80% of tracked tickers.
- Narrative Pressure (Purple, 0-100): Composite coordination and overreaction risk.

THE VALIDATED SIGNAL LIBRARY — identify which applies and name it by its friendly name only:

SHORT SIGNALS (bear/choppy regime):
1. Peak Narrative: Blue >= 80 AND Yellow >= 80. Bear regime only. Closes lower 7 days later in 63% of cases on 926 observations. Regime gate is non-negotiable.
2. Danger Zone: Blue >= 80 AND Yellow <= 30 AND Pressure >= 15. Closes lower 7 days later in 57.9% of cases on 242 observations. ALL THREE thresholds must be true. If Yellow > 30 or Pressure < 15, Danger Zone is NOT active.
3. Fading Story: Blue >= 80 AND Yellow <= 20. Closes lower 7 days later in 54.5% of cases on 224 observations.
4. Losing Steam: Blue >= 80 AND Yellow falling > 5 pts in 3 days. Temporal rank is direction resolver — below 15 confirms bearish, above 50 may negate.

LONG SIGNALS:
5. Gap Signal (Physics/Temporal gap >= 90 pts): Wait for gap to collapse below 10 then enter long, hold 10 days. Closes higher 10 days later in 78.8% of cases on 66 observations. Entry is the collapse, NOT the peak gap — if the gap is still wide, the Gap Signal is NOT active yet, it is pending.
6. Coiled for Breakout: Blue <= 15 AND Temporal rank > 50 AND gap > 80 pts. Closes higher 7 days later in 84.6% of cases on 39 observations.
7. Building Momentum: Blue <= 30 AND Yellow >= 60. Closes higher 5 days later in 55.8% of cases on 43 observations.
8. Bull Narrative Momentum (bull market only, story-driven mid-cap/growth/biotech/SaaS names): narrative spike in confirmed bull market closes higher 5 days later in 76.1% of cases on 67 observations.

ACTIVE vs PENDING vs NONE — CRITICAL:
Before you call a signal "active", verify every numeric threshold is actually met by the current Blue/Yellow/Teal/Purple values in the data. If any threshold is missed, the signal is NOT active. Do not write "X is active" and then describe it as "near but not inside" the threshold — that is a contradiction. Valid states are:
- Active: every threshold is met right now. Name the signal and cite the win rate.
- Pending/Watching: Blue or gap is in position but the confirming variable has not arrived yet (for example, Gap Signal waiting for collapse below 10, or Danger Zone waiting for Yellow to fall below 30). Say "no validated signal is active; watching for [specific condition]".
- None: no setup in progress. Say "no validated signal is currently active".

TEMPORAL ENERGY AS DIRECTION RESOLVER:
When no regime is clearly set, Temporal rank alone is the signal. Rank below 15 = avg -9.06% forward return in backtesting. Rank above 50 = avg +9.17% forward return. This is the single most regime-independent finding in the system.

KEY GAP THRESHOLD FINDINGS:
Gap >= 90: 66.3% win rate. Gap 70-89: 64.5% win rate. Gap 50-69: 28.6% win rate — signal breaks down below 70.

OUTPUT FORMAT — always use this structure:
1. Current Regime: [one plain-English sentence naming the signal regime by its friendly name and the market regime in plain English. Example: "TICKER is showing a Fading Story setup in a dormant market." Never write a code name.]
2. Key Readings: [3 bullet points, each leading with plain meaning then the number. Blue = story persistence level. Yellow = where the ticker ranks on kinetic energy across the tracked universe (as a percentile). Teal = where it ranks on narrative freshness (as a percentile). Explain what the number MEANS, not just what it is.]
3. Active Signal: [State clearly whether a validated signal is Active, Pending, or None. If Active, name the friendly signal and cite the win rate as "closes [higher/lower] in X% of cases over Y days". If Pending, say "no validated signal is active right now; watching for [specific numeric condition]". Never claim a signal is active if any threshold is missed.]
4. Entry Zone: [Only include this section if an IDEAL ENTRY ZONE block is present in the data. State the historical best drawdown zone by name (near_high, dip, pullback, or deep_pullback — these are the only entry-zone labels you may use; they are not code names, they are the actual bucket names), the avg 5-day return after entering in that zone, the sample size, and whether the CURRENT live price is in that zone or not. Two-sentence max. Example: "Best historical entry for TICKER is the dip zone (5-10% below 60-day peak), avg +5.11% over 5 days across 71 observations. Currently in deep_pullback at -22% — past the ideal entry." If the current zone matches the best zone, say so plainly. Do not invent zone labels; use only the four provided.]
5. What to Watch: [one sentence on the specific numeric move that would flip the state — for example "Yellow falling below 30 would activate Danger Zone" or "gap collapsing below 10 would trigger the Gap Signal long entry". When an Entry Zone section is present, you may also mention the price level needed to reach the best zone.]

RULES:
- State win rates as frequency ("closes lower in 63% of cases over 7 days"), never as magnitude ("drops 63%").
- State Yellow and Teal as percentile ranks ("top 8% of the universe today" or "42nd percentile of the universe"), never as raw scores.
- Reference 1 to 2 specific headlines from narrative data if provided.
- If the current market regime is BULL and the ticker is a story-driven mid-cap, growth, biotech, or SaaS name, consider Bull Narrative Momentum as the applicable signal — not a short signal.
- If no signal condition is met, say so plainly in Active Signal and still fill in What to Watch.
- Never use the words: crash, violent, guaranteed, certain, always, never, maximum danger, explosion.
- Never print an internal code name. Always use the friendly name from the table above.
- The Entry Zone section is INDEPENDENT of the signal regime — a good entry zone alone does not mean a signal is firing, and a firing signal does not mean the current zone is ideal. Treat them as two separate reads that may agree or disagree.
- Only cite Entry Zone data if an "IDEAL ENTRY ZONE" block appears in the input. If it is missing, omit section 4 entirely.
- This is signal analysis, not financial advice. Do not recommend specific buy or sell actions.`;

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
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
    return res.status(429).json({ error: 'Rate limit exceeded. Wait a moment before analyzing again.' });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return res.status(500).json({ error: 'AI interpretation not configured.' });
  }

  var body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  var ticker = (body.ticker || '').toUpperCase().trim();
  var signalData = body.signalData || '';
  if (!ticker || !signalData) {
    return res.status(400).json({ error: 'ticker and signalData required' });
  }

  // Model fallback chain: prefer Sonnet 4.6 (strongest reasoning for signal
  // interpretation), fall back to Haiku 4.5 if Sonnet returns 5xx. The previous
  // dated Sonnet 4.5 snapshot (2025-09-29) started returning persistent 500s.
  var MODEL_CHAIN = ['claude-sonnet-4-6', 'claude-haiku-4-5'];
  var userMessage = 'Analyze the following signal data for ' + ticker + ' and interpret the chart pattern:\n\n' + signalData;

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
        max_tokens: 800,
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

    // Try each model in the chain. For each, do one retry on transient 5xx
    // before moving on to the next model.
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
      // Only fall through to next model on upstream 5xx; client errors
      // (4xx) indicate a bad request and won't be fixed by another model.
      if (lastStatus < 500 || lastStatus >= 600) break;
    }

    if (!response || !response.ok) {
      var upstreamErr = null;
      try {
        var errJson = JSON.parse(lastErrText);
        if (errJson && errJson.error) {
          upstreamErr = (errJson.error.type || '') + ': ' + (errJson.error.message || '');
        }
      } catch (e) { /* non-JSON body; fall through */ }
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(502).json({
        error: 'AI service error (' + lastStatus + ')'
          + (upstreamErr ? ': ' + upstreamErr.slice(0, 240) : '')
      });
    }

    var data = await response.json();
    var text = data.content && data.content[0] ? data.content[0].text : 'No interpretation generated.';

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ interpretation: text, ticker: ticker, model: modelUsed });
  } catch (err) {
    console.error('Interpret error:', err);
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
};
