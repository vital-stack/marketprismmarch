// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Trading Cards Module (v2)
// Clean brand design: Inter font, cyan/teal accents, big logos, gamified
// ══════════════════════════════════════════════════════════════════════════════
(function(){

var ACTIONS = {
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

function dirIndicator(dir){
  if(dir === 'BEARISH') return {arrow:'\u25BC', color:'#FF4D4D', label:'Bearish'};
  if(dir === 'BULLISH') return {arrow:'\u25B2', color:'#00DE94', label:'Bullish'};
  return {arrow:'\u25C6', color:'#00AEFF', label:'Neutral'};
}

function tierBadge(tier){
  var t = (tier||'').toUpperCase();
  if(t === 'PLATINUM') return '<span class="tcv2-tier">Platinum</span>';
  if(t === 'GOLD')     return '<span class="tcv2-tier tcv2-tier-gold">Gold</span>';
  if(t === 'SURPRISE') return '<span class="tcv2-tier tcv2-tier-surp">Surprise</span>';
  return '';
}

function buildCard(r, idx){
  var dir = (r.direction||'').toUpperCase();
  var d = dirIndicator(dir);
  var conf = Number(r.confidence) || 0.5;
  var confPct = Math.round(conf * 100);
  var price = r.price ? '$' + MP.fmtPrice(Number(r.price)) : '';
  var moveName = fmtLabel(r.primary_label);
  var action = ACTIONS[r.primary_label] || 'Monitor';
  var score = r.trade_score ? Math.round(Number(r.trade_score)*100) : 0;
  var days = r.holding_days || '';
  var sectorLine = [r.sector, r.industry].filter(Boolean).join(' \u00B7 ');
  var domain = MP.DOMAINS[r.ticker];
  var delay = Math.min(idx * 0.04, 0.8);

  // Expires
  var expiresStr = '';
  if(r.exit_date){
    try{expiresStr = new Date(r.exit_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});}catch(_){}
  }

  var logoHTML = domain
    ? '<img class="tcv2-logo" src="https://www.google.com/s2/favicons?domain='+domain+'&sz=128" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
      + '<div class="tcv2-logo-fb" style="display:none;">'+r.ticker.slice(0,2)+'</div>'
    : '<div class="tcv2-logo-fb">'+r.ticker.slice(0,2)+'</div>';

  return '<div class="tcv2-card" data-ticker="'+MP.esc(r.ticker)+'" style="animation-delay:'+delay+'s;">'
    // Shimmer overlay
    + '<div class="tcv2-shimmer"></div>'
    // Direction accent — thin top bar, only color on the card
    + '<div class="tcv2-accent" style="background:'+d.color+';"></div>'
    // Content
    + '<div class="tcv2-body">'
      // Row 1: Logo + ticker + tier
      + '<div class="tcv2-row1">'
        + '<div class="tcv2-logo-wrap">'+logoHTML+'</div>'
        + '<div class="tcv2-identity">'
          + '<div class="tcv2-ticker">'+MP.esc(r.ticker)+'</div>'
          + '<div class="tcv2-sector">'+MP.esc(sectorLine||'\u2014')+'</div>'
        + '</div>'
        + tierBadge(r.card_tier)
      + '</div>'
      // Row 2: Price + direction
      + '<div class="tcv2-row2">'
        + '<span class="tcv2-price">'+price+'</span>'
        + '<span class="tcv2-dir-pill" style="color:'+d.color+';border-color:'+d.color+'33;background:'+d.color+'0D;">'+d.arrow+' '+d.label+'</span>'
      + '</div>'
      // Row 3: Move name + action
      + '<div class="tcv2-move">'+MP.esc(moveName)+'</div>'
      + '<div class="tcv2-action">'+MP.esc(action)+'</div>'
      // Meta line
      + '<div class="tcv2-meta">'
        + (days ? '<span>'+days+'d window</span>' : '')
        + (expiresStr ? '<span>Expires '+expiresStr+'</span>' : '')
      + '</div>'
      // Row 6: Description
      + (r.description ? '<div class="tcv2-desc">'+MP.esc(r.description)+'</div>' : '')
    + '</div>'
    // Footer
    + '<div class="tcv2-footer">'
      + '<span class="tcv2-status"><span class="tcv2-pulse" style="background:'+d.color+';"></span>Live</span>'
      + '<span class="tcv2-view">View Analysis \u2192</span>'
    + '</div>'
  + '</div>';
}

async function init(){
  var root = document.getElementById('cards-root');
  if(!root) return;
  root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Loading Trading Cards\u2026</div>';

  try{
    var rows = await MP.rest('v_trade_cards', {
      select: 'ticker,direction,confidence,card_tier,primary_label,timeframe,holding_days,price,description,sector,industry,trade_score,exit_date',
      order: 'trade_score.desc'
    });
    if(!rows || !rows.length){
      root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">No trading cards available today.</div>';
      return;
    }

    // Filter chips
    var bearN = rows.filter(function(r){return (r.direction||'').toUpperCase()==='BEARISH';}).length;
    var bullN = rows.filter(function(r){return (r.direction||'').toUpperCase()==='BULLISH';}).length;

    root.innerHTML = '<div class="tcv2-page-header">'
        + '<div class="tcv2-page-title">Trading Cards</div>'
        + '<div class="tcv2-page-sub">'+rows.length+' active signals \u00B7 Updated daily before market open</div>'
      + '</div>'
      + '<div class="tcv2-filters" id="tcv2-filters">'
        + '<button class="tcv2-chip active" data-filter="all">All '+rows.length+'</button>'
        + '<button class="tcv2-chip" data-filter="bearish">Bearish '+bearN+'</button>'
        + '<button class="tcv2-chip" data-filter="bullish">Bullish '+bullN+'</button>'
        + '<button class="tcv2-chip" data-filter="day">Day Trade</button>'
        + '<button class="tcv2-chip" data-filter="swing">Swing</button>'
        + '<button class="tcv2-chip" data-filter="platinum">Platinum</button>'
        + '<button class="tcv2-chip" data-filter="gold">Gold</button>'
      + '</div>'
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
      grid.innerHTML = filtered.map(function(r, i){ return buildCard(r, i); }).join('');

      grid.querySelectorAll('.tcv2-card[data-ticker]').forEach(function(card){
        card.addEventListener('click', function(){
          window.location.href = '/ticker/' + encodeURIComponent(this.dataset.ticker);
        });
      });
    }

    renderCards('all');

    root.querySelectorAll('.tcv2-chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        root.querySelectorAll('.tcv2-chip').forEach(function(c){c.classList.remove('active');});
        this.classList.add('active');
        renderCards(this.dataset.filter);
      });
    });

  }catch(e){
    console.warn('[TC] Load failed:', e);
    root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Failed to load cards.</div>';
  }
}

MP.register('cards', init);
})();
