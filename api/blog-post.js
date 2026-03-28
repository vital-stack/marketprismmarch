const resolveTemplate = require('./_resolve-template');

module.exports = async (req, res) => {
  try {
    const supabaseUrl  = process.env.SUPABASE_URL  || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';

    let html = resolveTemplate('_blog_post.html');

    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '' };",
      `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}' };`
    );

    // Extract slug from request path
    const slug = (req.query && req.query.slug)
      || req.url.split('/').filter(Boolean).pop()
      || '';

    // Server-side fetch from Supabase to inject meta tags for crawlers
    if (slug && supabaseUrl && supabaseAnon) {
      try {
        const apiUrl = `${supabaseUrl}/rest/v1/blog_posts`
          + `?slug=eq.${encodeURIComponent(slug)}`
          + `&status=eq.published`
          + `&select=ticker,title,slug,excerpt,body,tag,author,published_at,image_url`
          + `&limit=1`;

        const response = await fetch(apiUrl, {
          headers: {
            'apikey': supabaseAnon,
            'Authorization': `Bearer ${supabaseAnon}`,
          },
        });

        if (response.ok) {
          const posts = await response.json();
          if (posts.length > 0) {
            const post = posts[0];
            const ticker = post.ticker || '';
            const title = post.title || '';
            const excerpt = post.excerpt || '';
            const desc160 = (post.body || excerpt || '').replace(/[#*|\n]+/g, ' ').trim().substring(0, 160);
            const pageUrl = `https://marketprism.co/blog/${post.slug}`;
            const imageUrl = post.image_url || 'https://marketprism.co/og-default.png';
            const author = post.author || 'Market Prism Research';
            const publishedAt = post.published_at || '';
            const tag = post.tag || 'Research';

            // Format date for title: "Mar 28, 2026"
            let dateStr = '';
            if (publishedAt) {
              const d = new Date(publishedAt);
              dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }

            // Dynamic title: [Ticker] Narrative Analysis — [Date] | Market Prism
            const seoTitle = ticker && ticker !== 'MP'
              ? `${ticker} Narrative Analysis \u2014 ${dateStr} | Market Prism`
              : `${title} | Market Prism`;

            // Replace static <title>
            html = html.replace(
              '<title>Market Prism \u2014 Intelligence Journal</title>',
              `<title>${escHtml(seoTitle)}</title>`
            );

            // Replace meta description
            html = html.replace(
              '<meta name="description" content="">',
              `<meta name="description" content="${escAttr(desc160)}">`
            );

            // Replace canonical
            html = html.replace(
              '<link rel="canonical" id="canonical-url" href="https://marketprism.co/blog">',
              `<link rel="canonical" id="canonical-url" href="${escAttr(pageUrl)}">`
            );

            // Replace OG tags
            html = html.replace('content="" id="og-title"', `content="${escAttr(seoTitle)}" id="og-title"`);
            html = html.replace('content="" id="og-desc"', `content="${escAttr(desc160)}" id="og-desc"`);
            html = html.replace('content="" id="og-url"', `content="${escAttr(pageUrl)}" id="og-url"`);
            html = html.replace('content="" id="og-image"', `content="${escAttr(imageUrl)}" id="og-image"`);

            // Replace Twitter tags
            html = html.replace('content="" id="tw-title"', `content="${escAttr(seoTitle)}" id="tw-title"`);
            html = html.replace('content="" id="tw-desc"', `content="${escAttr(desc160)}" id="tw-desc"`);

            // ── og:article:* tags for news aggregators ──
            const ogArticleTags = [
              `<meta property="og:type" content="article">`,
              `<meta property="article:published_time" content="${escAttr(publishedAt)}">`,
              `<meta property="article:modified_time" content="${escAttr(publishedAt)}">`,
              `<meta property="article:author" content="${escAttr(author)}">`,
              `<meta property="article:section" content="${escAttr(tag)}">`,
            ];
            if (ticker && ticker !== 'MP') {
              ogArticleTags.push(`<meta property="article:tag" content="${escAttr(ticker)}">`);
            }
            ogArticleTags.push(`<meta property="article:tag" content="market analysis">`);
            ogArticleTags.push(`<meta property="article:tag" content="narrative intelligence">`);

            // ── RSS/Atom autodiscovery ──
            const feedLinks = [
              `<link rel="alternate" type="application/rss+xml" title="Market Prism Intelligence Journal" href="https://marketprism.co/feed.xml">`,
              `<link rel="alternate" type="application/atom+xml" title="Market Prism Intelligence Journal (Atom)" href="https://marketprism.co/atom.xml">`,
            ];

            // ── NewsArticle schema (Google News compatible) ──
            const articleSchema = {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              "headline": title,
              "description": desc160,
              "datePublished": publishedAt,
              "dateModified": publishedAt,
              "author": { "@type": "Organization", "name": author, "url": "https://marketprism.co" },
              "publisher": {
                "@type": "Organization",
                "name": "Market Prism",
                "url": "https://marketprism.co",
                "logo": { "@type": "ImageObject", "url": "https://marketprism.co/logo.png" }
              },
              "url": pageUrl,
              "mainEntityOfPage": { "@type": "WebPage", "@id": pageUrl },
              "image": imageUrl,
              "articleSection": tag,
              "inLanguage": "en-US",
              "isAccessibleForFree": true,
            };
            if (ticker && ticker !== 'MP') {
              articleSchema.about = {
                "@type": "Corporation",
                "tickerSymbol": ticker,
              };
              articleSchema.keywords = [ticker, tag, 'narrative analysis', 'market intelligence'].join(', ');
            }

            // ── Speakable schema (AI voice answers / Google Assistant) ──
            const speakableSchema = {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "speakable": {
                "@type": "SpeakableSpecification",
                "cssSelector": [".article-title", ".article-body p:first-child"]
              },
              "url": pageUrl
            };

            // ── Breadcrumb schema ──
            const breadcrumbSchema = {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://marketprism.co"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Intelligence Journal",
                  "item": "https://marketprism.co/blog"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": title,
                  "item": pageUrl
                }
              ]
            };

            // ── FAQ schema ──
            const faqQuestions = generateFAQ(ticker, tag, title);
            const faqSchema = {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": faqQuestions.map(q => ({
                "@type": "Question",
                "name": q.question,
                "acceptedAnswer": { "@type": "Answer", "text": q.answer }
              }))
            };

            // Build all schema scripts
            const schemaScripts = [
              `<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>`,
              `<script type="application/ld+json">${JSON.stringify(speakableSchema)}</script>`,
              `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`,
              `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>`,
            ].join('\n');

            // Inject schemas where the comment placeholder is
            html = html.replace('<!-- Article schema injected by JS after load -->', schemaScripts);

            // Inject og:article tags + feed links before </head>
            const headInjection = ogArticleTags.join('\n') + '\n' + feedLinks.join('\n');
            html = html.replace('</head>', `${headInjection}\n</head>`);
          }
        }
      } catch (fetchErr) {
        // Non-fatal: page still works client-side
        console.error('[blog-post] SSR meta fetch failed:', fetchErr.message);
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Blog-post error: ' + err.message);
  }
};

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateFAQ(ticker, tag, title) {
  if (!ticker || ticker === 'MP') {
    return [
      { question: `What does this Market Prism analysis cover?`, answer: `This article provides forensic narrative intelligence and institutional-grade analysis on current market dynamics, examining evidence signals, positioning data, and structural factors that drive price action.` },
      { question: `How does Market Prism analyze market narratives?`, answer: `Market Prism uses a forensic approach combining quantitative signals \u2014 short interest, options flow, institutional positioning, and insider activity \u2014 with qualitative narrative analysis to identify structural support or fragility in market stories.` },
      { question: `Is this financial advice?`, answer: `No. Market Prism provides analytical research and narrative intelligence for informational purposes only. All investment decisions should be made with independent verification and professional financial advice.` }
    ];
  }
  return [
    { question: `Is ${ticker} overvalued right now?`, answer: `This Market Prism analysis examines ${ticker}'s current valuation relative to its narrative momentum, fundamental signals, and institutional positioning. The article presents quantifiable evidence from short interest, options flow, and analyst revisions to assess whether ${ticker}'s price reflects structural support or narrative-driven inflation.` },
    { question: `What does Market Prism say about ${ticker}?`, answer: `Market Prism's forensic analysis of ${ticker} evaluates the stock's narrative structure, evidence signals, and positioning data to determine whether the current market story is fundamentally supported or showing signs of fragility. Read the full analysis for detailed signal breakdowns and data tables.` },
    { question: `Is ${ticker} a narrative trap?`, answer: `This article uses Market Prism's forensic narrative framework to evaluate whether ${ticker}'s price action is driven by sustainable fundamentals or potentially unstable narrative momentum. The analysis includes quantifiable evidence signals, institutional flow data, and structural indicators to help investors distinguish between supported moves and narrative traps.` }
  ];
}
