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
            // Logo asset that actually exists in /assets — used as fallback when
            // a post has no dedicated image (which is now the default since we
            // dropped DALL-E generation in favour of feed-style layout).
            const imageUrl = post.image_url || 'https://marketprism.co/assets/Market-Prism-Logo-Light.png';
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
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://marketprism.co/assets/Market-Prism-Logo-Light.png"
                }
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

            // ── Server-render the article body so crawlers (Googlebot-News etc.)
            // see the full content in the initial HTML response. Client JS still
            // re-renders idempotently. ──
            const renderedBody = markdownToHtml(post.body || '');
            const eyebrowHtml = escHtml(tag);
            const titleHtml = escHtml(title);
            const metaAuthorHtml = escHtml(author);
            const metaDateHtml = escHtml(formatLongDate(publishedAt));
            const metaReadHtml = escHtml(estimateReadTime(post.body || ''));

            html = html.replace(
              '<div id="article-loading" class="con">\n  <div class="state-msg">Loading article...</div>\n</div>',
              '<div id="article-loading" class="con" style="display:none"><div class="state-msg">Loading article...</div></div>'
            );
            html = html.replace(
              '<div id="article-wrap" style="display:none">',
              '<div id="article-wrap">'
            );
            html = html.replace(
              '<div class="article-eyebrow" id="article-eyebrow">Market Intel</div>',
              `<div class="article-eyebrow" id="article-eyebrow">${eyebrowHtml}</div>`
            );
            html = html.replace(
              '<h1 class="article-title" id="article-title"></h1>',
              `<h1 class="article-title" id="article-title">${titleHtml}</h1>`
            );
            html = html.replace(
              '<span id="article-author">Market Prism Research</span>',
              `<span id="article-author">${metaAuthorHtml}</span>`
            );
            html = html.replace(
              '<span id="article-date"></span>',
              `<span id="article-date">${metaDateHtml}</span>`
            );
            html = html.replace(
              '<span id="article-read"></span>',
              `<span id="article-read">${metaReadHtml}</span>`
            );
            html = html.replace(
              '<div class="article-body" id="article-body"></div>',
              `<div class="article-body" id="article-body" data-prerendered="1">${renderedBody}</div>`
            );

            // Personalize beta CTA title server-side too (so crawlers see the right copy)
            if (ticker && ticker !== 'MP') {
              const lower = (tag || '').toLowerCase();
              const betaTitle = lower.indexOf('earnings') !== -1
                ? `Get every ${ticker} earnings signal — before the print, every quarter.`
                : `Track ${ticker} the way our analysts do.`;
              html = html.replace(
                /<div class="beta-cta-title" id="beta-cta-title">[^<]*<\/div>/,
                `<div class="beta-cta-title" id="beta-cta-title">${escHtml(betaTitle)}</div>`
              );
            }
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

function formatLongDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch (_) { return ''; }
}

function estimateReadTime(body) {
  if (!body) return '5 min read';
  const words = body.trim().split(/\s+/).length;
  return Math.max(3, Math.round(words / 200)) + ' min read';
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Server-side markdown → HTML, mirrors the client renderer in _blog_post.html so
// crawlers (Googlebot-News, Bingbot, social previewers) see fully-rendered article
// content in the initial response. Client JS re-renders idempotently.
function markdownToHtml(md) {
  if (!md) return '';
  let html = md;

  // Tables
  html = html.replace(/^\|(.+)\|\s*$/gm, function(line) {
    if (/^[\|\s\-:]+$/.test(line)) return '<!-- separator -->';
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    return '<tr>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
  });
  html = html.replace(/<!-- separator -->/g, '');
  html = html.replace(/((<tr>.*<\/tr>\n?)+)/g, function(m) {
    const rows = m.trim().split('\n');
    const header = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
    const body = rows.slice(1).join('\n');
    return '<table>' + (body ? '<thead>' + header + '</thead><tbody>' + body + '</tbody>' : '<tbody>' + m + '</tbody>') + '</table>';
  });

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Bullet lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:32px 0;">');

  // Paragraphs
  html = html.replace(/\n{2,}/g, '\n\n');
  const blocks = html.split('\n\n');
  html = blocks.map(function(block) {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[1-3]|ul|ol|table|blockquote|hr)/.test(block)) return block;
    if (/<\/tr>/.test(block)) return block;
    return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  return html;
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
