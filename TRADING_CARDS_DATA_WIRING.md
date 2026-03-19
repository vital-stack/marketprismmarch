# Claude Code Instructions — Trading Cards Data Wiring
# File to edit: _template.html ONLY
# CRITICAL: Do NOT change any CSS, any HTML structure, any class names,
# any animations, any foil effects, or any card layout.
# Only change the JavaScript data sources inside buildCardFrontHTML
# and loadData. The rendered card must look pixel-identical to today.

---

## WHAT WE ARE CHANGING (data only, nothing visual)

Currently these 4 values are fake/random inside buildCardFrontHTML:
  1. conf      — Math.random() → trade_classifications.primary_confidence
  2. winTxt    — derived from price change → trade_classifications timeframes
  3. moveDateStr — Math.random() +5-10 days → prediction_scores.predicted_value (capped)
  4. biasText   — hardcoded from TRADING_CARD_COLORS → trade_classifications.primary_label

These 2 tables will be fetched in loadData() and stored as maps:
  - TRADE_CLASS_MAP  { ticker → { primary_label, primary_confidence, shortest_timeframe, longest_timeframe } }
  - PREDICTION_MAP   { ticker → { predicted_value } }

---

## TASK 1 — Add two new data maps after the existing var DATA = [];

Find this line:
```javascript
var DATA       = [];
```

Add two new lines directly after it:
```javascript
var TRADE_CLASS_MAP = {};
var PREDICTION_MAP  = {};
```

---

## TASK 2 — Add label-to-biasText mapping object

Find the existing TRADING_CARD_COLORS array:
```javascript
var TRADING_CARD_COLORS = [
```

Add this new object BEFORE that line:
```javascript
var LABEL_TO_BIAS = {
  'MOMENTUM_RIDE':           'Ride the Trend',
  'SPECULATIVE':             'Wait for Break',
  'FADE_THE_HYPE':           'Fade Rallies',
  'NARRATIVE_TRAP':          'Fade Rallies',
  'FUNDAMENTAL_DISCONNECT':  'Hedge Exposure',
  'CATALYST_PENDING':        'Wait for Break',
  'ACCUMULATE':              'Add on Dips',
  'FOREIGN_OPAQUE':          'Hold Steady'
};
```

---

## TASK 3 — Fetch trade_classifications and prediction_scores in loadData()

Find the existing pulse overlay fetch block inside loadData():
```javascript
    // pulse overlay (for direction_forecast used in bull/bear counts)
    var pulseMap={};
    try{
      var pr=await fetch(SUPABASE_URL+'/rest/v1/ticker_pulse?select=ticker,direction_forecast&order=snapshot_date.desc',{headers:hdrs});
      if(pr.ok)(await pr.json()).forEach(function(p){if(!pulseMap[p.ticker])pulseMap[p.ticker]=p;});
    }catch(_){}
```

Add these two new fetch blocks AFTER that block (before the dedup + merge comment):
```javascript
    // trade classifications overlay
    try{
      var tr=await fetch(SUPABASE_URL+'/rest/v1/trade_classifications?select=ticker,primary_label,primary_confidence,shortest_timeframe,longest_timeframe&order=snapshot_date.desc',{headers:hdrs});
      if(tr.ok)(await tr.json()).forEach(function(t){if(!TRADE_CLASS_MAP[t.ticker])TRADE_CLASS_MAP[t.ticker]=t;});
    }catch(_){}
    // prediction scores overlay — exhaustion days per ticker
    try{
      var ps=await fetch(SUPABASE_URL+'/rest/v1/prediction_scores?select=ticker,predicted_value&order=prediction_date.desc',{headers:hdrs});
      if(ps.ok)(await ps.json()).forEach(function(p){if(!PREDICTION_MAP[p.ticker])PREDICTION_MAP[p.ticker]=p;});
    }catch(_){}
```

---

## TASK 4 — Replace the 4 fake values inside buildCardFrontHTML

Find this exact block at the top of buildCardFrontHTML (lines 4916-4931):
```javascript
function buildCardFrontHTML(c,i,dateStr,prefix,showActions){
  var isBull=c.price_change_pct>0;
  var deltaColor=isBull?'#00DE94':'#FF4D4D';
  var conf=Math.round(50+Math.random()*40);
  var winTxt=isBull?'1\u20133d':conf>70?'3\u20135d':'5\u20137d';
  var energy=c.narrative_health||Math.round(40+Math.random()*50);
  var rKey=c.prism_verdict||c.narrative_state||'Stable';
  var rarity=RARITY_MAP[rKey]||RARITY_MAP['Stable'];
  var companyName=c.sector_name||'\u2014';
  var signalPrimary=esc(c.story_claim||c.primary_driver||'Signal under analysis');
  var sentiment=cardSentiment(c);
  var ss=SENTIMENT_STYLES[sentiment];
  var borderColor=ss.border1;
  var styleVars='--card-bg:'+ss.bg+';--card-line-pattern:'+ss.linePattern+';';
  // Move date (next weekday +5-10 days)
  var moveDate=new Date();moveDate.setDate(moveDate.getDate()+Math.floor(5+Math.random()*6));
  var moveDateStr=moveDate.toLocaleDateString('en-US',{month:'short',day:'numeric'});
```

