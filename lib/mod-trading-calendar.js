// ══════════════════════════════════════════════════════════════════════════════
// Market Prism — Trading Calendar Module (v2)
// Copied from production tc-cal approach: DOM manipulation, not innerHTML
// ══════════════════════════════════════════════════════════════════════════════
(function(){

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
var ACTIONS = {
  'NARRATIVE_TRAP':'Short or avoid','FUNDAMENTAL_DISCONNECT':'Avoid','FADE_THE_HYPE':'Fade rallies',
  'DRIFT_COMPRESSION_SHORT':'Short on bounce','AIR_POCKET_SHORT':'Stay away',
  'ACCUMULATE':'Buy dips','MOMENTUM_CONFIRMED':'Ride the trend','FUNDAMENTAL_LONG':'Accumulate'
};

var STORAGE_KEY = 'mp_cal_v2';
var calMonth, calYear, queued, signals, earningsByDate, dragData;

function pad(n){ return n < 10 ? '0'+n : ''+n; }
function ds(y,m,d){ return y+'-'+pad(m+1)+'-'+pad(d); }

function getEvents(dateStr){
  var evts = [];
  if(HOLIDAYS[dateStr]) evts.push({color:'var(--mp-red)',label:HOLIDAYS[dateStr]});
  FOMC.forEach(function(f){
    if(dateStr===f.d1) evts.push({color:'#FFB800',label:'FOMC Day 1'});
    if(dateStr===f.d2) evts.push({color:'#FFB800',label:'FOMC Decision'+(f.sep?' + SEP':'')});
  });
  if(OPEX[dateStr]) evts.push({color:'var(--mp-cyan)',label:OPEX[dateStr]});
  if(QUAD[dateStr]) evts.push({color:'#FF4D4D',label:'Quad Witching'});
  if(earningsByDate && earningsByDate[dateStr]){
    earningsByDate[dateStr].forEach(function(e){
      evts.push({color:'var(--mp-cyan)',label:e.ticker+' Earnings'});
    });
  }
  return evts;
}

function loadQueued(){ try{ queued = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }catch(_){ queued = {}; } }
function saveQueued(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(queued)); }catch(_){} updateSummary(); }

