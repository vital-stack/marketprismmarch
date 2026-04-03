// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Trading Cards Module (v2)
// Gallery of collectible signal cards from v_trade_cards
// Direction-colored backgrounds, tier badges, confidence bars
// ══════════════════════════════════════════════════════════════════════════════
(function(){

var TIER_ICONS = {PLATINUM:'\u25C6',GOLD:'\u25B2',SURPRISE:'\u26A1',STANDARD:'\u25CF'};

var LABEL_ACTIONS = {
  'NARRATIVE_TRAP':          'Avoid or Short',
  'FUNDAMENTAL_DISCONNECT':  'Avoid',
  'FADE_THE_HYPE':           'Fade Rallies',
  'DRIFT_COMPRESSION_SHORT': 'Short on Bounce',
  'AIR_POCKET_SHORT':        'Stay Away',
  'ACCUMULATE':              'Buy Dips',
  'MOMENTUM_CONFIRMED':      'Ride the Trend',
  'FUNDAMENTAL_LONG':        'Accumulate',
  'OMISSION_CASCADE':        'Avoid'
};

function fmtLabel(label){
  if(!label) return 'Signal';
  return label.replace(/_/g,' ').toLowerCase().replace(/\b\w/g,function(c){return c.toUpperCase();});
}

function cardBg(dir, conf){
  var c = Number(conf) || 0.5;
  var a = 0.06 + c * 0.10; // subtle: 0.06 to 0.16
  if(dir === 'BEARISH') return 'linear-gradient(135deg, rgba(255,77,77,'+a.toFixed(2)+') 0%, var(--mp-surface) 60%)';
  if(dir === 'BULLISH') return 'linear-gradient(135deg, rgba(0,222,148,'+a.toFixed(2)+') 0%, var(--mp-surface) 60%)';
  return 'linear-gradient(135deg, rgba(0,174,255,'+(a*0.7).toFixed(2)+') 0%, var(--mp-surface) 60%)';
}

function cardAccent(dir){
  if(dir === 'BEARISH') return {color:'#FF4D4D', glow:'rgba(255,77,77,0.15)', border:'rgba(255,77,77,0.25)'};
  if(dir === 'BULLISH') return {color:'#00DE94', glow:'rgba(0,222,148,0.15)', border:'rgba(0,222,148,0.25)'};
  return {color:'#00AEFF', glow:'rgba(0,174,255,0.12)', border:'rgba(0,174,255,0.20)'};
}

function tierBadge(tier){
  var t = (tier||'').toUpperCase();
  var icon = TIER_ICONS[t] || '';
  if(t === 'PLATINUM') return '<span class="tcv2-tier tcv2-plat">'+icon+' PLATINUM</span>';
  if(t === 'GOLD')     return '<span class="tcv2-tier tcv2-gold">'+icon+' GOLD</span>';
  if(t === 'SURPRISE') return '<span class="tcv2-tier tcv2-surp">'+icon+' SURPRISE</span>';
  return '';
}

function buildCard(r){
  var dir = (r.direction||'').toUpperCase();
  var acc = cardAccent(dir);
  var conf = Number(r.confidence) || 0.5;
  var confPct = Math.round(conf * 100);
  var confColor = confPct >= 75 ? '#00DE94' : confPct >= 55 ? '#FFB800' : '#00AEFF';
  var price = r.price ? '$' + MP.fmtPrice(Number(r.price)) : '';
  var moveName = fmtLabel(r.primary_label);
  var action = LABEL_ACTIONS[r.primary_label] || 'Monitor';
  var score = r.trade_score ? Math.round(Number(r.trade_score)*100) : 0;
  var days = r.holding_days || '';
  var sector = r.sector || '';
  var industry = r.industry || '';
  var sectorLine = [sector, industry].filter(Boolean).join(' \u00B7 ');
  var domain = MP.DOMAINS[r.ticker];

  // Expires
  var expiresStr = '';
  if(r.exit_date){
    try{expiresStr = new Date(r.exit_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});}catch(_){}
  }

  var logoHTML = domain
    ? '<img class="tcv2-logo" src="https://www.google.com/s2/favicons?domain='+domain+'&sz=64" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
      + '<div class="tcv2-logo-fb" style="display:none;background:'+acc.color+'22;color:'+acc.color+';">'+r.ticker.slice(0,3)+'</div>'
    : '<div class="tcv2-logo-fb" style="background:'+acc.color+'22;color:'+acc.color+';">'+r.ticker.slice(0,3)+'</div>';

  return '<div class="tcv2-card" data-ticker="'+MP.esc(r.ticker)+'" style="background:'+cardBg(dir,conf)+';border-color:'+acc.border+';box-shadow:0 4px 16px '+acc.glow+';">'
    // Accent bar
    + '<div class="tcv2-accent" style="background:'+acc.color+';"></div>'
    // Header
    + '<div class="tcv2-header">'
      + '<div class="tcv2-header-left">'
        + logoHTML
        + '<div>'
          + '<div class="tcv2-ticker">'+MP.esc(r.ticker)+'</div>'
          + '<div class="tcv2-sector">'+MP.esc(sectorLine||'\u2014')+'</div>'
        + '</div>'
      + '</div>'
      + tierBadge(r.card_tier)
    + '</div>'
    // Price
    + '<div class="tcv2-price-row">'
      + '<span class="tcv2-price">'+price+'</span>'
      + '<span class="tcv2-dir" style="color:'+acc.color+';">'+(dir==='BEARISH'?'\u25BC':dir==='BULLISH'?'\u25B2':'\u25C6')+' '+MP.esc(dir||'NEUTRAL')+'</span>'
    + '</div>'
    // Move name + action
    + '<div class="tcv2-move" style="color:'+acc.color+';">'+MP.esc(moveName)+'</div>'
    + '<div class="tcv2-action">'+MP.esc(action)+'</div>'
    // Confidence bar
    + '<div class="tcv2-conf-row">'
      + '<div class="tcv2-conf-bar"><div class="tcv2-conf-fill" style="width:'+confPct+'%;background:'+confColor+';"></div></div>'
      + '<span class="tcv2-conf-pct" style="color:'+confColor+';">'+confPct+'%</span>'
    + '</div>'
    // Meta
    + '<div class="tcv2-meta">'
      + (score ? '<span>Score '+score+'</span>' : '')
      + (days ? '<span>'+days+' days</span>' : '')
    + '</div>'
    + (expiresStr ? '<div class="tcv2-expires">\u23F3 Play Expires '+expiresStr+'</div>' : '')
    // Description
    + (r.description ? '<div class="tcv2-desc">'+MP.esc(r.description)+'</div>' : '')
    // Footer
    + '<div class="tcv2-footer">'
      + '<span class="tcv2-status" style="color:'+acc.color+';"><span class="tcv2-pulse" style="background:'+acc.color+';"></span>'+MP.esc(dir||'ACTIVE')+' \u00B7 LIVE</span>'
      + '<span class="tcv2-view">View \u2192</span>'
    + '</div>'
  + '</div>';
}

async function init(){
  var root = document.getElementById('cards-root');
  if(!root) return;
  root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Loading Trading Cards\u2026</div>';

  try{
    var rows = await MP.rest('v_trade_cards', {
      select: 'ticker,direction,confidence,card_tier,primary_label,timeframe,holding_days,price,description,sector,industry,trade_score,exit_date,tier_label,phase,status',
      order: 'trade_score.desc'
    });
    if(!rows || !rows.length){
      root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">No trading cards available today.</div>';
      return;
    }

    // Filter chips
    var filterHTML = '<div class="tcv2-filters">'
      + '<span class="tcv2-filter-label">Filter:</span>'
      + '<button class="tcv2-chip active" data-filter="all">All Cards <span class="tcv2-chip-count">'+rows.length+'</span></button>'
      + '<button class="tcv2-chip" data-filter="bearish">Bearish</button>'
      + '<button class="tcv2-chip" data-filter="bullish">Bullish</button>'
      + '<button class="tcv2-chip" data-filter="platinum">\u25C6 Platinum</button>'
      + '<button class="tcv2-chip" data-filter="gold">\u25B2 Gold</button>'
      + '<button class="tcv2-chip" data-filter="day">\u26A1 Day Trade</button>'
      + '<button class="tcv2-chip" data-filter="swing">\uD83C\uDFAF Swing</button>'
    + '</div>';

    root.innerHTML = '<div class="tcv2-page-header">'
        + '<div class="tcv2-page-eyebrow">Trade Cards</div>'
        + '<h1 class="tcv2-page-title">Collect. Analyze. Play.</h1>'
        + '<p class="tcv2-page-sub">'+rows.length+' active signals scored by narrative forensics</p>'
      + '</div>'
      + filterHTML
      + '<div class="tcv2-grid" id="tcv2-grid"></div>';

    var grid = document.getElementById('tcv2-grid');
    var allCards = rows;

    function renderCards(filter){
      var filtered = allCards;
      if(filter === 'bearish') filtered = allCards.filter(function(r){return (r.direction||'').toUpperCase()==='BEARISH';});
      else if(filter === 'bullish') filtered = allCards.filter(function(r){return (r.direction||'').toUpperCase()==='BULLISH';});
      else if(filter === 'platinum') filtered = allCards.filter(function(r){return (r.card_tier||'').toUpperCase()==='PLATINUM';});
      else if(filter === 'gold') filtered = allCards.filter(function(r){return (r.card_tier||'').toUpperCase()==='GOLD';});
      else if(filter === 'day') filtered = allCards.filter(function(r){return (r.timeframe||'')==='day';});
      else if(filter === 'swing') filtered = allCards.filter(function(r){return (r.timeframe||'')==='swing';});

      if(!filtered.length){
        grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--mp-text-muted);">No cards match this filter.</div>';
        return;
      }
      grid.innerHTML = filtered.map(buildCard).join('');

      // Click handlers
      grid.querySelectorAll('.tcv2-card[data-ticker]').forEach(function(card){
        card.addEventListener('click', function(){
          window.location.href = '/ticker/' + encodeURIComponent(this.dataset.ticker);
        });
      });
    }

    renderCards('all');

    // Filter chip handlers
    root.querySelectorAll('.tcv2-chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        root.querySelectorAll('.tcv2-chip').forEach(function(c){c.classList.remove('active');});
        this.classList.add('active');
        renderCards(this.dataset.filter);
      });
    });

  }catch(e){
    console.warn('[TC] Load failed:', e);
    root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Failed to load cards: '+MP.esc(e.message)+'</div>';
  }
}

MP.register('cards', init);
})();
