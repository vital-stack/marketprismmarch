// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Trading Calendar Module (v2)
// Monthly planner with market events, signal cards, drag-to-queue
// ══════════════════════════════════════════════════════════════════════════════
(function(){

// ── Static 2026 Market Events ────────────────────────────────────────────────
var HOLIDAYS = {
  '2026-01-01':'New Year\'s Day','2026-01-19':'MLK Jr. Day','2026-02-16':'Presidents\' Day',
  '2026-04-03':'Good Friday','2026-05-25':'Memorial Day','2026-06-19':'Juneteenth',
  '2026-07-04':'Independence Day','2026-09-07':'Labor Day',
  '2026-11-26':'Thanksgiving','2026-12-25':'Christmas'
};
var FOMC = [
  {d1:'2026-01-27',d2:'2026-01-28',sep:false},{d1:'2026-03-17',d2:'2026-03-18',sep:true},
  {d1:'2026-05-06',d2:'2026-05-07',sep:false},{d1:'2026-06-17',d2:'2026-06-18',sep:true},
  {d1:'2026-07-29',d2:'2026-07-30',sep:false},{d1:'2026-09-16',d2:'2026-09-17',sep:true},
  {d1:'2026-10-28',d2:'2026-10-29',sep:false},{d1:'2026-12-09',d2:'2026-12-10',sep:true}
];
var OPEX = {
  '2026-01-16':'Jan OPEX','2026-02-20':'Feb OPEX','2026-03-20':'Mar OPEX',
  '2026-04-02':'Apr OPEX','2026-05-15':'May OPEX','2026-06-18':'Jun OPEX',
  '2026-07-17':'Jul OPEX','2026-08-21':'Aug OPEX','2026-09-18':'Sep OPEX',
  '2026-10-16':'Oct OPEX','2026-11-20':'Nov OPEX','2026-12-18':'Dec OPEX'
};
var QUAD = {'2026-03-20':1,'2026-06-18':1,'2026-09-18':1,'2026-12-18':1};

var STORAGE_KEY = 'mp_cal_v2';
var calMonth, calYear, queued, signals, earningsByDate, dragData;

function pad(n){ return n < 10 ? '0'+n : ''+n; }
function dateStr(y,m,d){ return y+'-'+pad(m+1)+'-'+pad(d); }

// ── Events for a date ────────────────────────────────────────────────────────
function getEvents(ds){
  var evts = [];
  if(HOLIDAYS[ds]) evts.push({type:'holiday',color:'#FF4D4D',label:HOLIDAYS[ds]});
  FOMC.forEach(function(f){
    if(ds===f.d1) evts.push({type:'fomc',color:'#FFB800',label:'FOMC Day 1'});
    if(ds===f.d2) evts.push({type:'fomc',color:'#FFB800',label:'FOMC Decision'+(f.sep?' + SEP':'')});
  });
  if(OPEX[ds]) evts.push({type:'opex',color:'var(--mp-cyan)',label:OPEX[ds]});
  if(QUAD[ds]) evts.push({type:'quad',color:'#FF4D4D',label:'Quad Witching'});
  if(earningsByDate && earningsByDate[ds]){
    earningsByDate[ds].forEach(function(e){
      evts.push({type:'earnings',color:'var(--mp-cyan)',label:e.ticker+' Earnings'});
    });
  }
  return evts;
}

// ── Queued items persistence ─────────────────────────────────────────────────
function loadQueued(){
  try{ queued = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }catch(_){ queued = {}; }
}
function saveQueued(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(queued)); }catch(_){}
  renderSummary();
}
function queueSignal(ds, sig){
  if(!queued[ds]) queued[ds] = [];
  queued[ds].push({id:sig.id||sig.ticker.toLowerCase(), ticker:sig.ticker, direction:sig.direction||''});
  saveQueued();
}
function removeQueued(ds, idx){
  if(queued[ds]){ queued[ds].splice(idx,1); if(!queued[ds].length) delete queued[ds]; }
  saveQueued();
}

