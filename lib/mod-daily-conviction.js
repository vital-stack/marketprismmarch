// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Daily Conviction Module
// Renders: SAFE / AVOID / WATCH cards from daily_conviction_list
// ══════════════════════════════════════════════════════════════════════════════
(function(){

  function parseReasoning(raw){
    if(!raw) return { metrics:{}, insight:'' };
    var metrics = {};
    // Pull verdict
    var vm = raw.match(/verdict=([^,]+)/);
    if(vm) metrics.verdict = vm[1].trim();
    // Pull key numbers
    ['VMS','NRS','FVD','drift','energy','conf'].forEach(function(k){
      var m = raw.match(new RegExp(k+'=([\\d.]+%?)'));
      if(m) metrics[k] = m[1];
    });
    // Extract human-readable insight — sentences that don't start with metric assignments
    var sentences = raw.split('. ').filter(function(s){
      return s.length > 20 && !/^[A-Z]{2,}\s*=/.test(s.trim()) && !/^\w+=\d/.test(s.trim());
    });
    var insight = sentences.join('. ');
    if(insight && !insight.endsWith('.')) insight += '.';
    return { metrics: metrics, insight: insight };
  }

  function buildCard(d, type){
    var confPct = d.confidence != null ? Math.round(d.confidence * 100) : 50;
    var confColor = confPct >= 80 ? '#00DE94' : confPct >= 60 ? '#FFB800' : '#00AEFF';
    var badgeLabel = type === 'safe' ? 'SAFE' : type === 'avoid' ? 'AVOID' : 'WATCH';
    var aligned = d.signals_aligned || 0;
    var conflicting = d.signals_conflicting || 0;
    var total = aligned + conflicting;

    // Signal dots
    var dots = '';
    for(var i = 0; i < total && i < 8; i++){
      dots += '<span class="dc-signal-dot ' + (i < aligned ? 'on' : 'off') + '"></span>';
    }

    // Parse reasoning
    var parsed = parseReasoning(d.reasoning);
    var mv = parsed.metrics;

    // Metric chips
    var chips = '';
    if(mv.verdict) chips += '<span class="dc-chip" style="color:' + (mv.verdict.indexOf('Trap')!==-1||mv.verdict.indexOf('Disconnect')!==-1 ? '#FF4D4D' : mv.verdict.indexOf('Support')!==-1 ? '#00DE94' : '#00AEFF') + ';">' + MP.esc(mv.verdict) + '</span>';
    if(mv.FVD) chips += '<span class="dc-chip">FVD ' + MP.esc(mv.FVD) + '</span>';
    if(mv.VMS) chips += '<span class="dc-chip">VMS ' + MP.esc(mv.VMS) + '</span>';
    if(mv.NRS) chips += '<span class="dc-chip">NRS ' + MP.esc(mv.NRS) + '</span>';

    return '<div class="dc-card dc-' + type + '" data-ticker="' + MP.esc(d.ticker) + '">'
      + '<div class="dc-card-top">'
        + '<span class="dc-card-ticker">' + MP.esc(d.ticker) + '</span>'
        + '<span class="dc-card-badge ' + type + '">' + badgeLabel + '</span>'
      + '</div>'
      + '<div class="dc-card-conf">'
        + '<div class="dc-conf-bar"><div class="dc-conf-fill" style="width:'+confPct+'%;background:'+confColor+';"></div></div>'
        + '<span class="dc-conf-pct" style="color:'+confColor+';">'+confPct+'%</span>'
      + '</div>'
      + '<div class="dc-card-signals">'
        + dots
        + '<span class="dc-signal-label">' + aligned + '/' + total + ' aligned</span>'
      + '</div>'
      + (chips ? '<div class="dc-card-chips">' + chips + '</div>' : '')
      + (parsed.insight ? '<div class="dc-card-reason">' + MP.esc(parsed.insight) + '</div>' : '')
    + '</div>';
  }

  function sectionLabel(icon, text){
    return '<div style="grid-column:1/-1;" class="dc-row-label"><span class="dc-row-icon">' + icon + '</span> ' + text + '</div>';
  }

  async function init(){
    try{
      var rows = await MP.rest('daily_conviction_list',{
        select:'conviction_date,conviction_data,summary',
        order:'conviction_date.desc', limit:'1'
      });
      if(!rows||!rows.length) return;
      var row = rows[0];
      var data;
      try{ data = typeof row.conviction_data === 'string' ? JSON.parse(row.conviction_data) : row.conviction_data; }catch(_){ return; }
      if(!data) return;
      MP.data.conviction = data;

      var section = document.getElementById('dc-section');
      if(!section) return;
      section.style.display = 'block';

      var dateEl = document.getElementById('dc-date');
      if(dateEl) dateEl.textContent = row.conviction_date || '';

      var safeN = (data.strong_conviction_safe||[]).length;
      var avoidN = (data.strong_conviction_avoid||[]).length;
      var monN = (data.monitoring_notable||[]).length;
      var sumEl = document.getElementById('dc-summary-line');
      if(sumEl) sumEl.textContent = safeN + ' safe \u00B7 ' + avoidN + ' avoid \u00B7 ' + monN + ' monitoring';

      var grid = document.getElementById('dc-grid');
      if(!grid) return;
      var html = '';

      if(safeN){
        html += sectionLabel('\u2705', 'Safe \u2014 Structurally supported');
        (data.strong_conviction_safe||[]).forEach(function(d){ html += buildCard(d, 'safe'); });
      }
      var avoidCards = (data.strong_conviction_avoid||[]).slice(0,6);
      if(avoidCards.length){
        html += sectionLabel('\uD83D\uDEA8', 'Avoid \u2014 High-conviction traps');
        avoidCards.forEach(function(d){ html += buildCard(d, 'avoid'); });
      }
      var monCards = (data.monitoring_notable||[]).slice(0,4);
      if(monCards.length){
        html += sectionLabel('\uD83D\uDD0D', 'Watch \u2014 Monitor for resolution');
        monCards.forEach(function(d){ html += buildCard(d, 'monitor'); });
      }
      var earnCards = (data.earnings_imminent||[]);
      if(earnCards.length){
        html += sectionLabel('\uD83D\uDCC5', 'Earnings Imminent');
        earnCards.forEach(function(d){
          html += '<div class="dc-card dc-monitor" data-ticker="'+MP.esc(d.ticker)+'">'
            + '<div class="dc-card-top">'
              + '<span class="dc-card-ticker">'+MP.esc(d.ticker)+'</span>'
              + '<span class="dc-card-badge monitor">'+MP.esc(d.dte)+' DAYS</span>'
            + '</div>'
            + '<div class="dc-card-reason">'+MP.esc((d.current_verdict||'')+' \u2014 '+(d.note||''))+'</div>'
          + '</div>';
        });
      }

      grid.innerHTML = html;

      // Click handlers
      grid.querySelectorAll('.dc-card[data-ticker]').forEach(function(card){
        card.addEventListener('click', function(){
          window.location.href = '/ticker/' + encodeURIComponent(this.dataset.ticker);
        });
      });
    }catch(e){ console.warn('[DC] Load failed:', e); }
  }

  MP.register('daily-conviction', init);
})();
