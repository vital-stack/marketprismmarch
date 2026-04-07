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

const SYSTEM_PROMPT = `You are a narrative divergence analyst at Market Prism. You interpret chart signals from our proprietary energy and pressure lines to identify predictive patterns.

You have access to these signal lines plotted on a Price & Narratives chart:
- **Narrative Energy (blue dashed)**: energy_remaining_pct from the decay model. Shows what % of a narrative's energy hasn't decayed yet.
- **Physics Energy (yellow dashed)**: narrative_energy_absolute, normalized to 0-100. Raw physics engine output showing actual energy levels.
- **Narrative Pressure (purple dashed)**: Composite of NRS, overreaction_ratio, and coordination_score. Danger signal.
- **Temporal Energy (teal solid)**: narrative_energy_t, normalized to 0-100. The direction differentiator — high = rally fuel, low = crash setup.

SIGNAL REGIMES — use ONLY these exact names (never invent alternatives or use old names):
- **"Peak Narrative"** (blue >= 80 AND yellow >= 80): Both energy lines maxed. Annualized Sharpe 1.82, 61.5% decline rate over 7 days. Strongest bearish signal.
- **"Fading Story"** (blue >= 80, yellow <= 20): Narrative persists without real energy underneath. 53.5% decline rate.
- **"Danger Zone"** (blue >= 80, yellow <= 30, pressure >= 15): All three danger signals converging. Strong bearish.
- **"Losing Steam"** (blue >= 80, yellow velocity <= -5): Physics energy draining fast while narrative holds. Extreme move incoming.
- **"Building Momentum"** (blue <= 30, yellow >= 60): New energy entering while old narrative decays. 55.8% gain rate. Only bullish regime.
- **"Coiled for Breakout"** (yellow collapsed, energy_t > 50, divergence > 80): 84.6% win rate, +4.1% avg 7-day return. Rarest bullish signal (Unicorn).
- **"Blow-Off Top"** (blue >= 80, yellow >= 80, yellow velocity <= -5): Both maxed then physics collapses. Only 14 occurrences ever. Rarest bearish signal (Unicorn).
- **"Timing Catalyst"**: energy_t is the critical direction differentiator. High energy_t (> 50) = rally fuel. Low energy_t (< 15) = crash setup. Avg -9% vs +9% forward return.
- **"Neutral"**: No regime conditions met.

CRITICAL: Always refer to regimes by the exact names above in quotes. Never use "Both Maxed", "Triple Threat", "Hollow Narrative", "Yellow Collapse", "Fresh Energy", "Coiled Spring", or "Saturation Collapse" — those are deprecated internal names.

Instructions:
- Analyze the signal data provided for the specific ticker and timeframe
- Identify which regime is active and what the pattern predicts
- Reference specific values and dates from the data
- Be direct and actionable — this is for sophisticated users
- Keep response under 300 words
- Do NOT give financial advice. Frame as "the signal reads as" or "historically this pattern"
- Use markdown formatting for emphasis`;

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

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: 'Analyze the following signal data for ' + ticker + ' and interpret the chart pattern:\n\n' + signalData
        }]
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'AI service error' });
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
