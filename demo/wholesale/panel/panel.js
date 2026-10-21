// The owner's panel. Reads /panel on our server with the owner's key, or the
// demo when there is no key. The key arrives once in the link's fragment
// (#k=…), which browsers never send to any server, and is kept for the tab.
(function () {
  // never inside someone else's frame: a page that holds a key is not a page to be clicked through a cover
  if (window.top !== window.self) { document.documentElement.style.display = 'none'; return; }
  var ME = (document.currentScript && document.currentScript.src) || '';
  var cfg = window.PANEL;
  // the shared panel serves any connected site: ?site=<slug>&name=<name>
  if (cfg.site === '*') {
    var qs = new URLSearchParams(location.search);
    cfg.site = (qs.get('site') || '').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'demo';
    cfg.name = qs.get('name') || cfg.site;
    var sm = document.querySelector('.pn-top small'); if (sm) sm.textContent = cfg.name + ' · 30 הימים האחרונים';
    document.title = 'לוח הבקרה | ' + cfg.name;
  }
  var api = cfg.api + '/panel?site=';
  var key = '';
  try {
    var m = location.hash.match(/k=([^&]+)/);
    if (m) { sessionStorage.setItem('pk:' + cfg.site, m[1]); history.replaceState(null, '', location.pathname + location.search); }
    key = sessionStorage.getItem('pk:' + cfg.site) || '';
  } catch (e) {}
  var demo = !key || /[?&]demo/.test(location.search);
  // every example panel is our test shop's, סחר פלוס (the pet shop it once showed is gone)
  var DEMO = 'demo-wholesale';
  // The example data is a shop's, so the header names an example shop: a
  // prospect opening ?demo on our own landing page's panel read "AgentFeed ·
  // דף הנחיתה" above a pet shop's dog food.
  if (demo) {
    cfg.name = 'סחר פלוס (חנות לדוגמה)';
    var dsm = document.querySelector('.pn-top small'); if (dsm) dsm.textContent = cfg.name + ' · 30 הימים האחרונים';
    document.title = 'לוח הבקרה | ' + cfg.name;
    var hn = document.getElementById('hud-name'); if (hn) hn.textContent = '30 ימים · ' + cfg.name;
  }
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var nf = function (n) { return Number(n || 0).toLocaleString('he-IL'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };

  // Numbers count up to their value once, so the eye lands on them.
  function countUp(el) {
    var to = Number(el.dataset.to), pre = el.dataset.pre || '', post = el.dataset.post || '', dec = Number(el.dataset.dec || 0);
    if (still || !isFinite(to)) { el.textContent = pre + to.toLocaleString('he-IL', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + post; return; }
    var t0 = performance.now(), dur = 900;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + (to * e).toLocaleString('he-IL', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + post;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function num(v, pre, post, dec) {
    return '<b data-to="' + v + '" data-pre="' + (pre || '') + '" data-post="' + (post || '') + '" data-dec="' + (dec || 0) + '">0</b>';
  }
  // Each number says what it is compared with: traffic, the 30 days before
  // the last 30; money, the same days of last month.
  var VS_30 = 'מ-30 הימים הקודמים', VS_MONTH = 'מאותם ימים בחודש שעבר';
  function delta(c, unit, invert, vs) {
    if (c === null || c === undefined) return '<span class="delta flat">חדש</span>';
    var up = c > 0, cls = c === 0 ? 'flat' : ((up !== !!invert) ? 'up' : 'down');
    return '<span class="delta ' + cls + '">' + (c > 0 ? '▲' : c < 0 ? '▼' : '•') + ' ' + Math.abs(c) + (unit || '%') +
           ' <small>' + (vs || VS_30) + '</small></span>';
  }
  function spark(vals, colour) {
    if (!vals.length) return '';
    var W = 300, H = 46, max = Math.max.apply(null, vals), min = Math.min(0, Math.min.apply(null, vals)), span = (max - min) || 1;
    var pts = vals.map(function (v, i) { return (i * W / Math.max(1, vals.length - 1)).toFixed(1) + ',' + (H - 4 - (v - min) / span * (H - 10)).toFixed(1); });
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true" style="direction:ltr">' +
      '<polyline points="0,' + H + ' ' + pts.join(' ') + ' ' + W + ',' + H + '" fill="' + colour + '" opacity=".12"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + colour + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
  }
  // Each number card has a second face: a tap opens what the number is
  // made of, from the same reply, in a circle that grows from the finger.
  function kpi(label, value, c, vals, colour, unit, vs, back) {
    return '<div class="kpi glass" tabindex="0" role="button" aria-expanded="false" aria-label="' + label + ' — לחצו לפירוט"><span class="l">' + label + '</span>' + value + delta(c, unit, false, vs) + spark(vals, colour) +
      '<div class="kback"><span class="l">' + label + ' · פירוט</span>' + back + '<span class="khint"></span></div></div>';
  }
  function rows(list) {
    return list.length ? '<ul class="krows">' + list.map(function (r) {
      return '<li><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><i style="width:' + Math.max(4, Math.min(100, r[2] || 0)) + '%"></i></li>'; }).join('') + '</ul>' : '<p class="sub">עוד אין נתונים לפרט.</p>';
  }
  function chart(series, W) {
    if (!series.some(function (d) { return d.visitors || d.actions; })) {
      return '<div class="empty-chart"><span></span><p>הגרף יתחיל להתמלא מהביקור הראשון באתר.</p></div>';
    }
    var H = 240, P = 30, max = Math.max.apply(null, series.map(function (d) { return d.visitors; }).concat([4]));
    var x = function (i) { return P + i * (W - 2 * P) / Math.max(1, series.length - 1); };
    var y = function (v) { return H - P - v * (H - 2 * P) / max; };
    // a smooth line: each segment a cubic through the midpoints
    var d = series.map(function (s, i) {
      if (!i) return 'M' + x(0) + ' ' + y(s.visitors);
      var px = x(i - 1), py = y(series[i - 1].visitors), cx = (px + x(i)) / 2;
      return 'C' + cx + ' ' + py + ' ' + cx + ' ' + y(s.visitors) + ' ' + x(i) + ' ' + y(s.visitors);
    }).join(' ');
    var area = d + ' L' + x(series.length - 1) + ' ' + (H - P) + ' L' + x(0) + ' ' + (H - P) + ' Z';
    var bars = series.map(function (s, i) {
      var h = (s.actions / max) * (H - 2 * P);
      return '<rect x="' + (x(i) - 3) + '" y="' + (H - P - h) + '" width="6" height="' + h + '" rx="3" fill="url(#gb)"/>';
    }).join('');
    var grid = [0, .5, 1].map(function (f) { var yy = y(max * f);
      return '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + yy + '" y2="' + yy + '" stroke="rgba(255,255,255,.07)" stroke-dasharray="3 5"/>' +
             '<text x="' + (W - 6) + '" y="' + (yy + 4) + '" font-size="11" fill="#8a8fb3" text-anchor="end">' + Math.round(max * f) + '</text>'; }).join('');
    var ticks = series.filter(function (_, i) { return (i % 7 === 0 && i < series.length - 4) || i === series.length - 1; }).map(function (s) {
      var i = series.indexOf(s); return '<text x="' + x(i) + '" y="' + (H - 8) + '" font-size="11" fill="#8a8fb3" text-anchor="middle">' + s.date.slice(8) + '.' + s.date.slice(5, 7) + '</text>'; }).join('');
    var last = series[series.length - 1] || { visitors: 0 };
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="מבקרים ופעולות ב-30 הימים האחרונים" style="direction:ltr">' +
      '<defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--glow)" stop-opacity=".45"/><stop offset="1" stop-color="var(--glow)" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="gl" x1="0" x2="1"><stop offset="0" stop-color="#3ee6ff"/><stop offset="1" stop-color="var(--glow)"/></linearGradient>' +
      '<linearGradient id="gb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8b6cff"/><stop offset="1" stop-color="#8b6cff" stop-opacity=".2"/></linearGradient>' +
      '<filter id="glow" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      grid + bars + '<path d="' + area + '" fill="url(#ga)"/><path d="' + d + '" fill="none" stroke="url(#gl)" stroke-width="3" filter="url(#glow)"/>' +
      '<circle cx="' + x(series.length - 1) + '" cy="' + y(last.visitors) + '" r="5" fill="#fff" filter="url(#glow)"/>' + ticks + '</svg>';
  }
  function ring(score, shown) {
    var r = 38, c = 2 * Math.PI * r, colour = score >= 70 ? '#3ef0a1' : score >= 45 ? '#ffc34d' : '#ff5d73';
    return '<svg viewBox="0 0 92 92" aria-hidden="true"><circle cx="46" cy="46" r="' + r + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>' +
      (score ? '<circle cx="46" cy="46" r="' + r + '" fill="none" stroke="' + colour + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (c * score / 100) + ' ' + c +
      '" transform="rotate(-90 46 46)" style="filter:drop-shadow(0 0 6px ' + colour + ')"/>' : '') +
      '<text x="46" y="53" text-anchor="middle" font-size="22" font-weight="800" fill="#fff">' + (shown || score) + '</text></svg>';
  }
  function donut(byCat) {
    var rows = Object.entries(byCat || {}).sort(function (a, b) { return b[1] - a[1]; });
    var total = rows.reduce(function (n, r) { return n + r[1]; }, 0);
    if (!total) return '<p class="sub" style="margin:0">עוד אין הוצאות רשומות החודש.</p>';
    var colours = ['#3ee6ff', '#8b6cff', 'var(--glow)', '#3ef0a1', '#ffc34d', '#ff4fd8'];
    var r = 40, c = 2 * Math.PI * r, off = 0;
    var arcs = rows.map(function (row, i) {
      var len = c * row[1] / total, s = '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="' + colours[i % 6] + '" stroke-width="14" stroke-dasharray="' +
        len + ' ' + c + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 55 55)"/>'; off += len; return s; }).join('');
    return '<svg viewBox="0 0 110 110" aria-hidden="true">' + arcs + '</svg><ul>' + rows.map(function (row, i) {
      return '<li><i style="background:' + colours[i % 6] + '"></i>' + esc(row[0]) + ' · ₪' + nf(row[1]) + '</li>'; }).join('') + '</ul>';
  }
  // this month's profit, day by day from the 1st, so the line ends on the
  // number printed above it
  function running(month, rows) {
    var by = {}, sum = 0, out = [];
    (rows || []).forEach(function (r) { if (String(r.date).indexOf(month) === 0) by[r.date] = (by[r.date] || 0) + (r.kind === 'expense' ? -r.amount : r.amount); });
    var last = Number(today().slice(8, 10));
    for (var dd = 1; dd <= last; dd++) { sum += by[month + '-' + (dd < 10 ? '0' : '') + dd] || 0; out.push(sum); }
    return Object.keys(by).length ? out : [];
  }
  // the owner's date, in Israel, whatever the device's clock zone
  function today() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()); }
    catch (x) { return new Date().toISOString().slice(0, 10); }
  }
  // what exactly does not match, so the one setting it up can fix it alone
  var WHY = {
    no_key: 'אין מפתח בקישור. הוסיפו בסוף הכתובת #k= ואת המפתח.',
    no_table: 'בשרת לא מוגדר המשתנה SITE_PANEL_KEYS, או שהפריסה עוד לא הסתיימה. בדקו ב-Vercel ועשו Redeploy.',
    bad_table: 'הערך של SITE_PANEL_KEYS ב-Vercel לא בפורמט הנכון. הוא צריך להיראות כך: {"' + cfg.site + '": "…"}',
    no_site: 'ב-SITE_PANEL_KEYS אין שורה בשם ' + cfg.site + '. בדקו את השם בתוך הערך ב-Vercel.',
    bad_hash: 'בתוך SITE_PANEL_KEYS, הערך של ' + cfg.site + ' צריך להיות 64 תווים של אותיות ומספרים (מהשורה השנייה בטרמינל).',
    mismatch: 'המפתח בקישור לא תואם למה ששמור ב-Vercel. ודאו שבקישור יש את המפתח מהשורה הראשונה בטרמינל, ושב-Vercel יש את המחרוזת מאותה הרצה.'
  };
  var ICON = { alert: '⚠️', warn: '👀', good: '🚀', info: '💡' };

  var shown = null;
  function render(d) {
    shown = d;
    var k = d.kpis, mo = d.money, s = d.series;
    $('demo').hidden = !d.demo;
    // a young site has little to draw; the owner can see the full picture
    // on the demo, which says it is one
    var few = !d.demo && d.kpis.visitors.now < 50, hint = document.getElementById('fewhint');
    if (few && !hint) {
      $('kpis').insertAdjacentHTML('afterend', '<p id="fewhint" class="sub" style="text-align:center;margin:-6px 0 18px">האתר צעיר, אז הגרפים עוד דלילים. רוצים לראות איך הלוח נראה עם חודש של תנועה? <a href="?demo" style="color:#3ee6ff">לתצוגת הדוגמה</a></p>');
    }
    $('kpis').innerHTML =
      kpi('ביקורים ב-30 יום', num(k.visitors.now), k.visitors.change, s.map(function (x) { return x.visitors; }), 'var(--glow)', '', '',
          rows(d.sources.slice(0, 4).map(function (x) { return [x.label, x.share + '%', x.share]; }))) +
      kpi('פניות ופעולות', num(k.actions.now), k.actions.change, s.map(function (x) { return x.actions; }), '#3ee6ff', '', '',
          rows(d.actions.filter(function (a) { return a.value; }).map(function (a) { return [a.label, nf(a.value), k.actions.now ? a.value / k.actions.now * 100 : 0]; }))) +
      kpi('אחוז המרה', num(k.conversion.now, '', '%', 1), k.conversion.change, s.map(function (x) { return x.visitors ? x.actions / x.visitors : 0; }), '#8b6cff', ' נק׳', '',
          rows([['מבקרים', nf(k.visitors.now), 100], ['פנו', nf(k.actions.now), k.visitors.now ? k.actions.now / k.visitors.now * 100 : 0], ['מטלפון', d.mobile + '%', d.mobile]])) +
      kpi('רווח החודש', num(k.profit.now, '₪'), k.profit.change, running(mo.month, d.ledger), '#3ef0a1', '', VS_MONTH,
          rows([['הכנסות', '₪' + nf(mo.income), mo.income ? 100 : 0], ['הוצאות', '₪' + nf(mo.expense), mo.income ? mo.expense / mo.income * 100 : 0]]));
    var h = d.health || { score: 0, parts: [] };
    if (h.score === null) {
      $('score').innerHTML = ring(0, '—') + '<p><b>ציון הבריאות יופיע כשיהיו מספיק נתונים.</b><br>צריך לפחות 20 ביקורים ב-30 יום כדי שהציון יגיד משהו אמיתי.</p>';
    } else {
      var weakest = h.parts.slice().sort(function (a, b) { return a.score - b.score; })[0];
      $('score').innerHTML = ring(h.score) + '<p><b>ציון הבריאות של האתר: ' + h.score + ' מתוך 100.</b><br>' +
        h.parts.map(function (p) { return esc(p.label) + ' ' + p.score + '/25'; }).join(' · ') +
        (weakest ? '<br>הכי כדאי לשפר: <b>' + esc(weakest.label) + '</b>' : '') + '</p>';
    }
    // drawn at the width it is shown at, so the labels stay readable on a phone
    $('chart').innerHTML = chart(s, Math.max(320, Math.min(700, $('chart').clientWidth || 700))) +
      '<div class="legend"><span><i style="background:var(--glow);box-shadow:0 0 8px var(--glow)"></i>מבקרים ביום</span><span><i style="background:#8b6cff;box-shadow:0 0 8px #8b6cff"></i>פניות ופעולות</span></div>';
    var srcMax = Math.max.apply(null, d.sources.map(function (x) { return x.value; }).concat([1]));
    $('ai').innerHTML = '<div class="ai-hero"><b>' + nf(d.ai) + '</b><span>' + (d.ai ? 'כניסות מעוזרי AI ב-30 הימים האחרונים' : 'עוד לא היו כניסות מעוזרי AI') + '</span></div>';
    $('sources').innerHTML = d.sources.length ? d.sources.map(function (x) {
      return '<div class="bar' + (x.ai ? ' isai' : '') + '"><span>' + esc(x.label) + (x.ai ? '<span class="ai-tag">AI</span>' : '') +
        '</span><div class="track"><div class="fill" style="width:' + (x.value / srcMax * 100) + '%"></div></div><em>' + x.share + '%</em></div>';
    }).join('') : '<p class="sub">עוד אין מספיק נתונים.</p>';
    $('actions').innerHTML = d.actions.map(function (a) {
      return '<li><span>' + a.label + '</span><span><b>' + nf(a.value) + '</b> ' + (a.change === null ? '' : delta(a.change)) + '</span></li>'; }).join('');
    var pmax = Math.max.apply(null, d.pages.map(function (p) { return p.value; }).concat([1]));
    $('pages').innerHTML = d.pages.length ? d.pages.map(function (p) {
      return '<li style="display:block"><span style="display:flex;justify-content:space-between"><span>' + esc(p.page === '/' ? 'עמוד הבית' : p.page) +
        '</span><b>' + nf(p.value) + '</b></span><div class="pbar" style="width:' + (p.value / pmax * 100) + '%"></div></li>'; }).join('') : '<li>עוד אין נתונים</li>';
    $('mobile').textContent = d.mobile ? d.mobile + '% מהצפיות מטלפון' : '';
    $('money').innerHTML =
      '<div><span>הכנסות</span>' + num(mo.income, '₪').replace('<b', '<b class="pos"') + '</div>' +
      '<div><span>הוצאות</span>' + num(mo.expense, '₪').replace('<b', '<b class="neg"') + '</div>' +
      '<div><span>רווח</span>' + num(mo.profit, '₪').replace('<b', '<b class="' + (mo.profit >= 0 ? 'pos' : 'neg') + '"') + '</div>';
    $('donut').innerHTML = donut(mo.byCat);
    $('ledger').innerHTML = '<tr><th>תאריך</th><th>סוג</th><th>קטגוריה</th><th>סכום</th><th>הערה</th><th></th></tr>' +
      (d.ledger || []).slice(0, 30).map(function (r) {
        return '<tr><td>' + r.date.split('-').reverse().join('.') + '</td><td>' + (r.kind === 'income' ? 'הכנסה' : 'הוצאה') + '</td><td>' + esc(r.category) +
          '</td><td class="' + (r.kind === 'income' ? 'in' : 'out') + '">₪' + nf(r.amount) + '</td><td>' + esc(r.note) + '</td><td>' +
          (d.demo ? '' : '<button type="button" data-rm="' + esc(r.id) + '" aria-label="מחיקה">✕</button>') + '</td></tr>'; }).join('');
    $('add').setAttribute('aria-disabled', d.demo ? 'true' : 'false');
    orders(d);
    $('advice').innerHTML = d.advice.length ? d.advice.map(function (a) {
      return '<div class="tip ' + a.level + '"><div class="ic" aria-hidden="true">' + ICON[a.level] + '</div><div><h3>' + esc(a.title) +
        '</h3><p>' + esc(a.body) + '</p></div><span class="ev">' + esc(a.metric) + '</span></div>'; }).join('') :
      '<p class="sub">הכול שקט. ברגע שיצטברו נתונים יופיעו כאן המלצות.</p>';
    window.__pn = d; if (window.__pnGadgets) window.__pnGadgets(d);
    var prod = d.products || [];
    $('products').innerHTML = prod.length ? prod.slice(0, 8).map(function (p) {
      return '<li><span>' + esc(p.name) + '</span><span><b>' + nf(p.actions) + '</b> פניות' + (p.wa ? ' · ' + nf(p.wa) + ' בוואטסאפ' : '') + '</span></li>'; }).join('') :
      '<li>כשמישהו ילחץ על הזמנה מתוך כרטיס של מוצר, הוא יופיע כאן.</li>';
    $('when').textContent = 'עודכן ' + new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' });
    document.querySelectorAll('[data-to]').forEach(countUp);
  }
  // Orders paid by card on the shop's own pages. Shown only for a shop that takes
  // them; added here and not in the page so panels of sites with no shop stay as they are.
  var ST = { paid: ['שולם', 'in'], pending: ['ממתין לתשלום', ''], 'amount-mismatch': ['סכום לא תואם, לבדוק', 'out'] };
  function orders(d) {
    var list = d.orders;
    var box = document.getElementById('orders');
    if (!list || !list.length) { if (box) box.parentNode.removeChild(box); return; }
    if (!box) {
      box = document.createElement('section'); box.id = 'orders'; box.className = 'cardp glass';
      var led = $('ledger').closest('section'); led.parentNode.insertBefore(box, led);
    }
    var paid = list.filter(function (o) { return o.status === 'paid'; });
    var sum = paid.reduce(function (a, o) { return a + o.total; }, 0);
    var ex = list.some(function (o) { return o.example; });
    box.innerHTML = '<h2>🧾 הזמנות מהאתר</h2><p class="sub">' +
      (ex ? 'אלה הזמנות לדוגמה. כשלקוח ישלם באתר, ההזמנה שלו תופיע כאן, עם השם, הטלפון ומה הזמין.' :
            'כל הזמנה ששולמה באשראי באתר. הכסף עובר ישר לחשבון הסליקה של העסק.') +
      (paid.length ? ' <b>' + nf(paid.length) + '</b> שולמו, סך ₪' + nf(Math.round(sum)) + '.' : '') + '</p>' +
      '<div style="overflow-x:auto;margin-top:12px"><table class="led ord"><tr><th>מתי</th><th>לקוח</th><th>מה הוזמן</th><th>סכום</th><th>מצב</th></tr>' +
      list.slice(0, 30).map(function (o) {
        var st = ST[o.status] || [o.status, ''];
        var who = (o.via === 'agent' ? '<span class="viaai">🤖 דרך עוזר AI</span><br>' : '') + esc((o.customer && o.customer.name) || '') + (o.customer && o.customer.phone ?
          '<br><a href="tel:' + esc(o.customer.phone) + '">' + esc(o.customer.phone) + '</a>' : '');
        var what = (o.lines || []).map(function (l) { return esc(l.name) + (l.label ? ' · ' + esc(l.label) : '') + ' ×' + nf(l.n); }).join('<br>');
        return '<tr><td data-l="מתי">' + new Date(o.created).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) + '</td><td data-l="לקוח">' + who +
          '</td><td data-l="מה הוזמן" style="font-size:13px">' + what + '</td><td data-l="סכום" class="in">₪' + nf(o.total) + '</td><td data-l="מצב" class="' + st[1] + '">' + st[0] +
          (o.mock && !o.example ? ' <small>(הדמיה)</small>' : '') + '</td></tr>'; }).join('') + '</table></div>';
  }

  // Order notifications. One tap: the phone asks for permission, we keep the
  // device, and from then on every paid order arrives as a system notification.
  // On an iPhone it works from the panel saved to the home screen (iOS 16.4+).
  function pushUI() {
    var host = document.querySelector('.pn-top .wrap'); if (!host || document.getElementById('bell')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'bell'; b.className = 'bell';
    var note = document.createElement('div'); note.id = 'bellnote'; note.className = 'bellnote'; note.hidden = true;
    host.appendChild(b); host.parentNode.insertBefore(note, host.nextSibling);
    var ios = /iP(hone|ad|od)/.test(navigator.userAgent), standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    var site = demo ? DEMO : cfg.site;
    function say(t, ok) { note.hidden = false; note.className = 'bellnote' + (ok ? ' ok' : ''); note.textContent = t; }
    function label(on) { b.textContent = on ? '🔔 התראות פועלות' : '🔔 התראה על כל הזמנה'; b.classList.toggle('on', !!on); }
    try { label(localStorage.getItem('push:' + site) === '1' && Notification.permission === 'granted'); } catch (x) { label(false); }
    var swUrl = ME.replace(/panel\.js.*$/, 'push-sw.js') + '?home=' + encodeURIComponent(location.origin + location.pathname + location.search);
    function key64(k) { var p = '='.repeat((4 - k.length % 4) % 4), r = atob((k + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
    function post(op, body) {
      var h = { 'content-type': 'application/json' }; if (!demo) h.authorization = 'Bearer ' + key;
      return fetch(cfg.api + '/panel?op=' + op, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); });
    }
    b.addEventListener('click', function () {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return say(ios && !standalone ? 'באייפון: לחצו על כפתור השיתוף ⬆️ ואז "הוספה למסך הבית", פתחו את הלוח משם ולחצו שוב על הפעמון.' : 'הדפדפן הזה לא תומך בהתראות. נסו בכרום.');
      }
      b.disabled = true; say('מפעיל…', false);
      var reg, vk;
      fetch(cfg.api + '/panel?op=push-key').then(function (r) { if (!r.ok) throw new Error('server'); return r.json(); })
        .then(function (d) { vk = d.key; return navigator.serviceWorker.register(swUrl, { scope: ME.replace(/panel\.js.*$/, '') }); })
        .then(function (r) { reg = r; return Notification.requestPermission(); })
        .then(function (p) { if (p !== 'granted') throw new Error('denied'); return navigator.serviceWorker.ready; })
        .then(function () { return reg.pushManager.getSubscription(); })
        .then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key64(vk) }); })
        .then(function (s) { var j = s.toJSON(); return post('push-sub', { site: site, sub: j }).then(function () { return post('push-test', { site: site, sub: j }); }); })
        .then(function () {
          try { localStorage.setItem('push:' + site, '1'); } catch (x) {}
          label(true); say(demo ? 'מעולה! שלחנו התראת בדיקה. עכשיו הזמינו בחנות הדמו ושלמו בהדמיה, וההתראה תגיע לטלפון.' : 'מעולה! מעכשיו כל הזמנה ששולמה באתר תגיע לטלפון הזה.', true);
        })
        .catch(function (e) {
          var m = String(e && e.message || e);
          say(m === 'denied' ? 'ההתראות חסומות. אפשר להפעיל אותן בהגדרות האתר בדפדפן (סמל המנעול ליד הכתובת).' :
              m === 'server' ? 'ההתראות עוד לא הופעלו בשרת. נסו שוב בקרוב.' : 'משהו השתבש. נסו שוב.', false);
        })
        .then(function () { b.disabled = false; });
    });
  }
  function load(method, body) {
    var h = { 'content-type': 'application/json' };
    if (!demo) h.authorization = 'Bearer ' + key;
    return fetch(api + (demo ? DEMO : cfg.site), { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401) return r.json().catch(function () { return {}; }).then(function (b) { throw new Error(WHY[b.reason] || 'הקישור לא תקין. בקשו קישור חדש.'); });
        if (r.status === 400) throw new Error('חסר סכום. כתבו סכום ונסו שוב.');
        if (!r.ok) throw new Error('השרת לא ענה כרגע. נסו לרענן בעוד דקה.');
        return r.json();
      })
      // a network failure arrives as the browser's own English text; the owner
      // gets a sentence that says what happened and what to do
      .then(function (d) { render(d); var l = document.getElementById('hud-link'); if (l) { l.textContent = d.demo ? '◉ נתוני דוגמה' : '◉ מחובר · נתונים חיים'; l.className = d.demo ? 'hud-demo' : 'hud-ok'; } return true; }).catch(function (e) {
        var msg = /[\u0590-\u05FF]/.test(e.message) ? e.message : 'אין חיבור לשרת כרגע. בדקו את האינטרנט ונסו לרענן.';
        // a failed save is told at the form and keeps what was typed
        if (method === 'POST') alert(msg); else $('advice').innerHTML = '<p class="sub">' + esc(msg) + '</p>';
        return false;
      });
  }
  $('add').addEventListener('submit', function (e) {
    e.preventDefault();
    if (demo) return;
    var f = e.target;
    load('POST', { add: { kind: f.kind.value, amount: f.amount.value, category: f.category.value, note: f.note.value,
                          date: today() } }).then(function (ok) { if (ok) f.reset(); });
  });
  $('ledger').addEventListener('click', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-rm');
    if (id && confirm('למחוק את הרשומה?')) load('POST', { remove: id });
  });
  // ── The analyst ──────────────────────────────────────────────────────────
  // It reads the same numbers, plus a count of what the product file is
  // missing, and its every sentence carries the facts it rests on.
  var brainApi = cfg.api + '/analyst?site=' + (demo ? DEMO : cfg.site);
  var CERT = { measured: 'נמדד', likely: 'סביר', guess: 'השערה לבדיקה' };
  var EFFORT = { low: 'כמה דקות', medium: 'שעה-שעתיים', high: 'יום ומעלה' };
  var VERDICT = { good: ['good', 'עובד טוב'], mixed: ['warn', 'חלק עובד, חלק לא'], weak: ['alert', 'צריך תשומת לב'], too_early: ['info', 'מוקדם לשפוט'] };
  var catalog = null, items = [];
  function readCatalog() {
    // the example has no product file beside it; asking for one is a 404 in every console
    if (demo) return Promise.resolve(null);
    return fetch('../products.jsonl').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var c = { total: 0, noImage: 0, noPrice: 0, outOfStock: 0, noCategory: 0 };
      t.split('\n').forEach(function (line) {
        if (!line.trim()) return;
        try { var p = JSON.parse(line); } catch (x) { return; }
        c.total++;
        if (p.id && p.title && items.length < 2000) items.push({ id: p.id, name: p.title, price: Number(p.price) > 0 ? Number(p.price) : null });
        if (!p.image) c.noImage++;
        if (!(Number(p.price) > 0)) c.noPrice++;
        if (p.availability === 'out_of_stock') c.outOfStock++;
        if (!p.category || !p.category.length) c.noCategory++;
      });
      catalog = c.total ? c : null;
    }).catch(function () {});
  }
  function ev(list) {
    return (list || []).length ? '<span class="ev">' + list.map(esc).join(' · ') + '</span>' : '';
  }
  // the headline types itself out once, as the analyst "says" it
  function typeOut(el, text) {
    if (still || !text) { el.textContent = text; return; }
    var i = 0; el.textContent = '';
    (function step() { i += 2; el.textContent = text.slice(0, i); if (i < text.length) setTimeout(step, 18); })();
  }
  function doneKey(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return 'done:' + cfg.site + ':' + h; }
  function isDone(t) { try { return localStorage.getItem(doneKey(t)) === '1'; } catch (x) { return false; } }
  function chip(list) {
    return (list || []).length ? '<div class="evs">' + list.map(function (e) { return '<code>' + esc(e) + '</code>'; }).join('') + '</div>' : '';
  }
  // the question box sits above "what to do this week": asking comes before
  // the to-do list. It lives outside the analysis, so a re-render does not
  // wipe the conversation; it is moved back out first, then placed again.
  var askNode = document.querySelector('.ask');
  // on the assistant's own page (?view=chat) the conversation is the page, and stays where it is
  var inRoom = function () { return Boolean(askNode && askNode.closest('.chatroom')); };
  function placeAsk() {
    if (!askNode || inRoom()) return;
    var todo = $('brain').querySelector('.brain-sub');
    if (todo) $('brain').insertBefore(askNode, todo); else $('brain').parentNode.appendChild(askNode);
  }
  function showBrain(a, bench) {
    if (askNode && !inRoom() && askNode.parentNode === $('brain')) $('brain').parentNode.appendChild(askNode);
    if (!a) { $('brain').innerHTML = '<p class="sub">המנתח לא ענה הפעם. ההמלצות למטה עדיין מבוססות על המספרים שלכם.</p>'; return; }
    var v = VERDICT[a.verdict] || VERDICT.mixed, F = a.findings || [], A = a.actions || [];
    $('brain').innerHTML =
      '<div class="verdict ' + v[0] + '"><span class="pill"><i></i>' + v[1] + '</span><p id="headline"></p></div>' +
      '<div class="meter" aria-hidden="true"><span>' + F.length + ' ממצאים</span><span>' + A.length + ' צעדים</span>' +
        (a.dropped ? '<span title="משפטים עם מספר שלא קיים בנתונים">' + (Number(a.dropped) || 0) + ' נמחקו בבדיקה</span>' : '<span>0 נמחקו בבדיקה</span>') + '</div>' +
      (F.length ? '<div class="fx-grid">' + F.map(function (f, i) {
        return '<article class="fx ' + f.certainty + '" style="--d:' + (i * 90) + 'ms"><header><span class="n">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="cert ' + f.certainty + '">' + (CERT[f.certainty] || '') + '</span></header><h3>' + esc(f.title) + '</h3><p>' + esc(f.explain) + '</p>' + chip(f.evidence) + '</article>'; }).join('') + '</div>' : '') +
      (A.length ? '<h3 class="brain-sub">מה לעשות השבוע <small>סמנו מה עשיתם</small></h3><ol class="todo">' + A.map(function (x) {
        var done = isDone(x.do);
        return '<li class="' + (done ? 'done' : '') + '"><label><input type="checkbox" data-do="' + esc(x.do) + '"' + (done ? ' checked' : '') + '><span class="box" aria-hidden="true"></span>' +
          '<span class="txt"><b>' + esc(x.do) + '</b><em class="eff ' + x.effort + '">' + (EFFORT[x.effort] || '') + '</em><br><span>' + esc(x.why) + '</span>' + chip(x.evidence) + '</span></label></li>'; }).join('') + '</ol>' : '') +
      ((a.ask_owner || []).length ? '<p class="sub q">❓ כדי לדייק, המנתח היה רוצה לדעת: ' + a.ask_owner.map(esc).join(' · ') + '</p>' : '') +
      (bench ? '<div class="bench"><span>לעומת ' + (Number(bench.sites) || 0) + ' חנויות אחרות שבנינו (חציון)</span><b>' + (Number(bench.conversion) || 0) + '%</b> פניות ל-100 מבקרים · <b>' + (Number(bench.mobile) || 0) + '%</b> מטלפון · <b>' + (Number(bench.google) || 0) + '%</b> מגוגל</div>' : '') +
      (a.demo ? '<p class="sub">בדוגמה הזאת הטקסט נכתב מתבנית. באתר אמיתי כותב אותו המנתח, מהמספרים שלכם.</p>' : '');
    typeOut($('headline'), a.headline || '');
    placeAsk();
    $('brain').querySelectorAll('.todo input').forEach(function (cb) {
      cb.addEventListener('change', function () {
        try { localStorage.setItem(doneKey(cb.dataset.do), cb.checked ? '1' : '0'); } catch (x) {}
        cb.closest('li').classList.toggle('done', cb.checked);
      });
    });
  }
  function brainCall(body, ms) {
    var h = { 'content-type': 'application/json' };
    if (!demo) h.authorization = 'Bearer ' + key;
    body = body || {}; body.catalog = catalog; body.name = cfg.name;
    // never wait forever: the server gives up at 60 seconds, we a little before
    var ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, ms || 55000);
    return fetch(brainApi, { method: 'POST', headers: h, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (r.status === 429) throw new Error('הגעתם למספר השאלות להיום. אפשר לשאול שוב מחר.');
      if (!r.ok) throw new Error('המנתח לא זמין כרגע. נסו שוב בעוד כמה דקות.');
      return r.json();
    }, function (e) {
      throw new Error(e && e.name === 'AbortError' ? 'המנתח לוקח יותר מדי זמן כרגע. נסו שוב בעוד דקה.' : 'אין חיבור למנתח כרגע.');
    }).then(function (x) { if (t) clearTimeout(t); return x; }, function (e) { if (t) clearTimeout(t); throw e; });
  }
  // The last analysis opens the section at once, and a fresh one replaces it
  // when it arrives. Kept on this device only.
  var BKEY = 'brain:' + (demo ? DEMO : cfg.site);
  function hhmm(iso) { try { return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }); } catch (x) { return ''; } }
  function brainNote(html) {
    var n = document.getElementById('brainnote'); if (!n) { n = document.createElement('p'); n.id = 'brainnote'; n.className = 'sub brainnote'; $('brain').insertBefore(n, $('brain').firstChild); }
    n.innerHTML = html;
  }
  function retryBtn() { return ' <button type="button" class="btn btn-s" id="brainretry">לנסות שוב</button>'; }
  function brain() {
    if (askNode && !inRoom() && askNode.parentNode === $('brain')) $('brain').parentNode.appendChild(askNode);
    var kept = null; try { kept = JSON.parse(localStorage.getItem(BKEY) || 'null'); } catch (x) {}
    if (kept && kept.a) { showBrain(kept.a, kept.bench); brainNote('<span class="spin"></span> מהבדיקה האחרונה (' + esc(hhmm(kept.at)) + ') · בודק אם יש משהו חדש…'); }
    else {
      $('brain').innerHTML = '<div class="scan"><div class="bar"></div><p id="scanp">המנתח קורא את המספרים, משווה ובודק כל משפט…</p></div>';
      setTimeout(function () { var p = document.getElementById('scanp'); if (p) p.textContent = 'עוד רגע… המנתח בודק כל מספר לפני שהוא מראה לכם.'; }, 12000);
    }
    readCatalog().then(function () { return brainCall({}); }).then(function (r) {
      if (r.reason === 'not_configured') { $('brain').innerHTML = '<p class="sub">המנתח עוד לא הופעל באתר הזה. ההמלצות למטה מבוססות על המספרים שלכם.</p>'; return; }
      if (!r.analysis && kept && kept.a) { brainNote('לא הצלחנו לעדכן עכשיו. מוצג הניתוח מ-' + esc(hhmm(kept.at)) + '.' + retryBtn()); return; }
      showBrain(r.analysis, r.bench);
      if (r.analysis) {
        try { localStorage.setItem(BKEY, JSON.stringify({ a: r.analysis, bench: r.bench, at: r.analysis.at || new Date().toISOString() })); } catch (x) {}
        if (r.analysis.at) brainNote('נכון ל-' + esc(hhmm(r.analysis.at)));
      } else if (r.detail) $('brain').insertAdjacentHTML('beforeend', '<p class="sub" dir="ltr" style="font-size:12px;opacity:.7">' + esc(r.detail) + '</p>' + retryBtn());
    }).catch(function (e) {
      var m = esc(/[\u0590-\u05FF]/.test(e.message) ? e.message : 'המנתח לא זמין כרגע.');
      if (kept && kept.a) brainNote(m + ' מוצג הניתוח מ-' + esc(hhmm(kept.at)) + '.' + retryBtn());
      else $('brain').innerHTML = '<p class="sub">' + m + retryBtn() + '</p>';
    });
  }
  $('brain').addEventListener('click', function (e) { if (e.target && e.target.id === 'brainretry') brain(); });
  // A conversation, not a box: each question stays above its answer, the
  // field empties and is ready for the next one.
  var asking = false;
  // ── The conversation ────────────────────────────────────────────────────
  // Before the first question the field sits on top, ready. Once a question is
  // sent the conversation takes the top and the field moves under the last
  // message, like any chat. Every conversation is kept in a log on this
  // device (never on our server), so yesterday's answer is one tap away.
  var CKEY = 'chats:' + (demo ? DEMO : cfg.site), chats = [], cur = null;
  try { chats = JSON.parse(localStorage.getItem(CKEY) || '[]') || []; } catch (x) { chats = []; }
  function saveChats() { try { localStorage.setItem(CKEY, JSON.stringify(chats.slice(0, 30))); } catch (x) {} drawRecent(); }
  var bar = document.createElement('div'); bar.className = 'askbar';
  bar.innerHTML = '<b>💬 העוזר של האתר <small style="font-weight:400;opacity:.75">שאלות, שינויים באתר ותקלות</small></b><span><button type="button" id="chnew">＋ שיחה חדשה</button><button type="button" id="chlog">🕘 יומן שיחות</button></span>';
  var logBox = document.createElement('div'); logBox.className = 'chlog'; logBox.id = 'chlogbox'; logBox.hidden = true;
  // the last conversations, always in view: one tap back to yesterday's answer
  var recent = document.createElement('div'); recent.className = 'chrecent';
  if (askNode) { askNode.insertBefore(recent, askNode.firstChild); askNode.insertBefore(logBox, askNode.firstChild); askNode.insertBefore(bar, askNode.firstChild); }
  function drawRecent() {
    var list = chats.slice(0, 6);
    recent.hidden = !list.length;
    recent.innerHTML = list.length ? '<small>שיחות קודמות:</small>' + list.map(function (c, i) {
      return '<button type="button" data-i="' + i + '" class="' + (c === cur ? 'on' : '') + '" title="' + esc(when(c.at)) + '">' + esc((c.title || 'שיחה').slice(0, 28)) + '</button>'; }).join('') : '';
  }
  recent.addEventListener('click', function (e) { var o = e.target.closest('[data-i]'); if (o) openChat(chats[+o.dataset.i]); });
  function layout() {
    var talking = $('answer').children.length > 0;
    if (talking) askNode.insertBefore($('answer'), $('chips'));      // the conversation on top, the field under it
    else askNode.appendChild($('answer'));                            // nothing yet: the field on top
    askNode.classList.toggle('talking', talking);
  }
  // the conversation scrolls inside its own frame; the page stays where it is
  // On the assistant's own page the page itself scrolls: each message the owner sends goes up to just under the
  // tabs, and the answer grows below it, the way a chat does. Elsewhere the conversation box scrolls to its end.
  function follow(el) {
    if (document.body.classList.contains('chatpage')) {
      var mine = el && el.classList && el.classList.contains('me') ? el : [].slice.call($('answer').querySelectorAll('.qa.me')).pop();
      if (!mine) return;
      var nav = document.querySelector('.pnnav'), off = (nav && nav.isConnected ? nav.getBoundingClientRect().height : 0) + 16;
      var top = Math.max(0, mine.getBoundingClientRect().top + window.scrollY - off);
      // a message just sent always goes up; an answer arriving leaves alone whoever scrolled away to read
      if (mine !== el && Math.abs(window.scrollY - top) > 140) return;
      window.scrollTo({ top: top, behavior: still ? 'auto' : 'smooth' });
      return;
    }
    var ans = $('answer');
    if (ans.scrollTo) ans.scrollTo({ top: ans.scrollHeight, behavior: still ? 'auto' : 'smooth' }); else ans.scrollTop = ans.scrollHeight;
    $('askf').scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }
  function plain(html) { var d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').trim(); }
  function tools(el) {
    if (!el.classList.contains('ai') || el.querySelector('.qtools')) return;
    var t = document.createElement('div'); t.className = 'qtools';
    t.innerHTML = '<button type="button" data-copy>📋 העתקה</button>';
    el.appendChild(t);
  }
  function bubble(html, cls, quiet) {
    var el = document.createElement('div'); el.className = 'qa ' + cls; el.innerHTML = html;
    $('answer').appendChild(el); layout(); if (!quiet) follow(el);
    return el;
  }
  function record(who, html) {
    if (!cur) { cur = { id: Date.now().toString(36), at: new Date().toISOString(), title: '', msgs: [] }; chats.unshift(cur); }
    if (!cur.title && who === 'me') cur.title = plain(html).slice(0, 60);
    cur.msgs.push({ w: who, h: html }); cur.at = new Date().toISOString();
    if (cur.msgs.length > 60) cur.msgs = cur.msgs.slice(-60);
    chats = [cur].concat(chats.filter(function (c) { return c !== cur; })); saveChats();
  }
  // A draft that was answered "כן" or "לא" is saved as answered, in its place.
  function resave(id, bub) {
    if (!cur || !bub) return;
    var html = bub.innerHTML.replace(/<div class="qtools">[\s\S]*$/, '');
    for (var i = cur.msgs.length - 1; i >= 0; i--) if (cur.msgs[i].h.indexOf('data-req="' + id + '"') >= 0) { cur.msgs[i].h = html; break; }
    saveChats();
  }
  // A chat kept on this device comes back as HTML, and anything else on this origin could have written it:
  // it is read in an inert template, and what could run (scripts, frames, on… handlers, script links) is removed
  function safeHtml(h) {
    var t = document.createElement('template'); t.innerHTML = String(h || '');
    [].forEach.call(t.content.querySelectorAll('script,iframe,object,embed,style,link,meta,base,form,svg,math'), function (n) { n.remove(); });
    [].forEach.call(t.content.querySelectorAll('*'), function (el) {
      [].slice.call(el.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || /^(href|src|action|formaction|xlink:href|srcdoc)$/i.test(a.name) && /^\s*(javascript|data|vbscript):/i.test(a.value) || /^srcdoc$/i.test(a.name)) el.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  }
  function openChat(c) {
    $('answer').innerHTML = ''; cur = c || null;
    (c ? c.msgs : []).forEach(function (m) { var el = bubble(safeHtml(m.h), m.w === 'me' ? 'me' : 'ai', true); tools(el); });
    layout(); logBox.hidden = true; drawRecent();
    var ans = $('answer'); ans.scrollTop = ans.scrollHeight;
  }
  function when(iso) { try { return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }); } catch (x) { return ''; } }
  function drawLog() {
    logBox.innerHTML = chats.length ? '<ul>' + chats.map(function (c, i) {
      return '<li><button type="button" class="open" data-i="' + i + '"><b>' + esc(c.title || 'שיחה') + '</b><small>' + esc(when(c.at)) + ' · ' + c.msgs.length + ' הודעות</small></button>' +
        '<button type="button" class="del" data-del="' + i + '" aria-label="מחיקת השיחה">✕</button></li>'; }).join('') + '</ul>' +
      '<p class="sub">השיחות נשמרות רק במכשיר הזה.</p>' : '<p class="sub">עוד אין שיחות. שאלו את המנתח משהו, והשיחה תישמר כאן.</p>';
  }
  bar.addEventListener('click', function (e) {
    if (e.target.id === 'chnew') { openChat(null); $('askq').focus(); }
    if (e.target.id === 'chlog') { drawLog(); logBox.hidden = !logBox.hidden; }
  });
  logBox.addEventListener('click', function (e) {
    var o = e.target.closest('[data-i]'), d = e.target.closest('[data-del]');
    if (o) openChat(chats[+o.dataset.i]);
    if (d && confirm('למחוק את השיחה?')) { var gone = chats.splice(+d.dataset.del, 1)[0]; saveChats(); if (gone === cur) openChat(null); drawLog(); }
  });
  $('answer').addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'); if (!c) return;
    var txt = plain(c.closest('.qa').innerHTML).replace('📋 העתקה', '').trim();
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { c.textContent = '✓ הועתק'; setTimeout(function () { c.textContent = '📋 העתקה'; }, 1500); }, function () {});
  });
  // the last conversation comes back if it is from the last twelve hours
  if (chats[0] && Date.now() - new Date(chats[0].at) < 12 * 3600e3) openChat(chats[0]); else layout();

  // speaking instead of typing, where the browser can listen (Chrome, Android, Safari)
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    var mic = document.createElement('button'); mic.type = 'button'; mic.className = 'mic'; mic.setAttribute('aria-label', 'הקלטת שאלה'); mic.textContent = '🎤';
    $('askf').insertBefore(mic, $('askf').querySelector('button[type=submit]'));
    var rec = null;
    // what was said goes into the field, and stays there: the owner reads it, fixes a word, and sends
    // with "לשאול". Nothing is sent by letting go of the microphone (a misheard price is a wrong price)
    var before = '', ph0 = '';
    function micOff() {
      mic.classList.remove('on'); mic.setAttribute('aria-pressed', 'false'); mic.setAttribute('aria-label', 'הקלטת שאלה');
      $('askq').placeholder = ph0 || $('askq').placeholder; rec = null;
      var q = $('askq'); q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (x) {}
    }
    mic.addEventListener('click', function () {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'he-IL'; rec.interimResults = true; rec.continuous = true;
      before = $('askq').value.trim(); ph0 = $('askq').placeholder;
      mic.classList.add('on'); mic.setAttribute('aria-pressed', 'true'); mic.setAttribute('aria-label', 'לעצור את ההקלטה');
      $('askq').placeholder = 'מקשיב… לחצו שוב על המיקרופון כשסיימתם';
      rec.onresult = function (ev) { var t = ''; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; $('askq').value = (before ? before + ' ' : '') + t.trim(); };
      rec.onend = micOff;
      rec.onerror = micOff;
      rec.start();
    });
  }
  // The example answers from the example's own numbers, the way the real
  // analyst answers from a shop's. A prospect who asks "which product sells"
  // and is told "in a real panel this would answer" has just watched the
  // product not work. Anything outside these questions says what the real one does.
  function demoAnswer(q, d) {
    var note = '<p class="sub" style="font-size:12px;opacity:.75;margin:8px 0 0">בדוגמה התשובה נבנית מתבנית. בלוח אמיתי עונה המנתח, מהמספרים של האתר שלכם.</p>';
    if (!d) return '<p>הנתונים עוד נטענים. נסו שוב בעוד רגע.</p>';
    var src = (d.sources || [])[0], prod = (d.products || [])[0], k = d.kpis || {};
    if (/מאיפה|מקור|מגיעים|תנועה|גוגל/.test(q) && src) {
      var two = (d.sources || [])[1];
      return '<p>הכי הרבה מבקרים מגיעים מ<b>' + esc(src.label) + '</b>: ' + nf(src.value) + ' ב-30 יום, ' + src.share + '% מכל המבקרים.' +
        (two ? ' אחריו ' + esc(two.label) + ', ' + two.share + '%.' : '') + ' כשמקור אחד מחזיק יותר משליש מהתנועה, כדאי לחזק מקור שני.</p>' +
        chip(['מבקרים מ' + src.label + ': ' + nf(src.value)]) + note;
    }
    if (/מבוקש|נמכר|הכי (שואלים|פונים|פופולרי)|פופולרי|איזה מוצר (הכי|מוביל)/.test(q) && prod) {
      lastItem = findItem(prod.name, shopItems()) || lastItem;
      return '<p>המוצר שהכי שואלים עליו הוא <b>' + esc(prod.name) + '</b>: ' + nf(prod.actions) + ' פניות ב-30 יום' +
        (prod.wa ? ', מתוכן ' + nf(prod.wa) + ' בוואטסאפ' : '') + '. שווה לשים אותו בראש עמוד הבית ולוודא שהמחיר והמלאי מעודכנים.</p>' +
        chip(['פניות על ' + prod.name + ': ' + nf(prod.actions)]) + note;
    }
    if (/לשפר|כדאי|השבוע|לעשות/.test(q)) {
      var conv = (k.conversion || {}).now;
      return '<p>מי שנכנס כבר פונה: ' + conv + ' פניות על כל 100 מבקרים, וזה טוב. לכן הצעד שהכי שווה השבוע הוא להביא עוד מבקרים: פוסט אחד עם קישור לאתר, או בקשה מלקוחות קבועים לשתף.</p>' +
        chip(['פניות על כל 100 מבקרים' + ': ' + conv + '%']) + note;
    }
    return '<p>בלוח אמיתי, המנתח עונה כאן על כל שאלה מהמספרים של האתר שלכם, ומראה על איזה מספר נשענה כל תשובה. בדוגמה אפשר לנסות את שלוש השאלות שלמעלה.</p>';
  }
  function tipsHtml(list) {
    return (list || []).length ? '<ol class="tips">' + list.map(function (t) {
      return '<li><span class="kind ' + t.kind + '">' + (t.kind === 'data' ? 'מהנתונים שלכם' : 'עצה כללית') + '</span><b>' + esc(t.tip) + '</b>' +
        (t.why ? '<span class="why">' + esc(t.why) + '</span>' : '') + chip(t.evidence) + '</li>'; }).join('') + '</ol>' : '';
  }
  // While the assistant works: what it is doing, and how long it has been at it, counted every second, until
  // the answer takes the bubble's place. A change of look takes Claude half a minute: the count says it is working.
  function thinking(el, q) {
    var t0 = Date.now(), design = DESIGN_RE.test(q) || ideaAsked, look = LOOK_RE.test(q);
    var steps = design ? [[0, 'קורא את העמוד'], [6, 'מכין את השינוי'], [16, 'מצלם לפני ואחרי'], [30, 'עוד רגע, בודק שהכול נכון']]
      : look ? [[0, 'פותח את האתר'], [5, 'מצלם את העמודים'], [12, 'מחפש מה כדאי לשנות']]
      : [[0, 'חושב'], [6, 'קורא את המספרים'], [16, 'בודק כל מספר בתשובה']];
    var tick = setInterval(function () {
      var tt = el.querySelector('.tt'), tw = el.querySelector('.tw');
      if (!tt || !el.isConnected) { clearInterval(tick); return; }
      var sec = Math.floor((Date.now() - t0) / 1000), now = steps.filter(function (x) { return sec >= x[0]; }).pop();
      tt.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      if (tw.textContent !== now[1]) tw.textContent = now[1];
    }, 1000);
  }
  $('askf').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('askq'), q = input.value.trim(); if (!q || asking) return;
    input.value = ''; logBox.hidden = true;
    bubble(esc(q), 'me'); record('me', esc(q));
    asking = true; $('askf').classList.add('busy');
    var wait = bubble('<div class="scan think"><div class="bar"></div><p><span class="tdots" aria-hidden="true"><i></i><i></i><i></i></span> <span class="tw">חושב</span> <time class="tt">0:00</time></p></div>', 'ai');
    thinking(wait, q);
    // the assistant sorts the message first: a change, a problem, a how-to.
    // Only a question about the numbers goes on to the analyst.
    var local = localAnswer(q);
    // the example panel shows its pictures and its changes on our test shop: real, but a change stays a preview
    var looks = demo && (ideaAsked || LOOK_RE.test(q) || DESIGN_RE.test(q)); ideaAsked = false;
    // the example's package used up: what needs the model waits for more, a price still changes (as in a real panel)
    if (demo && !local && demoMeter().spent) local = { kind: 'help', demo: true, answer: 'החבילה של העוזר לחודש הזה נגמרה, ולכן את זה אני לא יכול להכין עכשיו. שינוי מחיר, הסתרה והחזרה של מוצר עדיין עובדים. אפשר לבקש מהסטודיו להגדיל את החבילה (הכפתור מתחת לצ\'אט).' };
    if (demo && local && local.kind === 'help') looks = false;
    var ask = demo && local && local.kind === 'help' ? Promise.resolve(local) : looks ? keepCall('demo-look', { message: q }).catch(function () {
                        return { kind: 'help', answer: 'לא הצלחתי להכין את זה כרגע. נסו שוב בעוד דקה.' }; })
            : demo ? demoBrain(q).then(function (b) { return b || local || demoAssist(q); })
                   : local ? Promise.resolve(local) : assistCall(q);
    ask.then(function (a) {
      if (a && a.meter) showMeter(a.meter);
      if (demo && a && (looks || a.kind === 'brain' || (a.kind === 'change' && !local))) demoMeterUse();
      if (a && a.kind && a.kind !== 'question' && a.answer) {
        wait.innerHTML = assistHtml(a); record('ai', wait.innerHTML); tools(wait);
        asking = false; $('askf').classList.remove('busy'); input.focus({ preventScroll: true }); setTimeout(follow, 30);
        return;
      }
      askAnalyst(q, wait, input);
    });
  });
  function askAnalyst(q, wait, input) {
    if (demo) {
      var dh = demoAnswer(q, shown);
      wait.innerHTML = dh; tools(wait); record('ai', dh);
      asking = false; $('askf').classList.remove('busy'); return;
    }
    brainCall({ ask: q }).then(function (r) {
      if (r.meter) showMeter(r.meter);
      if (!r.answer && !(r.tips || []).length) {
        wait.innerHTML = r.detail ? '<p>המנתח לא הצליח לענות כרגע.</p><p class="sub" dir="ltr" style="font-size:12px;opacity:.7;margin:6px 0 0">' + esc(r.detail) + '</p>' :
          r.dropped ? '<p>המנתח ענה, אבל בתשובה הופיע מספר שלא קיים בנתונים שלכם, ולכן היא נמחקה. נסו לנסח את השאלה אחרת.</p>' :
          '<p>לא הצלחתי לענות על זה. נסו לנסח אחרת.</p>';
        return;
      }
      wait.innerHTML = (r.answer ? '<p>' + esc(r.answer) + ' <small class="cert ' + r.certainty + '">' + (CERT[r.certainty] || '') + '</small></p>' + chip(r.evidence) : '') + tipsHtml(r.tips);
      record('ai', wait.innerHTML); tools(wait);
    }).catch(function (e2) {
      wait.innerHTML = '<p>' + esc(/[֐-׿]/.test(e2.message) ? e2.message : 'המנתח לא זמין כרגע.') + '</p>';
    }).then(function () { asking = false; $('askf').classList.remove('busy'); input.focus({ preventScroll: true }); setTimeout(follow, 30); });
  }
  // ── The assistant and the keeper ────────────────────────────────────────
  // A change is drafted by the server and read back here; nothing reaches the
  // site until the owner presses "כן". The keeper's card says whether the
  // site is up, from the last real check, and what happened to each request.
  var keepApi = cfg.api + '/panel?site=' + (demo ? DEMO : cfg.site) + '&op=';
  // never wait forever: the server gives up at 60 seconds, the page a moment before
  function keepCall(op, body) {
    var h = { 'content-type': 'application/json' };
    if (!demo) h.authorization = 'Bearer ' + key;
    var ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 58000);
    return fetch(keepApi + op, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (t) clearTimeout(t); if (r.status === 429) throw new Error('limit'); if (!r.ok) throw new Error('server'); return r.json(); },
            function (e) { if (t) clearTimeout(t); throw e; });
  }
  // a request the assistant could not take is said so, here: it is not handed to the analyst, who reads numbers
  function assistCall(q) {
    return keepCall('assist', { message: q, catalog: items.length ? items : undefined }).catch(function (e) {
      return { kind: 'help', answer: e && e.name === 'AbortError' ? 'זה לקח יותר מדי זמן, ולא השתנה כלום. נסו שוב בעוד דקה, או נסחו את הבקשה קצר יותר.'
        : e && e.message === 'limit' ? 'הגעתם למספר הבקשות להיום. אפשר להמשיך מחר.' : 'לא הצלחתי להתחבר כרגע, ולא השתנה כלום. נסו שוב בעוד דקה.' };
    });
  }
  var REQ = { draft: 'מחכה לאישור שלכם', approved: 'אושר, עולה לאתר בדקות הקרובות', applied: '✓ עלה לאתר', needs_human: 'אצלנו בטיפול',
              failed: 'לא עלה', cancelled: 'בוטל', rejected: 'לא בוצע' };
  function assistHtml(a) {
    var h = '<p>' + esc(a.answer).replace(/\n/g, '<br>') + '</p>';
    if (a.link && pageUrl(a.link[0])) h += '<p><a class="btn btn-s" href="' + esc(a.link[0]) + '" target="_blank" rel="noopener">' + esc(a.link[1]) + '</a></p>';
    if ((a.changes || []).length) h += '<ul class="chg">' + a.changes.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    // the site itself, as every visitor sees it, and what is worth changing: each idea one tap from its own preview
    var pages = (a.pages || []).filter(function (x) { return pageUrl(x[0]); });
    if (pages.length) h += shots(pages.map(function (x) { return [x[0], esc(x[1])]; }).reverse());
    if ((a.ideas || []).length) h += '<div class="ideas">' + a.ideas.map(function (x) { return '<button type="button" class="btn btn-s" data-idea="' + esc(x) + '">✨ ' + esc(x) + '</button>'; }).join('') + '</div>';
    if (a.request && a.request.status === 'draft') {
      var pg = pageUrl(a.request.page), pv = pageUrl(a.request.preview);
      // a change of look: the page before, and with the change (a preview only this link shows)
      if (pv) h += compare(pv);
      else if (a.demoShots) h += shots([[a.demoShots.now, 'עכשיו באתר'], [a.demoShots.after, 'אחרי השינוי']]);
      else if (pg) h += shots([[pg, 'עכשיו באתר'], [pg + '?af-draft=' + encodeURIComponent(a.request.id), 'אחרי השינוי']]);
      h += '<div class="reqbtns" data-req="' + esc(a.request.id) + '"' + (pg ? ' data-page="' + esc(pg) + '"' : '') + (a.demo && pv ? ' data-preview="' + esc(pv) + '"' : '') + (a.demoShots ? ' data-after="' + esc(a.demoShots.after) + '"' : '') + '><button type="button" class="btn btn-brand btn-s" data-yes>' + esc(a.yesLabel || '✓ כן, לעדכן') + '</button> ' +
           '<button type="button" class="btn btn-s" data-no>✕ לא</button></div>';
    }
    return h;
  }
  // ── Prices and products, answered from the shop's own list ─────────────
  // "כמה עולה X" is not a question for the analyst, which reads visits and
  // clicks, not prices: it answered with the most-asked product. The panel
  // reads the product file the site is built from, and answers from it.
  var lastItem = null;
  function norm(s) { return String(s || '').toLowerCase().replace(/["'״׳`]/g, '').replace(/[-–—_,.:;!?()]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function findItem(text, list) {
    var tx = ' ' + norm(text) + ' ', best = null, score = 0;
    (list || []).forEach(function (p) {
      var n = norm(p.name); if (!n) return;
      if (tx.indexOf(n) >= 0) { if (1000 + n.length > score) { best = p; score = 1000 + n.length; } return; }
      var w = n.split(' ').filter(function (x) { return x.length > 1; }), hit = w.filter(function (x) { return tx.indexOf(x) >= 0; }).length;
      if (w.length && hit / w.length >= 0.6 && hit > score) { best = p; score = hit; }
    });
    return best;
  }
  // ₪9.90, not ₪9.9: a price with agorot shows both digits, as the shop does
  function money(n) { var r = Math.round(Number(n) * 100) / 100; return '₪' + r.toLocaleString('he-IL', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function shopItems() { return demo ? demoCat().filter(function (p) { return !p.hidden; }) : items; }
  var CHANGE_RE = /(תשנ[הי]|תעדכנ?[יו]?|תוריד|תורידי|תסתיר|תחזיר|תוסיף|תוסיפי|תחליף|תחליפי|תמחק|תמחקי|לשנות|לעדכן|להוריד|להסתיר|להחזיר|להוסיף|להחליף|למחוק|^\s*(שנה|עדכן|הורד|הוסף|החלף|מחק)|אזל|נגמר|חזר למלאי|יש שוב|מחיר חדש|להוזיל|תוזיל|הוזל|הנחה|מבצע|להעלות|תעלה|תייקר|לייקר|\d+\s*%|אחוז)/;
  // the same words the server sorts by (server/lib/assist.mjs RE.look and RE.design)
  var ideaAsked = false;   // a tapped idea is a change of look, however it is worded
  var LOOK_RE = /((שלח|תשלח|תשלחי|לשלוח|תראה|תראי|להראות|לראות|תביא|תביאי)[^.?!]{0,20}(תמונ|צילום|צילומי מסך|סקרינשוט))|((תראה|תראי|להראות)( לי)? את (ה)?(אתר|חנות|עמוד הבית))|איך (ה)?(אתר|חנות|עמוד הבית) נרא|מה (כדאי|אפשר|הייתי|צריך) (לשנות|לשפר)/;
  var DESIGN_RE = /(צבע|כחול|אדום|ירוק|רקע|פונט|גופן|כותרת|כפתור|לוגו|תגדיל|תקטין|תעצב|עיצוב|באנר|מרווח|תפריט)/;
  function localAnswer(q) {
    if (CHANGE_RE.test(q)) return null;
    var list = shopItems();
    if (!list.length) return null;
    var priceQ = /(כמה .{0,20}עול|מה המחיר|מחיר של|המחיר של|מה עולה|עלות)/.test(q);
    var listQ = /(אילו מוצרים|איזה מוצרים|מה יש (באתר|בחנות)|רשימת (ה)?מוצרים|כל המוצרים|מה אתם מוכרים)/.test(q);
    if (listQ) return { kind: 'catalog', answer: 'באתר יש ' + list.length + ' מוצרים: ' + list.slice(0, 8).map(function (p) { return p.name + (p.price ? ' (' + money(p.price) + ')' : ''); }).join(', ') + (list.length > 8 ? ' ועוד.' : '.') };
    if (!priceQ) return null;
    var it = findItem(q, list) || (/(הזה|הזאת|הזו|שלו|שלה|המוצר)/.test(q) ? lastItem : null);
    if (!it) return { kind: 'catalog', answer: 'על איזה מוצר? למשל: ' + list.slice(0, 4).map(function (p) { return p.name + (p.price ? ' ' + money(p.price) : ''); }).join(' · ') + '.' };
    lastItem = it;
    return { kind: 'catalog', answer: it.price ? it.name + ' עולה באתר ' + money(it.price) + '. רוצים לשנות? כתבו למשל: "תעדכן את המחיר של ' + it.name + ' ל-' + Math.round(it.price * 1.1) + '".' : 'ל' + it.name + ' אין מחיר באתר: הוא מוצג "לפי הזמנה".' };
  }

  // ── The demo shop: a catalogue the demo can really change ───────────────
  // Example products of an example shop, labelled as such. Every change the
  // visitor approves is made here, on this device, and shown in the table, so
  // a prospect sees what an owner sees: ask, read it back, press yes, done.
  // the test shop's own products (סחר פלוס, server/lib/catalogs.mjs "demo-wholesale"): the same the shop shows
  var DEMO_SEED = {
    'demo-wholesale': [
      { id: 'c1', name: 'ספריי ניקוי רב תכליתי', price: 9.9, desc: 'בקבוק 750 מ״ל' },
      { id: 'c2', name: 'נוזל רצפות מרוכז', price: 29, desc: 'גלון 4 ליטר' },
      { id: 'c3', name: 'אקונומיקה', price: 19, desc: 'גלון 4 ליטר' },
      { id: 'c4', name: 'סבון כלים מרוכז', price: 25, desc: 'גלון 4 ליטר' },
      { id: 'c5', name: 'מגבונים לחים לניקוי', price: 6.9, desc: 'חבילה של 80' },
      { id: 'd1', name: 'כוסות חד פעמיות', price: 79, desc: '1,000 יחידות' },
      { id: 'd2', name: 'צלחות קרטון', price: 69, desc: '500 יחידות' },
      { id: 'd3', name: 'סכו״ם חד פעמי', price: 55, desc: '600 יחידות' },
      { id: 'd4', name: 'מגשי אלומיניום עם מכסה', price: 45, desc: '50 יחידות' },
      { id: 'k1', name: 'סכין שף נירוסטה', price: 49, desc: 'להב 20 ס״מ' },
      { id: 'k2', name: 'סט סכינים עם מעמד', price: 189, desc: '5 חלקים' },
      { id: 'k3', name: 'קרש חיתוך מקצועי', price: 69, desc: '50×30 ס״מ' },
      { id: 'p1', name: 'מגבות נייר תעשייתיות', price: 39, desc: '6 גלילים' },
      { id: 'p2', name: 'נייר טואלט ג׳מבו', price: 85, desc: '12 גלילים' },
      { id: 'b1', name: 'שקיות זבל עבות', price: 35, desc: '50 יחידות' },
      { id: 'b2', name: 'כפפות ניטריל', price: 29, desc: '100 יחידות' }]
  };
  var DCK = 'democat:' + DEMO, dcat = null, dreqs = {}, dlog = [], dwa = '050-0000000';
  function demoCat() {
    if (!dcat) { try { dcat = JSON.parse(localStorage.getItem(DCK) || 'null'); } catch (x) {} }
    if (!dcat) dcat = JSON.parse(JSON.stringify(DEMO_SEED['demo-wholesale']));
    return dcat;
  }
  function demoSave() { try { localStorage.setItem(DCK, JSON.stringify(dcat)); } catch (x) {} }
  var HELP = [
    [/דומיין|כתובת (האתר|משלי|משלך)|co\.il/, 'הדומיין נקנה על שמכם ושייך לכם. אנחנו מחברים אותו לאתר ומחדשים אותו כל שנה כחלק מהתשלום החודשי.'],
    [/סליקה|אשראי|תשלום באתר/, 'התשלום באשראי עובר דרך חברת סליקה, בחשבון על שמכם. הכסף נכנס ישר אליכם, ואנחנו לא רואים את פרטי הכרטיס.'],
    [/הזמנ(ה|ות)|איפה רואים/, 'כל ההזמנות מופיעות בלוח הזה. הזמנה בוואטסאפ מגיעה ישר לוואטסאפ שלכם, עם כל המוצרים והכמויות.'],
    [/לבטל|ביטול|להפסיק/, 'אפשר להפסיק בכל רגע, בהודעה של 30 יום מראש. הדומיין נשאר שלכם.'],
    [/איך (משנים|מעדכנים|מוסיפים)|מה אפשר (לבקש|לשנות)|מה אתה יודע/, 'פשוט כותבים כאן מה לשנות, למשל: "תעדכן את המחיר של סכין שף נירוסטה ל-55", "כפפות ניטריל אזלו, תסתיר אותן", "תעשה את הכפתורים כחולים", "תוסיף מוצר: מטליות מיקרופייבר ב-25" או "תחליף את מספר הוואטסאפ ל-052-1234567". אני מראה מה הבנתי, ורק אחרי "כן" זה משתנה.']
  ];
  function demoParse(q, list, all) {
    var it = findItem(q, all) || null, value = '';
    var c = q.indexOf(':'); if (c >= 0) value = q.slice(c + 1).trim().replace(/^["״“]|["״”]$/g, '').trim();
    else { var m = q.match(/["“]([^"”]{2,300})["”]/); if (m) value = m[1].trim(); }
    if (/תמונ|צילום/.test(q)) return { kind: 'photo', item: it };
    var pc = q.match(/(\d+(?:\.\d+)?)\s*(?:%|אחוז)/);
    if (pc) {
      var up = /(להעלות|תעלה|תייקר|לייקר|יקר יותר|העלאה)/.test(q), f = 1 + (up ? 1 : -1) * Number(pc[1]) / 100;
      var scope = /(כל|הכל|הכול|כולם|החנות|האתר)/.test(q) || !it ? list : [it];
      if (!(f > 0) || Number(pc[1]) > 90) return { kind: 'other' };
      return { kind: 'bulk', pct: (up ? '+' : '-') + pc[1] + '%', list: scope.filter(function (x) { return x.price; }).map(function (x) {
        return { kind: 'price', item: x, value: Math.max(1, Math.round(x.price * f)) }; }) };
    }
    var add = q.match(/(?:תוסיף|תוסיפי|להוסיף|הוסף)\s+(?:מוצר|פריט)?\s*(?:חדש)?\s*:?\s*(.+?)\s+(?:ב|במחיר|ב-|ב־)\s*-?\s*₪?\s*(\d+(?:\.\d{1,2})?)/);
    if (add) return { kind: 'new', name: add[1].replace(/^["“]|["”]$/g, '').trim(), price: Number(add[2]) };
    if (/(תוסיף|להוסיף|הוסף|תוסיפי)\s+(מוצר|פריט)|מוצר חדש/.test(q)) return { kind: 'new' };
    var ph = q.replace(/[\s-]/g, '').match(/(?:\+?972|0)5\d{8}/);
    if (ph && /(מספר|טלפון|וואטסאפ|ווטסאפ)/.test(q)) { var d0 = ph[0].replace(/^\+?972/, '0'); return { kind: 'contact', value: d0.slice(0, 3) + '-' + d0.slice(3) }; }
    if (it && /(אזל|נגמר|תוריד|תורידי|להוריד|תסתיר|להסתיר|תמחק|למחוק|הורד|מחק|לא במלאי)/.test(q) && !/(תחזיר|להחזיר|חזר|יש שוב)/.test(q)) return { kind: 'hide', item: it };
    if (it && /(תחזיר|להחזיר|חזר למלאי|יש שוב|תציג|להציג)/.test(q)) return { kind: 'show', item: it };
    if (/(תיאור|הסבר)/.test(q) && it && value) return { kind: 'desc', item: it, value: value };
    if (/(שם|כותרת) (של|ה)/.test(q) && it && value) return { kind: 'name', item: it, value: value };
    if (/(עלינו|אודות|הסיפור)/.test(q) && value) return { kind: 'story', value: value };
    var nums = (q.replace(/(?:\+?972|0)5\d[\d-]{7,}/g, '').match(/\d+(?:\.\d{1,2})?/g) || []);
    var n = nums.length ? Number(nums[nums.length - 1]) : null;
    if (it && n !== null && /(מחיר|עולה|₪|שקל|ש"ח|שח|ל-?\d|ל־\d)/.test(q)) return { kind: 'price', item: it, value: n };
    return { kind: 'other' };
  }
  function demoAssist(q) {
    var NOTE = { demo: true };
    var h = HELP.filter(function (x) { return x[0].test(q); })[0];
    if (/(לא עובד|לא נפתח|לא עולה|לא נטען|קרס|נפל|תקוע|שגיאה|באג|תקלה|שבור|נשבר)/.test(q))
      return { demo: true, kind: 'problem', answer: 'בדקתי עכשיו: האתר עולה (200), נטען ב-0.6 שניות, והתמונות נטענות. אם אצלכם הוא עדיין לא נפתח, נסו לרענן או רשת אחרת, וכתבו מה בדיוק רואים. (בלוח אמיתי הבדיקה רצה על האתר שלכם באותו רגע.)' };
    if (!CHANGE_RE.test(q)) return h ? { demo: true, kind: 'help', answer: h[1] } : null;
    var all = demoCat(), ch = demoParse(q, shopItems(), all), it = ch.item, sum = '', why = '';
    // "which products should I discount?": the ones people ask about least,
    // by the panel's own numbers, 10% off, ready to approve
    if (ch.kind === 'other' && /(ממליץ|תמליץ|המלצה|כדאי|איזה|אילו)/.test(q) && /(להוריד|להוזיל|הוזל|הנחה|מבצע|מחיר)/.test(q)) {
      var asked = {}; ((shown && shown.products) || []).forEach(function (x) { asked[norm(x.name)] = x.actions || 0; });
      var rank = shopItems().filter(function (x) { return x.price; }).map(function (x) { return { p: x, n: asked[norm(x.name)] || 0 }; })
        .sort(function (a, b) { return a.n - b.n || b.p.price - a.p.price; }).slice(0, 2);
      var rl = rank.map(function (x) { var c = { kind: 'price', item: x.p, value: Math.max(1, Math.round(x.p.price * 0.9)) }; return { ch: c, sum: sumOf(c) }; });
      if (rl.length) {
        var rid = 'D' + Date.now().toString(36); dreqs[rid] = { list: rl };
        return { demo: true, kind: 'change', request: { id: rid, status: 'draft' }, changes: rl.map(function (x) { return x.sum; }),
                 answer: 'הייתי מתחיל מ' + rank.map(function (x) { return x.p.name; }).join(' ו') + ': הם מקבלים הכי מעט פניות באתר, ושם הנחה קטנה יכולה להזיז מכירות. ' +
                         'את המוצר המבוקש לא הייתי מוריד, הוא כבר נמכר טוב. הצעה של 10% הנחה:' };
      }
    }
    if (ch.kind === 'bulk') {
      var bl = ch.list.map(function (c) { return { ch: c, sum: sumOf(c) }; });
      if (!bl.length) return { demo: true, kind: 'change', answer: 'אין באתר מוצרים עם מחיר לשנות.' };
      var bid = 'D' + Date.now().toString(36); dreqs[bid] = { list: bl };
      return { demo: true, kind: 'change', request: { id: bid, status: 'draft' }, changes: bl.map(function (x) { return x.sum; }),
               answer: 'הבנתי: ' + (ch.pct.charAt(0) === '-' ? 'להוריד' : 'להעלות') + ' ' + ch.pct.slice(1) + ' ' + (bl.length > 1 ? 'מכל ' + bl.length + ' המוצרים' : 'מהמוצר') + ', מעוגל לשקל. ככה זה ייראה. לאשר?' };
    }
    if (ch.kind === 'price') {
      if (!(ch.value > 0)) why = 'המחיר לא נראה תקין. כתבו מספר, למשל 120.';
      else if (it.price && !/בטוח/.test(q) && (ch.value > it.price * 10 || ch.value < it.price / 10)) why = 'המחיר החדש רחוק מאוד מהמחיר הנוכחי (' + money(it.price) + '). אם זה נכון, כתבו שוב עם המילה "בטוח".';
      sum = 'לשנות את המחיר של "' + (it && it.name) + '" מ-' + money(it && it.price) + ' ל-' + money(ch.value);
    }
    else if (ch.kind === 'hide') sum = it.hidden ? '' : 'להסתיר מהאתר את "' + it.name + '"';
    else if (ch.kind === 'show') sum = 'להחזיר לאתר את "' + it.name + '"';
    else if (ch.kind === 'desc') sum = 'לשנות את התיאור של "' + it.name + '" ל: ' + ch.value;
    else if (ch.kind === 'name') sum = 'לשנות את השם של "' + it.name + '" ל: ' + ch.value;
    else if (ch.kind === 'story') sum = 'להחליף את הטקסט של "עלינו" ל: ' + ch.value;
    else if (ch.kind === 'contact') sum = 'לשנות את מספר הוואטסאפ באתר ל-' + ch.value;
    else if (ch.kind === 'new' && ch.name) sum = 'להוסיף מוצר חדש: "' + ch.name + '" ב-' + money(ch.price);
    else if (ch.kind === 'new') return ticketOffer(q, 'כדי שאוסיף מוצר לבד, כתבו שם ומחיר, למשל: "תוסיף מוצר: קערת מים ב-35". או שאפתח פנייה לצוות, והם יוסיפו אותו עם תמונה.');
    else if (ch.kind === 'photo') return ticketOffer(q, 'החלפת תמונה עושה איש צוות. לפתוח פנייה? אחרי זה שלחו את התמונה בוואטסאפ, והיא תצורף לפנייה.');
    else return ticketOffer(q, 'את זה עדיף שיעשה איש צוות. לפתוח פנייה לצוות, עם מה שכתבתם?');
    if (!sum && !why) return { demo: true, kind: 'change', answer: '"' + it.name + '" כבר מוסתר.' };
    if (why) return { demo: true, kind: 'change', answer: why };
    var id = 'D' + Date.now().toString(36); dreqs[id] = { ch: ch, sum: sum };
    if (it) lastItem = it;
    return { demo: true, kind: 'change', request: { id: id, status: 'draft', summary: sum }, demoShots: demoShots([ch]), answer: 'הבנתי: ' + sum + '.' + (demoShots([ch]) ? ' למטה שתי תמונות של עמוד המוצר: איך הוא נראה עכשיו, ואיך ייראה אחרי השינוי.' : '') + ' לאשר?' };
  }
  // The demo talks to the same model the analyst uses, with this example
  // shop's products and numbers, so it answers anything an owner would ask.
  // It only proposes; a change is made here, after "כן". Without the model
  // (no key, a busy quota, no network) the rules above answer instead.
  function demoBrain(q) {
    var hist = (cur && cur.msgs || []).slice(-9, -1).map(function (m) { return { w: m.w, t: plain(m.h).slice(0, 400) }; });
    var ctl = window.AbortController ? new AbortController() : null, tm = ctl && setTimeout(function () { ctl.abort(); }, 58000);
    return fetch(keepApi + 'demo-brain', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ message: q, history: hist, items: demoCat() }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        if (tm) clearTimeout(tm);
        if (!b || !b.answer) return null;
        var all = demoCat(), list = [], tkSubject = '';
        (b.changes || []).forEach(function (c) {
          var it = c.item ? all.filter(function (x) { return x.id === c.item; })[0] : null;
          var ch = { kind: c.kind, item: it, value: c.value, name: c.name, price: c.kind === 'new' ? c.value : undefined };
          if (ch.kind === 'photo' || ch.kind === 'ticket') { tkSubject = c.value || q; return; }
          var s = sumOf(ch); if (s) list.push({ ch: ch, sum: s });
        });
        if (!list.length && tkSubject) return ticketOffer(tkSubject, b.answer);
        if (!list.length) return { demo: true, kind: 'brain', answer: b.answer };
        var id = 'D' + Date.now().toString(36); dreqs[id] = { list: list };
        return { demo: true, kind: 'change', answer: b.answer, request: { id: id, status: 'draft' }, demoShots: demoShots(list.map(function (x) { return x.ch; })),
                 changes: list.map(function (x) { return x.sum; }) };
      }, function () { if (tm) clearTimeout(tm); return null; });
  }
  function sumOf(ch) {
    var it = ch.item;
    if (ch.kind === 'price' && it) return 'המחיר של "' + it.name + '": ' + money(it.price) + ' ← ' + money(ch.value);
    if (ch.kind === 'hide' && it) return 'להסתיר את "' + it.name + '"';
    if (ch.kind === 'show' && it) return 'להחזיר לאתר את "' + it.name + '"';
    if (ch.kind === 'desc' && it) return 'התיאור של "' + it.name + '": ' + ch.value;
    if (ch.kind === 'name' && it) return 'השם של "' + it.name + '" ← ' + ch.value;
    if (ch.kind === 'story') return 'הטקסט של "עלינו": ' + ch.value;
    if (ch.kind === 'contact') return 'וואטסאפ באתר ← ' + ch.value;
    if (ch.kind === 'new' && ch.name) return 'מוצר חדש: "' + ch.name + '" ב-' + money(ch.price);
    return '';
  }
  function demoApply(ch) {
    var it = ch.item, all = demoCat();
    var p = it && all.filter(function (x) { return x.id === it.id; })[0];
    if (!p && ['price', 'hide', 'show', 'desc', 'name'].indexOf(ch.kind) >= 0) return;
    if (ch.kind === 'price') { p.price = ch.value; p.changed = 'price'; }
    if (ch.kind === 'hide') { p.hidden = true; p.changed = 'hide'; }
    if (ch.kind === 'show') { p.hidden = false; p.changed = 'show'; }
    if (ch.kind === 'desc') { p.desc = ch.value; p.changed = 'desc'; }
    if (ch.kind === 'name') { p.name = ch.value; p.changed = 'name'; }
    if (ch.kind === 'contact') dwa = ch.value;
    if (ch.kind === 'new') all.push({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), name: ch.name, price: ch.price, desc: '', changed: 'new' });
  }
  // The example panel's before and after: the test shop's own page for the product, with the example's state
  // laid over it (lab-live.js, ?af-try=), once as it is and once with the change. Several products: the shop's front.
  var LAB = 'https://nitairevivo.github.io/agentfeed/lab/shop/';
  function labState(p) { return { price: Number(p.price), name: p.name, desc: p.desc || '', hidden: !!p.hidden }; }
  function demoShots(chs) {
    var now = {}, after = {}, ids = [];
    chs.forEach(function (ch) {
      var it = ch.item; if (!it || ['price', 'hide', 'show', 'desc', 'name'].indexOf(ch.kind) < 0 || !/^[a-z][0-9]{1,3}$/.test(it.id)) return;
      var cur = demoCat().filter(function (x) { return x.id === it.id; })[0] || it;
      if (!now[it.id]) { now[it.id] = labState(cur); after[it.id] = labState(cur); ids.push(it.id); }
      var a = after[it.id];
      if (ch.kind === 'price') a.price = Number(ch.value);
      if (ch.kind === 'hide') a.hidden = true;
      if (ch.kind === 'show') a.hidden = false;
      if (ch.kind === 'desc') a.desc = String(ch.value || '');
      if (ch.kind === 'name') a.name = String(ch.value || '');
    });
    if (!ids.length) return null;
    var page = ids.length === 1 ? LAB + 'p/' + ids[0] + '.html' : LAB;
    var u = function (st) { return page + '?af-try=' + encodeURIComponent(JSON.stringify(st)); };
    return { now: u(now), after: u(after) };
  }
  function ticketOffer(q, answer) {
    var id = 'D' + Date.now().toString(36); dreqs[id] = { ticket: { subject: q.slice(0, 90), body: q } };
    return { demo: true, kind: 'change', request: { id: id, status: 'draft' }, answer: answer, yesLabel: '📨 כן, לפתוח פנייה' };
  }
  function demoDecide(id, yes) {
    var r = dreqs[id]; if (!r) return { note: 'הבקשה כבר טופלה.' };
    delete dreqs[id];
    if (!yes) return { note: 'בוטל. שום דבר לא השתנה.' };
    if (r.ticket) { var tk = openTicket(r.ticket.subject, r.ticket.body, 'רגילה'); tickets(); return { note: '✓ נפתחה פנייה ' + tk.no + ' לצוות. אפשר לעקוב אחריה ב"פניות לצוות", מתחת לצ\'אט, ותקבלו הודעה כשהיא מטופלת.' }; }
    demoCat().forEach(function (x) { delete x.changed; });
    var list = r.list || [{ ch: r.ch, sum: r.sum }];
    list.forEach(function (x) { demoApply(x.ch); dlog.unshift({ summary: x.sum, status: 'applied', at: new Date().toISOString() }); });
    demoSave();
    return { note: (list.length > 1 ? '✓ ' + list.length + ' שינויים עודכנו.' : '✓ עודכן.') + ' ככה זה נראה עכשיו בטבלת המוצרים למעלה. באתר אמיתי השינוי עולה לאתר תוך כמה דקות, ומגיעה הודעה כשהוא באוויר.' };
  }
  function demoStatus() {
    var now = Date.now(), ago = function (m) { return new Date(now - m * 60000).toISOString(); };
    return { watched: true, demo: true, status: 'ok', checked: ago(7), last: { ms: 640 }, incident: null, uptime7: 100, uptime30: 99.8,
             incidents: [{ event: 'opened' }], requests: dlog.concat([{ summary: 'לשנות את המחיר של "סכין שף נירוסטה" מ-₪45 ל-₪49', status: 'applied' }]),
             weekly: { lines: ['412 מבקרים השבוע (+18% מהשבוע שלפני).', 'המוצר שהכי פנו עליו: ' + shopItems()[0].name + '.', 'האתר היה זמין 100% מהזמן השבוע, בלי תקלות.'] } };
  }
  function demoTable() {
    var all = demoCat();
    return '<h3 class="brain-sub">🛍️ המוצרים באתר <small>(חנות לדוגמה. נסו לשנות מהצ\'אט)</small></h3><ul class="list">' + all.map(function (p) {
      return '<li style="' + (p.hidden ? 'opacity:.45;text-decoration:line-through' : '') + (p.changed ? ';background:rgba(46,204,113,.12);border-radius:8px' : '') + '"><span>' + esc(p.name) +
        (p.desc ? '<br><small class="sub">' + esc(p.desc) + '</small>' : '') + (p.hidden ? ' <small>(מוסתר)</small>' : '') + '</span><b>' + money(p.price) + (p.changed ? ' ✓' : '') + '</b></li>'; }).join('') +
      '</ul><p class="sub">וואטסאפ באתר: ' + esc(dwa) + ' · <button type="button" class="btn btn-s" id="demoreset">איפוס הדוגמה</button></p>';
  }
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'demoreset') { dcat = null; dlog = []; dwa = '050-0000000'; tks = null; try { localStorage.removeItem(DCK); localStorage.removeItem(TKK); localStorage.removeItem(DMK); } catch (x) {} keeper(); tickets(); meterNow(); }
  });
  $('answer').addEventListener('click', function (e) {
    var idea = e.target.closest('[data-idea]');
    if (idea) { if (asking) return; ideaAsked = true; $('askq').value = idea.getAttribute('data-idea'); $('askf').requestSubmit ? $('askf').requestSubmit() : $('askf').dispatchEvent(new Event('submit')); return; }
    var cb = e.target.closest('[data-cmp]');
    if (cb) { var cbox = cb.closest('.cmp'); cbox.querySelectorAll('[data-cmp]').forEach(function (x) { x.classList.toggle('on', x === cb); });
      cbox.querySelectorAll('.cmpf').forEach(function (f) { f.classList.toggle('on', f.dataset.side === cb.dataset.cmp); }); return; }
    var yes = e.target.closest('[data-yes]'), no = e.target.closest('[data-no]');
    if (!yes && !no) return;
    var box = e.target.closest('[data-req]'), id = box.getAttribute('data-req');
    box.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    // a change of look in the example panel: "כן" shows it as made, to this visitor only; nothing is sent
    var dpv = demo && pageUrl(box.getAttribute('data-preview'));
    if (dpv) {
      var bubD = box.closest('.qa'), oldD = bubD.querySelector('.cmp');
      if (yes && oldD) oldD.remove();
      box.outerHTML = yes ? '<p class="sub"><b>✓ ככה זה נראה עכשיו.</b> בחנות של לקוח אמיתי זה כבר באתר, לכל המבקרים. בהדגמה השינוי נשאר רק אצלכם.</p>' + shots([[dpv, 'באתר עכשיו']])
        : '<p class="sub"><b>בוטל. שום דבר לא השתנה.</b></p>';
      resave(id, bubD); return;
    }
    var go = demo ? Promise.resolve(demoDecide(id, !!yes)) : keepCall(yes ? 'req-confirm' : 'req-cancel', { id: id });
    var bub2 = box.closest('.qa');
    go.then(function (r) {
      if (demo) {
        var bub = box.closest('.qa'), aft = yes && pageUrl(box.getAttribute('data-after')), oldC = aft && bub.querySelector('.cmp');
        if (oldC) oldC.remove();
        box.outerHTML = '<p class="sub"><b>' + esc(r.note) + '</b></p>' + (aft ? shots([[aft, 'באתר עכשיו']]) : '');
        resave(id, bub); keeper(); return;
      }
      var pg = pageUrl(box.getAttribute('data-page'));
      if (yes && r.status === 'applied') {
        // made: the picture is the shop itself, now, as every visitor sees it
        var bubA = box.closest('.qa'), old = bubA.querySelector('.cmp'); if (old) old.remove();
        var now = pageUrl(r.now) || (pg ? pg + '?t=' + Date.now() : '');
        box.outerHTML = '<p class="sub"><b>✓ השינוי עלה לאתר. ככה זה נראה עכשיו:</b></p>' + (pg ? shots([[now, 'באתר עכשיו']]) +
          '<p class="sub"><a href="' + esc(pg) + '" target="_blank" rel="noopener">לפתוח את העמוד באתר ↗</a></p>' : '');
        resave(id, bubA); keeper(); return;
      }
      box.outerHTML = '<p class="sub"><b>' + (yes ? (r.status === 'approved' ? '✓ אושר. השינוי יעלה לאתר תוך כמה דקות, ותקבלו הודעה כשהוא באוויר.' :
        (r.ticket ? '✓ נפתחה פנייה #' + r.ticket.no + ' לצוות. אפשר לעקוב אחריה ב"פניות לצוות".' : '✓ נשלח אלינו. אדם מאיתנו יטפל בזה ויעדכן אתכם.')) : 'בוטל. שום דבר לא השתנה.') + '</b></p>';
      if (r.ticket) tickets();
      resave(id, bub2); keeper();
    }).catch(function () {
      box.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
      box.insertAdjacentHTML('beforeend', '<p class="sub">לא הצלחנו לשלוח כרגע. נסו שוב.</p>');
    });
  });
  var STATUS = { ok: ['good', 'האתר עולה ותקין'], slow: ['warn', 'האתר עולה, אבל לאט'], broken: ['alert', 'משהו לא תקין באתר'],
                 down: ['alert', 'האתר לא עולה כרגע'], unknown: ['info', 'עוד לא נבדק'] };
  // ── Tickets: what the owner cannot change alone goes to the team ─────────
  // The owner opens a ticket (from the chat, or here); the agency sees every
  // client's tickets on one desk, assigns each to someone on the team, moves
  // it through new → in progress → waiting for the client → done, and the
  // owner sees each step. In the demo it all lives on this device, with an
  // example team and example clients, and says so.
  var TKK = 'demotickets:' + DEMO, tks = null, deskOn = false;
  var TEAM = ['נועם', 'דנה', 'אבי'];
  var TST = { new: ['info', 'חדשה'], doing: ['warn', 'בטיפול'], waiting: ['warn', 'מחכה לתשובה שלכם'], done: ['good', 'טופלה'] };
  function tkList() {
    if (tks) return tks;
    try { tks = JSON.parse(localStorage.getItem(TKK) || 'null'); } catch (x) {}
    if (!tks) {
      var h = function (n) { return new Date(Date.now() - n * 3600e3).toISOString(); };
      tks = [
        { no: '#1043', client: 'פרחי השרון', subject: 'להחליף את התמונה הראשית בעמוד הבית', prio: 'רגילה', status: 'doing', who: 'דנה', at: h(5), log: [{ w: 'client', t: 'שלחתי תמונה חדשה בוואטסאפ', at: h(5) }, { w: 'team', t: 'קיבלתי, מעלה היום', at: h(3) }] },
        { no: '#1042', client: 'מאפיית אורן', subject: 'להוסיף עמוד "הזמנות לאירועים"', prio: 'רגילה', status: 'waiting', who: 'אבי', at: h(26), log: [{ w: 'team', t: 'איזה מוצרים להציג בעמוד?', at: h(20) }] },
        { no: '#1041', client: 'סטודיו לי', subject: 'הטופס בעמוד צור קשר לא שולח', prio: 'דחופה', status: 'done', who: 'נועם', at: h(50), log: [{ w: 'team', t: 'תוקן ונבדק', at: h(47) }] }
      ];
    }
    return tks;
  }
  function tkSave() { try { localStorage.setItem(TKK, JSON.stringify(tks)); } catch (x) {} }
  function openTicket(subject, body, prio) {
    var l = tkList(), n = 1044 + l.filter(function (x) { return x.mine; }).length;
    var tk = { no: '#' + n, client: cfg.name, mine: true, subject: subject, prio: prio || 'רגילה', status: 'new', who: '', at: new Date().toISOString(),
               log: body && body !== subject ? [{ w: 'client', t: body, at: new Date().toISOString() }] : [] };
    l.unshift(tk); tkSave(); return tk;
  }
  function tickets() {
    var card = $('tks');
    if (!card) {
      card = document.createElement('section'); card.className = 'cardp glass tks'; card.id = 'tks';
      // after the assistant: asking comes first, a ticket is for what it could not do
      var anchor = document.querySelector('.brain') || $('keep'); if (!anchor) return;
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
      card.addEventListener('click', tkClick); card.addEventListener('change', tkChange); card.addEventListener('submit', tkSubmit);
    }
    if (!demo) return realTickets(card);
    var l = tkList(), mine = l.filter(function (x) { return x.mine; });
    var pill = function (s) { var v = TST[s] || TST.new; return '<span class="pill ' + v[0] + '"><i></i>' + v[1] + '</span>'; };
    var thread = function (x) { return (x.log || []).map(function (m) { return '<p class="tkmsg ' + m.w + '"><b>' + (m.w === 'team' ? esc(x.who || 'הצוות') : (x.mine ? 'אתם' : esc(x.client))) + ':</b> ' + esc(m.t) + ' <small>' + esc(hhmm(m.at)) + '</small></p>'; }).join(''); };
    var head = '<div class="tkhead"><h2>📨 פניות לצוות</h2><span class="tktabs"><button type="button" data-tab="me" class="' + (deskOn ? '' : 'on') + '">הפניות שלי</button>' +
               '<button type="button" data-tab="desk" class="' + (deskOn ? 'on' : '') + '">מסך הסוכנות</button></span></div>';
    if (!deskOn) {
      card.innerHTML = head + '<p class="sub">מה שלא משתנה לבד בצ\'אט, פותחים כאן פנייה, וצוות בניית האתרים מטפל. רואים כל שלב.</p>' +
        '<form class="tkform" id="tkform"><input name="s" maxlength="90" required placeholder="מה צריך? למשל: עמוד חדש למבצעי החג"><textarea name="b" rows="2" maxlength="600" placeholder="פרטים (לא חובה)"></textarea>' +
        '<label><input type="checkbox" name="u"> דחוף</label><button class="btn btn-brand btn-s" type="submit">📨 לפתוח פנייה</button></form>' +
        (mine.length ? '<ul class="tklist">' + mine.map(function (x) { return '<li><div class="tkrow"><b>' + esc(x.no) + ' · ' + esc(x.subject) + '</b>' + pill(x.status) + '</div>' +
          '<small class="sub">' + (x.who ? 'מטפל/ת: ' + esc(x.who) + ' · ' : '') + (x.prio === 'דחופה' ? '🔴 דחוף · ' : '') + 'נפתחה ' + esc(hhmm(x.at)) + '</small>' + thread(x) + '</li>'; }).join('') + '</ul>'
          : '<p class="sub">עוד אין פניות. אפשר לפתוח כאן, או פשוט לכתוב לעוזר בצ\'אט.</p>');
      return;
    }
    var count = function (s) { return l.filter(function (x) { return x.status === s; }).length; };
    card.innerHTML = head + '<p class="sub">כך הסוכנות רואה את הפניות של כל הלקוחות שלה במקום אחד. בדוגמה: צוות ולקוחות לדוגמה.</p>' +
      '<div class="meter"><span>חדשות: <b>' + count('new') + '</b></span><span>בטיפול: <b>' + count('doing') + '</b></span><span>מחכות ללקוח: <b>' + count('waiting') + '</b></span><span>טופלו: <b>' + count('done') + '</b></span></div>' +
      '<ul class="tklist desk">' + l.map(function (x, i) {
        return '<li class="' + (x.prio === 'דחופה' ? 'urgent' : '') + '"><div class="tkrow"><b>' + esc(x.no) + ' · ' + esc(x.client) + '</b>' + pill(x.status) + '</div><span>' + esc(x.subject) + (x.prio === 'דחופה' ? ' 🔴' : '') + '</span>' +
          '<div class="tkctl"><select data-i="' + i + '" data-f="status" aria-label="סטטוס">' + Object.keys(TST).map(function (k) { return '<option value="' + k + '"' + (x.status === k ? ' selected' : '') + '>' + TST[k][1] + '</option>'; }).join('') + '</select>' +
          '<select data-i="' + i + '" data-f="who" aria-label="משויך ל"><option value="">לא משויך</option>' + TEAM.map(function (n) { return '<option' + (x.who === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
          thread(x) + '<form class="tkreply" data-i="' + i + '"><input name="r" maxlength="300" placeholder="תשובה ללקוח…"><button class="btn btn-s" type="submit">שליחה</button></form></li>'; }).join('') + '</ul>';
  }
  // A real site run by an agency: its tickets live on the agency's desk, and
  // the owner sees theirs here, answers in the thread, and opens new ones.
  function toast(m) {
    var el = $('pntoast'); if (!el) { el = document.createElement('div'); el.id = 'pntoast'; el.className = 'pntoast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = m; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }
  var RST = { new: 'חדשה', doing: 'בטיפול', waiting: 'מחכה לתשובה שלכם', review: 'מחכה לאישור שינוי', done: 'טופלה' }, rtk = [], rself = '', rappr = 'team';
  // the owner's signing key, where the studio lets them approve on a site that checks signatures (afsign.js)
  var rdev = null, rdevs = null, rdevErr = '', ragency = '';
  function devLine() {
    if (!rdevs || !(rappr === 'client' || rself) || !rtk.some(function (x) { return x.sign; }) && !rdevs.active.length && !rdevs.waiting.length) return '';
    if (rdevErr) return '<p class="sub">⚠️ ' + esc(rdevErr) + '</p>';
    if (!rdev) return '';
    var on = rdevs.active.some(function (d) { return d.kid === rdev.kid; });
    return '<p class="sub">🔏 ' + (on ? 'המכשיר הזה מורשה לאשר שינויים באתר. ' : 'המכשיר הזה ממתין שהסטודיו יאשר אותו. כשהם מתקשרים, הקריאו להם את טביעת האצבע: ') +
      '<code dir="ltr">' + esc(rdev.fp) + '</code></p>';
  }
  function ensureOwnerDevice() {
    if (rdev || !window.AFSign || !(rappr === 'client' || rself)) return;
    AFSign.device('panel:' + cfg.site).then(function (d) {
      rdev = d;
      var known = rdevs && rdevs.active.concat(rdevs.waiting).some(function (x) { return x.kid === d.kid; });
      if (!known) return tkCall('dev-add', { pub: d.pub, name: 'בעל האתר · ' + AFSign.label() }).then(tickets);
      tickets();
    }).catch(function (e) { rdevErr = e.message; tickets(); });
  }
  function ownerSign(x, op) {
    var g = x && x.sign;
    if (!g || (op === 'ticket-approve') === /-undo$/.test(g.kind)) return Promise.resolve(null);
    if (!rdev || !rdevs || !rdevs.active.some(function (d) { return d.kid === rdev.kid; })) return Promise.reject(new Error('המכשיר הזה עוד לא אושר על ידי הסטודיו. בקשו מהם לאשר אותו, ונסו שוב.'));
    return AFSign.order(rdev, { agency: ragency, site: cfg.site, kind: g.kind, body: g.body });
  }
  function tkCall(op, body) {
    return fetch(cfg.api + '/panel?op=' + op + '&site=' + cfg.site, { method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || r.status); e.code = r.status; throw e; } return d; }); });
  }
  function realTickets(card) {
    tkCall('tickets').then(function (d) {
      card.hidden = false; rtk = d.tickets || []; rself = d.self || ''; rappr = d.approver || 'team'; rdevs = d.devices || null; ragency = d.agency || '';
      if (!rdev) ensureOwnerDevice();
      if (d.brand && d.brand.name) {
        document.title = (document.body.classList.contains('chatpage') ? 'העוזר | ' : 'לוח הבקרה | ') + cfg.name + ' · ' + d.brand.name;
        var top = document.querySelector('.pn-top small'); if (top && top.textContent.indexOf(d.brand.name) < 0) top.textContent += ' · ' + d.brand.name;
      }
      var pill = function (s) { return '<span class="pill ' + (s === 'done' ? 'good' : s === 'new' ? 'info' : 'warn') + '"><i></i>' + (RST[s] || s) + '</span>'; };
      var thread = function (x) { return (x.log || []).map(function (m) { return '<p class="tkmsg ' + (m.w === 'client' ? 'client' : 'team') + '"><b>' + (m.w === 'client' ? 'אתם' : m.w === 'system' ? 'המערכת' : esc(m.by || 'הצוות')) + ':</b> ' + esc(m.t) + ' <small>' + esc(hhmm(m.at)) + '</small></p>'; }).join(''); };
      card.innerHTML = '<div class="tkhead"><h2>📨 פניות לצוות</h2></div><p class="sub">מה שלא משתנה לבד בצ\'אט, פותחים כאן פנייה, והצוות מטפל. רואים כל שלב ועונים כאן.</p>' +
        '<form class="tkform" id="tkform"><input name="s" maxlength="120" required placeholder="מה צריך? למשל: להגדיל את הלוגו בטלפון"><textarea name="b" rows="2" maxlength="2000" placeholder="פרטים (לא חובה)"></textarea>' +
        selfChoice() +
        '<label><input type="checkbox" name="u"> דחוף</label><button class="btn btn-brand btn-s" type="submit">📨 לפתוח פנייה</button></form>' + devLine() +
        (rtk.length ? '<ul class="tklist">' + rtk.map(function (x) {
          var ag = x.agent || {};
          return '<li><div class="tkrow"><b>#' + esc(x.no) + ' · ' + esc(x.subject) + '</b>' + pill(x.status) + '</div>' +
            '<small class="sub">' + (x.whoName ? 'מטפל/ת: ' + esc(x.whoName) + ' · ' : '') + (x.prio === 'urgent' ? '🔴 דחוף · ' : '') + 'נפתחה ' + esc(hhmm(x.at)) + '</small>' + thread(x) +
            (x.status === 'review' && ag.state === 'preview' ? '<p class="sub">🤖 השינוי מוכן ומחכה לאישור' +
              (ag.preview ? ' · <a href="' + esc(ag.preview) + '" target="_blank" rel="noopener">👀 לראות איך זה ייראה באתר</a>' : '') +
              (rappr === 'client' || ag.mine ? ' <button type="button" class="btn btn-brand btn-s" data-tkok="' + esc(x.no) + '">' + (x.sign ? '🔏 לחתום ולאשר' : '✓ לאשר ולהעלות') + '</button>' : '') + '</p>' + compare(ag.preview) + signedList(x) : '') +
            (ag.state === 'sent' || ag.state === 'undoing' ? '<p class="sub">🔏 נחתם ונשלח לאתר. האתר בודק את החתימה ומבצע, בדרך כלל תוך דקה</p>' : '') +
            (ag.mine && ag.state === 'merged' ? '<p class="sub">🚀 השינוי באתר <button type="button" class="btn btn-s" data-tkundo="' + esc(x.no) + '">↩️ לבטל</button></p>' : '') +
            (x.status !== 'done' ? '<form class="tkreply" data-no="' + esc(x.no) + '"><input name="r" maxlength="2000" placeholder="לענות לצוות…"><button class="btn btn-s" type="submit">שליחה</button></form>' : '') + '</li>'; }).join('') + '</ul>'
          : '<p class="sub">עוד אין פניות. אפשר לפתוח כאן, או פשוט לכתוב לעוזר בצ\'אט.</p>');
    }).catch(function (e) { card.hidden = true; });   // a site with no team desk shows no card
  }
  // Before and after, side by side, before anyone approves: the site as it is, and the same page with the change
  // (a preview only whoever holds the link sees). In a sandbox: the page runs its own scripts, and reaches nothing of this screen.
  function compare(preview) {
    if (!/[?&]af-preview=[a-f0-9]{24}/.test(preview || '')) return '';
    var before = preview.replace(/([?&])af-preview=[a-f0-9]{24}/, '$1af-before=1');
    var frame = function (u, label, side) { return '<figure class="cmpf' + (side === 'a' ? ' on' : '') + '" data-side="' + side + '"><figcaption>' + label + '</figcaption>' +
      '<div class="cmpw"><iframe src="' + esc(u) + '" sandbox="allow-scripts" referrerpolicy="no-referrer" tabindex="-1" title="' + label + '"></iframe></div>' +
      '<a class="cmpopen" href="' + esc(u) + '" target="_blank" rel="noopener">לפתוח בגודל מלא ↗</a></figure>'; };
    return '<div class="cmp"><div class="cmpt" role="tablist"><button type="button" data-cmp="b">לפני</button><button type="button" data-cmp="a" class="on">אחרי</button></div>' +
      '<div class="cmpr">' + frame(before, 'עכשיו באתר', 'b') + frame(preview, 'אחרי השינוי', 'a') + '</div></div>';
  }
  // The product's own page, phone-sized: before a change and after it (the "after" a preview no one else sees),
  // or only as it is now, once the change is made. Sandboxed like the before/after of a design change.
  function shots(list) {
    // one picture needs no tabs: its caption says what it is
    return '<div class="cmp"><div class="cmpt"' + (list.length < 2 ? ' hidden' : '') + '>' + list.map(function (x, i) { return '<button type="button" data-cmp="' + i + '"' + (i === list.length - 1 ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="cmpr">' + list.map(function (x, i) { return '<figure class="cmpf' + (i === list.length - 1 ? ' on' : '') + '" data-side="' + i + '"><figcaption>' + x[1] + '</figcaption>' +
        '<div class="cmpw"><iframe src="' + esc(x[0]) + '" sandbox="allow-scripts" referrerpolicy="no-referrer" tabindex="-1" title="' + x[1] + '"></iframe></div>' +
        '<a class="cmpopen" href="' + esc(x[0]) + '" target="_blank" rel="noopener">לפתוח בגודל מלא ↗</a></figure>'; }).join('') + '</div></div>';
  }
  var pageUrl = function (u) { return /^https:\/\/[a-z0-9.-]+\//.test(u || '') ? u : ''; };
  // what the owner's device signs, drawn from the very object it signs
  function signedList(x) {
    var g = x.sign; if (!g || g.kind !== 'wp') return '';
    var F = { regular_price: 'מחיר', sale_price: 'מחיר מבצע', stock_status: 'מלאי', name: 'שם' }, ST = { instock: 'במלאי', outofstock: 'אזל', onbackorder: 'בהזמנה מראש' };
    var v = function (f, a) { return f === 'stock_status' ? (ST[a] || a) : /price$/.test(f) ? (a ? '₪' + a : 'בלי') : a; };
    return '<ul class="sub">' + (g.body.changes || []).map(function (c) { return '<li>' + esc(F[c.field] || c.field) + ' של "' + esc(c.name) + '": ' + esc(v(c.field, c.old)) + ' ← <b>' + esc(v(c.field, c.value)) + '</b></li>'; }).join('') + '</ul>';
  }
  // where the studio allows it, the owner has Claude make the change now, instead of waiting for the team
  function selfChoice() {
    if (!rself) return '';
    var o = [['', '📨 לשלוח לצוות']];
    if (rself === 'design' || rself === 'both') o.push(['design', '🎨 לבצע עכשיו עם Claude: עיצוב וטקסט']);
    if (rself === 'store' || rself === 'both') o.push(['store', '🛒 לבצע עכשיו עם Claude: מחירים, מבצעים ומלאי']);
    return '<fieldset class="tkself"><legend>מה לעשות עם הבקשה?</legend>' + o.map(function (x, i) {
      return '<label><input type="radio" name="m" value="' + x[0] + '"' + (i === (o.length > 1 ? 1 : 0) ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') +
      '<small class="sub">Claude מכין את השינוי, אתם רואים אותו ומאשרים. עד שתאשרו, שום דבר לא משתנה באתר.</small></fieldset>';
  }
  function tkClick(e) {
    var idea = e.target.closest('[data-idea]');
    if (idea) { if (asking) return; ideaAsked = true; $('askq').value = idea.getAttribute('data-idea'); $('askf').requestSubmit ? $('askf').requestSubmit() : $('askf').dispatchEvent(new Event('submit')); return; }
    var cb = e.target.closest('[data-cmp]');
    if (cb) { var box = cb.closest('.cmp'); box.querySelectorAll('[data-cmp]').forEach(function (x) { x.classList.toggle('on', x === cb); });
      box.querySelectorAll('.cmpf').forEach(function (f) { f.classList.toggle('on', f.dataset.side === cb.dataset.cmp); }); return; }
    var un = e.target.closest('[data-tkundo]');
    if (un && !demo) {
      if (!confirm('לבטל את השינוי ולהחזיר את מה שהיה קודם?')) return;
      var ux = rtk.filter(function (x) { return x.no === un.dataset.tkundo; })[0];
      un.disabled = true; ownerSign(ux, 'ticket-revert').then(function (sg) { return tkCall('ticket-revert', sg ? { no: un.dataset.tkundo, signed: sg } : { no: un.dataset.tkundo }); })
        .then(function () { toast('↩️ הביטול נשלח. האתר חוזר למה שהיה'); tickets(); })
        .catch(function (er) { un.disabled = false; toast(/מכשיר/.test(er.message) ? er.message : 'לא הצלחנו לבטל כרגע. כתבו לצוות בפנייה'); }); return;
    }
    var ok = e.target.closest('[data-tkok]');
    if (ok && !demo) {
      var ox = rtk.filter(function (x) { return x.no === ok.dataset.tkok; })[0];
      ok.disabled = true; ownerSign(ox, 'ticket-approve').then(function (sg) { return tkCall('ticket-approve', sg ? { no: ok.dataset.tkok, signed: sg } : { no: ok.dataset.tkok }); })
        .then(function () { toast('🚀 אושר. השינוי עולה לאתר'); tickets(); })
        .catch(function (er) { ok.disabled = false; toast(/מכשיר/.test(er.message) ? er.message : er.code === 403 ? 'באתר הזה הצוות מאשר שינויים. כתבו להם בפנייה.' : 'לא הצלחנו לאשר כרגע'); }); return; } var b = e.target.closest('[data-tab]'); if (b) { deskOn = b.dataset.tab === 'desk'; tickets(); } }
  function tkChange(e) {
    var s = e.target.closest('select[data-i]'); if (!s) return;
    var x = tkList()[+s.dataset.i]; x[s.dataset.f] = s.value;
    if (s.dataset.f === 'who' && s.value && x.status === 'new') x.status = 'doing';
    tkSave(); tickets();
  }
  function tkSubmit(e) {
    e.preventDefault();
    var f = e.target;
    if (!demo) {
      if (f.id === 'tkform') {
        var mode = f.m ? (f.querySelector('input[name=m]:checked') || {}).value || '' : '';
        var btn = f.querySelector('button[type=submit]'); btn.disabled = true;
        return tkCall('ticket-new', { subject: f.s.value.trim(), body: f.b.value.trim(), prio: f.u.checked ? 'urgent' : 'normal' }).then(function (t) {
          if (!mode) { toast('✓ נפתחה פנייה #' + t.no); return tickets(); }
          toast('🤖 Claude מכין את השינוי…');
          return tkCall('ticket-self', { no: t.no, kind: mode }).then(function () { toast('✓ השינוי מוכן. בדקו אותו ואשרו'); tickets(); })
            .catch(function () { toast('Claude לא הצליח הפעם, והבקשה עברה לצוות #' + t.no); tickets(); });
        }).catch(function () { toast('לא הצלחנו לפתוח פנייה כרגע'); }).then(function () { btn.disabled = false; });
      }
      if (f.classList.contains('tkreply') && f.r.value.trim()) return tkCall('ticket-reply', { no: f.dataset.no, text: f.r.value.trim() })
        .then(function () { toast('נשלח לצוות'); tickets(); }).catch(function () { toast('לא נשלח, נסו שוב'); });
      return;
    }
    if (f.id === 'tkform') { openTicket(f.s.value.trim(), f.b.value.trim(), f.u.checked ? 'דחופה' : 'רגילה'); tickets(); return; }
    if (f.classList.contains('tkreply') && f.r.value.trim()) {
      var x = tkList()[+f.dataset.i]; x.log = (x.log || []).concat([{ w: 'team', t: f.r.value.trim(), at: new Date().toISOString() }]);
      if (x.status === 'new') x.status = 'doing'; tkSave(); tickets();
    }
  }
  function keeper() {
    var card = $('keep');
    if (!card) {
      card = document.createElement('section'); card.className = 'cardp glass keep'; card.id = 'keep';
      var brainSec = document.querySelector('.brain'); if (!brainSec) return;
      brainSec.parentNode.insertBefore(card, brainSec);
    }
    (demo ? Promise.resolve(demoStatus()) : keepCall('site-status')).then(function (s) {
      if (!s.watched) { card.hidden = true; return; }
      card.hidden = false;
      var st = STATUS[s.status] || STATUS.unknown, inc = s.incident;
      var up = function (v) { return v == null ? '—' : v.toLocaleString('he-IL') + '%'; };
      card.innerHTML = '<h2>🛡️ שומר האתר</h2><p class="sub">בודק את האתר כל הזמן, כמו לקוח מהטלפון: שהוא עולה, שהעמוד שלם ושהתמונות נטענות. אם משהו נשבר, תקבלו הודעה, ואנחנו מטפלים.</p>' +
        '<div class="verdict ' + st[0] + '"><span class="pill"><i></i>' + st[1] + '</span>' +
        (s.checked ? '<small class="sub"> נבדק ב-' + esc(hhmm(s.checked)) + (s.last && s.last.ms ? ' · נטען ב-' + (s.last.ms / 1000).toFixed(1) + ' שניות' : '') + '</small>' : '') + '</div>' +
        (inc ? '<p><b>' + esc((inc.problems || []).join(' · ')) + '</b><br><span class="sub">התחיל ב-' + esc(hhmm(inc.opened)) + '. אנחנו כבר מטפלים.</span></p>' : '') +
        '<div class="meter"><span>זמינות השבוע: <b>' + up(s.uptime7) + '</b></span><span>ב-30 יום: <b>' + up(s.uptime30) + '</b></span>' +
        '<span>תקלות אחרונות: <b>' + (s.incidents || []).filter(function (i) { return i.event === 'opened'; }).length + '</b></span></div>' +
        (s.demo ? demoTable() : '') +
        ((s.requests || []).length ? '<h3 class="brain-sub">הבקשות שלכם</h3><ul class="list">' + s.requests.slice(0, 5).map(function (r) {
          return '<li><span>' + esc(r.summary) + '</span><b>' + esc(REQ[r.status] || r.status) + '</b></li>'; }).join('') + '</ul>' : '') +
        (s.weekly && (s.weekly.lines || []).length ? '<h3 class="brain-sub">📊 הדוח השבועי</h3><ul class="list">' + s.weekly.lines.map(function (l) { return '<li><span>' + esc(l) + '</span></li>'; }).join('') + '</ul>' : '') +
        '';
    }).catch(function () { card.hidden = true; });
  }
  document.querySelectorAll('#chips button').forEach(function (b) {
    b.addEventListener('click', function () { $('askq').value = b.textContent; $('askf').requestSubmit ? $('askf').requestSubmit() : $('askf').dispatchEvent(new Event('submit')); });
  });
  load();
  pushUI();
  brain();
  keeper();
  tickets();
  // a suggestion that shows the owner the chat can change the site, not only answer
  (function () { var c = $('chips'); if (!c) return; var b = document.createElement('button'); b.type = 'button'; b.textContent = 'איך משנים מחיר באתר?';
    b.addEventListener('click', function () { $('askq').value = b.textContent; $('askf').requestSubmit ? $('askf').requestSubmit() : $('askf').dispatchEvent(new Event('submit')); });
    c.appendChild(b); })();
  // The month's package, under the chat: what share the assistant has used. Counted in tokens on the server
  // (meter.mjs); here only the share, and, near the end, a way to ask the studio for more.
  // (the same bar on the numbers' page too, above the way to the assistant)
  var meterEl = null, lastMeter = null;
  function showMeter(m) {
    if (!m || !askNode || typeof m.pct !== 'number') return;
    // the package is not a limit right now (server/lib/meter.mjs ENFORCED): nothing to show
    if (m.off) { if (meterEl) { meterEl.remove(); meterEl = null; } var dOff = document.querySelector('.meter-data'); if (dOff) dOff.remove(); return; }
    lastMeter = m;
    if (!meterEl) { meterEl = document.createElement('div'); meterEl.className = 'meter-pk'; meterEl.setAttribute('aria-live', 'polite'); $('askf').insertAdjacentElement('beforebegin', meterEl); }
    var lvl = m.spent ? 'out' : m.pct >= 80 ? 'low' : 'ok', day = String(m.renews || '').split('-').reverse().slice(0, 2).map(Number).join('.');
    var dataEl = document.querySelector('.meter-data');
    meterEl.className = 'meter-pk ' + lvl;
    if (dataEl) dataEl.className = 'meter-pk meter-data ' + lvl;
    meterEl.innerHTML = '<div class="mrow"><span>' + (m.spent ? 'החבילה של העוזר לחודש הזה נגמרה' : 'העוזר החודש: השתמשתם ב-<b>' + m.pct + '%</b> מהחבילה') + '</span>' +
      '<small>' + (day ? 'מתחדשת ב-' + day : '') + '</small></div>' +
      '<div class="mbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + m.pct + '" aria-label="כמה מהחבילה נוצל"><i style="width:' + m.pct + '%"></i></div>' +
      (lvl === 'ok' ? '' : m.asked ? '<p class="sub">✓ ביקשתם מהסטודיו להגדיל. תקבלו הודעה כשזה מוכן.</p>' :
        '<button type="button" class="btn btn-s meterask">לבקש מהסטודיו להגדיל את החבילה</button>');
    if (dataEl) dataEl.innerHTML = meterEl.innerHTML;
  }
  // the example panel's meter: the same bar, on this device. It starts well into its month and fills a little with
  // each answer that needs the model, so a visitor sees the end of a package, asking for more, and the studio adding it
  var DMK = 'demometer:' + DEMO, DEMO_METER = false;
  function demoMeter() {
    var m = null; try { m = JSON.parse(localStorage.getItem(DMK) || 'null'); } catch (x) {}
    if (!m) m = { pct: 64, asked: '' };
    var d = new Date(), next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    // off while the real package is off, so the example shows what a client sees
    if (!DEMO_METER) return { pct: 0, spent: false, off: true };
    return { pct: Math.min(100, m.pct), spent: m.pct >= 100, asked: m.asked, renews: next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-01' };
  }
  function demoMeterSet(m) { try { localStorage.setItem(DMK, JSON.stringify({ pct: m.pct, asked: m.asked || '' })); } catch (x) {} showMeter(demoMeter()); }
  function demoMeterUse() { var m = demoMeter(); if (!m.spent) { m.pct = Math.min(100, m.pct + 6); demoMeterSet(m); } }
  function meterNow() { if (demo) showMeter(demoMeter()); else keepCall('meter').then(showMeter).catch(function () {}); }
  if (askNode && demo) {
    meterNow();
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest || !e.target.closest('.meterask')) return;
      var m = demoMeter(); m.asked = new Date().toISOString(); demoMeterSet(m);
      // what the studio does on its desk, played here: a package added a moment later
      setTimeout(function () { demoMeterSet({ pct: 32, asked: '' });
        bubble('<p><b>✓ הסטודיו הוסיף חבילה לחודש הזה.</b> אפשר להמשיך לבקש שינויים. (בהדגמה הסטודיו מאשר מיד. אצל לקוח אמיתי הבקשה נפתחת כפנייה במסך הצוות, והסטודיו מוסיף בלחיצה.)</p>', 'ai'); }, 2500);
    });
  }
  if (askNode && !demo) {
    meterNow();
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest || !e.target.closest('.meterask')) return;
      e.target.disabled = true;
      keepCall('meter-ask', {}).then(function (r) { showMeter(r.meter && Object.assign({}, r.meter, { asked: r.meter.asked || new Date().toISOString() })); })
        .catch(function () { e.target.disabled = false; e.target.insertAdjacentHTML('afterend', '<p class="sub">לא הצלחנו לשלוח כרגע. נסו שוב.</p>'); });
    });
  }
  // Two pages, one address: the numbers (the panel), and the assistant (?view=chat), a page of its own with
  // nothing else on it, opened empty and ready. A tab bar under the header moves between them; the key stays
  // in this tab, so the move needs nothing new. The conversation itself is the same one on any page.
  (function () {
    if (!askNode) return;
    var u = new URL(location.href), chat = u.searchParams.get('view') === 'chat';
    var to = function (v) { var x = new URL(location.href); x.hash = ''; if (v) x.searchParams.set('view', v); else x.searchParams.delete('view'); return x.pathname + x.search; };
    var nav = document.createElement('nav'); nav.className = 'pnnav'; nav.setAttribute('aria-label', 'דפי הלוח');
    nav.innerHTML = '<div class="wrap"><a href="' + esc(to('')) + '"' + (chat ? '' : ' class="on" aria-current="page"') + '>📊 הנתונים</a>' +
      '<a href="' + esc(to('chat')) + '"' + (chat ? ' class="on" aria-current="page"' : '') + '>💬 העוזר</a></div>';
    var top = document.querySelector('.pn-top');
    // the tabs belong to the numbers' page; the assistant's page is the conversation alone, with one way back in its header
    if (top && !chat) top.parentNode.insertBefore(nav, top.nextSibling);
    if (!chat) {
      // AgentFeed, free for the shop: its products written so AI assistants can read them. The owner joins
      // with their own form (an agency cannot agree for its client); the studio that sent them is named in it
      var join = document.createElement('a'); join.className = 'joinaf';
      var joinUrl = function () { return 'https://nitairevivo.github.io/agentfeed/join.html?via=' + encodeURIComponent(/^[a-z0-9][a-z0-9-]{0,39}$/.test(ragency || '') ? ragency : 'panel'); };
      join.href = joinUrl(); join.addEventListener('click', function () { join.href = joinUrl(); });   // the studio is known once its tickets load
      join.target = '_blank'; join.rel = 'noopener';
      join.innerHTML = '<span class="jic" aria-hidden="true">🤖</span><span><b>הצטרפות ל-AgentFeed, בחינם</b><small>הקטלוג של העסק שלכם, כתוב כך שעוזרי AI כמו ChatGPT יוכלו לקרוא אותו. ממלאים טופס אחד, ואנחנו מכינים.</small></span><span class="jgo">להצטרף ↗</span>';
      var mn = document.querySelector('main'); if (mn) mn.insertBefore(join, mn.firstChild);
      // the numbers' page: the conversation is not here; a button and the side button lead to its page
      askNode.hidden = true;
      var launch = document.createElement('a'); launch.className = 'btn btn-brand crlaunch'; launch.href = to('chat'); launch.innerHTML = '💬 לשאול את העוזר או לבקש שינוי';
      // beside the analysis, never inside it: a fresh analysis redraws #brain, and what was in it is gone
      var spot = $('brain'); spot.parentNode.insertBefore(launch, spot.nextSibling);
      var md = document.createElement('div'); md.className = 'meter-pk meter-data'; md.setAttribute('aria-live', 'polite');
      launch.parentNode.insertBefore(md, launch); if (lastMeter) showMeter(lastMeter);
      var fab = document.createElement('a'); fab.className = 'chatfab'; fab.href = to('chat'); fab.setAttribute('aria-label', 'לדף העוזר');
      fab.innerHTML = '<span aria-hidden="true">💬</span><b>לעוזר</b>';
      document.body.appendChild(fab);
      return;
    }
    // the assistant's page: the conversation is the whole page
    document.body.classList.add('chatpage');
    var back = document.createElement('a'); back.className = 'crback'; back.href = to(''); back.textContent = '📊 לנתונים';
    var tw = top && top.querySelector('.wrap'); if (tw) tw.appendChild(back);
    var room = document.createElement('section'); room.className = 'chatroom'; room.id = 'chatroom'; room.setAttribute('aria-label', 'העוזר');
    room.innerHTML = '<div class="crbody"></div><p class="crempty" id="crempty">אפשר לשאול על המספרים, או לבקש שינוי באתר:<br><b>"תעדכן את המחיר של… ל-120"</b> · <b>"תסתיר את…, אזל"</b></p>';
    var main = document.querySelector('main'); main.parentNode.insertBefore(room, main);
    room.querySelector('.crbody').appendChild(askNode); askNode.hidden = false;
    // the field's height, for the meter that sits right above it (panel.css --askh)
    var setH = function () { room.style.setProperty('--askh', $('askf').offsetHeight + 'px'); };
    setH(); if (window.ResizeObserver) new ResizeObserver(setH).observe($('askf'));
    document.title = 'העוזר | ' + (cfg.name || 'האתר');
    function empty() { $('crempty').hidden = $('answer').children.length > 0; }
    // opened empty and ready; the last conversation is one tap away under "שיחות קודמות"
    var nb = $('chnew'); if (nb) nb.click();
    new MutationObserver(empty).observe($('answer'), { childList: true }); empty();
    setTimeout(function () { $('askq').focus(); }, 30);
  })();
  var ph = $('askq'); if (ph) ph.placeholder = 'שאלו, או בקשו שינוי: "תעדכן את המחיר של… ל-120"';
})();

// the clock in the status strip: the owner's time, in Israel
(function () {
  var el = document.getElementById('hud-clock'); if (!el) return;
  function tick() { try { el.textContent = new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' }); } catch (x) {} }
  tick(); setInterval(tick, 1000);
})();
// ── The room itself: a sky that follows the mouse, cards that tilt toward
// it, and two gadgets that work on the owner's own numbers. Everything here
// is decoration or arithmetic; nothing invents a figure.
(function () {
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(pointer: fine)').matches;
  var root = document.documentElement, mx = innerWidth / 2, my = innerHeight / 3;
  // the light follows a mouse, once a frame; a finger moves the page, and nothing here should slow that down
  var lit = 0;
  addEventListener('pointermove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (!fine || lit) return;
    lit = requestAnimationFrame(function () { lit = 0; root.style.setProperty('--mx', mx + 'px'); root.style.setProperty('--my', my + 'px'); });
  }, { passive: true });
  // while the page scrolls, and while it is not on screen, the sky rests
  var moving = 0;
  addEventListener('scroll', function () { moving = Date.now(); }, { passive: true });

  // the sky: points that drift, join when near, and lean toward the pointer
  var c = document.getElementById('pnsky');
  if (c && !still) {
    var g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), W, H, pts = [];
    function size() {
      W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(fine ? 90 : 36, W * H / (fine ? 16000 : 22000)));
      pts = Array.from({ length: n }, function () { return { x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: Math.random() * 1.6 + .4 }; });
    }
    size(); addEventListener('resize', size);
    // a touch sends a ring out from the finger and pushes the stars away
    var rings = [];
    addEventListener('pointerdown', function (e) {
      rings.push({ x: e.clientX, y: e.clientY, r: 0 });
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], dx = p.x - e.clientX, dy = p.y - e.clientY, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < 260) { p.vx += dx / d * (260 - d) / 40; p.vy += dy / d * (260 - d) / 40; }
      }
    }, { passive: true });
    var brand = getComputedStyle(document.body).getPropertyValue('--glow').trim() || '#8b6cff';
    var tick = 0;
    (function frame() {
      requestAnimationFrame(frame);
      // a phone draws every other frame; nothing is drawn while scrolling or in the background
      if (document.hidden || Date.now() - moving < 180 || (!fine && (tick++ & 1))) return;
      g.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], dx = mx - p.x, dy = my - p.y, d2 = dx * dx + dy * dy;
        if (d2 < 40000) { p.vx += dx / 60000; p.vy += dy / 60000; }
        p.vx *= .985; p.vy *= .985; p.x += p.vx + (Math.random() - .5) * .05; p.y += p.vy + (Math.random() - .5) * .05;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], ex = p.x - q.x, ey = p.y - q.y, e2 = ex * ex + ey * ey;
          if (e2 < 12000) { g.strokeStyle = 'rgba(139,108,255,' + (0.22 * (1 - e2 / 12000)) + ')'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
        }
        if (d2 < 26000) { g.strokeStyle = 'rgba(62,230,255,' + (0.35 * (1 - d2 / 26000)) + ')'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(mx, my); g.stroke(); }
        g.fillStyle = d2 < 26000 ? '#3ee6ff' : 'rgba(238,240,255,.55)';
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
      }
      for (var k = rings.length - 1; k >= 0; k--) {
        var rg = rings[k]; rg.r += 7; var life = 1 - rg.r / 320;
        if (life <= 0) { rings.splice(k, 1); continue; }
        g.strokeStyle = 'rgba(62,230,255,' + (0.6 * life) + ')'; g.lineWidth = 2;
        g.beginPath(); g.arc(rg.x, rg.y, rg.r, 0, 6.283); g.stroke();
        g.strokeStyle = 'rgba(139,108,255,' + (0.4 * life) + ')'; g.lineWidth = 1;
        g.beginPath(); g.arc(rg.x, rg.y, rg.r * .6, 0, 6.283); g.stroke();
      }
    })();
  }

  // cards lean toward the pointer, with a glare where it is
  if (fine && !still) {
    document.addEventListener('pointermove', function (e) {
      var t = e.target.closest && e.target.closest('.kpi, .gadget');
      document.querySelectorAll('.kpi, .gadget').forEach(function (k) { if (k !== t) k.style.transform = ''; });
      if (!t) return;
      var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      t.style.transform = 'perspective(800px) rotateX(' + (-y * 6) + 'deg) rotateY(' + (x * 8) + 'deg) translateY(-2px)';
      t.style.setProperty('--gx', (x + .5) * 100 + '%'); t.style.setProperty('--gy', (y + .5) * 100 + '%');
    }, { passive: true });
  }

  // the chart answers the pointer: the day under it, and its two numbers
  var chart = document.getElementById('chart'), tip = document.createElement('div');
  tip.className = 'ctip'; tip.hidden = true; if (chart) { chart.style.position = 'relative'; chart.appendChild(tip); }
  function onChart(e) {
    var d = window.__pn, svg = chart.querySelector('svg'); if (!d || !svg || !d.series.length) return;
    // the chart is redrawn on every load, and takes the tip with it
    if (!tip.isConnected) chart.appendChild(tip);
    var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    var vb = svg.viewBox.baseVal, P = 30, i = Math.round(((x * vb.width) - P) / (vb.width - 2 * P) * (d.series.length - 1));
    i = Math.max(0, Math.min(d.series.length - 1, i));
    var s = d.series[i], px = (P + i * (vb.width - 2 * P) / Math.max(1, d.series.length - 1)) / vb.width * r.width;
    tip.hidden = false; tip.style.left = px + 'px';
    tip.innerHTML = '<b>' + s.date.slice(8) + '.' + s.date.slice(5, 7) + '</b><span>' + s.visitors.toLocaleString('he-IL') + ' מבקרים</span><span>' + s.actions.toLocaleString('he-IL') + ' פניות</span>';
  }
  if (chart) { chart.addEventListener('pointermove', onChart); chart.addEventListener('pointerleave', function () { tip.hidden = true; }); }

  // ── gadgets ──
  var nf = function (n) { return Math.round(n).toLocaleString('he-IL'); };
  var site = (window.PANEL || {}).site || 'x';
  function goalRing(pct) {
    var r = 46, c2 = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    return '<svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="' + r + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"/>' +
      '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="url(#gg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (c2 * p) + ' ' + c2 + '" transform="rotate(-90 55 55)" style="filter:drop-shadow(0 0 8px #3ef0a1)"/>' +
      '<defs><linearGradient id="gg"><stop offset="0" stop-color="#3ee6ff"/><stop offset="1" stop-color="#3ef0a1"/></linearGradient></defs>' +
      '<text x="55" y="62" text-anchor="middle" font-size="22" font-weight="800" fill="#fff">' + Math.round(p * 100) + '%</text></svg>';
  }
  window.__pnGadgets = function (d) {
    var v = d.kpis.visitors.now, a = d.kpis.actions.now, rng = document.getElementById('simr');
    function sim() {
      var pct = Number(rng.value);
      document.getElementById('simv').textContent = pct + '%';
      document.getElementById('simnow').textContent = nf(a) + ' (' + (v ? (a / v * 100).toFixed(1) : 0) + '%)';
      document.getElementById('simthen').textContent = v ? nf(v * pct / 100) : '—';
    }
    if (rng) { if (!rng.dataset.set && v) { rng.value = Math.min(20, Math.max(0.5, Math.round(a / v * 200) / 2 + 2)); rng.dataset.set = 1; } rng.oninput = sim; sim(); }
    var goal = 0; try { goal = Number(localStorage.getItem('goal:' + site)) || 0; } catch (x) {}
    var inc = (d.money || {}).income || 0;
    document.getElementById('goalring').innerHTML = goalRing(goal ? inc / goal : 0);
    document.getElementById('goali').value = goal || '';
    document.getElementById('goaltxt').textContent = goal ? ('נרשמו ₪' + nf(inc) + ' מתוך ₪' + nf(goal) + (inc >= goal ? '. הגעתם ליעד!' : '. חסרים ₪' + nf(goal - inc) + '.')) : 'עוד לא נקבע יעד.';
  };
  var gf = document.getElementById('goalf');
  if (gf) gf.addEventListener('submit', function (e) {
    e.preventDefault();
    try { localStorage.setItem('goal:' + site, String(Number(document.getElementById('goali').value) || 0)); } catch (x) {}
    if (window.__pn) window.__pnGadgets(window.__pn);
  });
  if (window.__pn) window.__pnGadgets(window.__pn);

  // A number opens over the whole screen, from where it was touched: the
  // number itself, large, and what it is made of beneath it.
  var full = document.createElement('div');
  full.id = 'kfull'; full.setAttribute('role', 'dialog'); full.setAttribute('aria-modal', 'true'); full.hidden = true;
  document.body.appendChild(full);
  var opener = null;
  function openFull(k, x, y) {
    var r = k.getBoundingClientRect();
    full.style.setProperty('--tx', (x == null ? r.left + r.width / 2 : x) + 'px');
    full.style.setProperty('--ty', (y == null ? r.top + r.height / 2 : y) + 'px');
    var big = k.querySelector('b'), back = k.querySelector('.kback');
    full.innerHTML = '<div class="kf-in"><span class="kf-l">' + (k.querySelector('.l') || {}).textContent + '</span>' +
      '<div class="kf-n">' + (big ? big.textContent : '') + '</div>' +
      (back ? back.innerHTML.replace(/<span class="l">[^<]*<\/span>/, '').replace(/<span class="khint">[^<]*<\/span>/, '') : '') +
      '<button type="button" class="kf-x">סגירה ✕</button></div>';
    full.hidden = false; opener = k;
    requestAnimationFrame(function () { full.classList.add('on'); });
    full.querySelector('.kf-x').focus();
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (x2) {}
  }
  function closeFull() {
    full.classList.remove('on');
    setTimeout(function () { full.hidden = true; }, still ? 0 : 450);
    if (opener) opener.focus();
  }
  full.addEventListener('click', closeFull);
  document.addEventListener('click', function (e) {
    var k = e.target.closest && e.target.closest('.kpi'); if (k) openFull(k, e.clientX, e.clientY);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !full.hidden) return closeFull();
    var k = e.target.closest && e.target.closest('.kpi');
    if (k && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openFull(k); }
  });
})();
