// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Trade Lanes Module
// "What's the play?" — Day Trade / Swing Trade / Long Hold lanes
// ══════════════════════════════════════════════════════════════════════════════
(function(){

var LANE_CONFIG = {
  day: {
    icon: '\u26A1',
    title: 'Day Trade',
    subtitle: 'In and out today',
    color: '#FFB800',
    bg: 'rgba(255,184,0,0.06)',
    border: 'rgba(255,184,0,0.2)'
  },
  swing: {
    icon: '\uD83C\uDFAF',
    title: 'Swing Trade',
    subtitle: '3\u201314 day window',
    color: '#00AEFF',
    bg: 'rgba(0,174,255,0.06)',
    border: 'rgba(0,174,255,0.2)'
  },
  position: {
    icon: '\uD83C\uDFE6',
    title: 'Long Hold',
    subtitle: 'Weeks to months',
    color: '#00DE94',
    bg: 'rgba(0,222,148,0.06)',
    border: 'rgba(0,222,148,0.2)'
  }
};

var LABEL_ACTIONS = {
  'NARRATIVE_TRAP':          { action:'Short or avoid', verb:'Narrative contradicts filings' },
  'FUNDAMENTAL_DISCONNECT':  { action:'Short or avoid', verb:'Price disconnected from value' },
  'FADE_THE_HYPE':           { action:'Fade rallies',   verb:'Hype exceeding fundamentals' },
  'DRIFT_COMPRESSION_SHORT': { action:'Short on bounce', verb:'Narrative drifting from filings' },
  'AIR_POCKET_SHORT':        { action:'Stay away',      verb:'Narrative collapsing' },
  'ACCUMULATE':              { action:'Buy dips',        verb:'Fundamentals support upside' },
  'MOMENTUM_CONFIRMED':      { action:'Ride the trend',  verb:'Momentum confirmed by credible sources' },
  'FUNDAMENTAL_LONG':        { action:'Accumulate',      verb:'Trading below fair value' },
  'OMISSION_CASCADE':        { action:'Avoid',           verb:'Key information being hidden' }
};

function buildLaneCard(r, laneColor){
  var conf = r.confidence ? Math.round(Number(r.confidence) * 100) : 50;
  var confColor = conf >= 75 ? '#00DE94' : conf >= 55 ? '#FFB800' : '#00AEFF';
  var dir = (r.direction || '').toUpperCase();
  var dirColor = dir === 'BEARISH' ? '#FF4D4D' : dir === 'BULLISH' ? '#00DE94' : '#00AEFF';
  var dirArrow = dir === 'BEARISH' ? '\u25BC' : dir === 'BULLISH' ? '\u25B2' : '\u25C6';
  var la = LABEL_ACTIONS[r.primary_label] || { action:'Monitor', verb:'Signal detected' };
  var price = r.price ? '$' + MP.fmtPrice(Number(r.price)) : '';
  var days = r.holding_days ? r.holding_days + 'd' : '';
  var tier = (r.card_tier || '').toUpperCase();
  var tierBadge = '';
  if(tier === 'PLATINUM') tierBadge = '<span class="tl-tier tl-platinum">\u25C6 PLAT</span>';
  else if(tier === 'GOLD') tierBadge = '<span class="tl-tier tl-gold">\u25B2 GOLD</span>';
  else if(tier === 'SURPRISE') tierBadge = '<span class="tl-tier tl-surprise">\u26A1 SURP</span>';

  return '<div class="tl-card" data-ticker="'+MP.esc(r.ticker)+'">'
    + '<div class="tl-card-row1">'
      + '<div class="tl-card-left">'
        + MP.logo(r.ticker, 'sm')
        + '<div>'
          + '<span class="tl-ticker">'+MP.esc(r.ticker)+'</span>'
          + (price ? '<span class="tl-price">'+price+'</span>' : '')
        + '</div>'
      + '</div>'
      + '<div class="tl-card-right">'
        + '<span class="tl-dir" style="color:'+dirColor+';">'+dirArrow+' '+MP.esc(dir)+'</span>'
        + tierBadge
      + '</div>'
    + '</div>'
    + '<div class="tl-action" style="color:'+dirColor+';">'+MP.esc(la.action)+'</div>'
    + '<div class="tl-verb">'+MP.esc(la.verb)+'</div>'
    + '<div class="tl-card-footer">'
      + '<div class="tl-conf-wrap">'
        + '<div class="tl-conf-bar"><div class="tl-conf-fill" style="width:'+conf+'%;background:'+confColor+';"></div></div>'
        + '<span class="tl-conf-pct" style="color:'+confColor+';">'+conf+'%</span>'
      + '</div>'
      + (days ? '<span class="tl-days">'+days+'</span>' : '')
    + '</div>'
  + '</div>';
}

var LANE_LIMIT = 5;

function buildLane(key, cards){
  var cfg = LANE_CONFIG[key];
  if(!cfg || !cards.length) return '';
  // Sort by confidence desc
  cards.sort(function(a,b){ return (Number(b.confidence)||0) - (Number(a.confidence)||0); });

  var visible = cards.slice(0, LANE_LIMIT);
  var overflow = cards.slice(LANE_LIMIT);
  var laneId = 'tl-overflow-' + key;

  var html = '<div class="tl-lane">'
    + '<div class="tl-lane-header" style="border-left:3px solid '+cfg.color+';background:'+cfg.bg+';">'
      + '<span class="tl-lane-icon">'+cfg.icon+'</span>'
      + '<div>'
        + '<div class="tl-lane-title" style="color:'+cfg.color+';">'+cfg.title+'</div>'
        + '<div class="tl-lane-sub">'+cfg.subtitle+' \u00B7 '+cards.length+' signals</div>'
      + '</div>'
    + '</div>'
    + '<div class="tl-lane-cards">';
  visible.forEach(function(c){ html += buildLaneCard(c, cfg.color); });
  if(overflow.length){
    html += '<div class="tl-overflow" id="'+laneId+'" style="display:none;">';
    overflow.forEach(function(c){ html += buildLaneCard(c, cfg.color); });
    html += '</div>';
    html += '<button class="tl-view-more" data-target="'+laneId+'" style="border-color:'+cfg.color+';color:'+cfg.color+';">'
      + 'View ' + overflow.length + ' more \u25BC'
    + '</button>';
  }
  html += '</div></div>';
  return html;
}

async function init(){
  var container = document.getElementById('tl-container');
  if(!container) return;

  try{
    var rows = await MP.rest('v_trade_cards', {
      select: 'ticker,direction,confidence,card_tier,primary_label,timeframe,holding_days,price,description,sector,industry',
      order: 'confidence.desc'
    });
    if(!rows || !rows.length){
      container.style.display = 'none';
      return;
    }

    // Bucket by timeframe
    var buckets = { day:[], swing:[], position:[] };
    rows.forEach(function(r){
      var tf = (r.timeframe || '').toLowerCase();
      if(tf === 'day') buckets.day.push(r);
      else if(tf === 'swing') buckets.swing.push(r);
      else if(tf === 'position') buckets.position.push(r);
      else {
        // Infer from holding_days or label
        var hd = r.holding_days || 7;
        if(hd <= 2) buckets.day.push(r);
        else if(hd <= 14) buckets.swing.push(r);
        else buckets.position.push(r);
      }
    });

    var html = '';
    html += buildLane('day', buckets.day);
    html += buildLane('swing', buckets.swing);
    html += buildLane('position', buckets.position);

    var grid = document.getElementById('tl-grid');
    if(grid) grid.innerHTML = html;
    container.style.display = 'block';

    // Click handlers — cards
    container.querySelectorAll('.tl-card[data-ticker]').forEach(function(card){
      card.addEventListener('click', function(){
        window.location.href = '/ticker/' + encodeURIComponent(this.dataset.ticker);
      });
    });

    // Click handlers — "View more" buttons
    container.querySelectorAll('.tl-view-more').forEach(function(btn){
      btn.addEventListener('click', function(){
        var target = document.getElementById(this.dataset.target);
        if(!target) return;
        var showing = target.style.display !== 'none';
        target.style.display = showing ? 'none' : 'block';
        this.textContent = showing
          ? 'View ' + target.children.length + ' more \u25BC'
          : 'Show less \u25B2';
      });
    });

  }catch(e){ console.warn('[TL] Load failed:', e); }
}

MP.register('trade-lanes', init);
})();
