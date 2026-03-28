module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const ticker = (url.searchParams.get('ticker') || '').replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    const apiKey = process.env.MASSIVE_API_KEY || process.env.MASSIVE_API || process.env.POLYGON_API_KEY || '';

    if (!ticker) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Missing ticker' }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'API key not configured' }));
      return;
    }

    const tradesUrl = `https://api.polygon.io/v3/trades/${encodeURIComponent(ticker)}?order=desc&limit=${limit}&sort=sip_timestamp&apiKey=${encodeURIComponent(apiKey)}`;
    const tradesRes = await fetch(tradesUrl);

    if (!tradesRes.ok) {
      const body = await tradesRes.text().catch(() => '');
      res.statusCode = tradesRes.status === 403 ? 403 : 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Trades unavailable', status: tradesRes.status, detail: body.slice(0, 200) }));
      return;
    }

    const json = JSON.parse(await tradesRes.text());
    const results = (json.results || []).map(t => ({
      price: t.price,
      size: t.size,
      exchange: t.exchange,
      timestamp: t.sip_timestamp,
      conditions: t.conditions || [],
      tape: t.tape
    }));

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=15');
    res.statusCode = 200;
    res.end(JSON.stringify({ ticker, results }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