// ── Render signal strip ──────────────────────────────────────────────────────
function renderSignalStrip(container){
  if(!signals || !signals.length){
    container.innerHTML = '<div style="padding:20px;color:var(--mp-text-muted);font-size:13px;">No signals available.</div>';
    return;
  }
  var html = '<div class="cal-strip-label">Drag signals onto dates to plan trades</div><div class="cal-strip-scroll">';
  signals.forEach(function(s, i){
    var dir = (s.direction||'').toUpperCase();
    var dirColor = dir === 'BEARISH' ? '#FF4D4D' : 'var(--mp-cyan)';
    var domain = MP.DOMAINS[s.ticker];
    var logo = domain ? '<img class="cal-strip-logo" src="https://www.google.com/s2/favicons?domain='+domain+'&sz=32" alt="" onerror="this.style.display=\'none\';">' : '';
    var action = {
      'NARRATIVE_TRAP':'Short or avoid','FUNDAMENTAL_DISCONNECT':'Avoid','FADE_THE_HYPE':'Fade rallies',
      'DRIFT_COMPRESSION_SHORT':'Short on bounce','AIR_POCKET_SHORT':'Stay away',
      'ACCUMULATE':'Buy dips','MOMENTUM_CONFIRMED':'Ride the trend','FUNDAMENTAL_LONG':'Accumulate'
    }[s.primary_label] || 'Monitor';

    html += '<div class="cal-strip-card" draggable="true" data-idx="'+i+'">'
      + '<div class="cal-strip-card-top">'
        + logo
        + '<span class="cal-strip-ticker">'+MP.esc(s.ticker)+'</span>'
        + '<span class="cal-strip-dir" style="color:'+dirColor+';">'+(dir==='BEARISH'?'\u25BC':dir==='BULLISH'?'\u25B2':'')+' '+MP.esc(dir||'')+'</span>'
      + '</div>'
      + '<div class="cal-strip-action">'+MP.esc(action)+'</div>'
      + (s.holding_days ? '<div class="cal-strip-meta">'+s.holding_days+'d window</div>' : '')
    + '</div>';
  });
  html += '</div>';
  container.innerHTML = html;

  // Drag handlers
  container.querySelectorAll('.cal-strip-card[draggable]').forEach(function(card){
    card.addEventListener('dragstart', function(e){
      var idx = parseInt(this.dataset.idx);
      dragData = signals[idx];
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', dragData.ticker);
    });
    card.addEventListener('dragend', function(){
      this.classList.remove('dragging');
      dragData = null;
    });
  });
}

