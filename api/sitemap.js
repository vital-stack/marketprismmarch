module.exports = async (req, res) => {
  try {
    const supabaseUrl  = process.env.SUPABASE_URL  || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';
    const siteUrl = 'https://marketprism.co';

    // Static pages
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/blog', priority: '0.9', changefreq: 'daily' },
      { loc: '/dashboard', priority: '0.8', changefreq: 'daily' },
      { loc: '/methodology', priority: '0.6', changefreq: 'monthly' },
    ];

    let blogEntries = [];

    if (supabaseUrl && supabaseAnon) {
      try {
        const apiUrl = `${supabaseUrl}/rest/v1/blog_posts`
          + `?status=eq.published`
          + `&select=slug,published_at`
          + `&order=published_at.desc`
          + `&limit=500`;

        const response = await fetch(apiUrl, {
          headers: {
            'apikey': supabaseAnon,
            'Authorization': `Bearer ${supabaseAnon}`,
          },
        });

        if (response.ok) {
          blogEntries = await response.json();
        }
      } catch (fetchErr) {
        console.error('[sitemap] Supabase fetch failed:', fetchErr.message);
      }
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${siteUrl}${page.loc}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    // Blog posts
    for (const post of blogEntries) {
      const lastmod = post.published_at
        ? new Date(post.published_at).toISOString().split('T')[0]
        : '';
      xml += '  <url>\n';
      xml += `    <loc>${siteUrl}/blog/${post.slug}</loc>\n`;
      if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>\n';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).send('Sitemap error: ' + err.message);
  }
};
