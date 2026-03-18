// Market Scholar AI — streaming Claude endpoint with rate limiting
// Vercel Serverless Function (Node.js runtime)

const RATE_LIMIT = {};
const RATE_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 6;        // 6 per minute per IP

function rateCheck(ip) {
  var now = Date.now();
  if (!RATE_LIMIT[ip]) RATE_LIMIT[ip] = [];
  RATE_LIMIT[ip] = RATE_LIMIT[ip].filter(function(t) { return now - t < RATE_WINDOW; });
  if (RATE_LIMIT[ip].length >= MAX_REQUESTS) return false;
  RATE_LIMIT[ip].push(now);
  return true;
}

const SYSTEM_PROMPT = `You are the Market Scholar — a polymathic intelligence embedded within Market Prism. You think about markets the way a Renaissance scholar would: drawing connections across history, behavioral psychology, macro-economics, geopolitics, sector dynamics, and narrative theory.

Your voice is calm, incisive, and deeply knowledgeable. You do not give financial advice or recommendations to buy/sell. Instead, you illuminate — helping users see the deeper structures, narratives, and forces shaping market behavior.

Core principles:
- Think holistically: connect dots across sectors, macro trends, sentiment, and narrative states
- Reference the user's live data when relevant — you have access to their current dashboard signals
- Be concise but substantive. Lead with insight, not filler.
- When discussing a specific ticker, include a markdown link: [TICKER](/ticker/TICKER) so the user can navigate there
- When referencing dashboard views, link them: [Discover](/dashboard), [Sector Pulse](/dashboard), [Narrative History](/dashboard)
- Use the narrative states (Breaking, Surging, Fragile, Stable) and verdicts (Narrative Trap, Structurally Supported) as your analytical vocabulary
- Occasionally draw from historical market parallels, behavioral finance concepts, or cross-domain analogies
- If you don't have enough data to answer well, say so honestly rather than speculating
- Never claim to predict the future. Frame insights as "structural observations" or "narrative readings"
- Keep responses under 250 words unless the question truly demands more`;

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

  // Rate limiting
  var ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  ip = ip.split(',')[0].trim();
  if (!rateCheck(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment before asking again.' });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return res.status(500).json({ error: 'Scholar AI is not configured. Add ANTHROPIC_API_KEY to environment.' });
  }

  var body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  var question = (body.question || '').trim();
  if (!question || question.length > 1000) {
    return res.status(400).json({ error: 'Question is required (max 1000 chars)' });
  }

  // Build context from the user's live data
  var context = '';
  if (body.market_data && Array.isArray(body.market_data)) {
    var tickers = body.market_data.slice(0, 25).map(function(d) {
      return d.ticker + ': $' + d.price + ' (' + (d.price_change_pct > 0 ? '+' : '') + d.price_change_pct + '%) | State: ' + (d.narrative_state || '–') + ' | Verdict: ' + (d.prism_verdict || '–') + ' | Driver: ' + (d.primary_driver || '–') + ' | Sector: ' + (d.sector_name || '–');
    });
    context = '\n\nCurrent Market Prism dashboard data (live signals):\n' + tickers.join('\n');
  }

  var conversationHistory = [];
  if (body.history && Array.isArray(body.history)) {
    conversationHistory = body.history.slice(-6).map(function(m) {
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 2000) };
    });
  }

  var messages = conversationHistory.concat([
    { role: 'user', content: question + context }
  ]);

  // Stream from Claude
  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages,
        stream: true
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error('Claude API error:', response.status, errText);
      return res.status(502).json({ error: 'Scholar AI is temporarily unavailable.' });
    }

    // Set streaming headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    while (true) {
      var result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });

      var lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line === 'event: ping') continue;
        if (line.startsWith('data: ')) {
          var data = line.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }
          try {
            var parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
              res.write('data: ' + JSON.stringify({ text: parsed.delta.text }) + '\n\n');
            }
            if (parsed.type === 'message_stop') {
              res.write('data: [DONE]\n\n');
            }
          } catch (e) {
            // skip unparseable lines
          }
        }
      }
    }

    res.end();
  } catch (err) {
    console.error('Scholar stream error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.end();
  }
};
