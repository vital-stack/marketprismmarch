// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Market Map Module (Force-Directed Graph)
// Interactive bubble mind-map: tickers clustered by sector, colored by direction
// Click to expand, drag to explore, zoom to focus
// ══════════════════════════════════════════════════════════════════════════════
(function(){

var COLORS = {
  BEARISH:  { fill:'rgba(255,77,77,0.8)',  stroke:'#FF4D4D', glow:'rgba(255,77,77,0.3)' },
  BULLISH:  { fill:'rgba(0,222,148,0.8)',  stroke:'#00DE94', glow:'rgba(0,222,148,0.3)' },
  NEUTRAL:  { fill:'rgba(0,174,255,0.6)',  stroke:'#00AEFF', glow:'rgba(0,174,255,0.2)' }
};
var TIER_SCALE = { PLATINUM:1.4, GOLD:1.2, SURPRISE:1.1, STANDARD:1.0 };
var SECTOR_COLORS = {
  'Technology':'#00AEFF','Healthcare':'#00DE94','Energy':'#FFB800',
  'Financials':'#7B61FF','Industrials':'#38C8B8','Consumer Discretionary':'#FF6B9D',
  'Consumer Staples':'#A0A8B0','Materials':'#FF8C00','Communication Services':'#E040FB',
  'Utilities':'#66BB6A','Real Estate':'#8D6E63'
};

function getSectorColor(sector){
  return SECTOR_COLORS[sector] || '#00AEFF';
}

// Sector grid layout — group nodes into labeled sector zones
function sectorGridLayout(nodes, width, height){
  // Group by sector
  var sectors = {};
  nodes.forEach(function(n){
    var s = n.sector || 'Other';
    if(!sectors[s]) sectors[s] = [];
    sectors[s].push(n);
  });
  var sectorNames = Object.keys(sectors).sort(function(a,b){
    return sectors[b].length - sectors[a].length; // biggest sectors first
  });

  // Calculate grid: how many sector columns fit?
  var nodeSize = 56; // diameter + label space
  var sectorPad = 20;
  var labelH = 24;
  var cols = Math.max(2, Math.min(4, Math.floor(width / 240)));
  var colW = (width - sectorPad) / cols;

  var curCol = 0;
  var colY = []; // track Y position per column
  for(var c = 0; c < cols; c++) colY.push(sectorPad);

  // Store sector label positions for rendering
  nodes._sectorLabels = [];

  sectorNames.forEach(function(sName){
    var group = sectors[sName];
    // Pick shortest column
    var minCol = 0;
    for(var c = 1; c < cols; c++) if(colY[c] < colY[minCol]) minCol = c;

    var sx = minCol * colW + sectorPad; // sector X start
    var sy = colY[minCol]; // sector Y start

    // Sector label
    nodes._sectorLabels.push({ text: sName, x: sx, y: sy + 12 });
    sy += labelH;

    // Lay out nodes in a mini-grid within this sector
    var perRow = Math.max(2, Math.floor((colW - sectorPad) / nodeSize));
    group.forEach(function(n, i){
      var row = Math.floor(i / perRow);
      var col = i % perRow;
      n.x = sx + col * nodeSize + nodeSize/2;
      n.y = sy + row * nodeSize + nodeSize/2;
    });

    var rows = Math.ceil(group.length / perRow);
    colY[minCol] = sy + rows * nodeSize + sectorPad;
  });

  // Return needed height
  var maxY = 0;
  for(var c = 0; c < cols; c++) if(colY[c] > maxY) maxY = colY[c];
  return maxY + 20;
}

function render(canvas, nodes, hoveredIdx, selectedIdx){
  var ctx = canvas.getContext('2d');
  var w = canvas.width;
  var h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Draw sector labels from grid layout
  if(nodes._sectorLabels){
    nodes._sectorLabels.forEach(function(sl){
      var sc = SECTOR_COLORS[sl.text] || '#00AEFF';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = sc;
      ctx.globalAlpha = 0.7;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(sl.text.toUpperCase(), sl.x, sl.y);
      // Underline
      var tw = ctx.measureText(sl.text.toUpperCase()).width;
      ctx.beginPath();
      ctx.moveTo(sl.x, sl.y + 8);
      ctx.lineTo(sl.x + tw, sl.y + 8);
      ctx.strokeStyle = sc;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  // Draw nodes
  nodes.forEach(function(n, i){
    var isHovered = i === hoveredIdx;
    var isSelected = i === selectedIdx;
    var colors = COLORS[n.direction] || COLORS.NEUTRAL;
    var r = n.radius * (isHovered ? 1.15 : 1);

    // Glow for hovered/selected
    if(isHovered || isSelected){
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 8, 0, Math.PI*2);
      ctx.fillStyle = colors.glow;
      ctx.fill();
    }

    // Circle background
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(12,16,24,0.9)';
    ctx.fill();

    // Draw logo if loaded, else fallback to initials
    if(n._logoImg && n._logoImg.complete && n._logoImg.naturalWidth > 0){
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, r - 3, 0, Math.PI*2);
      ctx.clip();
      var imgSize = (r - 3) * 1.4;
      ctx.drawImage(n._logoImg, n.x - imgSize/2, n.y - imgSize/2, imgSize, imgSize);
      ctx.restore();
    } else {
      // Fallback: ticker initials
      ctx.font = 'bold ' + (r > 20 ? '13' : '10') + 'px Inter, sans-serif';
      ctx.fillStyle = colors.stroke;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.ticker.slice(0, 4), n.x, n.y);
    }

    // Direction-colored ring
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI*2);
    ctx.strokeStyle = isHovered ? '#fff' : colors.stroke;
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.stroke();

    // Ticker name below bubble
    ctx.font = (r > 18 ? '11' : '9') + 'px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(n.ticker, n.x, n.y + r + 4);

    // Confidence % below ticker name for larger nodes
    if(r > 16){
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(n.confPct + '%', n.x, n.y + r + 16);
    }
  });
}

function buildDetailPanel(n){
  var dirColor = n.direction === 'BEARISH' ? '#FF4D4D' : n.direction === 'BULLISH' ? '#00DE94' : '#00AEFF';
  // Action label
  var actions = {
    'NARRATIVE_TRAP': 'Avoid or short — narrative contradicts fundamentals',
    'FUNDAMENTAL_DISCONNECT': 'Avoid — price disconnected from value',
    'FADE_THE_HYPE': 'Fade rallies — hype exceeding reality',
    'DRIFT_COMPRESSION_SHORT': 'Caution — narrative drifting from filings',
    'AIR_POCKET_SHORT': 'Stay away — narrative collapsing',
    'ACCUMULATE': 'Buy dips — fundamentals support the story',
    'MOMENTUM_CONFIRMED': 'Ride the trend — momentum confirmed',
    'FUNDAMENTAL_LONG': 'Accumulate — trading below fair value',
    'OMISSION_CASCADE': 'Avoid — key facts being hidden'
  };
  var action = actions[n.primary_label] || 'Monitor for developments';

  return '<div class="mm-detail" id="mm-detail">'
    + '<button class="mm-detail-close" onclick="document.getElementById(\'mm-detail\').remove();">&times;</button>'
    + '<div class="mm-detail-header">'
      + '<span class="mm-detail-ticker">' + MP.esc(n.ticker) + '</span>'
      + '<span class="mm-detail-dir" style="color:'+dirColor+';">' + MP.esc(n.direction||'') + '</span>'
    + '</div>'
    + '<div class="mm-detail-sector">' + MP.esc((n.sector||'') + (n.industry ? ' \u00B7 ' + n.industry : '')) + '</div>'
    + '<div class="mm-detail-action" style="border-left:3px solid '+dirColor+';padding-left:12px;margin:10px 0;font-size:14px;font-weight:600;color:'+dirColor+';">' + MP.esc(action) + '</div>'
    + '<div class="mm-detail-desc">' + MP.esc(n.description||'') + '</div>'
    + '<div class="mm-detail-stats">'
      + '<div class="mm-stat"><span class="mm-stat-l">Confidence</span><span class="mm-stat-v" style="color:'+dirColor+';">' + n.confPct + '%</span></div>'
      + '<div class="mm-stat"><span class="mm-stat-l">Tier</span><span class="mm-stat-v">' + MP.esc(n.card_tier||'STANDARD') + '</span></div>'
      + (n.price ? '<div class="mm-stat"><span class="mm-stat-l">Price</span><span class="mm-stat-v">$' + MP.fmtPrice(n.price) + '</span></div>' : '')
      + (n.fair_value ? '<div class="mm-stat"><span class="mm-stat-l">Fair Value</span><span class="mm-stat-v">$' + MP.fmtPrice(n.fair_value) + '</span></div>' : '')
    + '</div>'
    + '<a class="mm-detail-link" href="/ticker/'+encodeURIComponent(n.ticker)+'">View Full Analysis \u2192</a>'
  + '</div>';
}

async function init(){
  var container = document.getElementById('mm-container');
  if(!container) return;

  // Show loading state
  var wrap = document.getElementById('mm-wrap');
  if(wrap) wrap.innerHTML = '<canvas class="mm-canvas" id="mm-canvas"></canvas><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--mp-text-muted);font-size:14px;" id="mm-loading">Loading market map\u2026</div>';

  try{
    var rows = await MP.rest('v_trade_cards', {
      select: 'ticker,direction,confidence,card_tier,primary_label,sector,industry,description,price,fair_value',
      order: 'trade_score.desc'
    });

    // Remove loading
    var loadEl = document.getElementById('mm-loading');
    if(loadEl) loadEl.remove();

    if(!rows || !rows.length){
      if(wrap) wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">No signal data available.</div>';
      return;
    }

    var canvas = document.getElementById('mm-canvas');
    if(!canvas || !wrap) return;

    // Get container width — use parent if wrap has no width yet
    var W = wrap.clientWidth || wrap.parentElement.clientWidth || 900;
    var H = Math.max(450, Math.min(650, window.innerHeight * 0.5));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    // Build nodes
    var nodes = rows.map(function(r){
      var conf = r.confidence ? Number(r.confidence) : 0.5;
      var confPct = Math.round(conf * 100);
      var tierMult = TIER_SCALE[r.card_tier] || 1;
      var radius = 22 * tierMult; // uniform size for clean grid
      return {
        ticker: r.ticker,
        direction: (r.direction||'').toUpperCase(),
        confidence: conf,
        confPct: confPct,
        card_tier: r.card_tier,
        primary_label: r.primary_label,
        sector: r.sector || '',
        industry: r.industry || '',
        description: r.description || '',
        price: r.price ? Number(r.price) : null,
        fair_value: r.fair_value ? Number(r.fair_value) : null,
        radius: radius,
        x: 0, y: 0, vx: 0, vy: 0
      };
    });

    // Preload logos
    var logoPromises = nodes.map(function(n){
      var domain = MP.DOMAINS[n.ticker];
      if(!domain) return Promise.resolve();
      return new Promise(function(resolve){
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function(){ n._logoImg = img; resolve(); };
        img.onerror = function(){ resolve(); }; // silent fail — will show initials
        img.src = 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=64';
      });
    });
    // Wait for logos (with 3s timeout so we don't block forever)
    await Promise.race([
      Promise.all(logoPromises),
      new Promise(function(r){ setTimeout(r, 3000); })
    ]);

    // Layout: sector grid
    var neededH = sectorGridLayout(nodes, W, 9999);
    H = Math.max(400, neededH);
    canvas.height = H;
    canvas.style.height = H + 'px';

    // State
    var hoveredIdx = -1;
    var selectedIdx = -1;

    // Render
    render(canvas, nodes, hoveredIdx, selectedIdx);

    // Update legend count
    var bull = nodes.filter(function(n){return n.direction==='BULLISH';}).length;
    var bear = nodes.filter(function(n){return n.direction==='BEARISH';}).length;
    var neut = nodes.length - bull - bear;
    var legendEl = document.getElementById('mm-legend');
    if(legendEl) legendEl.innerHTML =
      '<span style="color:#00DE94;">\u25CF ' + bull + ' Bullish</span>'
      + '<span style="color:#FF4D4D;">\u25CF ' + bear + ' Bearish</span>'
      + '<span style="color:#00AEFF;">\u25CF ' + neut + ' Neutral</span>'
      + '<span style="color:var(--mp-text-muted);">\u25CF ' + nodes.length + ' Total</span>';

    // Hit test
    function getNodeAt(mx, my){
      for(var i = nodes.length - 1; i >= 0; i--){
        var dx = mx - nodes[i].x;
        var dy = my - nodes[i].y;
        if(dx*dx + dy*dy <= nodes[i].radius * nodes[i].radius) return i;
      }
      return -1;
    }

    // Mouse move — hover
    canvas.addEventListener('mousemove', function(e){
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left;
      var my = e.clientY - r.top;
      var idx = getNodeAt(mx, my);
      if(idx !== hoveredIdx){
        hoveredIdx = idx;
        canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
        render(canvas, nodes, hoveredIdx, selectedIdx);
      }
    });

    // Click — show detail panel
    canvas.addEventListener('click', function(e){
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left;
      var my = e.clientY - r.top;
      var idx = getNodeAt(mx, my);
      // Remove existing detail
      var existing = document.getElementById('mm-detail');
      if(existing) existing.remove();
      if(idx >= 0){
        selectedIdx = idx;
        render(canvas, nodes, hoveredIdx, selectedIdx);
        wrap.insertAdjacentHTML('beforeend', buildDetailPanel(nodes[idx]));
      } else {
        selectedIdx = -1;
        render(canvas, nodes, hoveredIdx, selectedIdx);
      }
    });

    // Resize
    window.addEventListener('resize', function(){
      var r2 = wrap.getBoundingClientRect();
      if(Math.abs(r2.width - W) > 50){
        W = r2.width;
        canvas.width = W;
        canvas.style.width = W + 'px';
        forceSimulation(nodes, [], W, H);
        render(canvas, nodes, -1, -1);
      }
    });

  }catch(e){
    console.warn('[MM] Load failed:', e);
    var loadEl2 = document.getElementById('mm-loading');
    if(loadEl2) loadEl2.textContent = 'Failed to load market map: ' + (e.message||e);
    else if(wrap) wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Failed to load market map: '+MP.esc(e.message||'unknown error')+'</div>';
  }
}

MP.register('market-map', init);
})();
