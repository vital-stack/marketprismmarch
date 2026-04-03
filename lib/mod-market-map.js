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

// Simple force simulation (no D3 dependency)
function forceSimulation(nodes, links, width, height){
  // Initialize positions in a circle
  nodes.forEach(function(n, i){
    var angle = (i / nodes.length) * Math.PI * 2;
    var r = Math.min(width, height) * 0.3;
    n.x = width/2 + Math.cos(angle) * r + (Math.random()-0.5) * 40;
    n.y = height/2 + Math.sin(angle) * r + (Math.random()-0.5) * 40;
    n.vx = 0; n.vy = 0;
  });

  // Run 120 iterations
  for(var iter = 0; iter < 120; iter++){
    var alpha = 1 - iter/120;
    // Center gravity
    nodes.forEach(function(n){
      n.vx += (width/2 - n.x) * 0.01 * alpha;
      n.vy += (height/2 - n.y) * 0.01 * alpha;
    });
    // Sector clustering — pull same-sector nodes together
    var sectorCenters = {};
    nodes.forEach(function(n){
      var s = n.sector || 'Other';
      if(!sectorCenters[s]) sectorCenters[s] = {x:0,y:0,count:0};
      sectorCenters[s].x += n.x;
      sectorCenters[s].y += n.y;
      sectorCenters[s].count++;
    });
    Object.keys(sectorCenters).forEach(function(s){
      sectorCenters[s].x /= sectorCenters[s].count;
      sectorCenters[s].y /= sectorCenters[s].count;
    });
    nodes.forEach(function(n){
      var sc = sectorCenters[n.sector || 'Other'];
      n.vx += (sc.x - n.x) * 0.03 * alpha;
      n.vy += (sc.y - n.y) * 0.03 * alpha;
    });
    // Repulsion between all nodes
    for(var i = 0; i < nodes.length; i++){
      for(var j = i+1; j < nodes.length; j++){
        var dx = nodes[j].x - nodes[i].x;
        var dy = nodes[j].y - nodes[i].y;
        var dist = Math.sqrt(dx*dx + dy*dy) || 1;
        var minDist = (nodes[i].radius + nodes[j].radius) * 2.2;
        if(dist < minDist){
          var force = (minDist - dist) / dist * 0.5 * alpha;
          nodes[i].vx -= dx * force;
          nodes[i].vy -= dy * force;
          nodes[j].vx += dx * force;
          nodes[j].vy += dy * force;
        }
      }
    }
    // Apply velocity with damping
    nodes.forEach(function(n){
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
      // Boundary
      n.x = Math.max(n.radius+10, Math.min(width-n.radius-10, n.x));
      n.y = Math.max(n.radius+10, Math.min(height-n.radius-10, n.y));
    });
  }
}

function render(canvas, nodes, hoveredIdx, selectedIdx){
  var ctx = canvas.getContext('2d');
  var w = canvas.width;
  var h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Draw sector labels (behind nodes)
  var sectorPositions = {};
  nodes.forEach(function(n){
    var s = n.sector || 'Other';
    if(!sectorPositions[s]) sectorPositions[s] = {x:0,y:0,count:0};
    sectorPositions[s].x += n.x;
    sectorPositions[s].y += n.y;
    sectorPositions[s].count++;
  });
  Object.keys(sectorPositions).forEach(function(s){
    var sp = sectorPositions[s];
    var cx = sp.x / sp.count;
    var cy = sp.y / sp.count;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.textAlign = 'center';
    ctx.fillText(s.toUpperCase(), cx, cy - 30);
  });

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

    // Circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI*2);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#fff' : colors.stroke;
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.stroke();

    // Ticker label
    ctx.font = (r > 18 ? '12' : '10') + 'px Inter, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.ticker, n.x, n.y);

    // Confidence % below for larger nodes
    if(r > 16){
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(n.confPct + '%', n.x, n.y + r + 12);
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

  try{
    var rows = await MP.rest('v_trade_cards', {
      select: 'ticker,direction,confidence,card_tier,primary_label,sector,industry,description,price,fair_value',
      order: 'trade_score.desc'
    });
    if(!rows || !rows.length){
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">No signal data available.</div>';
      return;
    }

    var wrap = document.getElementById('mm-wrap');
    var canvas = document.getElementById('mm-canvas');
    if(!canvas || !wrap) return;

    var rect = wrap.getBoundingClientRect();
    var W = rect.width || 900;
    var H = Math.max(500, Math.min(700, window.innerHeight * 0.55));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    // Build nodes
    var nodes = rows.map(function(r){
      var conf = r.confidence ? Number(r.confidence) : 0.5;
      var confPct = Math.round(conf * 100);
      var tierMult = TIER_SCALE[r.card_tier] || 1;
      var radius = Math.max(14, Math.min(32, 10 + conf * 20)) * tierMult;
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

    // Run simulation
    forceSimulation(nodes, [], W, H);

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
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Failed to load market map.</div>';
  }
}

MP.register('market-map', init);
})();
