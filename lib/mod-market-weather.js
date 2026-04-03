// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Market Weather Module
// Renders: regime banner, VIX, SPY trend, rates, heatmap
// ══════════════════════════════════════════════════════════════════════════════
(function(){
  var REGIME_ICONS = {choppy:'\u26C8\uFE0F',trending:'\u2600\uFE0F',crisis:'\uD83C\uDF2A\uFE0F',recovery:'\uD83C\uDF24\uFE0F'};
  var RATE_ICONS = {Rising:'\u2B06\uFE0F',Falling:'\u2B07\uFE0F',Stable:'\u27A1\uFE0F'};

  async function init(){
    try{
      var rows = await MP.rest('market_regime_log',{
        select:'date,vix_close,vix_regime,market_regime,spy_trend_5d,spy_trend_20d,rate_environment,is_transitioning',
        order:'date.desc', limit:'1'
      });
      if(!rows||!rows.length)return;
      var r = rows[0];
      MP.data.regime = r;
      render(r);
    }catch(e){console.warn('[MW] Load failed:',e);}
  }

  function render(r){
    var el = document.getElementById('mw-banner');
    if(!el)return;
    var key = (r.market_regime||'').toLowerCase();
    var vix = r.vix_close ? Number(r.vix_close) : 0;
    var t5 = r.spy_trend_5d ? Number(r.spy_trend_5d) : 0;
    var t20 = r.spy_trend_20d ? Number(r.spy_trend_20d) : 0;

    el.className = 'mw-banner mw-' + key;
    el.style.display = 'flex';
    el.innerHTML =
      cell('Market Regime',
        '<span class="mw-icon">'+(REGIME_ICONS[key]||'\uD83C\uDF25\uFE0F')+'</span> '
        + '<span class="regime-'+key+'">'+(r.market_regime||'\u2014')+'</span>',
        r.is_transitioning ? '\u26A0 Transitioning' : 'Established')
      + cell('VIX',
        '<span class="mw-icon">'+(vix>30?'\uD83D\uDD34':vix>20?'\uD83D\uDFE1':'\uD83D\uDFE2')+'</span> '
        + '<span style="color:'+(vix>30?'var(--mp-red)':vix>20?'var(--mp-amber)':'var(--mp-green)')+';">'+vix.toFixed(1)+'</span>',
        r.vix_regime||'')
      + cell('S&P 500',
        '<span style="color:'+(t5>0?'var(--mp-green)':'var(--mp-red)')+';">'+(t5>0?'\u25B2':'\u25BC')+' '+Math.abs(t5).toFixed(2)+'%</span>',
        '20d: '+t20.toFixed(2)+'%')
      + cell('Rates',
        (RATE_ICONS[r.rate_environment]||'')+' '+(r.rate_environment||'\u2014'),
        r.date||'')
      + heatmapCell();
  }

  function cell(label, val, sub){
    return '<div class="mw-cell">'
      +'<div class="mw-label">'+label+'</div>'
      +'<div class="mw-val">'+val+'</div>'
      +'<div class="mw-sub">'+MP.esc(sub)+'</div>'
    +'</div>';
  }

  function heatmapCell(){
    var src = MP.data.cards.length ? MP.data.cards : MP.data.stories;
    var bull=0, bear=0, neutral=0;
    src.forEach(function(r){
      var d = (r.direction||r.prism_verdict||'').toUpperCase();
      if(d.indexOf('BULL')!==-1||d.indexOf('SUPPORT')!==-1||d.indexOf('SURG')!==-1) bull++;
      else if(d.indexOf('BEAR')!==-1||d.indexOf('TRAP')!==-1||d.indexOf('BREAK')!==-1||d.indexOf('DISCONNECT')!==-1) bear++;
      else neutral++;
    });
    var total = bull+bear+neutral;
    if(!total) return '<div class="mw-cell" style="flex:1.5;"><div class="mw-label">Heatmap</div><div class="mw-heatmap"><div class="mw-hm-seg" style="flex:1;background:var(--mp-surface2);color:var(--mp-text-muted);">Loading</div></div></div>';
    var bp=Math.round(bull/total*100), brp=Math.round(bear/total*100), np=100-bp-brp;
    return '<div class="mw-cell" style="flex:1.5;">'
      +'<div class="mw-label">Signal Heatmap</div>'
      +'<div class="mw-heatmap">'
        +(bp?'<div class="mw-hm-seg" style="flex:'+bp+';background:rgba(0,222,148,0.25);color:#00DE94;">'+bp+'% Bull</div>':'')
        +(np?'<div class="mw-hm-seg" style="flex:'+np+';background:rgba(0,174,255,0.15);color:#00AEFF;">'+np+'%</div>':'')
        +(brp?'<div class="mw-hm-seg" style="flex:'+brp+';background:rgba(255,77,77,0.25);color:#FF4D4D;">'+brp+'% Bear</div>':'')
      +'</div>'
      +'<div class="mw-sub">'+bull+' bullish \u00B7 '+bear+' bearish \u00B7 '+neutral+' neutral</div>'
    +'</div>';
  }

  MP.register('market-weather', init);
  // Also export render for refresh after data loads
  MP.refreshWeatherHeatmap = function(){ if(MP.data.regime) render(MP.data.regime); };
})();
