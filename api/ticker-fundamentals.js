const rateLimit = require('./_rate-limit');

module.exports = async (req, res) => {
  if (!rateLimit(req, res, 'ticker-fundamentals', 60)) return;
  try {
    const url = new URL(req.url, 'http://localhost');
    const ticker = (url.searchParams.get('ticker') || '').replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '25', 10), 50);
    const formType = url.searchParams.get('form_type') || '';
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

    let fetchUrl = `https://api.polygon.io/stocks/filings/vX/index?ticker=${encodeURIComponent(ticker)}&limit=${limit}&sort=filing_date.desc&apiKey=${encodeURIComponent(apiKey)}`;
    if (formType) {
      fetchUrl += `&form_type.any_of=${encodeURIComponent(formType)}`;
    }

    const apiRes = await fetch(fetchUrl);

    if (!apiRes.ok) {
      const body = await apiRes.text().catch(() => '');
      res.statusCode = apiRes.status === 403 ? 403 : 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'SEC filings data unavailable', status: apiRes.status, detail: body.slice(0, 300) }));
      return;
    }

    const json = JSON.parse(await apiRes.text());
    const results = (json.results || []).map(r => ({
      accession_number: r.accession_number,
      cik: r.cik,
      filing_date: r.filing_date,
      filing_url: r.filing_url,
      form_type: r.form_type,
      issuer_name: r.issuer_name,
      ticker: r.ticker
    }));

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.statusCode = 200;
    res.end(JSON.stringify({ ticker, results }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
  }
};
