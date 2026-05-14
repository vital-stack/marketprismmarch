const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const { HIDDEN_TICKERS } = require('./_hidden-tickers');

// Injected after <head>: defines the global denylist + wraps fetch so any
// Supabase REST array response has hidden-ticker rows stripped out. This is
// the single choke point that hides excluded tickers from every dashboard,
// list, snapshot, scorecard, leaderboard etc. served by the platform.
const HIDDEN_INJECT = '\n<script>(function(){var H=new Set(' + JSON.stringify(HIDDEN_TICKERS.map(function(t){return String(t).toUpperCase();})) + ');window.MP_HIDDEN_TICKERS=Array.from(H);window.MP_IS_HIDDEN_TICKER=function(t){return !!t&&H.has(String(t).toUpperCase());};if(window.fetch&&!window.__mpHideWrap){window.__mpHideWrap=1;var _f=window.fetch.bind(window);window.fetch=function(input,init){var url=typeof input==="string"?input:(input&&input.url)||"";var isSupa=url.indexOf("/rest/v1/")>=0;if(!isSupa)return _f(input,init);return _f(input,init).then(function(r){if(!r||!r.ok)return r;var ct=(r.headers&&r.headers.get&&r.headers.get("content-type"))||"";if(ct.indexOf("application/json")<0)return r;var cl=r.clone();return cl.json().then(function(body){var filtered=body;if(Array.isArray(body)){filtered=body.filter(function(row){if(!row||typeof row!=="object")return true;var t=row.ticker||row.symbol;return !(t&&H.has(String(t).toUpperCase()));});}else if(body&&typeof body==="object"){var t=body.ticker||body.symbol;if(t&&H.has(String(t).toUpperCase())){var status=406;var msg={code:"PGRST116",message:"Hidden ticker"};return new Response(JSON.stringify(msg),{status:status,headers:{"content-type":"application/json"}});}}return new Response(JSON.stringify(filtered),{status:r.status,statusText:r.statusText,headers:r.headers});}).catch(function(){return r;});});};}})();</script>';

function injectHiddenTickerGuard(html) {
  if (!html || HIDDEN_TICKERS.length === 0) return html;
  // Insert right after the opening <head ...> tag so the wrapper is in place
  // before any subsequent <script> runs.
  return html.replace(/<head([^>]*)>/i, function (m) {
    return m + HIDDEN_INJECT;
  });
}

/**
 * Resolve and read an HTML template file.
 * Tries multiple paths to handle Vercel's serverless file bundling.
 */
module.exports = function resolveTemplate(filename) {
  const candidates = [
    join(__dirname, filename),
    join(__dirname, '..', filename),
    join(process.cwd(), filename),
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      return injectHiddenTickerGuard(readFileSync(p, 'utf8'));
    }
  }

  throw new Error('Template not found: ' + filename + '. Searched: ' + candidates.join(', '));
};