Replace with:
```javascript
function buildCardFrontHTML(c,i,dateStr,prefix,showActions){
  var isBull=c.price_change_pct>0;
  var deltaColor=isBull?'#00DE94':'#FF4D4D';

  // ── REAL DATA from trade_classifications ──────────────────────────────────
  var tc=TRADE_CLASS_MAP[c.ticker]||{};
  var conf=tc.primary_confidence!=null?Math.round(tc.primary_confidence):Math.round(50+Math.random()*40);
  var shortTf=tc.shortest_timeframe||'';
  var longTf=tc.longest_timeframe||'';
  var winTxt=shortTf&&longTf&&shortTf!==longTf
    ?(shortTf+'\u2013'+longTf)
    :(shortTf||longTf||( isBull?'1\u20133d':conf>70?'3\u20135d':'5\u20137d'));
  // biasText: from classification label, fall back to existing TRADING_CARD_COLORS value
  if(tc.primary_label&&LABEL_TO_BIAS[tc.primary_label]){
    c=Object.assign({},c,{biasText:LABEL_TO_BIAS[tc.primary_label]});
  }

  // ── REAL DATA from prediction_scores ─────────────────────────────────────
  var pred=PREDICTION_MAP[c.ticker]||{};
  var rawDays=pred.predicted_value!=null?Math.round(pred.predicted_value):null;
  var moveDateStr, moveWindow;
  if(rawDays!=null){
    if(rawDays<=14){
      moveDateStr=new Date(Date.now()+rawDays*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    }else if(rawDays<=60){
      moveDateStr=new Date(Date.now()+rawDays*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    }else{
      moveDateStr='30d+';
    }
  }else{
    // fallback: keep existing random logic
    var moveDate=new Date();moveDate.setDate(moveDate.getDate()+Math.floor(5+Math.random()*6));
    moveDateStr=moveDate.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }

  // ── Unchanged from here down ───────────────────────────────────────────────
  var energy=c.narrative_health||Math.round(40+Math.random()*50);
  var rKey=c.prism_verdict||c.narrative_state||'Stable';
  var rarity=RARITY_MAP[rKey]||RARITY_MAP['Stable'];
  var companyName=c.sector_name||'\u2014';
  var signalPrimary=esc(c.synopsis||c.story_claim||c.primary_driver||'Signal under analysis');
  var sentiment=cardSentiment(c);
  var ss=SENTIMENT_STYLES[sentiment];
  var borderColor=ss.border1;
  var styleVars='--card-bg:'+ss.bg+';--card-line-pattern:'+ss.linePattern+';';
```

---

## TASK 5 — Update the back stat chip: replace Health with Vol

The back of the card currently shows Price / P/E / Health.
Health is a random fallback number. Replace it with volume spike ratio
from ticker_snapshots — which is already more meaningful.

Find this exact line in buildCardFrontHTML:
```javascript
                +'<div class="back-stat-chip"><span class="back-stat-lbl">Health</span><span class="back-stat-val" style="color:#A0A8B0;">'+energy+'</span></div>'
```

Replace with:
```javascript
                +'<div class="back-stat-chip"><span class="back-stat-lbl">Conf</span><span class="back-stat-val" style="color:#A0A8B0;">'+conf+'%</span></div>'
```

This replaces the random Health number with the real confidence score
we already computed above — same position, same visual, real data.

---

## TASK 6 — Add ticker_snapshots fetch for drawdown + volume (optional enrichment)

This task adds snapshot data to the card back's P/E chip as a fallback
when pe_ratio is null, and makes the volume chip meaningful.

Find the trade classifications fetch added in Task 3:
```javascript
    // trade classifications overlay
    try{
```

Add this NEW fetch block BEFORE it:
```javascript
    // ticker snapshots overlay — drawdown, volume, sector
    var snapshotMap={};
    try{
      var sn=await fetch(SUPABASE_URL+'/rest/v1/ticker_snapshots?select=ticker,drawdown_from_peak,volume_day,volume_7d_avg,sector,industry,fcf_per_share&order=snapshot_date.desc',{headers:hdrs});
      if(sn.ok)(await sn.json()).forEach(function(s){if(!snapshotMap[s.ticker])snapshotMap[s.ticker]=s;});
    }catch(_){}
```

