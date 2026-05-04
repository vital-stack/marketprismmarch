/**
 * aeoBlock.js
 * Generates the AEO (Answer Engine Optimization) HTML block
 * to be appended to ticker pages without modifying existing content.
 */

const { transformNarrative, generateFAQ } = require('./narrativeEngine');

/**
 * Build the full AEO HTML section + JSON-LD FAQ schema for a ticker.
 * @param {string} ticker
 * @param {object} data - Raw scorecard/trade data from Supabase
 * @returns {string} HTML string to inject inside </main>
 */
function buildAEOBlock(ticker, data) {
  const narr = transformNarrative({ ticker, ...data });
  const faqs = generateFAQ(ticker, narr);

  // JSON-LD FAQ schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": { "@type": "Answer", "text": f.answer }
    }))
  };

  // JSON-LD FinancialProduct schema for the ticker
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "name": `${ticker} Narrative Analysis`,
    "description": narr.metaDescription,
    "provider": {
      "@type": "Organization",
      "name": "Market Prism",
      "url": "https://marketprism.co"
    },
    "url": `https://marketprism.co/ticker/${ticker}`
  };

  // Organization schema
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Market Prism",
    "url": "https://marketprism.co",
    "description": "AI-powered stock analysis platform delivering forensic narrative intelligence and institutional-grade equity market research.",
    "sameAs": ["https://x.com/market_prism"]
  };

  const t = esc(ticker);
  const tLower = esc(ticker.toLowerCase());

  const html = `
<!-- ═══ AEO BLOCK — appended by server, does not modify existing layout ═══ -->
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(productSchema)}</script>
<script type="application/ld+json">${JSON.stringify(orgSchema)}</script>
<style>
  #mp-aeo-block {
    padding: 40px 40px 64px;
    font-family: var(--font-body, 'Inter', 'DM Sans', system-ui, sans-serif);
    color: var(--mp-text-secondary, #9ca3af);
    line-height: 1.7;
    font-size: 15px;
    border-top: 1px solid var(--mp-border, rgba(255,255,255,0.07));
    margin-top: 24px;
  }
  #mp-aeo-block .aeo-title {
    font-family: var(--font-display, 'Instrument Serif', Georgia, serif);
    font-size: 20px;
    font-weight: 400;
    color: var(--mp-text-primary, #E8ECF4);
    margin-bottom: 28px;
    letter-spacing: -0.02em;
  }
  #mp-aeo-block .aeo-section {
    margin-bottom: 28px;
  }
  #mp-aeo-block .aeo-section h2 {
    font-family: var(--font-display, 'Instrument Serif', Georgia, serif);
    font-size: 16px;
    font-weight: 400;
    color: var(--mp-text-primary, #E8ECF4);
    margin-bottom: 8px;
    line-height: 1.3;
  }
  #mp-aeo-block .aeo-section p {
    margin: 0;
    color: var(--mp-text-secondary, #9ca3af);
    font-size: 14px;
    line-height: 1.7;
  }
  #mp-aeo-block .aeo-links {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid var(--mp-border, rgba(255,255,255,0.07));
  }
  #mp-aeo-block .aeo-links-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mp-text-tertiary, #6b7280);
    margin-bottom: 12px;
  }
  #mp-aeo-block .aeo-links-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  #mp-aeo-block .aeo-links-grid a {
    font-size: 12px;
    color: #3b82f6;
    text-decoration: none;
    padding: 6px 12px;
    border: 1px solid var(--mp-border, rgba(255,255,255,0.07));
    border-radius: 6px;
    transition: border-color 0.15s;
    white-space: nowrap;
  }
  #mp-aeo-block .aeo-links-grid a:hover {
    border-color: var(--mp-border-mid, rgba(255,255,255,0.10));
  }
  @media (max-width: 768px) {
    #mp-aeo-block {
      padding: 24px 12px 48px;
    }
    #mp-aeo-block .aeo-title {
      font-size: 18px;
      margin-bottom: 20px;
    }
    #mp-aeo-block .aeo-section {
      margin-bottom: 22px;
    }
    #mp-aeo-block .aeo-section h2 {
      font-size: 15px;
    }
    #mp-aeo-block .aeo-section p {
      font-size: 13px;
    }
    #mp-aeo-block .aeo-links-grid {
      gap: 6px;
    }
    #mp-aeo-block .aeo-links-grid a {
      font-size: 11px;
      padding: 5px 10px;
    }
  }
</style>
<div id="mp-aeo-block">
  <div class="aeo-title">${t} Intelligence Summary</div>

  <div class="aeo-section">
    <h2>Why is ${t} stock moving today?</h2>
    <p>${esc(narr.whyMoving)}</p>
  </div>

  <div class="aeo-section">
    <h2>Is ${t} overvalued right now?</h2>
    <p>${esc(narr.isOvervalued)}</p>
  </div>

  <div class="aeo-section">
    <h2>Market Prism Verdict</h2>
    <p>${esc(narr.verdictExplain)}</p>
  </div>

  <div class="aeo-section">
    <h2>What happens next?</h2>
    <p>${esc(narr.whatsNext)}</p>
  </div>

  <div class="aeo-links">
    <div class="aeo-links-label">Related Analysis</div>
    <div class="aeo-links-grid">
      <a href="/why-is-${tLower}-stock-down">Why is ${t} down?</a>
      <a href="/is-${tLower}-overvalued">Is ${t} overvalued?</a>
      <a href="/should-i-buy-${tLower}">Should I buy ${t}?</a>
      <a href="/blog">Intelligence Journal</a>
      <a href="/dashboard">Full Dashboard</a>
      <a href="/">Market Prism Home</a>
    </div>
  </div>
</div>
<!-- ═══ END AEO BLOCK ═══ -->
`;

  return html;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { buildAEOBlock };
