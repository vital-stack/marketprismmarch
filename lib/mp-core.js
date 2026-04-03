// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Core Utilities (mp-core.js)
// Shared helpers used by all dashboard modules
// ══════════════════════════════════════════════════════════════════════════════

var MP = window.MP || {};

// ── Supabase ─────────────────────────────────────────────────────────────────
MP.supabaseUrl  = (window.__env||{}).SUPABASE_URL  || '';
MP.supabaseAnon = (window.__env||{}).SUPABASE_ANON || '';
MP.massiveApi   = (window.__env||{}).MASSIVE_API   || '';
MP.supa = (window.supabase && MP.supabaseUrl && MP.supabaseAnon)
  ? window.supabase.createClient(MP.supabaseUrl, MP.supabaseAnon)
  : null;

MP.hdrs = function(){
  return {
    'apikey': MP.supabaseAnon,
    'Authorization': 'Bearer ' + MP.supabaseAnon,
    'Accept': 'application/json'
  };
};

// ── REST Fetch (PostgREST) ───────────────────────────────────────────────────
MP.rest = function(table, params){
  var qs = Object.keys(params || {}).filter(function(k){
    var v = params[k]; return v !== undefined && v !== null && v !== '';
  }).map(function(k){
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  var url = MP.supabaseUrl + '/rest/v1/' + table + (qs ? '?' + qs : '');
  return fetch(url, { headers: MP.hdrs() }).then(function(r){
    if (!r.ok) throw new Error(table + ' ' + r.status);
    return r.json();
  });
};

// ── HTML Escape ──────────────────────────────────────────────────────────────
MP.esc = function(s){
  return s ? (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
};

// ── Format Helpers ───────────────────────────────────────────────────────────
MP.fmtPrice = function(v){
  v = Number(v);
  if (isNaN(v)) return '—';
  return v >= 1000 ? v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})
       : v >= 1    ? v.toFixed(2)
       : v.toFixed(4);
};

MP.fmtLargeNum = function(n){
  n = Number(n);
  if (isNaN(n)) return '—';
  if (n >= 1e12) return (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3)  return (n/1e3).toFixed(1) + 'K';
  return n.toLocaleString();
};

MP.fmtPct = function(v){
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';
};

MP.fmtDate = function(d){
  if (!d) return '—';
  try { return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
  catch(_){ return d; }
};

// ── Logo ─────────────────────────────────────────────────────────────────────
MP.DOMAINS = {
  // Tech / Semis
  NVDA:'nvidia.com',AMD:'amd.com',INTC:'intel.com',AVGO:'broadcom.com',
  AMAT:'appliedmaterials.com',MRVL:'marvell.com',SMCI:'supermicro.com',
  STX:'seagate.com',WDC:'westerndigital.com',VRT:'vertiv.com',
  AAPL:'apple.com',MSFT:'microsoft.com',GOOG:'google.com',GOOGL:'google.com',
  AMZN:'amazon.com',META:'meta.com',TSLA:'tesla.com',NFLX:'netflix.com',
  CRM:'salesforce.com',ADBE:'adobe.com',ORCL:'oracle.com',IBM:'ibm.com',
  COIN:'coinbase.com',SHOP:'shopify.com',SQ:'squareup.com',PYPL:'paypal.com',
  PLTR:'palantir.com',SNOW:'snowflake.com',CRWD:'crowdstrike.com',PANW:'paloaltonetworks.com',
  DDOG:'datadoghq.com',NET:'cloudflare.com',ZM:'zoom.us',DOCU:'docusign.com',
  MSTR:'microstrategy.com',OPEN:'opendoor.com',NBIS:'nebius.com',
  // Consumer / Retail
  SPOT:'spotify.com',SNAP:'snap.com',PINS:'pinterest.com',RDDT:'reddit.com',
  RBLX:'roblox.com',DASH:'doordash.com',BYND:'beyondmeat.com',
  DIS:'disney.com',NKE:'nike.com',SBUX:'starbucks.com',
  WMT:'walmart.com',COST:'costco.com',HD:'homedepot.com',MCD:'mcdonalds.com',
  PG:'pg.com',KO:'coca-cola.com',PEP:'pepsico.com',KHC:'kraftheinzcompany.com',
  GIS:'generalmills.com',CMCSA:'comcast.com',
  // Finance
  JPM:'jpmorganchase.com',GS:'goldmansachs.com',BAC:'bankofamerica.com',
  V:'visa.com',MA:'mastercard.com',
  // Healthcare
  JNJ:'jnj.com',PFE:'pfizer.com',UNH:'unitedhealthgroup.com',LLY:'lilly.com',
  MRK:'merck.com',ABBV:'abbvie.com',IBRX:'innobiopharma.com',
  // Energy / Materials
  XOM:'exxonmobil.com',CVX:'chevron.com',COP:'conocophillips.com',
  BHP:'bhp.com',RIO:'riotinto.com',CCJ:'cameco.com',
  SCCO:'southerncoppercorp.com',ENPH:'enphase.com',CEG:'constellationenergy.com',
  BG:'bunge.com',ECL:'ecolab.com',MP:'mpmaterials.com',
  GOLD:'barrick.com',SO:'southerncompany.com',
  // Industrials
  BA:'boeing.com',CAT:'caterpillar.com',LMT:'lockheedmartin.com',GE:'ge.com',
  HON:'honeywell.com',RTX:'rtx.com',DE:'deere.com',UPS:'ups.com',FDX:'fedex.com',
  URI:'unitedrentals.com',PWR:'quanta.com',TTEK:'tetratech.com',STN:'stantec.com',
  // Transport
  UBER:'uber.com',LYFT:'lyft.com',UAL:'united.com',
  F:'ford.com',GM:'gm.com',TM:'toyota.com',RIVN:'rivian.com',LCID:'lucidmotors.com',NIO:'nio.com',
  // Other
  ABNB:'airbnb.com',DJT:'truthsocial.com'
};

MP._logoColors = ['#1a5276','#7d3c98','#1e8449','#b9770e','#922b21','#2471a3','#148f77','#6c3483','#1f618d','#af601a'];

MP.logoColor = function(t){
  var h = 0; for(var i=0;i<t.length;i++) h = ((h<<5)-h)+t.charCodeAt(i);
  return MP._logoColors[Math.abs(h) % MP._logoColors.length];
};

MP.logo = function(ticker, size){
  size = size || 'sm';
  var domain = MP.DOMAINS[ticker];
  var bg = MP.logoColor(ticker);
  var initials = ticker.length <= 4 ? ticker : ticker.slice(0,3);
  if (domain) {
    return '<div class="t-logo '+size+'">'
      +'<img src="https://www.google.com/s2/favicons?domain='+domain+'&sz=64" alt="'+ticker+'" '
      +'onerror="this.parentNode.style.background=\''+bg+'\';this.parentNode.style.color=\'#fff\';this.parentNode.textContent=\''+initials+'\'">'
      +'</div>';
  }
  return '<div class="t-logo '+size+'" style="background:'+bg+';color:#fff;">'+initials+'</div>';
};

// ── Module Registry ──────────────────────────────────────────────────────────
MP.modules = {};
MP.register = function(name, initFn){
  MP.modules[name] = { init: initFn, loaded: false };
};
MP.load = function(name){
  var m = MP.modules[name];
  if (m && !m.loaded) {
    m.loaded = true;
    try { m.init(); } catch(e) { console.error('[MP:'+name+'] Init failed:', e); }
  }
};

// ── Tab Switching ────────────────────────────────────────────────────────────
MP.switchTab = function(id, btn){
  document.querySelectorAll('.tk-tab-panel').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var panel = document.getElementById('tab-'+id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
  var title = document.getElementById('topbar-title');
  if (title) title.textContent = MP.TAB_TITLES[id] || id;
  // Lazy-load module
  MP.load(id);
};

MP.TAB_TITLES = {
  daily: 'Daily Brief',
  cards: 'Trading Cards',
  calendar: 'Trading Calendar',
  snapshots: 'Ticker Snapshots',
  leaderboard: 'Leaderboard',
  discover: 'Discover'
};

// ── Auth ─────────────────────────────────────────────────────────────────────
MP.currentUser = null;
MP.ensureAuth = async function(){
  if (!MP.supa) return null;
  try {
    var { data } = await MP.supa.auth.getSession();
    if (data && data.session && data.session.user) {
      MP.currentUser = data.session.user;
      return data.session.user;
    }
    // Try beta bypass
    var params = new URLSearchParams(location.search);
    if (params.get('beta') === 'true') {
      MP.currentUser = { id: 'beta', email: 'beta@marketprism.co' };
      return MP.currentUser;
    }
  } catch(e) { console.warn('[MP] Auth error:', e); }
  return null;
};

// ── Shared Data Store ────────────────────────────────────────────────────────
MP.data = {
  cards: [],        // CARD_DATA from v_trade_cards
  stories: [],      // DATA from v_dash_daily_story
  snapshots: {},    // ticker -> snapshot
  industry: {},     // ticker -> {sector, industry, name, description}
  scorecard: {},    // ticker -> scorecard
  regime: null,     // latest market_regime_log row
  conviction: null  // latest daily_conviction_list parsed
};

window.MP = MP;
