// Batch live quotes via Polygon snapshot endpoint.
// Accepts ?tickers=AAPL,NVDA,TSM and returns a map of
// {AAPL: {price, change, changePct, source}, ...}.
// Uses Polygon's filtered snapshot call so one HTTP request covers
// every ticker on the Daily Brief page.

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const raw = (url.searchParams.get('tickers') || '').trim();
    const apiKey = process.env.MASSIVE_API_KEY || process.env.MASSIVE_API || process.env.POLYGON_API_KEY || '';

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!raw) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing tickers query param (comma-separated)' }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'API key not configured' }));
      return;
    }

    // Sanitize + dedupe tickers
    const tickers = Array.from(new Set(
      raw.split(',')
        .map(t => t.replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase())
        .filter(Boolean)
    ));

    if (!tickers.length) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'No valid tickers after sanitization' }));
      return;
    }

    // Polygon caps the tickers query param; chunk to 100 per request to be safe.
    const chunks = [];
    for (let i = 0; i < tickers.length; i += 100) {
      chunks.push(tickers.slice(i, i + 100));
    }

    const quotes = {};
    let anySuccess = false;

    for (const chunk of chunks) {
      try {
        const snapUrl = 'https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers'
          + '?tickers=' + encodeURIComponent(chunk.join(','))
          + '&apiKey=' + encodeURIComponent(apiKey);
        const snapRes = await fetch(snapUrl);
        if (!snapRes.ok) continue;
        const json = JSON.parse(await snapRes.text());
        const rows = json.tickers || [];
        for (const t of rows) {
          const ticker = t.ticker;
          if (!ticker) continue;
          const day = t.day || {};
          const prevDay = t.prevDay || {};
          const lastTrade = t.lastTrade || {};
          const price = lastTrade.p || day.c || prevDay.c;
          if (!price) continue;
          const prevClose = prevDay.c || null;
          quotes[ticker] = {
            price: Number(price),
            change: prevClose ? Number((price - prevClose).toFixed(2)) : null,
            changePct: prevClose ? Number(((price - prevClose) / prevClose * 100).toFixed(2)) : null,
            prevClose: prevClose ? Number(prevClose) : null,
            dayHigh: day.h ? Number(day.h) : null,
            dayLow: day.l ? Number(day.l) : null,
            source: lastTrade.p ? 'snapshot_live' : 'snapshot_close'
          };
          anySuccess = true;
        }
      } catch (_) {
        // Swallow per-chunk errors so a single bad chunk doesn't block the rest.
      }
    }

    // Short edge cache so concurrent viewers share one upstream call.
    // 15s fresh + 60s stale-while-revalidate keeps Polygon load sane while
    // still giving every viewer near-live prices.
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
    res.statusCode = 200;
    res.end(JSON.stringify({
      quotes,
      count: Object.keys(quotes).length,
      requested: tickers.length,
      ok: anySuccess,
      updated: new Date().toISOString()
    }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
