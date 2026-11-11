// The billing tab of the team desk: the agency's own invoicing account, each client's monthly plan, and
// the month at a glance — what the plans come to, what went out, what was paid, who is late. Every action
// goes through the desk's door (window.AFDesk.call: the builder's key and device proof) to billingapi.mjs.
// In the demo nothing is sent: the numbers are examples and every button only says what it would do.
(function () {
  var D = window.AFDesk; if (!D) return;
  var box = document.getElementById('billing'), esc = D.esc, data = null, open = '', busy = false;
  var STATE = { sent: ['נשלח קישור לתשלום', 'warn'], issued: ['חשבונית נשלחה', 'warn'], notified: ['דווח תשלום — לאשר', 'info'], paid: ['שולם', 'ok'], failed: ['לא יצא', 'alert'] };
  var ils = function (a) { return (a / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 }) + ' ₪'; };
  var HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var mname = function (m) { return HE[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); };

  function demoData() {
    var m = new Date().toISOString().slice(0, 7), at = function (d) { return new Date(Date.now() - d * 864e5).toISOString(); };
    var rows = [
      { site: 'pizza-dror', client: 'פיצה דרור (דוגמה)', price: 29900, active: true, day: 1, collect: 'link', bill: { state: 'paid', total: 35282, at: at(9), late: 0, reminders: [] } },
      { site: 'flowers', client: 'פרחי השרון (דוגמה)', price: 19900, active: true, day: 1, collect: 'invoice', bill: { state: 'issued', total: 23482, at: at(16), late: 16, reminders: ['7', '14'] } },
      { site: 'yoga-tal', client: 'יוגה עם טל (דוגמה)', price: 14900, active: true, day: 15, collect: 'link', bill: null }];
    var plans = rows.map(function (r) { return { site: r.site, client: { name: r.client, emails: ['example@example.co.il'], phone: '' }, price: r.price, vat: 'plus', collect: r.collect, day: r.day, includes: { changes: 5 }, extraPrice: 15000 }; });
    return { demo: true, connected: true, env: 'sandbox', vault: true, month: m, monthly: 64700, issued: 58764, paid: 35282, open: 23482, late: ['flowers'], rows: rows, plans: plans, once: [{ id: 'aaaaaaaaaaaa', client: { name: 'עסק לדוגמה' }, description: 'הקמת אתר (דוגמה)', total: 413000, state: 'sent', payUrl: 'https://example.com', allocation: false }] };
  }
  function load() {
    if (D.isDemo()) { data = demoData(); draw(); return; }
    box.innerHTML = '<p class="sub">טוען…</p>';
    D.call('billing').then(function (d) { data = d; draw(); }).catch(function (e) { box.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
  }

  function connectCard() {
    if (data.connected) return '<section class="cardp glass"><h2>חשבון החשבוניות</h2><p class="sub">מחובר' + (data.env === 'sandbox' ? ' — <b>סביבת בדיקה</b>: שום מסמך לא נכנס לספרים' : '') +
      '. החשבוניות והקישורים לתשלום יוצאים מהחשבון שלכם ב-Morning, בשם שלכם, והכסף נכנס אליכם.</p>' +
      '<button type="button" class="btn ghost sm" data-bill="disconnect">לנתק</button></section>';
    if (!data.vault) return '<section class="cardp glass"><h2>חשבון החשבוניות</h2><p class="sub">החיבור עוד לא פתוח בשרת. כשהוא ייפתח, אפשר יהיה לחבר כאן את Morning.</p></section>';
    return '<section class="cardp glass"><h2>לחבר את Morning</h2>' +
      '<p class="sub">ב-Morning: הגדרות ← כלים למפתחים ← מפתחות API ← "הוספת מפתח". מעתיקים לכאן את המזהה ואת הסוד. הסוד נשמר מוצפן, ואפשר לבטל אותו ב-Morning בכל רגע. ה-API של Morning דורש מסלול שכולל אותו.</p>' +
      '<form class="bform" data-bform="connect"><label>מזהה המפתח<input name="id" id="bill-id" autocomplete="off" dir="ltr" required></label>' +
      '<label>הסוד<input name="secret" id="bill-secret" type="password" autocomplete="off" dir="ltr" required></label>' +
      '<label class="chk"><input type="checkbox" name="sandbox" id="bill-sandbox" checked> סביבת בדיקה (מומלץ בהתחלה)</label>' +
      '<button type="submit" class="btn sm">לחבר ולבדוק</button></form></section>';
  }
  function kpis() {
    var k = function (l, v, cls) { return '<div class="kpi glass ' + (cls || '') + '"><span class="l">' + l + '</span><b>' + v + '</b></div>'; };
    return '<section class="kpis dkpis" aria-label="החודש בכסף">' + k('החבילות בחודש', ils(data.monthly)) + k('יצא ב' + mname(data.month), ils(data.issued)) +
      k('שולם', ils(data.paid), 'st-done') + k('פתוח', ils(data.open), data.open ? 'st-waiting' : '') + '</section>' +
      (data.late.length ? '<p class="bwarn">⚠️ ' + data.late.length + ' לקוחות לא שילמו 14 ימים ומעלה. התזכורת מוכנה בכפתור "תזכורת בוואטסאפ".</p>' : '');
  }
  function planForm(site, p) {
    p = p || { client: { name: '', emails: [], phone: '' }, price: '', vat: 'plus', collect: 'link', day: 1, includes: { changes: 0 }, extraPrice: '' };
    var o = function (v, cur, l) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + l + '</option>'; };
    var amt = function (a) { return a === '' ? '' : String(a / 100); };
    return '<form class="bform" data-bform="plan" data-site="' + esc(site) + '">' +
      '<label>שם הלקוח בחשבונית<input name="name" required maxlength="80" value="' + esc(p.client.name) + '"></label>' +
      '<label>מייל לחשבונית<input name="email" type="email" dir="ltr" value="' + esc((p.client.emails || [])[0] || '') + '"></label>' +
      '<label>נייד (לתזכורת)<input name="phone" type="tel" dir="ltr" value="' + esc(p.client.phone || '') + '"></label>' +
      '<label>מחיר לחודש (₪)<input name="price" inputmode="decimal" required value="' + esc(amt(p.price)) + '"></label>' +
      '<label>מע"מ<select name="vat">' + o('plus', p.vat, 'המחיר לפני מע"מ') + o('included', p.vat, 'המחיר כולל מע"מ') + o('exempt', p.vat, 'עוסק פטור') + '</select></label>' +
      '<label>איך משלמים<select name="collect">' + o('link', p.collect, 'קישור לתשלום באשראי') + o('invoice', p.collect, 'חשבונית במייל, תשלום אחר כך') + '</select></label>' +
      '<label>יום בחודש<input name="day" type="number" min="1" max="28" value="' + esc(p.day) + '"></label>' +
      '<label>שינויים כלולים בחודש<input name="changes" type="number" min="0" max="100" value="' + esc(p.includes.changes) + '"></label>' +
      '<label>מחיר לשינוי נוסף (₪)<input name="extra" inputmode="decimal" value="' + esc(amt(p.extraPrice)) + '"></label>' +
      '<button type="submit" class="btn sm">לשמור חבילה</button></form>';
  }
  function row(r) {
    var b = r.bill, st = b ? STATE[b.state] || [b.state, ''] : null;
    var acts = '';
    if (!b) acts += '<button type="button" class="btn ghost sm" data-bill="dry" data-site="' + esc(r.site) + '">מה ייצא</button><button type="button" class="btn sm" data-bill="issue" data-site="' + esc(r.site) + '">להוציא עכשיו</button>';
    if (b && b.state !== 'paid') acts += '<button type="button" class="btn ok sm" data-bill="paid" data-site="' + esc(r.site) + '">שולם</button><button type="button" class="btn ghost sm" data-bill="remind" data-site="' + esc(r.site) + '">תזכורת בוואטסאפ</button>';
    if (b && (b.payUrl || b.docUrl)) acts += '<a class="btn ghost sm" target="_blank" rel="noopener" href="' + esc(b.payUrl || b.docUrl) + '">' + (b.payUrl ? 'הקישור לתשלום' : 'החשבונית') + '</a>';
    acts += '<button type="button" class="btn ghost sm" data-bill="edit" data-site="' + esc(r.site) + '">החבילה</button>';
    return '<li class="tk brow"><div class="bhead"><b>' + esc(r.client) + '</b> <span class="sub">' + ils(r.price) + ' לחודש · ביום ' + r.day + '</span>' +
      (st ? ' <span class="pill ' + st[1] + '">' + st[0] + (b.late && b.state !== 'paid' ? ' · ' + b.late + ' ימים' : '') + '</span>' : ' <span class="pill">עוד לא יצא החודש</span>') +
      (b && b.allocation ? ' <span class="pill info" title="Morning מבקש את המספר מרשות המסים כשהחשבון מחובר אליה">צריך מספר הקצאה</span>' : '') +
      (b && b.error ? ' <span class="pill alert">' + esc(b.error) + '</span>' : '') + '</div>' +
      '<div class="bacts">' + acts + '</div>' + (open === r.site ? planForm(r.site, (data.plans || []).filter(function (p) { return p.site === r.site; })[0]) : '') + '</li>';
  }
  // a one-off: anyone, any amount — a quote that was accepted, a setup fee, a site that was built
  function onceCard() {
    var list = (data.once || []).slice(0, 10).map(function (o) {
      var st = STATE[o.state] || [o.state, ''];
      return '<li class="tk brow"><div class="bhead"><b>' + esc(o.client && o.client.name) + '</b> <span class="sub">' + esc(o.description) + ' · ' + ils(o.total) + '</span> <span class="pill ' + st[1] + '">' + st[0] + '</span>' +
        (o.allocation ? ' <span class="pill info">צריך מספר הקצאה</span>' : '') + '</div><div class="bacts">' +
        (o.payUrl || o.docUrl ? '<a class="btn ghost sm" target="_blank" rel="noopener" href="' + esc(o.payUrl || o.docUrl) + '">' + (o.payUrl ? 'הקישור לתשלום' : 'החשבונית') + '</a>' : '') +
        (o.state !== 'paid' ? '<button type="button" class="btn ok sm" data-bill="once-paid" data-id="' + esc(o.id) + '">שולם</button>' : '') + '</div></li>';
    }).join('');
    return '<section class="cardp glass"><h2>חיוב חד־פעמי</h2><p class="sub">לכל אחד, בכל סכום: הצעת מחיר שאושרה, דמי הקמה, אתר שנבנה. יוצא מהחשבון שלכם ב-Morning.</p>' +
      '<form class="bform" data-bform="once"><label>שם בחשבונית<input name="name" id="once-name" required maxlength="80"></label>' +
      '<label>מייל<input name="email" id="once-email" type="email" dir="ltr"></label>' +
      '<label>על מה<input name="desc" id="once-desc" required maxlength="120" placeholder="למשל: הקמת אתר"></label>' +
      '<label>סכום (₪)<input name="amount" id="once-amount" inputmode="decimal" required></label>' +
      '<label>מע"מ<select name="vat" id="once-vat"><option value="plus">הסכום לפני מע"מ</option><option value="included">הסכום כולל מע"מ</option><option value="exempt">עוסק פטור</option></select></label>' +
      '<label>איך משלמים<select name="collect" id="once-collect"><option value="link">קישור לתשלום באשראי</option><option value="invoice">חשבונית במייל</option></select></label>' +
      '<button type="submit" class="btn sm">להוציא</button></form>' + (list ? '<ul class="tklist">' + list + '</ul>' : '') + '</section>';
  }
  function draw() {
    var have = {}; data.rows.forEach(function (r) { have[r.site] = 1; });
    var noPlan = D.sites().filter(function (s) { return !have[s.slug]; });
    box.innerHTML = (data.demo ? '<p class="bwarn">דוגמה: לקוחות ומספרים לדוגמה. בכפתורים לא נשלח כלום.</p>' : '') + connectCard() + kpis() +
      '<ul class="tklist">' + data.rows.map(row).join('') + '</ul>' +
      (noPlan.length ? '<section class="cardp glass"><h2>אתרים בלי חבילה</h2><ul class="tklist">' + noPlan.map(function (s) {
        return '<li class="tk brow"><div class="bhead"><b>' + esc(s.name || s.slug) + '</b></div><div class="bacts"><button type="button" class="btn ghost sm" data-bill="edit" data-site="' + esc(s.slug) + '">להגדיר חבילה</button></div>' +
          (open === s.slug ? planForm(s.slug) : '') + '</li>'; }).join('') + '</ul></section>' : '') +
      onceCard() +
      '<p class="pn-foot">החשבוניות יוצאות מהחשבון שלכם, והכסף נכנס ישר אליכם — לא דרכנו. חיוב יוצא פעם אחת בחודש, ביום שנקבע. תזכורת נשלחת רק מהוואטסאפ שלכם, בלחיצה שלכם.</p>';
  }

  function run(op, body, done) {
    if (busy) return; busy = true;
    if (D.isDemo()) { busy = false; D.toast('בדוגמה לא נשלח כלום. במסך אמיתי: ' + ({ 'billing-issue': 'החיוב היה יוצא מ-Morning', 'billing-paid': 'החודש היה מסומן כשולם', 'billing-remind': 'הייתה נפתחת הודעה מוכנה בוואטסאפ', 'billing-plan': 'החבילה הייתה נשמרת', 'billing-connect': 'החשבון היה נבדק ונשמר מוצפן', 'billing-once': 'החיוב היה יוצא מ-Morning', 'billing-once-paid': 'החיוב היה מסומן כשולם' }[op] || '')); return; }
    D.call(op, body).then(function (r) { busy = false; done(r); }).catch(function (e) { busy = false; D.toast(e.message); });
  }
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-bill]'); if (!b) return;
    var site = b.dataset.site, m = data.month, what = b.dataset.bill;
    if (what === 'edit') { open = open === site ? '' : site; draw(); return; }
    if (what === 'disconnect') return run('billing-disconnect', {}, function () { D.toast('החשבון נותק'); load(); });
    if (what === 'dry') return run('billing-issue', { site: site, month: m, dry: true }, function (r) {
      D.toast('ייצא: ' + ils(Math.round(r.total)) + (r.doc.type === 320 ? ' — קישור לתשלום' : ' — חשבונית מס במייל') + (r.allocation ? '. צריך מספר הקצאה' : ''));
    });
    if (what === 'issue') return run('billing-issue', { site: site, month: m }, function (r) { D.toast(r.ok ? '✓ החיוב יצא' : r.why); load(); });
    if (what === 'once-paid') return run('billing-once-paid', { id: b.dataset.id }, function () { D.toast('✓ סומן כשולם'); load(); });
    if (what === 'paid') return run('billing-paid', { site: site, month: m }, function () { D.toast('✓ סומן כשולם'); load(); });
    if (what === 'remind') return run('billing-remind', { site: site, month: m }, function (r) {
      if (r.wa) window.open(r.wa, '_blank', 'noopener'); else { navigator.clipboard && navigator.clipboard.writeText(r.text).catch(function () {}); }
      D.toast(r.wa ? 'נפתחה הודעה מוכנה בוואטסאפ. בודקים ושולחים.' : 'אין נייד בחבילה. ההודעה הועתקה.'); load();
    });
  });
  box.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-bform]'); if (!f) return; e.preventDefault();
    var v = function (n) { var x = f.elements[n]; return x ? (x.type === 'checkbox' ? x.checked : x.value) : ''; };
    if (f.dataset.bform === 'once') return run('billing-once', { name: v('name'), emails: v('email') ? [v('email')] : [], description: v('desc'), amount: v('amount'), vat: v('vat'), collect: v('collect') },
      function (r) { D.toast(r.once && r.once.payUrl ? '✓ נוצר קישור לתשלום. אפשר לשלוח אותו ללקוח.' : '✓ החשבונית יצאה במייל'); load(); });
    if (f.dataset.bform === 'connect') return run('billing-connect', { id: v('id'), secret: v('secret'), sandbox: v('sandbox') }, function () { D.toast('✓ החשבון מחובר'); load(); });
    run('billing-plan', { site: f.dataset.site, plan: { client: { name: v('name'), emails: v('email') ? [v('email')] : [], phone: v('phone') }, price: v('price'), vat: v('vat'),
      collect: v('collect'), day: v('day'), includes: { changes: v('changes') }, extraPrice: v('extra') } }, function () { open = ''; D.toast('✓ החבילה נשמרה'); load(); });
  });
  window.AFBilling = { show: load };
})();
