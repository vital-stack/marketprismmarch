const resolveTemplate = require('./_resolve-template');
const requireAuth = require('./_require-auth');

module.exports = async (req, res) => {
  try {
    const supabaseUrl  = process.env.SUPABASE_URL  || '';
    const supabaseAnon = process.env.SUPABASE_ANON || '';

    // Extract ticker — try multiple sources because Vercel rewrites may
    // change req.url to the destination path (/api/ticker instead of /ticker/NVDA)
    let ticker = '';

    // 1. Vercel populates req.query with named rewrite params (:ticker)
    if (req.query && req.query.ticker) {
      ticker = req.query.ticker;
    }

    // 2. Try the original URL path (works when req.url preserves the source)
    if (!ticker) {
      const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
      const last = parts[parts.length - 1] || '';
      if (last !== 'ticker' && last !== 'api') {
        ticker = last;
      }
    }

    // 3. Try x-now-route-matches header (Vercel internal routing metadata)
    if (!ticker && req.headers && req.headers['x-now-route-matches']) {
      try {
        const matches = decodeURIComponent(req.headers['x-now-route-matches']);
        const m = matches.match(/ticker=([^&]+)/);
        if (m) ticker = decodeURIComponent(m[1]);
      } catch (_) {}
    }

    // 4. Try query string ?t=NVDA as last resort
    if (!ticker && req.query && req.query.t) {
      ticker = req.query.t;
    }

    // Sanitise — only allow alphanumeric + dot + hyphen
    const safeTicker = ticker.replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();

    // Hard gate — bail before the expensive Supabase fetches below.
    const nextPath = safeTicker ? `/ticker/${safeTicker}` : '/dashboard';
    const auth = await requireAuth(req, res, { next: nextPath });
    if (!auth) return;

    let html = resolveTemplate('_ticker.html');

    html = html.replace(
      "window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '', TICKER: '' };",
      `window.__env = { SUPABASE_URL: '${supabaseUrl}', SUPABASE_ANON: '${supabaseAnon}', TICKER: '${safeTicker}' };`
    );

    // ── SEO + AEO injection (server-side, non-destructive) ──────────────
    if (safeTicker && supabaseUrl && supabaseAnon) {
      try {
        const { buildTickerMeta, buildWebPageSchema } = require('../lib/seoHead');
        const { buildAEOBlock } = require('../lib/aeoBlock');
        const { transformNarrative } = require('../lib/narrativeEngine');

        // Fetch scorecard data server-side for meta tags + AEO
        const headers = {
          'apikey': supabaseAnon,
          'Authorization': `Bearer ${supabaseAnon}`,
        };

        const data = {};

        const controller = new AbortController();
        const seoTimeout = setTimeout(() => controller.abort(), 5000);
        const [scRes, tcRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/narrative_scorecard?ticker=eq.${encodeURIComponent(safeTicker)}&order=snapshot_date.desc&limit=1`, { headers, signal: controller.signal }),
          fetch(`${supabaseUrl}/rest/v1/v_trade_cards?ticker=eq.${encodeURIComponent(safeTicker)}&order=snapshot_date.desc&limit=1`, { headers, signal: controller.signal }),
        ]).finally(() => clearTimeout(seoTimeout));

        if (scRes.ok) {
          const rows = await scRes.json();
          if (rows.length > 0) {
            const r = rows[0];
            data.verdict = r.verdict;
            data.fvd = r.fvd_pct != null ? r.fvd_pct : r.fvd;
            data.vms = r.vms;
            data.energy = r.energy_remaining;
            data.decay = r.decay_rate;
            data.coordination = r.coordination_score;
            data.narrative = r.narrative;
            data.suspicion = r.suspicion_score;
          }
        }

        if (tcRes.ok) {
          const rows = await tcRes.json();
          if (rows.length > 0) {
            data.direction = rows[0].direction;
            data.price = rows[0].price;
            data.label = rows[0].primary_label;
          }
        }

        // Build narrative for meta description
        const narr = transformNarrative({ ticker: safeTicker, ...data });

        // 1. Inject SEO <title>
        html = html.replace(
          '<title>Ticker \u2014 Market Prism</title>',
          `<title>${escHtml(safeTicker)} Analysis \u2014 Narrative Intelligence | Market Prism</title>`
        );

        // 2. Inject meta tags after <title> line (safe head injection)
        const metaTags = buildTickerMeta({
          ticker: safeTicker,
          title: `${safeTicker} Analysis \u2014 Narrative Intelligence | Market Prism`,
          description: narr.metaDescription,
          url: `https://marketprism.co/ticker/${safeTicker}`,
        });
        const webPageSchema = `<script type="application/ld+json">${buildWebPageSchema({
          title: `${safeTicker} Analysis`,
          description: narr.metaDescription,
          url: `https://marketprism.co/ticker/${safeTicker}`,
        })}</script>`;

        // Breadcrumb schema
        const breadcrumbSchema = `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://marketprism.co" },
            { "@type": "ListItem", "position": 2, "name": "Dashboard", "item": "https://marketprism.co/dashboard" },
            { "@type": "ListItem", "position": 3, "name": safeTicker, "item": `https://marketprism.co/ticker/${safeTicker}` }
          ]
        })}</script>`;

        // RSS autodiscovery
        const feedLinks = `<link rel="alternate" type="application/rss+xml" title="Market Prism Intelligence Journal" href="https://marketprism.co/feed.xml">\n<link rel="alternate" type="application/atom+xml" title="Market Prism Intelligence Journal (Atom)" href="https://marketprism.co/atom.xml">`;

        // Inject meta tags before </head>
        html = html.replace(
          '</head>',
          `${metaTags}\n${webPageSchema}\n${breadcrumbSchema}\n${feedLinks}\n</head>`
        );

        // 3. Append AEO block inside main content (before </main>) so it
        //    inherits the page layout and sits below all tab content
        const aeoHtml = buildAEOBlock(safeTicker, data);
        html = html.replace('</main>', `${aeoHtml}\n</main>`);

      } catch (seoErr) {
        // Non-fatal — page still works without SEO/AEO
        console.error('[ticker] SEO/AEO injection failed:', seoErr.message);
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Ticker error: ' + err.message);
  }
};

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
