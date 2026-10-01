// The owner's panel. Reads /panel on our server with the owner's key, or the
// demo when there is no key. The key arrives once in the link's fragment
// (#k=…), which browsers never send to any server, and is kept for the tab.
(function () {
  var cfg = window.PANEL, api = cfg.api + '/panel?site=';
  var key = '';
  try {
    var m = location.hash.match(/k=([^&]+)/);
    if (m) { sessionStorage.setItem('pk:' + cfg.site, m[1]); history.replaceState(null, '', location.pathname); }
    key = sessionStorage.getItem('pk:' + cfg.site) || '';
  } catch (e) {}
  var demo = !key || /[?&]demo/.test(location.search);
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
  function kpi(label, value, c, vals, colour, unit, vs) {
    return '<div class="kpi glass"><span class="l">' + label + '</span>' + value + delta(c, unit, false, vs) + spark(vals, colour) + '</div>';
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

  function render(d) {
    var k = d.kpis, mo = d.money, s = d.series;
    $('demo').hidden = !d.demo;
    // a young site has little to draw; the owner can see the full picture
    // on the demo, which says it is one
    var few = !d.demo && d.kpis.visitors.now < 50, hint = document.getElementById('fewhint');
    if (few && !hint) {
      $('kpis').insertAdjacentHTML('afterend', '<p id="fewhint" class="sub" style="text-align:center;margin:-6px 0 18px">האתר צעיר, אז הגרפים עוד דלילים. רוצים לראות איך הלוח נראה עם חודש של תנועה? <a href="?demo" style="color:#3ee6ff">לתצוגת הדוגמה</a></p>');
    }
    $('kpis').innerHTML =
      kpi('ביקורים ב-30 יום', num(k.visitors.now), k.visitors.change, s.map(function (x) { return x.visitors; }), 'var(--glow)') +
      kpi('פניות ופעולות', num(k.actions.now), k.actions.change, s.map(function (x) { return x.actions; }), '#3ee6ff') +
      kpi('אחוז המרה', num(k.conversion.now, '', '%', 1), k.conversion.change, s.map(function (x) { return x.visitors ? x.actions / x.visitors : 0; }), '#8b6cff', ' נק׳') +
      kpi('רווח החודש', num(k.profit.now, '₪'), k.profit.change, running(mo.month, d.ledger), '#3ef0a1', '', VS_MONTH);
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
    $('advice').innerHTML = d.advice.length ? d.advice.map(function (a) {
      return '<div class="tip ' + a.level + '"><div class="ic" aria-hidden="true">' + ICON[a.level] + '</div><div><h3>' + esc(a.title) +
        '</h3><p>' + esc(a.body) + '</p></div><span class="ev">' + esc(a.metric) + '</span></div>'; }).join('') :
      '<p class="sub">הכול שקט. ברגע שיצטברו נתונים יופיעו כאן המלצות.</p>';
    window.__pn = d; if (window.__pnGadgets) window.__pnGadgets(d);
    var prod = d.products || [];
    $('products').innerHTML = prod.length ? prod.slice(0, 8).map(function (p) {
      return '<li><span>' + esc(p.name) + '</span><span><b>' + nf(p.actions) + '</b> פניות' + (p.wa ? ' · ' + nf(p.wa) + ' בוואטסאפ' : '') + '</span></li>'; }).join('') :
      '<li>כשמישהו ילחץ על הזמנה מתוך כרטיס של מוצר, הוא יופיע כאן.</li>';
    $('when').textContent = 'עודכן ' + new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
    document.querySelectorAll('[data-to]').forEach(countUp);
  }
  function load(method, body) {
    var h = { 'content-type': 'application/json' };
    if (!demo) h.authorization = 'Bearer ' + key;
    return fetch(api + (demo ? 'demo' : cfg.site), { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401) return r.json().catch(function () { return {}; }).then(function (b) { throw new Error(WHY[b.reason] || 'הקישור לא תקין. בקשו קישור חדש.'); });
        if (r.status === 400) throw new Error('חסר סכום. כתבו סכום ונסו שוב.');
        if (!r.ok) throw new Error('השרת לא ענה כרגע. נסו לרענן בעוד דקה.');
        return r.json();
      })
      // a network failure arrives as the browser's own English text; the owner
      // gets a sentence that says what happened and what to do
      .then(function (d) { render(d); return true; }).catch(function (e) {
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
  var brainApi = cfg.api + '/analyst?site=' + (demo ? 'demo' : cfg.site);
  var CERT = { measured: 'נמדד', likely: 'סביר', guess: 'השערה לבדיקה' };
  var EFFORT = { low: 'כמה דקות', medium: 'שעה-שעתיים', high: 'יום ומעלה' };
  var VERDICT = { good: ['good', 'עובד טוב'], mixed: ['warn', 'חלק עובד, חלק לא'], weak: ['alert', 'צריך תשומת לב'], too_early: ['info', 'מוקדם לשפוט'] };
  var catalog = null;
  function readCatalog() {
    return fetch('../products.jsonl').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var c = { total: 0, noImage: 0, noPrice: 0, outOfStock: 0, noCategory: 0 };
      t.split('\n').forEach(function (line) {
        if (!line.trim()) return;
        try { var p = JSON.parse(line); } catch (x) { return; }
        c.total++;
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
  function showBrain(a, bench) {
    if (!a) { $('brain').innerHTML = '<p class="sub">המנתח לא ענה הפעם. ההמלצות למטה עדיין מבוססות על המספרים שלכם.</p>'; return; }
    var v = VERDICT[a.verdict] || VERDICT.mixed;
    $('brain').innerHTML =
      '<div class="verdict ' + v[0] + '"><span class="pill">' + v[1] + '</span><p>' + esc(a.headline || '') + '</p></div>' +
      (a.findings || []).map(function (f) {
        return '<div class="tip ' + (f.certainty === 'guess' ? 'info' : 'warn') + '"><div class="ic" aria-hidden="true">🔎</div><div><h3>' + esc(f.title) +
          ' <small class="cert ' + f.certainty + '">' + (CERT[f.certainty] || '') + '</small></h3><p>' + esc(f.explain) + '</p></div>' + ev(f.evidence) + '</div>'; }).join('') +
      ((a.actions || []).length ? '<h3 class="brain-sub">מה לעשות השבוע</h3><ol class="todo">' + a.actions.map(function (x) {
        return '<li><b>' + esc(x.do) + '</b> <small>(' + (EFFORT[x.effort] || '') + ')</small><br><span>' + esc(x.why) + '</span>' + ev(x.evidence) + '</li>'; }).join('') + '</ol>' : '') +
      ((a.ask_owner || []).length ? '<p class="sub">כדי לדייק, המנתח היה רוצה לדעת: ' + a.ask_owner.map(esc).join(' · ') + '</p>' : '') +
      (bench ? '<p class="sub bench">בהשוואה ל-' + bench.sites + ' חנויות אחרות שבנינו (חציון): ' + bench.conversion + '% פניות על כל 100 מבקרים · ' +
        bench.mobile + '% מטלפון · ' + bench.google + '% מגוגל.</p>' : '') +
      (a.demo ? '<p class="sub">בדוגמה הזאת הטקסט נכתב מתבנית. באתר אמיתי כותב אותו המנתח, מהמספרים שלכם.</p>' : '');
  }
  function brainCall(body) {
    var h = { 'content-type': 'application/json' };
    if (!demo) h.authorization = 'Bearer ' + key;
    body = body || {}; body.catalog = catalog; body.name = cfg.name;
    return fetch(brainApi, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function (r) {
      if (r.status === 429) throw new Error('הגעתם למספר השאלות להיום. אפשר לשאול שוב מחר.');
      if (!r.ok) throw new Error('המנתח לא זמין כרגע. נסו שוב בעוד כמה דקות.');
      return r.json();
    });
  }
  function brain() {
    $('brain').innerHTML = '<div class="thinking"><span></span><span></span><span></span> המנתח קורא את המספרים…</div>';
    readCatalog().then(function () { return brainCall({}); }).then(function (r) {
      if (r.reason === 'not_configured') { $('brain').innerHTML = '<p class="sub">המנתח עוד לא הופעל באתר הזה. ההמלצות למטה מבוססות על המספרים שלכם.</p>'; return; }
      showBrain(r.analysis, r.bench);
      if (!r.analysis && r.detail) $('brain').insertAdjacentHTML('beforeend', '<p class="sub" dir="ltr" style="font-size:12px;opacity:.7">' + esc(r.detail) + '</p>');
    }).catch(function (e) { $('brain').innerHTML = '<p class="sub">' + esc(/[\u0590-\u05FF]/.test(e.message) ? e.message : 'המנתח לא זמין כרגע.') + '</p>'; });
  }
  $('askf').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('askq').value.trim(); if (!q) return;
    if (demo) { $('answer').innerHTML = '<div class="answer"><p>בלוח אמיתי, המנתח עונה כאן מהמספרים של האתר שלכם, ומראה על איזה מספר נשענה התשובה.</p></div>'; return; }
    $('answer').innerHTML = '<div class="thinking"><span></span><span></span><span></span> חושב…</div>';
    brainCall({ ask: q }).then(function (r) {
      $('answer').innerHTML = r.answer ? '<div class="answer"><p>' + esc(r.answer) + ' <small class="cert ' + r.certainty + '">' + (CERT[r.certainty] || '') + '</small></p>' + ev(r.evidence) + '</div>' :
        '<div class="answer"><p>אין לי מספיק נתונים כדי לענות על זה בלי לנחש. נסו לשאול על משהו שהלוח מודד: ביקורים, מקורות, פניות או מוצרים.</p></div>';
    }).catch(function (e) { $('answer').innerHTML = '<p class="sub">' + esc(/[\u0590-\u05FF]/.test(e.message) ? e.message : 'המנתח לא זמין כרגע.') + '</p>'; });
  });
  load();
  brain();
})();

// ── The room itself: a sky that follows the mouse, cards that tilt toward
// it, and two gadgets that work on the owner's own numbers. Everything here
// is decoration or arithmetic; nothing invents a figure.
(function () {
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(pointer: fine)').matches;
  var root = document.documentElement, mx = innerWidth / 2, my = innerHeight / 3;
  addEventListener('pointermove', function (e) {
    mx = e.clientX; my = e.clientY;
    root.style.setProperty('--mx', mx + 'px'); root.style.setProperty('--my', my + 'px');
  }, { passive: true });

  // the sky: points that drift, join when near, and lean toward the pointer
  var c = document.getElementById('pnsky');
  if (c && !still) {
    var g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), W, H, pts = [];
    function size() {
      W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(90, W * H / 16000));
      pts = Array.from({ length: n }, function () { return { x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: Math.random() * 1.6 + .4 }; });
    }
    size(); addEventListener('resize', size);
    var brand = getComputedStyle(document.body).getPropertyValue('--glow').trim() || '#8b6cff';
    (function frame() {
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
      requestAnimationFrame(frame);
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
})();