// ── Render calendar grid ─────────────────────────────────────────────────────
function renderCalendar(container){
  var today = new Date();
  var todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
  var firstDay = new Date(calYear, calMonth, 1).getDay();
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var html = '<div class="cal-nav">'
    + '<button class="cal-nav-btn" id="cal-prev">\u2039</button>'
    + '<span class="cal-nav-title">'+monthNames[calMonth]+' '+calYear+'</span>'
    + '<button class="cal-nav-btn" id="cal-next">\u203A</button>'
  + '</div>';

  html += '<div class="cal-grid">';
  // Day headers
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(function(d){
    html += '<div class="cal-day-header">'+d+'</div>';
  });

  // Fill previous month's trailing days
  var prevMonthDays = new Date(calYear, calMonth, 0).getDate();
  for(var e = firstDay - 1; e >= 0; e--){
    var prevD = prevMonthDays - e;
    var prevM = calMonth - 1;
    var prevY = calYear;
    if(prevM < 0){ prevM = 11; prevY--; }
    var prevDs = dateStr(prevY, prevM, prevD);
    var prevEvts = getEvents(prevDs);
    html += '<div class="cal-day cal-other-month" data-date="'+prevDs+'">';
    html += '<div class="cal-day-num">'+prevD+'</div>';
    if(prevEvts.length){
      html += '<div class="cal-day-events">';
      prevEvts.forEach(function(ev){ html += '<div class="cal-evt" style="color:'+ev.color+';"><span class="cal-evt-dot" style="background:'+ev.color+';"></span>'+MP.esc(ev.label)+'</div>'; });
      html += '</div>';
    }
    html += '</div>';
  }

  // Current month day cells
  for(var d = 1; d <= daysInMonth; d++){
    var ds = dateStr(calYear, calMonth, d);
    var isToday = ds === todayStr;
    var isPast = new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var isClosed = !!HOLIDAYS[ds];
    var events = getEvents(ds);
    var qItems = queued[ds] || [];
    var cls = 'cal-day' + (isToday ? ' cal-today' : '') + (isPast ? ' cal-past' : '') + (isClosed ? ' cal-closed' : '');

    html += '<div class="'+cls+'" data-date="'+ds+'">';
    html += '<div class="cal-day-num">' + d + '</div>';

    // Events
    if(events.length){
      html += '<div class="cal-day-events">';
      events.forEach(function(ev){
        html += '<div class="cal-evt" style="color:'+ev.color+';"><span class="cal-evt-dot" style="background:'+ev.color+';"></span>'+MP.esc(ev.label)+'</div>';
      });
      html += '</div>';
    }

    // Queued chips
    if(qItems.length){
      html += '<div class="cal-day-queued">';
      qItems.forEach(function(q, qi){
        var qColor = (q.direction||'').toUpperCase() === 'BEARISH' ? '#FF4D4D' : 'var(--mp-cyan)';
        html += '<div class="cal-chip" style="border-color:'+qColor+'33;"><span class="cal-chip-dot" style="background:'+qColor+';"></span>'+MP.esc(q.ticker)+'<button class="cal-chip-x" data-date="'+ds+'" data-qi="'+qi+'">\u00D7</button></div>';
      });
      html += '</div>';
    }

    // Drop hint
    html += '<div class="cal-drop-hint">Drop here</div>';
    html += '</div>';
  }

  // Fill next month's leading days
  var totalCells = firstDay + daysInMonth;
  var remainder = totalCells % 7;
  if(remainder){
    var nextM = calMonth + 1;
    var nextY = calYear;
    if(nextM > 11){ nextM = 0; nextY++; }
    for(var t = 1; t <= 7 - remainder; t++){
      var nextDs = dateStr(nextY, nextM, t);
      var nextEvts = getEvents(nextDs);
      html += '<div class="cal-day cal-other-month" data-date="'+nextDs+'">';
      html += '<div class="cal-day-num">'+t+'</div>';
      if(nextEvts.length){
        html += '<div class="cal-day-events">';
        nextEvts.forEach(function(ev){ html += '<div class="cal-evt" style="color:'+ev.color+';"><span class="cal-evt-dot" style="background:'+ev.color+';"></span>'+MP.esc(ev.label)+'</div>'; });
        html += '</div>';
      }
      html += '</div>';
    }
  }

  html += '</div>';
  container.innerHTML = html;

  // Month nav
  document.getElementById('cal-prev').addEventListener('click', function(){
    calMonth--; if(calMonth < 0){ calMonth = 11; calYear--; }
    renderCalendar(container);
  });
  document.getElementById('cal-next').addEventListener('click', function(){
    calMonth++; if(calMonth > 11){ calMonth = 0; calYear++; }
    renderCalendar(container);
  });

  // Drop zones
  container.querySelectorAll('.cal-day[data-date]').forEach(function(cell){
    cell.addEventListener('dragover', function(e){
      e.preventDefault();
      this.classList.add('cal-drag-over');
    });
    cell.addEventListener('dragleave', function(){
      this.classList.remove('cal-drag-over');
    });
    cell.addEventListener('drop', function(e){
      e.preventDefault();
      this.classList.remove('cal-drag-over');
      if(!dragData) return;
      var ds = this.dataset.date;
      queueSignal(ds, dragData);
      dragData = null;
      renderCalendar(container);
    });
  });

  // Remove queued chips
  container.querySelectorAll('.cal-chip-x').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      removeQueued(this.dataset.date, parseInt(this.dataset.qi));
      renderCalendar(container);
    });
  });
}

