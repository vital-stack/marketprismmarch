module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const ticker = (url.searchParams.get('ticker') || '').replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
    const daysRaw = parseInt(url.searchParams.get('days') || '730', 10);
    const days = Math.max(30, Math.min(Number.isFinite(daysRaw) ? daysRaw : 730, 3650));
    const apiKey = process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY || '';

    if (!ticker) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Missing ticker' }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'MASSIVE_API_KEY not configured' }));
      return;
    }

    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - days);

    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    const upstream = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${encodeURIComponent(apiKey)}`;

    const upstreamRes = await fetch(upstream);
    const body = await upstreamRes.text();

    if (!upstreamRes.ok) {
      res.statusCode = upstreamRes.status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: body.slice(0, 300) }));
      return;
    }

    const json = JSON.parse(body);
    const series = Array.isArray(json.results)
      ? json.results.map((row) => ({
          snapshot_date: new Date(row.t).toISOString().slice(0, 10),
          price_close: Number(row.c),
        }))
      : [];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.statusCode = 200;
    res.end(JSON.stringify({ ticker, series }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
