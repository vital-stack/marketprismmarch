async function fetchLivePrice(ticker, apiKey) {
  try {
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`;
    const snapshotRes = await fetch(snapshotUrl);
    if (snapshotRes.ok) {
      const snapshotJson = JSON.parse(await snapshotRes.text());
      const snap = snapshotJson.ticker || {};
      const day = snap.day || {};
      const prevDay = snap.prevDay || {};
      const lastTrade = snap.lastTrade || {};
      const price = Number(lastTrade.p || day.c || prevDay.c || 0);
      if (price) return price;
    }
  } catch (_) {}

  try {
    const tradeUrl = `https://api.polygon.io/v2/last/trade/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`;
    const tradeRes = await fetch(tradeUrl);
    if (tradeRes.ok) {
      const tradeJson = JSON.parse(await tradeRes.text());
      const trade = tradeJson.results || tradeJson.last || {};
      const price = Number(trade.p || trade.price || 0);
      if (price) return price;
    }
  } catch (_) {}

  return null;
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const ticker = (url.searchParams.get('ticker') || '').replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
    const daysRaw = parseInt(url.searchParams.get('days') || '730', 10);
    const days = Math.max(30, Math.min(Number.isFinite(daysRaw) ? daysRaw : 730, 3650));
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
    const livePrice = await fetchLivePrice(ticker, apiKey);
    const today = new Date().toISOString().slice(0, 10);

    if (livePrice) {
      const latest = series[series.length - 1];
      if (latest && latest.snapshot_date === today) {
        latest.price_close = Number(livePrice);
      } else {
        series.push({
          snapshot_date: today,
          price_close: Number(livePrice),
        });
      }
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', livePrice ? 's-maxage=60, stale-while-revalidate=300' : 's-maxage=300, stale-while-revalidate=86400');
    res.statusCode = 200;
    res.end(JSON.stringify({ ticker, series }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
