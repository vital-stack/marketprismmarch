module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const ticker = (url.searchParams.get('ticker') || '').replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
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
      res.end(JSON.stringify({ error: 'API key not configured' }));
      return;
    }

    const snapUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`;
    const snapRes = await fetch(snapUrl);

    if (!snapRes.ok) {
      const body = await snapRes.text().catch(() => '');
      res.statusCode = snapRes.status === 403 ? 403 : 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Snapshot unavailable', status: snapRes.status, detail: body.slice(0, 200) }));
      return;
    }

    const json = JSON.parse(await snapRes.text());
    const snap = json.ticker || {};

    const result = {
      ticker: snap.ticker || ticker,
      day: snap.day || {},
      prevDay: snap.prevDay || {},
      lastTrade: snap.lastTrade || {},
      lastQuote: snap.lastQuote || {},
      min: snap.min || {},
      todaysChange: snap.todaysChange || null,
      todaysChangePerc: snap.todaysChangePerc || null,
      updated: snap.updated || null,
      fmv: snap.fmv || null
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
