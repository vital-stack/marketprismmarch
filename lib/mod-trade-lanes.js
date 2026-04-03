// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Trade Lanes Module (v2)
// "What's the play?" — Day Trade / Swing Trade / Long Hold
// Compact list layout, sorted by confidence
// ══════════════════════════════════════════════════════════════════════════════
(function(){

var LANE_CONFIG = {
  day: {
    title: 'Day Trade',
    subtitle: 'In and out today',
    count: 0
  },
  swing: {
    title: 'Swing Trade',
    subtitle: '3\u201314 day window',
    count: 0
  },
  position: {
    title: 'Long Hold',
    subtitle: 'Weeks to months',
    count: 0
  }
};

var ACTIONS = {
  'NARRATIVE_TRAP':          'Short or avoid',
  'FUNDAMENTAL_DISCONNECT':  'Short or avoid',
  'FADE_THE_HYPE':           'Fade rallies',
  'DRIFT_COMPRESSION_SHORT': 'Short on bounce',
  'AIR_POCKET_SHORT':        'Stay away',
  'ACCUMULATE':              'Accumulate',
  'MOMENTUM_CONFIRMED':      'Ride the trend',
  'FUNDAMENTAL_LONG':        'Accumulate',
  'OMISSION_CASCADE':        'Avoid'
};

function fmtLabel(label){
  if(!label) return 'Signal';
  return label.replace(/_/g,' ').toLowerCase().replace(/\b\w/g,function(c){return c.toUpperCase();});
}

var LANE_LIMIT = 5;

function buildRow(r){
  var dir = (r.direction||'').toUpperCase();
  var isBear = dir === 'BEARISH';
  var dirColor = isBear ? '#FF4D4D' : 'var(--mp-cyan)';
  var dirArrow = isBear ? '\u25BC' : dir === 'BULLISH' ? '\u25B2' : '';
  var action = ACTIONS[r.primary_label] || 'Monitor';
  var price = r.price ? '$' + MP.fmtPrice(Number(r.price)) : '';
  var tier = (r.card_tier||'').toUpperCase();
  var tierHTML = '';
  if(tier === 'PLATINUM') tierHTML = '<span class="tl-tier tl-plat">Plat</span>';
  else if(tier === 'GOLD') tierHTML = '<span class="tl-tier tl-gold">Gold</span>';
  else if(tier === 'SURPRISE') tierHTML = '<span class="tl-tier tl-surp">Surp</span>';
  var domain = MP.DOMAINS[r.ticker];

  return '<div class="tl-row" data-ticker="'+MP.esc(r.ticker)+'">'
    + '<div class="tl-row-left">'
      + tierHTML
      + (domain
        ? '<img class="tl-row-logo" src="https://www.google.com/s2/favicons?domain='+domain+'&sz=32" alt="" onerror="this.style.display=\'none\';">'
        : '')
      + '<span class="tl-row-ticker">'+MP.esc(r.ticker)+'</span>'
      + '<span class="tl-row-price">'+price+'</span>'
    + '</div>'
    + '<div class="tl-row-right">'
      + '<span class="tl-row-action">'+MP.esc(action)+'</span>'
      + '<span class="tl-row-dir" style="color:'+dirColor+';">'+dirArrow+'</span>'
    + '</div>'
  + '</div>';
}

function buildLane(key, cards){
  var cfg = LANE_CONFIG[key];
  if(!cfg || !cards.length) return '';
  cards.sort(function(a,b){ return (Number(b.confidence)||0) - (Number(a.confidence)||0); });

  var visible = cards.slice(0, LANE_LIMIT);
  var overflow = cards.slice(LANE_LIMIT);
  var laneId = 'tl-overflow-' + key;

  var html = '<div class="tl-lane">'
    + '<div class="tl-lane-header">'
      + '<div class="tl-lane-title">'+cfg.title+'</div>'
      + '<div class="tl-lane-sub">'+cfg.subtitle+' \u00B7 '+cards.length+' signals</div>'
    + '</div>'
    + '<div class="tl-lane-rows">';
  visible.forEach(function(c){ html += buildRow(c); });
  if(overflow.length){
    html += '<div class="tl-overflow" id="'+laneId+'" style="display:none;">';
    overflow.forEach(function(c){ html += buildRow(c); });
    html += '</div>';
    html += '<button class="tl-view-more" data-target="'+laneId+'">View '+overflow.length+' more</button>';
  }
  html += '</div></div>';
  return html;
}

async function init(){
  var container = document.getElementById('tl-container');
  if(!container) return;

  try{
    var rows = await MP.rest('trade_cards_live', {
      select: 'ticker,direction,confidence,card_tier,primary_label,timeframe,holding_days,price',
      order: 'confidence.desc'
    });
    if(!rows || !rows.length){
      container.style.display = 'none';
      return;
    }

    var buckets = { day:[], swing:[], position:[] };
    rows.forEach(function(r){
      var tf = (r.timeframe || '').toLowerCase();
      if(tf === 'day') buckets.day.push(r);
      else if(tf === 'swing') buckets.swing.push(r);
      else if(tf === 'position') buckets.position.push(r);
      else {
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

    // Click — rows
    container.querySelectorAll('.tl-row[data-ticker]').forEach(function(row){
      row.addEventListener('click', function(){
        window.location.href = '/ticker/' + encodeURIComponent(this.dataset.ticker);
      });
    });

    // Click — view more
    container.querySelectorAll('.tl-view-more').forEach(function(btn){
      btn.addEventListener('click', function(){
        var target = document.getElementById(this.dataset.target);
        if(!target) return;
        var showing = target.style.display !== 'none';
        target.style.display = showing ? 'none' : 'block';
        this.textContent = showing
          ? 'View ' + target.children.length + ' more'
          : 'Show less';
      });
    });

  }catch(e){ console.warn('[TL] Load failed:', e); }
}

MP.register('trade-lanes', init);
})();
