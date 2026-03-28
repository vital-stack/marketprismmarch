const { renderSEOPage } = require('../lib/seoPageRenderer');

module.exports = async (req, res) => {
  try {
    const ticker = extractTicker(req);
    if (!ticker) {
      res.status(404).send('Ticker not found in URL');
      return;
    }
    await renderSEOPage({ ticker, pageType: 'should-buy' }, req, res);
  } catch (err) {
    res.status(500).send('SEO page error: ' + err.message);
  }
};

function extractTicker(req) {
  if (req.query && req.query.ticker) {
    return req.query.ticker.replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
  }
  if (req.headers && req.headers['x-now-route-matches']) {
    try {
      const matches = decodeURIComponent(req.headers['x-now-route-matches']);
      const m = matches.match(/ticker=([^&]+)/);
      if (m) return decodeURIComponent(m[1]).replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
    } catch (_) {}
  }
  const path = (req.url || '').split('?')[0];
  const match = path.match(/should-i-buy-([a-z0-9.\-]+)/i);
  if (match) return match[1].replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
  return '';
}
