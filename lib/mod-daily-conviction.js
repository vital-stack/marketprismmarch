// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Daily Conviction Module
// Renders: SAFE / AVOID / WATCH cards from daily_conviction_list
// ══════════════════════════════════════════════════════════════════════════════
(function(){

  function cleanReasoning(raw){
    // Strip all quant noise and return plain-English insight only
    if(!raw) return '';
    // Split on periods to get sentences
    var sentences = raw.split(/\.\s+/);
    var clean = [];
    sentences.forEach(function(s){
      s = s.trim();
      if(!s) return;
      // Skip sentences that are mostly metric assignments
      if(/^[A-Z]{2,}\s*=/.test(s)) return;           // starts with VMS=, NRS=, etc
      if(/^\w+=[\d.]+/.test(s)) return;               // starts with key=value
      if(/^verdict=/i.test(s)) return;                // starts with verdict=
      if(/^coord=/i.test(s)) return;                  // starts with coord=
      if(s.split('=').length > 3) return;             // too many key=value pairs
      // Strip inline metric references from otherwise good sentences
      s = s.replace(/\b(VMS|NRS|FVD|CCP|ACS|SRS|BFS|OR|DTE|conf|coord|drift|exhaust|energy)\s*[=:]\s*[\d.]+%?/gi, '');
      s = s.replace(/\b\d+(\.\d+)?%?\s*(overvaluation|confidence\s+trap)/gi, function(m,n,w){ return w; });
      s = s.replace(/\(?\s*score:?\s*\d+\s*\)?/gi, '');
      s = s.replace(/\s{2,}/g, ' ').trim();
      // Skip if too short after cleanup
      if(s.length < 15) return;
      // Skip if still mostly numbers/acronyms
      var letters = s.replace(/[^a-zA-Z]/g, '');
      if(letters.length < s.length * 0.4) return;
      clean.push(s);
    });
    var result = clean.join('. ');
    if(result && !result.endsWith('.')) result += '.';
    return result;
  }

  function getVerdict(raw){
    if(!raw) return '';
    var m = raw.match(/verdict=([^,]+)/);
    return m ? m[1].trim() : '';
  }

  function verdictColor(v){
    if(!v) return 'var(--mp-text-tertiary)';
    var lc = v.toLowerCase();
    if(lc.indexOf('trap')!==-1 || lc.indexOf('disconnect')!==-1 || lc.indexOf('cascade')!==-1) return '#FF4D4D';
    if(lc.indexOf('support')!==-1 || lc.indexOf('confirmed')!==-1) return '#00DE94';
    if(lc.indexOf('air pocket')!==-1) return '#FF4D4D';
    return '#00AEFF';
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

    // Get verdict for one clean chip
    var verdict = getVerdict(d.reasoning);
    var vColor = verdictColor(verdict);

    // Clean reasoning — plain English only
    var insight = cleanReasoning(d.reasoning);

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
      + (verdict ? '<div class="dc-card-chips"><span class="dc-chip" style="color:'+vColor+';border-color:'+vColor+'33;">'+MP.esc(verdict)+'</span></div>' : '')
      + (insight ? '<div class="dc-card-reason">' + MP.esc(insight) + '</div>' : '')
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
          var earnInsight = cleanReasoning(d.note||'');
          html += '<div class="dc-card dc-monitor" data-ticker="'+MP.esc(d.ticker)+'">'
            + '<div class="dc-card-top">'
              + '<span class="dc-card-ticker">'+MP.esc(d.ticker)+'</span>'
              + '<span class="dc-card-badge monitor">'+MP.esc(d.dte)+' DAYS</span>'
            + '</div>'
            + (earnInsight ? '<div class="dc-card-reason">'+MP.esc(earnInsight)+'</div>' : '')
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