// ── Render calendar using DOM manipulation (same as production) ──────────────
function renderCalendar(){
  var grid = document.getElementById('tc-cal-grid');
  var title = document.getElementById('tc-cal-month-title');
  if(!grid || !title) return;

  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  title.textContent = months[calMonth] + ' ' + calYear;

  // Remove old day cells but keep DOW headers
  grid.querySelectorAll('.tc-cal-day').forEach(function(d){ d.remove(); });

  var firstDay = new Date(calYear, calMonth, 1).getDay();
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  var today = new Date();
  var todayStr = ds(today.getFullYear(), today.getMonth(), today.getDate());

  // Previous month fill
  var prevDays = new Date(calYear, calMonth, 0).getDate();
  for(var p = firstDay - 1; p >= 0; p--){
    var cell = document.createElement('div');
    cell.className = 'tc-cal-day empty';
    var num = document.createElement('div');
    num.className = 'tc-cal-day-num';
    num.textContent = prevDays - p;
    cell.appendChild(num);
    grid.appendChild(cell);
  }

  // Current month days
  for(var d = 1; d <= daysInMonth; d++){
    var dateStr = ds(calYear, calMonth, d);
    var cell = document.createElement('div');
    cell.className = 'tc-cal-day';
    cell.dataset.date = dateStr;
    var isToday = dateStr === todayStr;
    var isClosed = !!HOLIDAYS[dateStr];
    var isPast = new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if(isToday) cell.classList.add('today');
    if(isPast && !isToday) cell.classList.add('past');
    if(isClosed) cell.classList.add('closed');

    var numEl = document.createElement('div');
    numEl.className = 'tc-cal-day-num';
    numEl.textContent = d;
    cell.appendChild(numEl);

    if(isClosed){
      var cl = document.createElement('div');
      cl.className = 'tc-cal-day-closed';
      cl.textContent = 'CLOSED';
      cell.appendChild(cl);
    }

    var evts = getEvents(dateStr);
    if(evts.length){
      var evWrap = document.createElement('div');
      evWrap.className = 'tc-cal-day-events';
      evts.forEach(function(ev){
        var tag = document.createElement('div');
        tag.className = 'tc-cal-evt';
        tag.innerHTML = '<span class="tc-cal-evt-dot" style="background:'+ev.color+';"></span>' + ev.label;
        evWrap.appendChild(tag);
      });
      cell.appendChild(evWrap);
    }

    // Queued chips
    var qWrap = document.createElement('div');
    qWrap.className = 'tc-cal-day-queued';
    var qItems = queued[dateStr] || [];
    qItems.forEach(function(q, qi){
      var chip = document.createElement('div');
      chip.className = 'tc-cal-chip';
      var qColor = (q.direction||'').toUpperCase() === 'BEARISH' ? '#FF4D4D' : 'var(--mp-cyan)';
      chip.innerHTML = '<span class="tc-cal-chip-dot" style="background:'+qColor+';"></span>' + MP.esc(q.ticker)
        + '<span class="tc-cal-chip-rm" data-date="'+dateStr+'" data-qi="'+qi+'">\u00D7</span>';
      qWrap.appendChild(chip);
    });
    cell.appendChild(qWrap);

    // Drop hint
    var hint = document.createElement('div');
    hint.className = 'tc-cal-drop-hint';
    hint.textContent = 'Drop here';
    cell.appendChild(hint);

    // DnD
    cell.addEventListener('dragover', function(e){ e.preventDefault(); this.classList.add('drag-over'); });
    cell.addEventListener('dragleave', function(){ this.classList.remove('drag-over'); });
    cell.addEventListener('drop', function(e){
      e.preventDefault();
      this.classList.remove('drag-over');
      if(!dragData) return;
      var date = this.dataset.date;
      if(!queued[date]) queued[date] = [];
      queued[date].push({ticker: dragData.ticker, direction: dragData.direction || ''});
      saveQueued();
      dragData = null;
      renderCalendar();
    });

    grid.appendChild(cell);
  }

  // Trailing fill
  var totalCells = firstDay + daysInMonth;
  var trailing = totalCells % 7 === 0 ? 0 : 7 - totalCells % 7;
  for(var t = 1; t <= trailing; t++){
    var cell = document.createElement('div');
    cell.className = 'tc-cal-day empty';
    var num = document.createElement('div');
    num.className = 'tc-cal-day-num';
    num.textContent = t;
    cell.appendChild(num);
    grid.appendChild(cell);
  }

  // Remove chip handlers
  grid.querySelectorAll('.tc-cal-chip-rm').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var d = this.dataset.date;
      var qi = parseInt(this.dataset.qi);
      if(queued[d]){ queued[d].splice(qi, 1); if(!queued[d].length) delete queued[d]; }
      saveQueued();
      renderCalendar();
    });
  });
}

function updateSummary(){
  var countEl = document.getElementById('tc-cal-summary-count');
  var chipsEl = document.getElementById('tc-cal-summary-chips');
  if(!countEl || !chipsEl) return;
  var total = 0;
  var tickers = {};
  Object.keys(queued).forEach(function(d){
    (queued[d]||[]).forEach(function(q){ total++; tickers[q.ticker] = q.direction || ''; });
  });
  countEl.textContent = total;
  var html = '';
  Object.keys(tickers).forEach(function(t){
    var c = (tickers[t]||'').toUpperCase() === 'BEARISH' ? '#FF4D4D' : 'var(--mp-cyan)';
    html += '<span class="tc-cal-summary-chip"><span class="tc-cal-chip-dot" style="background:'+c+';"></span>'+MP.esc(t)+'</span>';
  });
  chipsEl.innerHTML = html;
}

