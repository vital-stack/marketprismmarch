module.exports = (req, res) => {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Protected app pages — require authentication',
    'Disallow: /dashboard',
    'Disallow: /dashboard-dev',
    'Disallow: /ticker/',
    'Disallow: /ticker-dev/',
    'Disallow: /daily',
    'Disallow: /heatmap',
    'Disallow: /scorer-dev',
    'Disallow: /signalstudies',
    'Disallow: /stockpsycho',
    'Disallow: /signal-charts',
    'Disallow: /search',
    '',
    'Sitemap: https://marketprism.co/sitemap.xml',
    'Sitemap: https://marketprism.co/news-sitemap.xml',
    '',
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  res.status(200).send(body);
};
