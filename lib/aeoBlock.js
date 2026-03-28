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
 * @returns {string} HTML string to inject before </body>
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
    "description": "Forensic narrative intelligence platform for institutional-grade equity market analysis.",
    "sameAs": ["https://x.com/marketprism"]
  };

  const html = `
<!-- ═══ AEO BLOCK — appended by server, does not modify existing layout ═══ -->
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(productSchema)}</script>
<script type="application/ld+json">${JSON.stringify(orgSchema)}</script>
<div id="mp-aeo-block" style="
  max-width: 800px;
  margin: 0 auto;
  padding: 48px 24px 64px;
  font-family: 'Inter', 'DM Sans', system-ui, sans-serif;
  color: #A0A8B0;
  line-height: 1.7;
  font-size: 15px;
  border-top: 1px solid rgba(255,255,255,0.06);
">
  <div style="font-family: 'Instrument Serif', 'DM Serif Display', Georgia, serif; font-size: 24px; font-weight: 400; color: #E8ECF4; margin-bottom: 32px; letter-spacing: -0.02em;">
    ${esc(ticker)} Intelligence Summary
  </div>

  <div style="margin-bottom: 36px;">
    <h2 style="font-family: 'Instrument Serif', 'DM Serif Display', Georgia, serif; font-size: 18px; font-weight: 400; color: #E8ECF4; margin-bottom: 12px;">
      Why is ${esc(ticker)} stock moving today?
    </h2>
    <p style="margin: 0; color: #A0A8B0; font-size: 15px; line-height: 1.7;">
      ${esc(narr.whyMoving)}
    </p>
  </div>

  <div style="margin-bottom: 36px;">
    <h2 style="font-family: 'Instrument Serif', 'DM Serif Display', Georgia, serif; font-size: 18px; font-weight: 400; color: #E8ECF4; margin-bottom: 12px;">
      Is ${esc(ticker)} overvalued right now?
    </h2>
    <p style="margin: 0; color: #A0A8B0; font-size: 15px; line-height: 1.7;">
      ${esc(narr.isOvervalued)}
    </p>
  </div>

  <div style="margin-bottom: 36px;">
    <h2 style="font-family: 'Instrument Serif', 'DM Serif Display', Georgia, serif; font-size: 18px; font-weight: 400; color: #E8ECF4; margin-bottom: 12px;">
      Market Prism Verdict
    </h2>
    <p style="margin: 0; color: #A0A8B0; font-size: 15px; line-height: 1.7;">
      ${esc(narr.verdictExplain)}
    </p>
  </div>

  <div style="margin-bottom: 36px;">
    <h2 style="font-family: 'Instrument Serif', 'DM Serif Display', Georgia, serif; font-size: 18px; font-weight: 400; color: #E8ECF4; margin-bottom: 12px;">
      What happens next?
    </h2>
    <p style="margin: 0; color: #A0A8B0; font-size: 15px; line-height: 1.7;">
      ${esc(narr.whatsNext)}
    </p>
  </div>

  ${buildRelatedLinks(ticker)}
</div>
<!-- ═══ END AEO BLOCK ═══ -->
`;

  return html;
}

/**
 * Build the <RelatedLinks /> component HTML.
 */
function buildRelatedLinks(ticker) {
  return `
  <div style="margin-top: 40px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.06);">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #4A5578; margin-bottom: 14px;">
      Related Analysis
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
      <a href="/why-is-${esc(ticker.toLowerCase())}-stock-down" style="font-size: 13px; color: #00AEFF; text-decoration: none; padding: 7px 14px; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; transition: border-color 0.15s;">
        Why is ${esc(ticker)} down?
      </a>
      <a href="/is-${esc(ticker.toLowerCase())}-overvalued" style="font-size: 13px; color: #00AEFF; text-decoration: none; padding: 7px 14px; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; transition: border-color 0.15s;">
        Is ${esc(ticker)} overvalued?
      </a>
      <a href="/should-i-buy-${esc(ticker.toLowerCase())}" style="font-size: 13px; color: #00AEFF; text-decoration: none; padding: 7px 14px; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; transition: border-color 0.15s;">
        Should I buy ${esc(ticker)}?
      </a>
      <a href="/blog" style="font-size: 13px; color: #00AEFF; text-decoration: none; padding: 7px 14px; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; transition: border-color 0.15s;">
        Intelligence Journal
      </a>
      <a href="/dashboard" style="font-size: 13px; color: #00AEFF; text-decoration: none; padding: 7px 14px; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; transition: border-color 0.15s;">
        Full Dashboard
      </a>
      <a href="/" style="font-size: 13px; color: #00AEFF; text-decoration: none; padding: 7px 14px; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; transition: border-color 0.15s;">
        Market Prism Home
      </a>
    </div>
  </div>`;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { buildAEOBlock, buildRelatedLinks };
