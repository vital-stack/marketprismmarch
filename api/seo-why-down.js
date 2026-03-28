const { renderSEOPage } = require('../lib/seoPageRenderer');

module.exports = async (req, res) => {
  try {
    const ticker = extractTicker(req, 'why-is-', '-stock-down');
    if (!ticker) {
      res.status(404).send('Ticker not found in URL');
      return;
    }
    await renderSEOPage({ ticker, pageType: 'why-down' }, req, res);
  } catch (err) {
    res.status(500).send('SEO page error: ' + err.message);
  }
};

function extractTicker(req, prefix, suffix) {
  // Try query param first (Vercel rewrite)
  if (req.query && req.query.ticker) {
    return req.query.ticker.replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
  }
  // Parse from x-now-route-matches
  if (req.headers && req.headers['x-now-route-matches']) {
    try {
      const matches = decodeURIComponent(req.headers['x-now-route-matches']);
      const m = matches.match(/ticker=([^&]+)/);
      if (m) return decodeURIComponent(m[1]).replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
    } catch (_) {}
  }
  // Parse from URL path
  const path = (req.url || '').split('?')[0];
  const match = path.match(/why-is-([a-z0-9.\-]+)-stock-down/i);
  if (match) return match[1].replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
  return '';
}
