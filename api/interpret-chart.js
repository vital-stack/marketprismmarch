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

const SYSTEM_PROMPT = `You are the Market Prism signal interpreter. You analyze narrative forensic signals for a specific stock and produce a structured, easy-to-read interpretation. Use short numbered or bulleted sections with clear headers. Keep the full response under 200 words. Do not use markdown bold or em-dashes. No generic disclaimers. Be specific to this ticker. Write for a reader who has NOT memorized the signal system — lead with plain-English meaning, then the number.

THE CHART SHOWS THREE ELEMENTS:
1. Narrative Force (teal line, 0-100): Combined signal = (Physics Energy x 0.6) + ((100 - Energy Remaining) x 0.4). When this line rises, narrative momentum is building — new coverage is arriving while old stories decay. When it falls, force is absent or exhausted.
2. Risk Pressure (orange-red line, 0-100): NRS-weighted composite of coordination score, overreaction ratio, and narrative risk. When this crosses above 20, forensic risk is elevated. Stays low most of the time, spikes when real risk is detected.
3. Mass Dots (on price line): Size = narrative mass (institutional coverage volume). Color = WKS keyword sentiment (green = historically bullish keywords, red = bearish, gray = neutral).

THE FOUR REGIMES — determined by Narrative Force, Risk Pressure, and Energy Remaining (Blue):
- Building (green): Force > 60, Risk < 20. Narrative momentum accelerating cleanly. Strongest bullish signal.
- Recovering (light green): Force < 30, Blue < 50. Old narrative dying, nothing holding price down. Price typically recovers.
- Pressure (red): Force > 40, Risk > 20. Forensic risk detected alongside active narratives. Bearish regime.
- Fading (orange): Force < 40, Blue > 80. Entrenched story with no force behind it. Price grinds down.
- Neutral: No strong directional signal. Default state.

OUTPUT FORMAT — always use this structure:
1. Current Regime: [One plain-English sentence naming the regime and what it means for this ticker. Example: "MSFT is in Pressure — narrative force is present but forensic risk is elevated."]
2. Key Readings: [2-3 bullet points explaining what the current Narrative Force, Risk Pressure, and Mass Dot signals mean in plain English. Lead with the meaning, then the number.]
3. Regime Outlook: [State whether the regime is likely to hold, shift, or is at a threshold. Name the specific numeric move that would change the regime — for example "Force falling below 40 would shift to Fading" or "Risk dropping below 20 would upgrade to Building".]
4. Entry Zone: [Only include this section if an IDEAL ENTRY ZONE block is present in the data. State the historical best drawdown zone, avg return, sample size, and whether the current price is in that zone. Two sentences max.]
5. What to Watch: [One sentence on the key thing to monitor — a specific level on Force or Risk, a mass dot pattern, or a headline trend.]

RULES:
- Reference 1-2 specific headlines from narrative data if provided.
- Reference mass dot patterns (size and color trends) if WKS data is provided.
- Do not reference old signal names (Blue, Yellow, Teal, Purple, Physics Energy, Temporal Energy, Narrative Pressure, Peak Narrative, Danger Zone, Fading Story, Coiled for Breakout, etc). Use only "Narrative Force", "Risk Pressure", "Mass Dots", and the four regime names (Building, Recovering, Pressure, Fading, Neutral).
- Only cite Entry Zone data if an "IDEAL ENTRY ZONE" block appears in the input. If missing, omit section 4.
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
