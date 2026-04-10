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

const SYSTEM_PROMPT = `You are the Market Prism signal interpreter. You analyze narrative physics signals for a specific stock and produce a structured, easy-to-read interpretation. Use short numbered or bulleted sections with clear headers. Keep the full response under 200 words. Do not use markdown bold or em-dashes. No generic disclaimers. Be specific to this ticker.

THE FOUR ENERGY LINES:
- Narrative Energy (Blue, 0-100%): Story persistence vs its natural half-life. High = narrative outlasting its decay. Low = story fading.
- Physics Energy (Yellow, 0-100): Raw kinetic energy — article volume times velocity for THIS ticker vs its own 90-day history. Focus on direction and level, not cross-ticker rank comparisons.
- Temporal Energy (Teal, 0-100): Cross-ticker universe percentile rank today. 80 = fresher narrative energy than 80% of all tracked tickers. Above 80 = top quintile. Below 15 = bottom 15th percentile.
- Narrative Pressure (Purple, 0-100): Composite coordination and overreaction risk.

THE VALIDATED SIGNAL LIBRARY — identify which applies and name it:

SHORT SIGNALS (bear/choppy regime):
1. Peak Narrative (SATURATION): Blue >= 80 AND Yellow >= 80. Bear regime only. Closes lower 7 days later in 63% of cases. Annualized Sharpe 2.037 on 926 observations. Without regime gate: Sharpe -1.296 — regime gate is non-negotiable.
2. Danger Zone (TRIPLE_THREAT): Blue >= 80, Yellow <= 30, Pressure >= 15. Sharpe 1.031 on 242 observations, 57.9% lower 7 days later.
3. Fading Story (HOLLOW): Blue >= 80, Yellow <= 20. Sharpe 0.919 on 224 observations, 54.5% lower 7 days later. Story running on fumes.
4. Losing Steam (YELLOW_COLLAPSE): Blue >= 80, Yellow falling > 5 pts in 3 days. Temporal rank is direction resolver — below 15 confirms bearish, above 50 may negate.

LONG SIGNALS:
5. Gap Signal (Physics/Temporal gap >= 90 pts): Wait for gap to collapse below 10 then enter long, hold 10 days. Closes higher 10 days later in 78.8% of cases, avg +3.73%, t=4.39 (p<0.0001) on 66 observations. Do not enter at peak gap — entry is the collapse.
6. Coiled for Breakout (COILED_SPRING): Blue <= 15, Temporal rank > 50, gap > 80 pts. Closes higher 7 days later in 84.6% of cases, avg +4.1% on 39 observations.
7. Building Momentum (FRESH_ENERGY): Blue <= 30, Yellow >= 60. Closes higher 5 days later in 55.8% of cases. Sharpe 1.321 on 43 observations. New energy entering while old narrative decays.
8. Bull Narrative Momentum (BULL regime only, regime-flip tickers): In confirmed bull market, narrative spikes on story-driven mid-cap/growth/biotech/SaaS names produce the OPPOSITE outcome — 76.1% closes higher over 5 days, avg +3.05%, Sharpe 4.592 on 67 observations. Same signal, opposite regime, opposite trade direction.

TEMPORAL ENERGY AS DIRECTION RESOLVER:
When no regime is clearly set, Temporal rank alone is the signal. Rank below 15 = avg -9.06% forward return in backtesting. Rank above 50 = avg +9.17% forward return. This is the single most regime-independent finding in the system.

KEY GAP THRESHOLD FINDINGS:
Gap >= 90: 66.3% win rate. Gap 70-89: 64.5% win rate. Gap 50-69: 28.6% win rate — signal breaks down below 70.

OUTPUT FORMAT — always use this structure:
1. Current Regime: [name the signal regime and direction in one sentence]
2. Key Readings: [3 bullet points — Blue level and meaning, Yellow level and meaning, Temporal rank as percentile]
3. Active Signal: [name the signal, state the validated win rate and hold period as "closes [higher/lower] in X% of cases over Y days"]
4. What to Watch: [one sentence on what would confirm or invalidate the signal]

RULES:
- State win rates as frequency ("closes lower in 63% of cases over 7 days"), never as magnitude ("drops 63%").
- State Temporal Energy as a percentile ("top 8% of the universe today"), never as a raw number.
- Reference 1 to 2 specific headlines from narrative data if provided.
- If the current market regime is BULL and the ticker is a story-driven mid-cap, growth, biotech, or SaaS name, consider Bull Narrative Momentum as the applicable signal — not a short signal.
- If no signal condition is met, say so in the Active Signal field and stop.
- Never use the words: crash, violent, guaranteed, certain, always, never, maximum danger, explosion.
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

  // Pin to a dated Sonnet 4.5 snapshot for production stability. Rolling
  // aliases occasionally route to endpoints returning 500 api_error; dated
  // snapshots are served from the stable production path.
  var requestBody = JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: 'Analyze the following signal data for ' + ticker + ' and interpret the chart pattern:\n\n' + signalData
    }]
  });

  async function callAnthropic() {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: requestBody
    });
  }

  try {
    var response = await callAnthropic();

    // Single automatic retry on transient upstream 5xx (Anthropic "api_error"
    // Internal server error is typically a transient blip that clears on retry).
    if (!response.ok && response.status >= 500 && response.status < 600) {
      await new Promise(function(r){ setTimeout(r, 800); });
      response = await callAnthropic();
    }

    if (!response.ok) {
      var errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      // Surface the upstream status + error type/message so failures are
      // diagnosable from the UI instead of showing a generic "AI service error".
      var upstreamErr = null;
      try {
        var errJson = JSON.parse(errText);
        if (errJson && errJson.error) {
          upstreamErr = (errJson.error.type || '') + ': ' + (errJson.error.message || '');
        }
      } catch (e) { /* non-JSON body; fall through */ }
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(502).json({
        error: 'AI service error (' + response.status + ')'
          + (upstreamErr ? ': ' + upstreamErr.slice(0, 240) : '')
      });
    }

    var data = await response.json();
    var text = data.content && data.content[0] ? data.content[0].text : 'No interpretation generated.';

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ interpretation: text, ticker: ticker });
  } catch (err) {
    console.error('Interpret error:', err);
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
};
