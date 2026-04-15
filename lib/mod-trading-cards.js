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
  'OMISSION_CASCADE':        'Avoid',
  'NRS_SPIKE':               'Short on Bounce',
  'BOTH_MAXED':              'Ride the Trend'
};

var LABEL_NAMES = {
  'NARRATIVE_TRAP':   'Narrative Trap',
  'NRS_SPIKE':        'NRS Spike',
  'BOTH_MAXED':       'Signal Confluence'
};

function fmtLabel(label){
  if(!label) return 'Signal';
  if(LABEL_NAMES[label]) return LABEL_NAMES[label];
  return label.replace(/_/g,' ').toLowerCase().replace(/\b\w/g,function(c){return c.toUpperCase();});
}

// Convert a t_paper_trades_active row → shape expected by buildCard()
function paperToCardRow(r){
  var dir=(r.direction||'').toUpperCase();
  var isShort=dir==='SHORT';
  var entry=Number(r.entry_price)||0;
  var tp=r.take_profit_price!=null?Number(r.take_profit_price):null;
  var sl=r.stop_loss_price!=null?Number(r.stop_loss_price):null;
  function mvPct(from,to){if(!from||to==null)return null;return(to-from)/from*100*(isShort?-1:1);}
  var tpPct=mvPct(entry,tp);
  var slPct=mvPct(entry,sl);

  // Confidence (0-1 float) — entry_confidence is stored as a percent (0-100)
  var confRaw=r.entry_confidence!=null?Number(r.entry_confidence):null;
  var conf=confRaw!=null?confRaw/100:null;

  // Hold window (entry → planned exit) in days
  var holdDays=null;
  if(r.entry_date&&r.planned_exit_date){
    try{
      var d1=new Date(r.entry_date),d2=new Date(r.planned_exit_date);
      holdDays=Math.max(1,Math.round((d2-d1)/(1000*60*60*24)));
    }catch(_){}
  }
  var timeframe=holdDays!=null?(holdDays<=2?'day':holdDays<=10?'swing':'position'):'swing';

  // Tier derived from confidence bucket
  var tier=null;
  if(conf!=null){
    if(conf>=0.85) tier='PLATINUM';
    else if(conf>=0.70) tier='GOLD';
    else if(conf>=0.55) tier='SURPRISE';
  }

  // Description: mechanical entry/target/stop, or closed PnL if finished
  var description;
  if(r.status==='CLOSED'&&r.pnl_pct!=null){
    var pnl=Number(r.pnl_pct);
    description='Closed '+(pnl>=0?'+':'')+pnl.toFixed(1)+'% in '+(r.days_held!=null?r.days_held:'\u2014')+' days. Entry $'+entry.toFixed(2)+(r.exit_price?' \u2192 exit $'+Number(r.exit_price).toFixed(2):'')+'.';
  } else {
    var parts=['Entry $'+entry.toFixed(2)];
    if(tp!=null) parts.push('target $'+tp.toFixed(2)+(tpPct!=null?' ('+(tpPct>=0?'+':'')+tpPct.toFixed(1)+'%)':''));
    if(sl!=null) parts.push('stop $'+sl.toFixed(2)+(slPct!=null?' ('+slPct.toFixed(1)+'%)':''));
    description=parts.join(' \u00B7 ')+'.';
  }

  return {
    ticker:             r.ticker,
    direction:          isShort?'BEARISH':dir==='LONG'?'BULLISH':'NEUTRAL',
    confidence:         conf,
    regime_adjusted_confidence: conf,
    card_tier:          tier,
    primary_label:      r.signal_basis||null,
    timeframe:          timeframe,
    holding_days:       holdDays,
    price:              entry,
    description:        description,
    sector:             '',
    industry:           '',
    trade_score:        conf,
    exit_date:          r.planned_exit_date,
    _paperStatus:       r.status,
    _paperPnl:          r.pnl_pct!=null?Number(r.pnl_pct):null,
    _paperEntryDate:    r.entry_date
  };
}

function dirIndicator(dir, label){
  var action = ACTIONS[label];
  if(dir === 'BEARISH') return {arrow:'\u25BC', color:'#FF4D4D', label: action || 'Short'};
  if(dir === 'BULLISH') return {arrow:'\u25B2', color:'#00DE94', label: action || 'Buy & Hold'};
  return {arrow:'\u25C6', color:'#00AEFF', label: action || 'Monitor'};
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
  var d = dirIndicator(dir, r.primary_label);
  var conf = Number(r.regime_adjusted_confidence || r.confidence) || 0.5;
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
    // Pull every paper trade row (open + closed); sort open first, then by confidence
    var raw = await MP.rest('t_paper_trades_active', {
      select: 'ticker,direction,signal_basis,entry_date,entry_price,entry_confidence,stop_loss_price,take_profit_price,planned_exit_date,status,pnl_pct,days_held,exit_price',
      order: 'status.asc,entry_confidence.desc'
    });
    if(!raw || !raw.length){
      root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">No trading cards available today.</div>';
      return;
    }

    var rows = raw.map(paperToCardRow);

    // Counts for filter chips
    var openN   = rows.filter(function(r){return r._paperStatus==='OPEN';}).length;
    var closedN = rows.filter(function(r){return r._paperStatus==='CLOSED';}).length;
    var winsN   = rows.filter(function(r){return r._paperStatus==='CLOSED'&&r._paperPnl!=null&&r._paperPnl>0;}).length;
    var bearN   = rows.filter(function(r){return r.direction==='BEARISH';}).length;
    var bullN   = rows.filter(function(r){return r.direction==='BULLISH';}).length;

    root.innerHTML = '<div class="page-header">'
        + '<div class="ph-eyebrow">Trade Cards</div>'
        + '<h1>Collect. Analyze. Play.</h1>'
        + '<span class="ph-italic">Committed paper trades with entry, target and stop.</span>'
        + '<p>'+rows.length+' positions tracked \u00B7 '+openN+' open \u00B7 '+closedN+' closed</p>'
      + '</div>'
      + '<div class="tcv2-filters" id="tcv2-filters">'
        + '<button class="tcv2-chip active" data-filter="all">All '+rows.length+'</button>'
        + '<button class="tcv2-chip" data-filter="open">Open '+openN+'</button>'
        + '<button class="tcv2-chip" data-filter="wins">Closed Wins '+winsN+'</button>'
        + '<button class="tcv2-chip" data-filter="bearish">Bearish '+bearN+'</button>'
        + '<button class="tcv2-chip" data-filter="bullish">Bullish '+bullN+'</button>'
        + '<button class="tcv2-chip" data-filter="day">Day Trade</button>'
        + '<button class="tcv2-chip" data-filter="swing">Swing</button>'
      + '</div>'
      + '<div class="tcv2-grid" id="tcv2-grid"></div>';

    var grid = document.getElementById('tcv2-grid');
    var allCards = rows;

    function renderCards(filter){
      var filtered = allCards;
      if(filter === 'open')         filtered = allCards.filter(function(r){return r._paperStatus==='OPEN';});
      else if(filter === 'wins')    filtered = allCards.filter(function(r){return r._paperStatus==='CLOSED'&&r._paperPnl!=null&&r._paperPnl>0;});
      else if(filter === 'bearish') filtered = allCards.filter(function(r){return r.direction==='BEARISH';});
      else if(filter === 'bullish') filtered = allCards.filter(function(r){return r.direction==='BULLISH';});
      else if(filter === 'day')     filtered = allCards.filter(function(r){return r.timeframe==='day';});
      else if(filter === 'swing')   filtered = allCards.filter(function(r){return r.timeframe==='swing';});

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
