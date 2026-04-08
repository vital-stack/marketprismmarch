// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Sectors & Themes Module
// Horizontal scroll rows for sector intelligence + market-wide narratives
// ══════════════════════════════════════════════════════════════════════════════
(function(){

async function init(){
  var container = document.getElementById('st-container');
  if(!container) return;

  try{
    // Fetch sector intelligence + macro events in parallel
    var sectorRows = await MP.rest('sector_intelligence', {
      select: 'sector,subsector,key_strengths,key_weaknesses,emerging_themes,ticker',
      order: 'sector.asc',
      limit: '50'
    }).catch(function(){ return []; });

    var macroRows = await MP.rest('detected_macro_events', {
      select: 'event_type,description,affected_tickers,detected_date,severity',
      order: 'detected_date.desc',
      limit: '20'
    }).catch(function(){ return []; });

    if(!sectorRows.length && !macroRows.length){
      container.style.display = 'none';
      return;
    }

    var html = '';

    // ── Sectors ──
    if(sectorRows.length){
      // Group by sector
      var sectors = {};
      sectorRows.forEach(function(r){
        var s = r.sector || 'Other';
        if(!sectors[s]) sectors[s] = {themes:'', strengths:'', weaknesses:'', tickers:[]};
        if(r.emerging_themes) sectors[s].themes = r.emerging_themes;
        if(r.key_strengths) sectors[s].strengths = r.key_strengths;
        if(r.key_weaknesses) sectors[s].weaknesses = r.key_weaknesses;
        if(r.ticker) sectors[s].tickers.push(r.ticker);
      });

      html += '<div class="st-section">'
        + '<div class="st-section-header">Sector Intelligence</div>'
        + '<div class="scroll-wrap">'
        + '<button class="scroll-arrow scroll-arrow-l" data-scroll="st-scroll-sectors" data-dir="-1">\u2039</button>'
        + '<div class="st-scroll-row" id="st-scroll-sectors">';

      Object.keys(sectors).forEach(function(name){
        var s = sectors[name];
        var tickerList = s.tickers.slice(0, 6).join(', ');
        html += '<div class="st-card">'
          + '<div class="st-card-title">' + MP.esc(name) + '</div>'
          + (s.themes ? '<div class="st-card-theme">' + MP.esc(s.themes) + '</div>' : '')
          + (s.strengths ? '<div class="st-card-body"><span class="st-label">Strength:</span> ' + MP.esc(s.strengths.split(';')[0]) + '</div>' : '')
          + (s.weaknesses ? '<div class="st-card-body"><span class="st-label">Risk:</span> ' + MP.esc(s.weaknesses.split(';')[0]) + '</div>' : '')
          + (tickerList ? '<div class="st-card-tickers">' + MP.esc(tickerList) + '</div>' : '')
        + '</div>';
      });

      html += '</div>'  // close st-scroll-row
        + '<button class="scroll-arrow scroll-arrow-r" data-scroll="st-scroll-sectors" data-dir="1">\u203A</button>'
        + '</div>'  // close scroll-wrap
        + '</div>'; // close st-section
    }

    // ── Market-Wide Narratives ──
    if(macroRows.length){
      html += '<div class="st-section">'
        + '<div class="st-section-header">Market-Wide Narratives</div>'
        + '<div class="scroll-wrap">'
        + '<button class="scroll-arrow scroll-arrow-l" data-scroll="st-scroll-macro" data-dir="-1">\u2039</button>'
        + '<div class="st-scroll-row" id="st-scroll-macro">';

      macroRows.forEach(function(r){
        var sevColor = r.severity === 'high' ? '#FF4D4D' : r.severity === 'medium' ? '#FFB800' : 'var(--mp-text-muted)';
        var tickers = r.affected_tickers || '';
        // Clean up tickers if it's an array or comma list
        if(Array.isArray(tickers)) tickers = tickers.slice(0, 5).join(', ');
        else if(typeof tickers === 'string' && tickers.length > 40) tickers = tickers.substring(0, 40) + '...';

        html += '<div class="st-card">'
          + '<div class="st-card-title">' + MP.esc(r.event_type || 'Market Event') + '</div>'
          + (r.detected_date ? '<div class="st-card-date">' + MP.esc(r.detected_date) + '</div>' : '')
          + '<div class="st-card-body">' + MP.esc(r.description || '') + '</div>'
          + (tickers ? '<div class="st-card-tickers">' + MP.esc(tickers) + '</div>' : '')
          + (r.severity ? '<div class="st-card-sev" style="color:' + sevColor + ';">' + MP.esc(r.severity.toUpperCase()) + '</div>' : '')
        + '</div>';
      });

      html += '</div>'  // close st-scroll-row
        + '<button class="scroll-arrow scroll-arrow-r" data-scroll="st-scroll-macro" data-dir="1">\u203A</button>'
        + '</div>'  // close scroll-wrap
        + '</div>'; // close st-section
    }

    container.innerHTML = html;

    // Scroll arrow handlers
    container.querySelectorAll('.scroll-arrow').forEach(function(btn){
      btn.addEventListener('click', function(){
        var row = document.getElementById(this.dataset.scroll);
        if(!row) return;
        row.scrollBy({ left: parseInt(this.dataset.dir) * Math.min(320, row.offsetWidth * 0.7), behavior: 'smooth' });
      });
    });
    container.style.display = 'block';

  }catch(e){ console.warn('[ST] Load failed:', e); }
}

MP.register('sectors-themes', init);
})();