// ── Render summary ───────────────────────────────────────────────────────────
function renderSummary(){
  var el = document.getElementById('cal-summary');
  if(!el) return;
  var total = 0;
  var tickers = {};
  Object.keys(queued).forEach(function(ds){
    (queued[ds]||[]).forEach(function(q){
      total++;
      tickers[q.ticker] = q.direction || '';
    });
  });
  if(!total){
    el.innerHTML = '<span style="color:var(--mp-text-muted);">No trades queued. Drag signal cards onto calendar dates.</span>';
    return;
  }
  var chips = '';
  Object.keys(tickers).forEach(function(t){
    var c = (tickers[t]||'').toUpperCase() === 'BEARISH' ? '#FF4D4D' : 'var(--mp-cyan)';
    chips += '<span class="cal-sum-chip"><span class="cal-sum-dot" style="background:'+c+';"></span>'+MP.esc(t)+'</span>';
  });
  el.innerHTML = '<span class="cal-sum-count">'+total+'</span> queued '+chips;
}

// ── Build earnings index from signals ────────────────────────────────────────
function buildEarningsIndex(rows){
  earningsByDate = {};
  rows.forEach(function(r){
    if(r.days_to_earnings != null && r.days_to_earnings >= 0 && r.snapshot_date){
      var base = new Date(r.snapshot_date+'T00:00:00');
      base.setDate(base.getDate() + r.days_to_earnings);
      var ds = dateStr(base.getFullYear(), base.getMonth(), base.getDate());
      if(!earningsByDate[ds]) earningsByDate[ds] = [];
      earningsByDate[ds].push({ticker: r.ticker});
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init(){
  var root = document.getElementById('calendar-root');
  if(!root) return;
  root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Loading Trading Calendar\u2026</div>';

  var now = new Date();
  calMonth = now.getMonth();
  calYear = now.getFullYear();
  loadQueued();
  dragData = null;
  earningsByDate = {};

  try{
    var rows = await MP.rest('trade_cards_live', {
      select: 'ticker,direction,confidence,card_tier,primary_label,timeframe,holding_days,price,days_to_earnings,snapshot_date',
      order: 'confidence.desc'
    });
    signals = rows || [];
    if(rows && rows.length) buildEarningsIndex(rows);

    // Build layout
    root.innerHTML = '<div class="page-header">'
        + '<div class="ph-eyebrow">Trade Planner</div>'
        + '<h1>Plan around what matters.</h1>'
        + '<span class="ph-italic">Every catalyst mapped.</span>'
        + '<p>Drag signal cards onto calendar dates to plan trades around FOMC, earnings, OPEX, and every market-moving event.</p>'
      + '</div>'
      + '<div class="cal-signals" id="cal-signals"></div>'
      + '<div id="cal-container"></div>'
      + '<div class="cal-summary-wrap"><div class="cal-summary" id="cal-summary"></div></div>'
      + '<div class="cal-legend">'
        + '<span class="cal-legend-item"><span class="cal-legend-dot" style="background:#FF4D4D;"></span>Holiday / Quad</span>'
        + '<span class="cal-legend-item"><span class="cal-legend-dot" style="background:#FFB800;"></span>FOMC</span>'
        + '<span class="cal-legend-item"><span class="cal-legend-dot" style="background:var(--mp-cyan);"></span>OPEX / Earnings</span>'
      + '</div>';

    renderSignalStrip(document.getElementById('cal-signals'));
    renderCalendar(document.getElementById('cal-container'));
    renderSummary();

  }catch(e){
    console.warn('[CAL] Load failed:', e);
    root.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mp-text-muted);">Failed to load calendar.</div>';
  }
}

MP.register('calendar', init);
})();
