module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const ticker = (url.searchParams.get('ticker') || '').replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
    const sync = url.searchParams.get('sync') === 'true';
    const bulk = url.searchParams.get('bulk') === 'true';
    const apiKey = process.env.MASSIVE_API_KEY || process.env.MASSIVE_API || process.env.POLYGON_API_KEY || '';
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON || '';

    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'API key not configured' }));
    }

    // ── BULK SYNC MODE: fetch all tickers missing from ticker_industry_lookup ──
    if (bulk) {
      if (!supabaseUrl || !supabaseKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: 'Supabase credentials not configured' }));
      }

      // Get all tickers in the system
      const allTickersRes = await fetch(
        supabaseUrl + '/rest/v1/rpc/get_all_tickers',
        { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' },
          method: 'POST', body: '{}' }
      ).catch(() => null);

      // Fallback: query ticker_sector_inference + ticker_industry_lookup
      let allTickers = [];
      if (allTickersRes && allTickersRes.ok) {
        allTickers = await allTickersRes.json();
      } else {
        const [tsiRes, tilRes] = await Promise.all([
          fetch(supabaseUrl + '/rest/v1/ticker_sector_inference?select=ticker', { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } }),
          fetch(supabaseUrl + '/rest/v1/ticker_industry_lookup?select=ticker', { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } })
        ]);
        const tsiRows = tsiRes.ok ? await tsiRes.json() : [];
        const tilRows = tilRes.ok ? await tilRes.json() : [];
        const seen = new Set();
        tsiRows.concat(tilRows).forEach(r => { if (r.ticker && !seen.has(r.ticker)) { seen.add(r.ticker); allTickers.push(r.ticker); } });
      }

      // Filter to tickers missing description (need enrichment)
      const existingRes = await fetch(
        supabaseUrl + '/rest/v1/ticker_industry_lookup?select=ticker&description=not.is.null',
        { headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey } }
      ).catch(() => null);
      const existing = new Set();
      if (existingRes && existingRes.ok) {
        (await existingRes.json()).forEach(r => existing.add(r.ticker));
      }
      const tickers = (Array.isArray(allTickers) ? allTickers : [])
        .map(t => typeof t === 'string' ? t : t.ticker)
        .filter(t => t && !existing.has(t) && !t.includes(' '));

      // Skip ETFs and indices that Polygon won't have reference data for
      const skipList = new Set(['SPY','QQQ','IWM','XLE','XLF','XLI','XLK','XLV','GLD','TLT']);
      const toFetch = tickers.filter(t => !skipList.has(t));

      let synced = 0, failed = 0, errors = [];

      // Process in batches of 5 with 1.2s delay between batches (respect rate limits)
      for (let i = 0; i < toFetch.length; i += 5) {
        const batch = toFetch.slice(i, i + 5);
        const results = await Promise.all(batch.map(async (t) => {
          try {
            const detailUrl = `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(t)}?apiKey=${encodeURIComponent(apiKey)}`;
            const dRes = await fetch(detailUrl);
            if (!dRes.ok) return { ticker: t, error: dRes.status };
            const dJson = JSON.parse(await dRes.text());
            const r = dJson.results || {};
            return {
              ticker: r.ticker || t,
              name: r.name || null,
              sector: r.sector || null,
              industry: r.sic_description || null,
              sic_code: r.sic_code || null,
              description: r.description || null,
              homepage: r.homepage_url || null,
              total_employees: r.total_employees || null,
              market_cap: r.market_cap || null,
              updated_at: new Date().toISOString()
            };
          } catch (e) { return { ticker: t, error: e.message }; }
        }));

        // Upsert successful results
        const good = results.filter(r => !r.error);
        const bad = results.filter(r => r.error);
        bad.forEach(b => { failed++; errors.push(b.ticker + ':' + b.error); });

        if (good.length) {
          const upsertRes = await fetch(
            supabaseUrl + '/rest/v1/ticker_industry_lookup?on_conflict=ticker',
            {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': 'Bearer ' + supabaseKey,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
              },
              body: JSON.stringify(good)
            }
          );
          if (upsertRes.ok || upsertRes.status === 201) {
            synced += good.length;
          } else {
            const errBody = await upsertRes.text().catch(() => '');
            good.forEach(g => { failed++; errors.push(g.ticker + ':upsert-' + upsertRes.status); });
          }
        }

        // Rate limit delay between batches
        if (i + 5 < toFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.statusCode = 200;
      return res.end(JSON.stringify({ synced, failed, total: toFetch.length, skipped: existing.size, errors: errors.slice(0, 20) }));
    }

    // ── SINGLE TICKER MODE ──
    if (!ticker) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Missing ticker' }));
    }

    const detailUrl = `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`;
    const detailRes = await fetch(detailUrl);
    if (!detailRes.ok) {
      res.statusCode = detailRes.status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Polygon API error: ' + detailRes.status }));
    }

    const json = JSON.parse(await detailRes.text());
    const r = json.results || {};

    const result = {
      ticker: r.ticker || ticker,
      name: r.name || null,
      description: r.description || null,
      sector: r.sector || null,
      industry: r.sic_description || null,
      sic_code: r.sic_code || null,
      market_cap: r.market_cap || null,
      locale: r.locale || null,
      type: r.type || null,
      homepage: r.homepage_url || null,
      logo: r.branding && r.branding.icon_url ? r.branding.icon_url + '?apiKey=' + apiKey : null,
      list_date: r.list_date || null,
      total_employees: r.total_employees || null,
      share_class_shares_outstanding: r.share_class_shares_outstanding || null,
      weighted_shares_outstanding: r.weighted_shares_outstanding || null,
    };

    // ── Optionally upsert to Supabase ──
    if (sync && supabaseUrl && supabaseKey) {
      const row = {
        ticker: result.ticker,
        name: result.name,
        sector: result.sector,
        industry: result.industry,
        sic_code: result.sic_code,
        description: result.description,
        homepage: result.homepage,
        total_employees: result.total_employees,
        market_cap: result.market_cap,
        updated_at: new Date().toISOString()
      };
      await fetch(
        supabaseUrl + '/rest/v1/ticker_industry_lookup?on_conflict=ticker',
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey,
            'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify([row])
        }
      ).catch(() => {});
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
