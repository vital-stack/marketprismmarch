module.exports = (req, res) => {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    'Sitemap: https://marketprism.co/sitemap.xml',
    '',
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  res.status(200).send(body);
};