function renderSignalStrip(container){
  if(!signals || !signals.length){ container.innerHTML = ''; return; }
  var html = '<div class="cal-strip-label">Drag signals onto calendar dates</div><div class="cal-strip-scroll">';
  signals.forEach(function(s, i){
    var dir = (s.direction||'').toUpperCase();
    var dirColor = dir === 'BEARISH' ? '#FF4D4D' : 'var(--mp-cyan)';
    var domain = MP.DOMAINS[s.ticker];
    var logo = domain ? '<img class="cal-strip-logo" src="https://www.google.com/s2/favicons?domain='+domain+'&sz=32" alt="" onerror="this.style.display=\'none\';">' : '';
    var action = ACTIONS[s.primary_label] || 'Monitor';
    html += '<div class="cal-strip-card" draggable="true" data-idx="'+i+'">'
      + '<div class="cal-strip-card-top">' + logo
        + '<span class="cal-strip-ticker">'+MP.esc(s.ticker)+'</span>'
        + '<span class="cal-strip-dir" style="color:'+dirColor+';">'+(dir==='BEARISH'?'\u25BC':dir==='BULLISH'?'\u25B2':'')+' '+MP.esc(dir)+'</span>'
      + '</div>'
      + '<div class="cal-strip-action">'+MP.esc(action)+'</div>'
      + (s.holding_days ? '<div class="cal-strip-meta">'+s.holding_days+'d window</div>' : '')
    + '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
  container.querySelectorAll('.cal-strip-card[draggable]').forEach(function(card){
    card.addEventListener('dragstart', function(e){
      dragData = signals[parseInt(this.dataset.idx)];
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', dragData.ticker);
    });
    card.addEventListener('dragend', function(){ this.classList.remove('dragging'); dragData = null; });
  });
}

function buildEarningsIndex(rows){
  earningsByDate = {};
  rows.forEach(function(r){
    if(r.days_to_earnings != null && r.days_to_earnings >= 0 && r.snapshot_date){
      var base = new Date(r.snapshot_date+'T00:00:00');
      base.setDate(base.getDate() + r.days_to_earnings);
      var d = ds(base.getFullYear(), base.getMonth(), base.getDate());
      if(!earningsByDate[d]) earningsByDate[d] = [];
      earningsByDate[d].push({ticker: r.ticker});
    }
  });
}

async function init(){
  var root = document.getElementById('calendar-root');
  if(!root) return;

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
  }catch(e){ console.warn('[CAL] Data load failed:', e); signals = []; }

  // Build layout — use exact production HTML structure
  root.innerHTML = '<div class="page-header">'
      + '<div class="ph-eyebrow">Trade Planner</div>'
      + '<h1>Plan around what matters.</h1>'
      + '<span class="ph-italic">Every catalyst mapped.</span>'
      + '<p>Drag signal cards onto calendar dates to plan trades around FOMC, earnings, OPEX, and every market-moving event.</p>'
    + '</div>'
    + '<div class="cal-signals" id="cal-signals"></div>'
    // Calendar section — matches production tc-cal-planner structure exactly
    + '<div style="margin-bottom:16px;">'
      + '<div class="tc-cal-month-nav">'
        + '<button class="tc-cal-month-arrow" id="tc-cal-mprev">\u2039</button>'
        + '<span class="tc-cal-month-title" id="tc-cal-month-title"></span>'
        + '<button class="tc-cal-month-arrow" id="tc-cal-mnext">\u203A</button>'
      + '</div>'
      + '<div class="tc-cal-grid" id="tc-cal-grid">'
        + '<div class="tc-cal-dow">Sun</div><div class="tc-cal-dow">Mon</div><div class="tc-cal-dow">Tue</div><div class="tc-cal-dow">Wed</div><div class="tc-cal-dow">Thu</div><div class="tc-cal-dow">Fri</div><div class="tc-cal-dow">Sat</div>'
      + '</div>'
    + '</div>'
    // Summary
    + '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;font-size:13px;color:var(--mp-text-secondary);flex-wrap:wrap;">'
      + '<span class="tc-cal-summary-count" id="tc-cal-summary-count" style="font-size:18px;font-weight:700;color:var(--mp-text-primary);">0</span> queued'
      + '<span id="tc-cal-summary-chips" style="display:flex;gap:8px;flex-wrap:wrap;"></span>'
    + '</div>'
    // Legend
    + '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--mp-text-muted);margin-top:8px;">'
      + '<span style="display:flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:#FF4D4D;"></span>Holiday / Quad</span>'
      + '<span style="display:flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:#FFB800;"></span>FOMC</span>'
      + '<span style="display:flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:var(--mp-cyan);"></span>OPEX / Earnings</span>'
    + '</div>';

  // Render
  renderSignalStrip(document.getElementById('cal-signals'));
  renderCalendar();
  updateSummary();

  // Month nav
  document.getElementById('tc-cal-mprev').addEventListener('click', function(){
    calMonth--; if(calMonth < 0){ calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('tc-cal-mnext').addEventListener('click', function(){
    calMonth++; if(calMonth > 11){ calMonth = 0; calYear++; }
    renderCalendar();
  });
}

MP.register('calendar', init);
})();