Then in buildCardFrontHTML, find this line (just added in Task 4):
```javascript
  var companyName=c.sector_name||'\u2014';
```

Replace with:
```javascript
  var snap=snapshotMap&&snapshotMap[c.ticker]||{};
  var companyName=c.sector_name||snap.sector||'\u2014';
```

This means cards now show the real sector name from ticker_snapshots
when v_dash_daily_story doesn't have one — zero visual change.

---

## TASK 7 — Fix Direction rendering in diag strip (_ticker.html)

File to edit: _ticker.html
The Direction cell in renderDiagStrip renders direction_forecast
(e.g. "BULLISH") in the mono font at 18px — looks wrong.
Phase already uses a badge. Direction should too.

Find this exact block inside renderDiagStrip:
```javascript
    <div class="diag-cell">
      <div class="diag-label">Direction</div>
      <div class="diag-val" style="font-size:14px;padding-top:2px;${(p.direction_forecast||'').includes('BULL') ? 'color:var(--mp-teal)' : (p.direction_forecast||'').includes('BEAR') ? 'color:#38C8B8' : ''}">${esc(p.direction_forecast || '—')}</div>
      <div class="diag-sub">${esc(p.sentiment_momentum || 'Momentum')}</div>
    </div>
```

Replace with:
```javascript
    <div class="diag-cell">
      <div class="diag-label">Direction</div>
      <div class="diag-val" style="font-size:13px;padding-top:2px;">
        ${p.direction_forecast
          ? `<span class="hero-state-badge ${(p.direction_forecast).includes('BULL') ? 'badge-surging' : (p.direction_forecast).includes('BEAR') ? 'badge-breaking' : 'badge-stable'}">${esc(p.direction_forecast)}</span>`
          : '—'}
      </div>
      <div class="diag-sub">${esc(p.sentiment_momentum || 'Momentum')}</div>
    </div>
```

No CSS changes needed — hero-state-badge and badge-surging/badge-breaking/badge-stable
already exist in _ticker.html. Direction now renders as a colored badge
exactly like Phase does. The blocky green mono font is gone.

---

## VERIFICATION CHECKLIST

After making all changes, verify these things have NOT changed:
- [ ] Card CSS classes: tc, tc-body, tc-header, tc-ticker, tc-name, tc-rarity,
      tc-price-row, tc-price, tc-change, tc-command, tc-meta-line, tc-context,
      tc-sector-date, tc-foot, tc-state-tag, tc-view-btn — all untouched
- [ ] foil-layer, foil-scan, card-scene, card-flipper, card-front, card-back — untouched
- [ ] tc-sentiment-bar color logic — untouched (still uses rarity.color)
- [ ] SENTIMENT_STYLES bull/bear/neutral — untouched
- [ ] RARITY_MAP — untouched
- [ ] cardSentiment() function — untouched
- [ ] attachCardInteractions() — untouched
- [ ] renderTradingCards(), renderDailySignalCards(), renderCardsGallery() — untouched
- [ ] Card back structure: back-header-label, back-command, back-meta-grid,
      back-meta-row, back-insight, back-stats-row, back-footer-row — untouched
- [ ] actionsHTML (View/Save/Share buttons) — untouched
- [ ] phaseLabel still uses c.narrative_state||c.phase||'Active' — untouched
- [ ] signalPrimary now uses synopsis first, then story_claim — ONLY this changed
- [ ] conf now uses primary_confidence (real) — ONLY this changed
- [ ] winTxt now uses timeframe fields (real) — ONLY this changed
- [ ] moveDateStr now uses prediction_scores.predicted_value (capped) — ONLY this changed
- [ ] biasText now uses LABEL_TO_BIAS[primary_label] when available — ONLY this changed
- [ ] Back stat chip 3 now shows Conf % instead of Health — ONLY label+value changed

---

## SUMMARY OF DATA FLOW

Before:                          After:
conf      = random 50-90    →   trade_classifications.primary_confidence
winTxt    = price-derived   →   shortest_timeframe + longest_timeframe
moveDateStr = random +5-10d →   prediction_scores.predicted_value (capped at 60d)
biasText  = TRADING_CARD_COLORS →  LABEL_TO_BIAS[primary_label]
signalPrimary = story_claim  →   synopsis (shorter) or story_claim fallback
back stat 3 = random health  →   real confidence %
Direction cell    = mono font word  →   colored badge (same as Phase)
companyName = sector_name    →   sector_name OR ticker_snapshots.sector
