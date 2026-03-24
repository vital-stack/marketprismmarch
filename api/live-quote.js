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

    // Use Polygon snapshot endpoint for latest price data
    const upstream = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`;
    const upstreamRes = await fetch(upstream);
    const body = await upstreamRes.text();

    if (!upstreamRes.ok) {
      // Fallback: try previous close from aggs endpoint
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const fallbackUrl = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${weekAgo}/${today}?adjusted=true&sort=desc&limit=2&apiKey=${encodeURIComponent(apiKey)}`;
      const fbRes = await fetch(fallbackUrl);
      if (fbRes.ok) {
        const fbJson = JSON.parse(await fbRes.text());
        const results = fbJson.results || [];
        if (results.length >= 1) {
          const latest = results[0];
          const prev = results[1] || results[0];
          const change = latest.c - prev.c;
          const changePct = prev.c ? (change / prev.c) * 100 : 0;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
          res.statusCode = 200;
          res.end(JSON.stringify({
            ticker,
            price: latest.c,
            change: Number(change.toFixed(2)),
            changePct: Number(changePct.toFixed(2)),
            high: latest.h,
            low: latest.l,
            open: latest.o,
            volume: latest.v,
            timestamp: latest.t,
            source: 'aggs_fallback'
          }));
          return;
        }
      }
      res.statusCode = upstreamRes.status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: body.slice(0, 300) }));
      return;
    }

    const json = JSON.parse(body);
    const snap = json.ticker || {};
    const day = snap.day || {};
    const prevDay = snap.prevDay || {};
    const lastTrade = snap.lastTrade || {};
    const lastQuote = snap.lastQuote || {};

    const price = lastTrade.p || day.c || prevDay.c || null;
    const prevClose = prevDay.c || null;
    const change = price && prevClose ? Number((price - prevClose).toFixed(2)) : null;
    const changePct = price && prevClose ? Number(((price - prevClose) / prevClose * 100).toFixed(2)) : null;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    res.statusCode = 200;
    res.end(JSON.stringify({
      ticker,
      price,
      change,
      changePct,
      high: day.h || null,
      low: day.l || null,
      open: day.o || null,
      volume: day.v || null,
      prevClose,
      bid: lastQuote.p || null,
      ask: lastQuote.P || null,
      timestamp: lastTrade.t || snap.updated || null,
      source: 'snapshot'
    }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
