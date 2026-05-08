const rateLimit = require('./_rate-limit');

module.exports = async (req, res) => {
  if (!rateLimit(req, res, 'live-quote', 120)) return;
  try {
    const url = new URL(req.url, 'http://localhost');
    const ticker = (url.searchParams.get('ticker') || '').replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
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

    // Strategy: try endpoints in order of plan compatibility
    // 1. Snapshot (paid plans) — real-time
    // 2. Last trade (most plans) — real-time
    // 3. Previous day aggs (free tier) — end-of-day

    let result = null;

    // ── Try 1: Snapshot (best data, requires Stocks Starter+) ──
    try {
      const snapUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`;
      const snapRes = await fetch(snapUrl);
      if (snapRes.ok) {
        const json = JSON.parse(await snapRes.text());
        const snap = json.ticker || {};
        const day = snap.day || {};
        const prevDay = snap.prevDay || {};
        const lastTrade = snap.lastTrade || {};
        const lastQuote = snap.lastQuote || {};
        const price = lastTrade.p || day.c || prevDay.c;
        if (price) {
          const prevClose = prevDay.c || null;
          const regularClose = day.c || null;
          // After-hours: if lastTrade price differs from day close, it's an extended-hours trade
          const ahPrice = (lastTrade.p && regularClose && Math.abs(lastTrade.p - regularClose) > 0.005) ? lastTrade.p : null;
          result = {
            ticker,
            price,
            change: prevClose ? Number((price - prevClose).toFixed(2)) : null,
            changePct: prevClose ? Number(((price - prevClose) / prevClose * 100).toFixed(2)) : null,
            high: day.h || null,
            low: day.l || null,
            open: day.o || null,
            volume: day.v || null,
            prevClose,
            bid: lastQuote.p || null,
            ask: lastQuote.P || null,
            afterHours: ahPrice,
            ahChange: (ahPrice && regularClose) ? Number((ahPrice - regularClose).toFixed(2)) : null,
            ahChangePct: (ahPrice && regularClose) ? Number(((ahPrice - regularClose) / regularClose * 100).toFixed(2)) : null,
            timestamp: lastTrade.t || snap.updated || null,
            source: 'snapshot'
          };
        }
      }
    } catch (_) {}

    // ── Try 2: Last trade + previous close (free tier compatible) ──
    if (!result) {
      try {
        const [tradeRes, prevRes] = await Promise.all([
          fetch(`https://api.polygon.io/v2/last/trade/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`),
          fetch(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${encodeURIComponent(apiKey)}`)
        ]);

        let tradePrice = null, tradeTs = null;
        if (tradeRes.ok) {
          const tradeJson = JSON.parse(await tradeRes.text());
          const lr = tradeJson.results || tradeJson.last || {};
          tradePrice = lr.p || lr.price || null;
          tradeTs = lr.t || lr.sip_timestamp || null;
        }

        let prevClose = null, prevHigh = null, prevLow = null, prevOpen = null, prevVol = null;
        if (prevRes.ok) {
          const prevJson = JSON.parse(await prevRes.text());
          const pr = (prevJson.results || [])[0] || {};
          prevClose = pr.c || null;
          prevHigh = pr.h || null;
          prevLow = pr.l || null;
          prevOpen = pr.o || null;
          prevVol = pr.v || null;
        }

        const price = tradePrice || prevClose;
        if (price) {
          result = {
            ticker,
            price,
            change: prevClose ? Number((price - prevClose).toFixed(2)) : null,
            changePct: prevClose ? Number(((price - prevClose) / prevClose * 100).toFixed(2)) : null,
            high: prevHigh,
            low: prevLow,
            open: prevOpen,
            volume: prevVol,
            prevClose,
            timestamp: tradeTs,
            source: tradePrice ? 'last_trade' : 'prev_close'
          };
        }
      } catch (_) {}
    }

    // ── Try 3: Daily aggs for last 7 days (ultimate fallback) ──
    if (!result) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const aggsUrl = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${weekAgo}/${today}?adjusted=true&sort=desc&limit=2&apiKey=${encodeURIComponent(apiKey)}`;
        const aggsRes = await fetch(aggsUrl);
        if (aggsRes.ok) {
          const aggsJson = JSON.parse(await aggsRes.text());
          const results = aggsJson.results || [];
          if (results.length >= 1) {
            const latest = results[0];
            const prev = results[1] || results[0];
            const change = latest.c - prev.c;
            result = {
              ticker,
              price: latest.c,
              change: Number(change.toFixed(2)),
              changePct: prev.c ? Number((change / prev.c * 100).toFixed(2)) : null,
              high: latest.h,
              low: latest.l,
              open: latest.o,
              volume: latest.v,
              prevClose: prev.c,
              timestamp: latest.t,
              source: 'daily_aggs'
            };
          }
        }
      } catch (_) {}
    }

    if (!result) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'No price data available for ' + ticker }));
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', result.source === 'snapshot' ? 's-maxage=15, stale-while-revalidate=60' : 's-maxage=60, stale-while-revalidate=300');
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
