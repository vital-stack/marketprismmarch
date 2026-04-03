// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Ticker Snapshots Module (v2)
// Sortable/filterable table of all active signals
// ══════════════════════════════════════════════════════════════════════════════
(function(){

var ACTIONS = {
  'NARRATIVE_TRAP':'Avoid or Short','FUNDAMENTAL_DISCONNECT':'Avoid',
  'FADE_THE_HYPE':'Fade Rallies','DRIFT_COMPRESSION_SHORT':'Short on Bounce',
  'AIR_POCKET_SHORT':'Stay Away','ACCUMULATE':'Buy Dips',
  'MOMENTUM_CONFIRMED':'Ride the Trend','FUNDAMENTAL_LONG':'Accumulate',
  'OMISSION_CASCADE':'Avoid'
};

function fmtLabel(l){ return l ? l.replace(/_/g,' ').toLowerCase().replace(/\b\w/g,function(c){return c.toUpperCase();}) : ''; }

var allRows = [];
var currentSort = 'score';
var currentFilter = '';

function renderTable(){
  var tbody = document.getElementById('snap-tbody');
  if(!tbody) return;

  var filtered = allRows;
  if(currentFilter){
    var q = currentFilter.toLowerCase();
    filtered = allRows.filter(function(r){
      return (r.ticker||'').toLowerCase().indexOf(q) !== -1
        || (r.sector||'').toLowerCase().indexOf(q) !== -1
        || (r.industry||'').toLowerCase().indexOf(q) !== -1;
    });
  }

  // Sort
  var sorted = filtered.slice();
  if(currentSort === 'score') sorted.sort(function(a,b){ return (Number(b.trade_score)||0) - (Number(a.trade_score)||0); });
  else if(currentSort === 'ticker') sorted.sort(function(a,b){ return (a.ticker||'').localeCompare(b.ticker||''); });
  else if(currentSort === 'conf-desc') sorted.sort(function(a,b){ return (Number(b.confidence)||0) - (Number(a.confidence)||0); });
  else if(currentSort === 'bearish') sorted = sorted.filter(function(r){ return (r.direction||'').toUpperCase() === 'BEARISH'; });
  else if(currentSort === 'bullish') sorted = sorted.filter(function(r){ return (r.direction||'').toUpperCase() === 'BULLISH'; });

  if(!sorted.length){
    tbody.innerHTML = '<tr><td colspan="7" style="padding:32px;text-align:center;color:var(--mp-text-muted);">No tickers match.</td></tr>';
    document.getElementById('snap-count').textContent = '0 tickers';
    return;
  }

  document.getElementById('snap-count').textContent = sorted.length + ' ticker' + (sorted.length !== 1 ? 's' : '');

  tbody.innerHTML = sorted.map(function(r){
    var dir = (r.direction||'').toUpperCase();
    var dirColor = dir === 'BEARISH' ? '#FF4D4D' : dir === 'BULLISH' ? 'var(--mp-cyan)' : 'var(--mp-text-muted)';
    var dirArrow = dir === 'BEARISH' ? '\u25BC' : dir === 'BULLISH' ? '\u25B2' : '';
    var action = ACTIONS[r.primary_label] || 'Monitor';
    var label = fmtLabel(r.primary_label);
    var price = r.price ? '$' + MP.fmtPrice(Number(r.price)) : '';
    var tier = (r.card_tier||'').toUpperCase();
    var tierHTML = '';
    if(tier === 'PLATINUM') tierHTML = '<span class="snap-tier snap-plat">Plat</span>';
    else if(tier === 'GOLD') tierHTML = '<span class="snap-tier snap-gold">Gold</span>';
    else if(tier === 'SURPRISE') tierHTML = '<span class="snap-tier snap-surp">Surp</span>';
    var domain = MP.DOMAINS[r.ticker];
    var logo = domain ? '<img class="snap-logo" src="https://www.google.com/s2/favicons?domain='+domain+'&sz=32" alt="" onerror="this.style.display=\'none\';">' : '';
    var sectorLine = [r.sector, r.industry].filter(Boolean).join(' \u00B7 ');

    return '<tr data-ticker="'+MP.esc(r.ticker)+'">'
      + '<td class="snap-td-ticker">' + logo + '<span class="snap-ticker-name">'+MP.esc(r.ticker)+'</span>' + tierHTML + '</td>'
      + '<td class="snap-td-price">' + price + '</td>'
      + '<td class="snap-td-signal"><span class="snap-label">'+MP.esc(label)+'</span></td>'
      + '<td class="snap-td-action">'+MP.esc(action)+'</td>'
      + '<td class="snap-td-dir"><span style="color:'+dirColor+';">'+dirArrow+' '+MP.esc(dir)+'</span></td>'
      + '<td class="snap-td-sector">'+MP.esc(sectorLine||'\u2014')+'</td>'
      + '<td class="snap-td-view"><a href="/ticker/'+encodeURIComponent(r.ticker)+'">View \u2192</a></td>'
    + '</tr>';
  }).join('');

  // Row click
  tbody.querySelectorAll('tr[data-ticker]').forEach(function(row){
    row.addEventListener('click', function(){ window.location.href = '/ticker/' + encodeURIComponent(this.dataset.ticker); });
  });
}

async function init(){
  var root = document.getElementById('snapshots-root');
  if(!root) return;
  root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Loading Ticker Snapshots\u2026</div>';

  try{
    var rows = await MP.rest('trade_cards_live', {
      select: 'ticker,direction,confidence,card_tier,primary_label,price,sector,industry,trade_score,description,timeframe,holding_days',
      order: 'trade_score.desc'
    });
    if(!rows || !rows.length){
      root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">No snapshot data available.</div>';
      return;
    }
    allRows = rows;

    root.innerHTML = '<div class="page-header">'
        + '<div class="ph-eyebrow">Ticker Snapshots</div>'
        + '<h1>Every signal at a glance.</h1>'
        + '<span class="ph-italic">Ranked and scored daily.</span>'
        + '<p>'+rows.length+' active signals across all sectors</p>'
      + '</div>'
      + '<div class="snap-controls">'
        + '<input class="snap-search" id="snap-search-v2" placeholder="Filter ticker or sector\u2026" autocomplete="off">'
        + '<div class="snap-chips">'
          + '<button class="snap-chip active" data-sort="score">Top Score</button>'
          + '<button class="snap-chip" data-sort="ticker">A \u2192 Z</button>'
          + '<button class="snap-chip" data-sort="conf-desc">Confidence</button>'
          + '<button class="snap-chip" data-sort="bearish">Bearish</button>'
          + '<button class="snap-chip" data-sort="bullish">Bullish</button>'
        + '</div>'
        + '<span class="snap-count" id="snap-count">'+rows.length+' tickers</span>'
      + '</div>'
      + '<div class="snap-table-wrap">'
        + '<table class="snap-table">'
          + '<thead><tr>'
            + '<th>Ticker</th><th>Price</th><th>Signal</th><th>Action</th><th>Direction</th><th>Sector</th><th></th>'
          + '</tr></thead>'
          + '<tbody id="snap-tbody"></tbody>'
        + '</table>'
      + '</div>';

    renderTable();

    // Search
    document.getElementById('snap-search-v2').addEventListener('input', function(){
      currentFilter = this.value;
      renderTable();
    });

    // Sort chips
    root.querySelectorAll('.snap-chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        root.querySelectorAll('.snap-chip').forEach(function(c){ c.classList.remove('active'); });
        this.classList.add('active');
        currentSort = this.dataset.sort;
        renderTable();
      });
    });

  }catch(e){
    console.warn('[SNAP] Load failed:', e);
    root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Failed to load snapshots.</div>';
  }
}

MP.register('snapshots', init);
})();
