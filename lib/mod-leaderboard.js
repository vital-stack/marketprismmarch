// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Leaderboard Module (v2)
// Ranked lists: most overvalued, undervalued, highest confidence, coordination
// ══════════════════════════════════════════════════════════════════════════════
(function(){

function buildList(title, subtitle, rows, valueFn, colorFn){
  if(!rows.length) return '';
  var html = '<div class="lb-section">'
    + '<div class="lb-section-header">'
      + '<div class="lb-section-title">'+title+'</div>'
      + '<div class="lb-section-sub">'+subtitle+'</div>'
    + '</div>'
    + '<div class="lb-list">';
  rows.forEach(function(r, i){
    var domain = MP.DOMAINS[r.ticker];
    var logo = domain ? '<img class="lb-logo" src="https://www.google.com/s2/favicons?domain='+domain+'&sz=32" alt="" onerror="this.style.display=\'none\';">' : '';
    var val = valueFn(r);
    var color = colorFn(r);
    html += '<div class="lb-row" data-ticker="'+MP.esc(r.ticker)+'">'
      + '<span class="lb-rank">'+(i+1)+'</span>'
      + logo
      + '<span class="lb-ticker">'+MP.esc(r.ticker)+'</span>'
      + '<span class="lb-val" style="color:'+color+';">'+MP.esc(val)+'</span>'
    + '</div>';
  });
  html += '</div></div>';
  return html;
}

async function init(){
  var root = document.getElementById('leaderboard-root');
  if(!root) return;
  root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Loading Leaderboard\u2026</div>';

  try{
    var rows = await MP.rest('trade_cards_live', {
      select: 'ticker,direction,confidence,card_tier,primary_label,price,trade_score,pct_above_fair_value,coordination_class,sector',
      order: 'trade_score.desc'
    });
    if(!rows || !rows.length){
      root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">No data available.</div>';
      return;
    }

    // Build ranked lists
    var overvalued = rows.filter(function(r){ return r.pct_above_fair_value != null && Number(r.pct_above_fair_value) > 20; })
      .sort(function(a,b){ return Number(b.pct_above_fair_value) - Number(a.pct_above_fair_value); }).slice(0, 10);

    var undervalued = rows.filter(function(r){ return r.pct_above_fair_value != null && Number(r.pct_above_fair_value) < -5; })
      .sort(function(a,b){ return Number(a.pct_above_fair_value) - Number(b.pct_above_fair_value); }).slice(0, 10);

    var topScore = rows.slice(0, 10);

    var coordinated = rows.filter(function(r){ return r.coordination_class && (r.coordination_class.indexOf('COORDINATED') !== -1 || r.coordination_class.indexOf('SUSPICIOUS') !== -1); })
      .sort(function(a,b){ return (Number(b.confidence)||0) - (Number(a.confidence)||0); }).slice(0, 10);

    var platinum = rows.filter(function(r){ return (r.card_tier||'').toUpperCase() === 'PLATINUM'; });

    var html = '<div class="page-header">'
        + '<div class="ph-eyebrow">Leaderboard</div>'
        + '<h1>Top signals ranked.</h1>'
        + '<span class="ph-italic">Who\'s leading, who\'s lagging.</span>'
        + '<p>'+rows.length+' active signals ranked by score, valuation, and coordination</p>'
      + '</div>'
      + '<div class="lb-grid">';

    html += buildList('Highest Trade Score', 'Top composite signal strength', topScore,
      function(r){ return 'Score ' + Math.round(Number(r.trade_score)*100); },
      function(){ return 'var(--mp-cyan)'; });

    html += buildList('Most Overvalued', 'Trading above fair value', overvalued,
      function(r){ return '+' + Math.round(Number(r.pct_above_fair_value)) + '% above FV'; },
      function(){ return '#FF4D4D'; });

    html += buildList('Most Undervalued', 'Trading below fair value', undervalued,
      function(r){ return Math.round(Number(r.pct_above_fair_value)) + '% below FV'; },
      function(){ return 'var(--mp-cyan)'; });

    html += buildList('Coordinated Activity', 'Suspicious or coordinated patterns', coordinated,
      function(r){ return (r.coordination_class||'').replace(/_/g,' ').toLowerCase().replace(/\b\w/g,function(c){return c.toUpperCase();}); },
      function(){ return '#FFB800'; });

    if(platinum.length){
      html += buildList('Platinum Tier', 'Highest conviction signals', platinum,
        function(r){ return Math.round(Number(r.confidence)*100) + '% confidence'; },
        function(){ return 'var(--mp-cyan)'; });
    }

    html += '</div>';
    root.innerHTML = html;

    // Click handlers
    root.querySelectorAll('.lb-row[data-ticker]').forEach(function(row){
      row.addEventListener('click', function(){ window.location.href = '/ticker/' + encodeURIComponent(this.dataset.ticker); });
    });

  }catch(e){
    console.warn('[LB] Load failed:', e);
    root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Failed to load leaderboard.</div>';
  }
}

MP.register('leaderboard', init);
})();
