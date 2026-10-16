// The agency's desk: every client's ticket, in one place, for the builders.
// A builder opens the link we sent them once (…/desk/?agency=newsite#k=…);
// the key moves from the address to this tab and is sent only in a header.
// ?demo shows the same desk with example tickets, kept on this device.
(function () {
  var qs = new URLSearchParams(location.search);
  // a local server, for testing on this machine only
  var API = /^http:\/\/localhost:\d+$/.test(qs.get('api') || '') ? qs.get('api') + '/panel' : 'https://agentfeed-plum.vercel.app/api/panel';
  var agency = (qs.get('agency') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  var key = '';
  try {
    var m = location.hash.match(/k=([0-9a-f]{32})/);
    if (m) { sessionStorage.setItem('dk:' + agency, m[1]); history.replaceState(null, '', location.pathname + location.search); }
    key = sessionStorage.getItem('dk:' + agency) || '';
  } catch (x) {}
  var demo = qs.has('demo') || !key;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var when = function (iso) { try { return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }); } catch (x) { return ''; } };
  var ST = { new: 'חדשה', doing: 'בטיפול', waiting: 'מחכה ללקוח', review: 'מחכה לאישור שינוי', done: 'טופלה' };
  var state = { tickets: [], team: [], sites: [], seasons: [], me: null, filter: 'open', q: '' };

  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); setTimeout(function () { el.classList.remove('on'); }, 2600); }
  function call(op, body) {
    var h = { 'content-type': 'application/json', authorization: 'Bearer ' + key };
    return fetch(API + '?op=' + op + '&agency=' + agency, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) throw new Error('הקישור לא תקין או שהמפתח הוחלף. בקשו קישור חדש.');
        if (!r.ok) { var er = new Error(d.error || 'השרת לא ענה. נסו שוב בעוד דקה.'); er.data = d; throw er; } return d; }); });
  }

  // ── the demo: a studio, its team, its clients, on this device ──
  // the same offers the server makes from a site's free check (server/lib/growth.mjs)
  var DEMO_OFFERS = {
    whatsapp: { key: 'whatsapp', offer: 'כפתור וואטסאפ קבוע בפינה', pitch: 'שמנו לב שבאתר אין כפתור וואטסאפ. בישראל הרבה קונים מעדיפים לשאול שאלה בוואטסאפ לפני שהם קונים. רוצים שנוסיף כפתור קבוע בפינת האתר?' },
    llms: { key: 'llms', offer: 'קובץ הסבר לעוזרי AI (llms.txt)', pitch: 'יש תקן חדש, llms.txt, שמסביר לעוזרי AI מה יש באתר. מעט עסקים כבר עשו את זה. רוצים שנוסיף?' },
    products: { key: 'products', offer: 'סימון המוצרים לגוגל ולעוזרי AI', pitch: 'המוצרים באתר לא מסומנים כך שגוגל ועוזרי AI כמו ChatGPT יודעים לקרוא מהם שם, מחיר וזמינות. רוצים שנוסיף את הסימון? במראה של האתר זה לא משנה כלום, זה רק למכונות.' },
    share: { key: 'share', offer: 'תמונה ותיאור כשמשתפים קישור', pitch: 'כשמשתפים קישור לאתר בוואטסאפ או בפייסבוק, לא מופיעה תמונה. רוצים שנגדיר תמונה ותיאור יפים לשיתוף?' },
    speed: { key: 'speed', offer: 'האצת האתר', pitch: 'העמוד הראשי נטען לאט. בדרך כלל אלה תמונות כבדות מדי, וזה תיקון קצר. רוצים שנטפל בזה?' }
  };
  var DK = 'desk-demo-2', h = function (n) { return new Date(Date.now() - n * 3600e3).toISOString(); };
  function demoData() {
    var kept = null; try { kept = JSON.parse(localStorage.getItem(DK) || 'null'); } catch (x) {}
    if (kept) return kept;
    return { me: { id: 'noam', name: 'נועם' }, brand: { name: 'סטודיו לדוגמה', color: '#5b4bdb', accent: '#00b5b8' },
      team: [{ id: 'noam', name: 'נועם' }, { id: 'dana', name: 'דנה' }],
      sites: [{ slug: 'pizza', name: 'פיצה דרור', platform: 'lovable', repo: 'studio/pizza', health: { watched: true, status: 'ok', uptime7: 100 },
                growth: { cert: { days: 64 }, audit: { score: 74, opportunities: [DEMO_OFFERS.whatsapp, DEMO_OFFERS.llms] } } },
              { slug: 'flowers', name: 'פרחי השרון', platform: 'base44', repo: '', health: { watched: true, status: 'ok', uptime7: 99.6 },
                growth: { cert: { days: 12 }, audit: { score: 58, opportunities: [DEMO_OFFERS.products, DEMO_OFFERS.share, DEMO_OFFERS.speed] } } },
              { slug: 'bakery', name: 'מאפיית אורן', platform: 'lovable', repo: 'studio/bakery', health: { watched: true, status: 'slow', uptime7: 100 },
                growth: { cert: { days: 81 }, audit: { score: 86, opportunities: [DEMO_OFFERS.share] } } },
              { slug: 'ceramics', name: 'קרמיקה של נועה', platform: 'wordpress', repo: '', line: true, health: { watched: true, status: 'ok', uptime7: 100 },
                wp: { connected: true, woo: true, user: 'noa-shop' },
                growth: { cert: { days: 47 }, audit: { score: 69, opportunities: [DEMO_OFFERS.whatsapp, DEMO_OFFERS.products] } } }],
      tickets: [
        { no: '1005', site: 'ceramics', client: 'קרמיקה של נועה', subject: 'הקערה הגדולה עולה 120 מהיום, והספל הכחול אזל', prio: 'normal', status: 'new', who: '', at: h(2), log: [{ w: 'client', t: 'הקערה הגדולה עולה 120 מהיום, והספל הכחול אזל', at: h(2) }] },
        { no: '1004', site: 'pizza', client: 'פיצה דרור', subject: 'להגדיל את הלוגו בטלפון', prio: 'urgent', status: 'new', who: '', at: h(1), log: [{ w: 'client', t: 'בטלפון הלוגו ממש קטן, אפשר להגדיל?', at: h(1) }] },
        { no: '1003', site: 'bakery', client: 'מאפיית אורן', subject: 'כפתור "הזמנה לאירוע" בצבע של הלוגו', prio: 'normal', status: 'review', who: 'dana', whoName: 'דנה', at: h(6),
          agent: { state: 'preview', pr: 'https://github.com/studio/bakery/pull/12', preview: '' },
          log: [{ w: 'client', t: 'שהכפתור יהיה בחום של הלוגו', at: h(6) }, { w: 'system', t: '🤖 השינוי מוכן. אפשר לראות אותו ולאשר · שיניתי את צבע הכפתור לחום של הלוגו (#8B5E3C) בעמוד הבית ובעמוד האירועים.', at: h(5) }] },
        { no: '1002', site: 'flowers', client: 'פרחי השרון', subject: 'להחליף את התמונה הראשית', prio: 'normal', status: 'waiting', who: 'noam', whoName: 'נועם', at: h(20),
          log: [{ w: 'team', by: 'נועם', t: 'שלחי לנו את התמונה בוואטסאפ ונעלה היום', at: h(19) }, { w: 'note', by: 'נועם', t: 'אתר Base44, ידני', at: h(19) }] },
        { no: '1001', site: 'pizza', client: 'פיצה דרור', subject: 'שעות פתיחה חדשות לחגים', prio: 'normal', status: 'done', who: 'dana', whoName: 'דנה', at: h(50), log: [{ w: 'team', by: 'דנה', t: 'עודכן ונבדק ✓', at: h(48) }] },
        { no: '1000', site: 'flowers', client: 'פרחי השרון', subject: 'להוסיף באנר של מבצע ולנטיינז', prio: 'normal', status: 'doing', who: 'dana', whoName: 'דנה', at: h(30), log: [{ w: 'client', t: 'משהו אדום וחגיגי, עד יום חמישי', at: h(30) }] },
        { no: '999', site: 'bakery', client: 'מאפיית אורן', subject: 'הכתובת בפוטר לא נכונה', prio: 'urgent', status: 'doing', who: 'dana', whoName: 'דנה', at: h(7), log: [{ w: 'client', t: 'עברנו לרחוב הרצל 12', at: h(7) }] },
        { no: '998', site: 'flowers', client: 'פרחי השרון', subject: 'לשנות את הטקסט בעמוד אודות', prio: 'normal', status: 'new', who: '', at: h(28), log: [] }
      ] };
  }
  function demoSave(d) { try { localStorage.setItem(DK, JSON.stringify(d)); } catch (x) {} }
  var D = null;
  function demoAct(op, b) {
    var t = D.tickets.filter(function (x) { return x.no === b.no; })[0], now = new Date().toISOString();
    if (op === 'ticket-set') {
      if (b.status) t.status = b.status;
      if (b.who !== undefined) { var mm = D.team.filter(function (x) { return x.id === b.who; })[0]; t.who = mm ? mm.id : ''; t.whoName = mm ? mm.name : ''; if (mm && t.status === 'new') t.status = 'doing'; }
      if (b.reply) { t.log.push({ w: 'team', by: D.me.name, t: b.reply, at: now }); if (t.status === 'new') t.status = 'doing'; }
      if (b.note) t.log.push({ w: 'note', by: D.me.name, t: b.note, at: now });
    }
    if (op === 'ticket-agent') {
      t.log.push({ w: 'system', t: '🤖 Claude התחיל לעבוד על השינוי', at: now });
      t.agent = { state: 'running' };
      setTimeout(function () {
        t.agent = { state: 'preview', pr: 'https://github.com/studio/' + t.site + '/pull/' + (20 + Number(t.no) % 7), preview: '' };
        t.status = 'review'; t.log.push({ w: 'system', t: '🤖 השינוי מוכן. אפשר לראות אותו ולאשר · (בדוגמה: השינוי מדומה)', at: new Date().toISOString() });
        demoSave(D); render(); toast('🤖 השינוי מוכן לאישור');
      }, 2500);
    }
    if (op === 'ticket-patch') {
      t.log.push({ w: 'system', t: '🎨 Claude קורא את העמוד ומכין שינוי עיצוב', at: now });
      t.agent = { state: 'running' };
      setTimeout(function () {
        t.agent = { state: 'preview', patch: 'demo', preview: '' };
        t.status = 'review'; t.log.push({ w: 'system', t: '🤖 השינוי מוכן. אפשר לראות אותו באתר ולאשר · (בדוגמה: השינוי מדומה)', at: new Date().toISOString() });
        demoSave(D); render(); toast('🎨 השינוי מוכן לתצוגה מקדימה');
      }, 2500);
    }
    if (op === 'ticket-wp') {
      t.log.push({ w: 'system', t: '🛒 Claude קורא את המוצרים בחנות ומכין שינוי', at: now });
      t.agent = { state: 'running' };
      setTimeout(function () {
        t.agent = { state: 'preview', wp: 'demo' };
        t.status = 'review'; t.log.push({ w: 'system', t: '🤖 השינוי מוכן. אפשר לראות אותו ולאשר · אעלה את המחיר של הקערה ואסמן את הספל כאזל.\nמחיר של "קערה גדולה": ₪90 ← ₪120\nמלאי של "ספל כחול": במלאי ← אזל\n(בדוגמה: השינוי מדומה)', at: new Date().toISOString() });
        demoSave(D); render(); toast('🛒 השינוי מוכן לאישור');
      }, 2500);
    }
    if (op === 'wp-code') { demoSave(D); return Promise.resolve({ code: 'DEMO2345', expires: new Date(Date.now() + 3 * 864e5).toISOString() }); }
    if (op === 'ticket-approve') { t.status = 'done'; t.agent.state = 'merged'; t.log.push({ w: 'system', t: '🚀 השינוי עלה לאתר', at: now }); }
    if (op === 'ticket-revert') { t.agent.state = 'reverted'; t.status = 'doing'; t.log.push({ w: 'system', t: '↩️ השינוי בוטל והאתר חזר לגרסה הקודמת', at: now }); }
    demoSave(D); return Promise.resolve(t);
  }
  function act(op, b) { return demo ? demoAct(op, b) : call(op, b); }

  // ── drawing ──
  function brand(b) {
    if (!b) return;
    document.title = 'מסך הצוות · ' + (b.name || '');
    $('bname').textContent = b.name || 'מסך הצוות';
    if (b.logo) { $('logo').src = b.logo; $('logowrap').hidden = false; }
    if (b.color) document.documentElement.style.setProperty('--brand', b.color);
    if (b.accent) document.documentElement.style.setProperty('--accent', b.accent);
  }
  function shown() {
    var q = state.q.trim();
    return state.tickets.filter(function (t) {
      var f = state.filter;
      if (f === 'open' && t.status === 'done') return false;
      if (ST[f] && t.status !== f) return false;
      if (f === 'mine' && t.who !== (state.me && state.me.id)) return false;
      if (f === 'urgent' && t.prio !== 'urgent') return false;
      return !q || (t.no + ' ' + t.client + ' ' + t.subject).indexOf(q) >= 0;
    });
  }
  function counts() {
    var c = function (s) { return state.tickets.filter(function (t) { return t.status === s; }).length; };
    $('counts').innerHTML = ['new', 'doing', 'waiting', 'review', 'done'].map(function (s) {
      return '<button type="button" data-f="' + s + '" class="kpi glass st-' + s + (state.filter === s ? ' on' : '') + '"><span class="l">' + ST[s] + '</span><b>' + c(s) + '</b></button>'; }).join('');
    var chips = [['open', 'פתוחות'], ['mine', 'שלי'], ['urgent', '🔴 דחופות'], ['all', 'הכול']];
    var tp = tips();
    // the panel's "what to do now": one tip per line, its colour by how pressing it is
    var tone = { late: 'alert', unassigned: 'warn', review: 'info' };
    $('tips').innerHTML = '<h2>מה הכי כדאי עכשיו</h2><p class="sub">נבנה מהפניות עצמן. לחיצה על שורה מסננת את הפניות שלה.</p>' + (tp.length ? '<div class="advice">' + tp.map(function (x) {
      return '<div class="tip ' + (tone[x[2]] || 'good') + '"' + (x[2] ? ' data-f="' + (x[2] === 'late' ? 'open' : x[2] === 'unassigned' ? 'new' : x[2]) + '"' : '') + '><div class="ic">' + x[0] + '</div><div><p>' + esc(x[1]) + '</p></div></div>'; }).join('') + '</div>'
      : '<div class="advice"><div class="tip good"><div class="ic">✓</div><div><p>הכול מטופל. יופי של עבודה.</p></div></div></div>');
    $('load').innerHTML = workload();
    $('chips').innerHTML = chips.map(function (x) { return '<button type="button" data-f="' + x[0] + '" class="' + (state.filter === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('');
  }
  // ── what makes the desk smarter than a list ──
  var QUICK = ['קיבלנו, מטפלים בזה היום 🙏', 'אפשר לשלוח לנו את התמונה בוואטסאפ?', 'השינוי עלה לאתר. תבדקו ותגידו לנו שהכול טוב 🙂',
               'צריכים עוד פרט קטן כדי להתקדם:', 'זה ייקח קצת יותר זמן, נעדכן עד מחר בצהריים'];
  function ageH(t) { return (Date.now() - new Date(t.at)) / 3600e3; }
  function age(t) {
    if (t.status === 'done') return '';
    var hh = ageH(t), late = t.prio === 'urgent' ? hh > 4 : hh > 24;
    var d = Math.round(hh / 24), txt = hh < 1 ? 'נפתחה עכשיו' : hh < 2 ? 'פתוחה שעה' : hh < 24 ? 'פתוחה ' + Math.round(hh) + ' שעות' : d === 1 ? 'פתוחה יום' : d === 2 ? 'פתוחה יומיים' : 'פתוחה ' + d + ' ימים';
    return '<span class="age' + (late ? ' late' : '') + '" title="' + (late ? 'מעבר לזמן התגובה' : '') + '">⏱ ' + txt + '</span>';
  }
  // Advice from the desk's own numbers: which tickets are late, who carries
  // too much, what waits on an approval, which client keeps asking.
  function tips() {
    var open = state.tickets.filter(function (t) { return t.status !== 'done'; }), out = [];
    var late = open.filter(function (t) { return t.prio === 'urgent' ? ageH(t) > 4 : ageH(t) > 24; });
    if (late.length) out.push(['⏱', late.length === 1 ? 'פנייה אחת עברה את זמן התגובה: #' + late[0].no + ' (' + late[0].client + ')' : late.length + ' פניות עברו את זמן התגובה. כדאי להתחיל מהן', 'late']);
    var none = open.filter(function (t) { return !t.who && t.status === 'new'; });
    if (none.length) out.push(['👤', none.length === 1 ? 'פנייה אחת עוד לא שויכה לאף אחד' : none.length + ' פניות עוד לא שויכו לאף אחד', 'unassigned']);
    var rev = open.filter(function (t) { return t.status === 'review'; });
    if (rev.length) out.push(['🤖', (rev.length === 1 ? 'שינוי אחד של Claude מחכה' : rev.length + ' שינויים של Claude מחכים') + ' לאישור. זה הכי מהיר לסגור', 'review']);
    var load = {}; open.forEach(function (t) { if (t.who) load[t.who] = (load[t.who] || 0) + 1; });
    var ids = Object.keys(load).sort(function (a, b) { return load[b] - load[a]; });
    if (ids.length > 1 && load[ids[0]] >= load[ids[ids.length - 1]] + 3) {
      var nm = function (id) { return (state.team.filter(function (m) { return m.id === id; })[0] || {}).name || id; };
      out.push(['⚖️', nm(ids[0]) + ' מחזיק/ה ' + load[ids[0]] + ' פניות פתוחות, ' + nm(ids[ids.length - 1]) + ' רק ' + load[ids[ids.length - 1]] + '. כדאי לאזן', '']);
    }
    var by = {}; state.tickets.forEach(function (t) { if (ageH(t) < 30 * 24) by[t.client] = (by[t.client] || 0) + 1; });
    var busy = Object.keys(by).filter(function (c) { return by[c] >= 3; })[0];
    if (busy) out.push(['💬', busy + ' פתח/ה ' + by[busy] + ' פניות החודש. אולי שווה שיחה קצרה: מה עוד מפריע לו באתר?', '']);
    var canAI = open.filter(function (t) { var s = siteOf(t.site); return s.repo && t.status !== 'review' && !(t.agent && t.agent.state === 'running'); });
    if (canAI.length) out.push(['✨', canAI.length + ' פניות באתרי Lovable: אפשר לתת ל-Claude להתחיל עליהן, ולבדוק רק את התוצאה', '']);
    return out;
  }
  function workload() {
    var open = state.tickets.filter(function (t) { return t.status !== 'done'; });
    return state.team.map(function (m) {
      var n = open.filter(function (t) { return t.who === m.id; }).length;
      return '<span class="ev wl"><b>' + esc(m.name) + '</b> ' + n + ' פתוחות</span>'; }).join('');
  }
  function siteOf(slug) { return state.sites.filter(function (s) { return s.slug === slug; })[0] || {}; }
  function ticket(t) {
    var s = siteOf(t.site), canAI = !!s.repo, ag = t.agent || {};
    var opts = function (cur) { return Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + ST[k] + '</option>'; }).join(''); };
    var who = '<option value="">לא משויך</option>' + state.team.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === t.who ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('');
    var thread = (t.log || []).map(function (m) {
      var by = m.w === 'client' ? esc(t.client) : m.w === 'system' ? 'המערכת' : esc(m.by || 'הצוות') + (m.w === 'note' ? ' (פנימי)' : '');
      return '<p class="msg ' + m.w + '"><b>' + by + ':</b> ' + esc(m.t) + '<small>' + esc(when(m.at)) + '</small></p>'; }).join('');
    var agent = '';
    if (ag.state === 'running') agent = '<div class="agent">🤖 Claude עובד על השינוי…</div>';
    if (ag.state === 'preview' && t.status === 'review') agent = '<div class="agent">🤖 השינוי מוכן' + (ag.pr ? ' · <a href="' + esc(ag.pr) + '" target="_blank" rel="noopener">השינוי בקוד</a>' : '') +
      (ag.preview ? ' · <a href="' + esc(ag.preview) + '" target="_blank" rel="noopener">' + (ag.patch ? 'לראות את השינוי באתר' : 'צילומי לפני ואחרי') + '</a>' : '') +
      ' <button type="button" class="btn ok" data-act="ticket-approve" data-no="' + t.no + '">' + (ag.wp ? '✓ לאשר ולעדכן בחנות' : '✓ לאשר ולהעלות') + '</button>' +
      '<button type="button" class="btn ghost" data-act="ticket-revert" data-no="' + t.no + '">✕ לא לאשר</button></div>';
    if (ag.state === 'merged' && ag.wp) agent = '<div class="agent">🛒 נכנס לחנות <button type="button" class="btn ghost" data-act="ticket-revert" data-no="' + t.no + '">↩️ לבטל ולהחזיר את הערכים הקודמים</button></div>';
    else if (ag.state === 'merged') agent = '<div class="agent">🚀 עלה לאתר <button type="button" class="btn ghost" data-act="ticket-revert" data-no="' + t.no + '">↩️ לבטל ולחזור לגרסה הקודמת</button></div>';
    return '<li class="tk' + (t.prio === 'urgent' ? ' urgent' : '') + '"><header><span class="no">#' + esc(t.no) + '</span><span class="client">' + esc(t.client) + '</span>' +
      age(t) + '<span class="st ' + t.status + '">' + ST[t.status] + '</span></header><div class="subj">' + (t.prio === 'urgent' ? '🔴 ' : '') + esc(t.subject) + '</div>' +
      '<div class="ctl"><select data-set="status" data-no="' + t.no + '" aria-label="סטטוס">' + opts(t.status) + '</select>' +
      '<select data-set="who" data-no="' + t.no + '" aria-label="משויך ל">' + who + '</select>' +
      (canAI && t.status !== 'done' && ag.state !== 'running' && t.status !== 'review' ? '<button type="button" class="btn ai" data-act="ticket-agent" data-no="' + t.no + '">🤖 לתת ל-Claude לבצע</button>' : '') +
      // any platform: a design patch through the site's one line (no code access needed)
      (!canAI && t.status !== 'done' && ag.state !== 'running' && t.status !== 'review' ? '<button type="button" class="btn ai" data-act="ticket-patch" data-no="' + t.no + '">🎨 שינוי עיצוב עם Claude</button>' : '') +
      // a WordPress store connected directly: prices, sales, stock and names of products
      (s.wp && s.wp.connected && s.wp.woo && !s.wp.lost && t.status !== 'done' && ag.state !== 'running' && t.status !== 'review' ? '<button type="button" class="btn ai" data-act="ticket-wp" data-no="' + t.no + '">🛒 שינוי במוצרים עם Claude</button>' : '') +
      (!canAI ? '<small style="color:var(--dim)">' + (s.line || demo ? 'השורה מותקנת באתר ✓' : 'צריך להתקין את השורה באתר') + '</small>' : '') + '</div>' +
      agent + '<div class="thread">' + thread + '</div>' +
      '<form class="reply" data-no="' + t.no + '"><div class="quick">' + QUICK.map(function (q, i) { return '<button type="button" data-q="' + i + '">' + esc(q.length > 26 ? q.slice(0, 24) + '…' : q) + '</button>'; }).join('') + '</div>' +
      '<textarea name="t" maxlength="2000" placeholder="תשובה ללקוח…"></textarea>' +
      '<div class="row"><label><input type="checkbox" name="n"> הערה פנימית (הלקוח לא רואה)</label><button class="btn" type="submit">שליחה</button></div></form></li>';
  }
  function render() {
    counts();
    var list = shown();
    $('list').innerHTML = list.length ? list.map(ticket).join('') : '<li class="empty">אין פניות כאן. 🎉</li>';
    copies = [];
    $('slist').innerHTML = state.sites.length ? state.sites.map(siteCard).join('') : '<li class="empty">עוד אין אתרים.</li>';
    seasonCard();
  }
  // Text the studio sends a client, kept here by number: the button carries the number, not the text.
  var copies = [];
  function copyBtn(text, label) { copies.push(text); return '<button type="button" class="btn ghost sm" data-copy="' + (copies.length - 1) + '">' + (label || '📋 העתקת הודעה ללקוח') + '</button>'; }
  function siteCard(s) {
    var hh = s.health || {}, g = s.growth || {}, c = g.cert, a = g.audit;
    var cert = c && c.days != null ? '<span class="cert' + (c.days <= 21 ? ' warn' : '') + '">🔒 ' + (c.days < 0 ? 'תעודת האבטחה פגה' : 'תעודת האבטחה בתוקף עוד ' + c.days + ' ימים') + '</span>' : '';
    var ops = a && (a.opportunities || []).length ? '<div class="ops"><b>✨ מה אפשר להציע ללקוח</b> <small>(מהבדיקה החינמית של האתר · ציון ' + esc(a.score) + ' מ-100)</small><ul>' +
      a.opportunities.slice(0, 3).map(function (o) { return '<li><span>' + esc(o.offer) + '</span>' + copyBtn('היי, ' + o.pitch) + '</li>'; }).join('') + '</ul></div>' :
      a ? '<div class="ops"><b>✨ האתר עבר את הבדיקה החינמית בציון ' + esc(a.score) + '</b></div>' : '';
    return '<li class="site"><div class="srow"><span class="dot ' + esc(hh.status || '') + '"></span><b>' + esc(s.name || s.slug) + '</b>' +
      (s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener"><small>' + esc(s.url.replace(/^https:\/\//, '')) + '</small></a>' : '') +
      '<small>' + (hh.uptime7 != null ? 'זמינות השבוע ' + hh.uptime7 + '%' : 'עוד לא נבדק') + '</small>' + cert +
      '<span class="tag">' + esc(s.platform || '') + (s.repo ? ' · Claude מחובר לקוד' : s.line ? ' · השורה מותקנת' : '') + '</span>' +
      '<button type="button" class="btn ghost sm" data-report="' + esc(s.slug) + '">📄 דוח חודשי ללקוח</button></div>' + direct(s) + ops + '</li>';
  }
  // The direct line to a WordPress store (server/lib/wpdirect.mjs): connected, cut, or a code to connect with.
  var codes = {};
  function direct(s) {
    // only a WordPress site carries the plugin that makes the connection
    if (s.repo || s.platform !== 'wordpress') return '';
    var w = s.wp || {}, c = codes[s.slug];
    if (w.connected && !w.lost) return '<div class="direct ok"><span>🔌 <b>חיבור ישיר</b> · ' + (w.woo ? 'Claude יכול לשנות מחירים, מבצעים ומלאי בחנות, באישור' : 'מחובר, אבל לא נמצאה חנות ווקומרס') + '</span></div>';
    var head = '<span>' + (w.lost ? '<b class="warn">⚠️ החיבור הישיר נותק</b> (הסיסמה בוטלה באתר). אפשר לחבר מחדש' : '<b>🔌 חיבור ישיר לחנות</b> <small>(וורדפרס עם ווקומרס: מחירים, מבצעים ומלאי)</small>') + '</span>';
    if (c) return '<div class="direct">' + head + '<p>הקוד: <code class="code">' + esc(c.code) + '</code> · בתוקף שלושה ימים, לשימוש אחד.<br>' +
      '<small>בעל האתר נכנס לוורדפרס ← כלים ← AgentFeed, מדביק את הקוד ולוחץ "אישור חיבור ישיר". צריך את התוסף AgentFeed Connect בגרסה 1.1 ומעלה.</small></p>' +
      copyBtn('היי, כדי ש-Claude יוכל לעדכן לכם מחירים ומלאי בחנות (רק אחרי אישור, ותמיד אפשר לבטל): בוורדפרס נכנסים לכלים ← AgentFeed, מדביקים את הקוד ' + c.code + ' ולוחצים "אישור חיבור ישיר". אפשר לנתק בכל רגע מאותו מסך.', '📋 הוראות ללקוח') + '</div>';
    return '<div class="direct">' + head + '<button type="button" class="btn ghost sm" data-wpcode="' + esc(s.slug) + '">קוד חיבור</button></div>';
  }

  // What is coming up in the shops' year, with the message to send every client.
  function seasonCard() {
    var el = $('season'), list = (state.seasons || []).filter(function (e) { return e.days >= 3; }).slice(0, 3);
    if (!list.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<h2>📅 בקרוב אצל הלקוחות</h2><p class="sub">מה מתקרב בלוח השנה של החנויות, עם הודעה מוכנה לכל לקוח.</p><ul class="list">' + list.map(function (e) {
      var d = ''; try { d = new Date(e.date + 'T12:00:00Z').toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }); } catch (x) {}
      return '<li><span><b>' + esc(e.name) + '</b> · ' + esc(d) + ' (בעוד ' + e.days + ' ימים)<br><small>' + esc(e.idea) + '</small></span>' + copyBtn(e.ask, '📋 הודעה ללקוחות') + '</li>'; }).join('') +
      '</ul><p class="rule">שולחים ללקוח, הוא שולח את הנוסח, פותחים פנייה ו-Claude מכין פס הודעה לתצוגה מקדימה. עולה רק אחרי אישור.</p>';
  }

  // ── the monthly report a studio sends each client: what the fee bought ──
  var MON = function (m) { var p = m.split('-'); try { return new Date(Date.UTC(+p[0], +p[1] - 1, 15)).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }); } catch (x) { return m; } };
  function monthNow(back) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (back || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function hrs(x) { return x < 1 ? 'פחות משעה' : x < 24 ? Math.round(x) + ' שעות' : Math.round(x / 24) + ' ימים'; }
  function demoReport(slug, month) {
    var s = siteOf(slug), mine = state.tickets.filter(function (t) { return t.site === slug; });
    // the example month: this site's tickets on the demo desk, and a few done earlier in the month
    var done = mine.filter(function (t) { return t.status === 'done'; }).map(function (t) { return { no: t.no, subject: t.subject }; })
      .concat([{ no: '981', subject: 'עדכון שעות הפתיחה לחגים' }, { no: '975', subject: 'הוספת שלושה מוצרים חדשים' }, { no: '968', subject: 'תיקון הקישור לוואטסאפ בטלפון' }]);
    var open = mine.filter(function (t) { return t.status !== 'done'; }).length;
    var r = { demo: true, month: month, monthName: MON(month), site: { name: s.name, url: '' }, brand: D && D.brand,
      watch: { checks: 2976, uptime: 99.9 }, incidents: [{ mins: 9, what: 'השרת לא ענה' }],
      requests: { opened: done.length + open, done: done.length, open: open, list: done },
      answerH: 1.5, changes: done.slice(0, 3), visits: { views: 1284, actions: 61 } };
    r.text = textOf(r); return r;
  }
  // the same words as server/lib/report.mjs reportText, for the demo
  function textOf(r) {
    var L = ['📄 *סיכום ' + r.monthName + '* · ' + r.site.name, ''];
    if (r.watch) L.push('🛡️ האתר נבדק ' + r.watch.checks.toLocaleString('he-IL') + ' פעמים החודש, ועבד ב-' + r.watch.uptime + '% מהבדיקות.');
    if (r.incidents.length) L.push('⚠️ ' + (r.incidents.length === 1 ? 'תקלה אחת' : r.incidents.length + ' תקלות') + ': ' + r.incidents.map(function (i) { return i.mins ? i.mins + ' דקות' : 'עדיין בטיפול'; }).join(', ') + '.');
    else if (r.watch) L.push('✅ לא היו תקלות החודש.');
    L.push('📨 ' + (r.requests.opened === 1 ? 'בקשה אחת נפתחה' : r.requests.opened + ' בקשות נפתחו') + ', ' + (r.requests.done === 1 ? 'אחת טופלה' : r.requests.done + ' טופלו') + '.');
    if (r.answerH != null) L.push('⏱ זמן תגובה רגיל: ' + hrs(r.answerH) + '.');
    if (r.changes.length) { L.push('', '🚀 *מה עלה לאתר:*'); r.changes.forEach(function (c) { L.push('• ' + c.subject); }); }
    if (r.visits) L.push('', '👀 ' + r.visits.views.toLocaleString('he-IL') + ' צפיות באתר, ' + r.visits.actions.toLocaleString('he-IL') + ' לחיצות על וואטסאפ, טלפון, טופס או סל.');
    if (r.brand && r.brand.name) L.push('', r.brand.name);
    return L.join('\n');
  }
  function repHtml(r) {
    var b = r.brand || {}, n = function (x) { return Number(x).toLocaleString('he-IL'); };
    var big = function (v, l) { return '<div class="kpi"><b>' + v + '</b><span>' + l + '</span></div>'; };
    return '<div class="rhead" style="--brand:' + esc(b.color || '') + '">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : '') +
      '<div><small>' + esc(b.name || '') + '</small><h2>סיכום ' + esc(r.monthName) + '</h2><p>' + esc(r.site.name) + (r.site.url ? ' · ' + esc(r.site.url.replace(/^https?:\/\//, '')) : '') + '</p></div></div>' +
      '<div class="kpis">' + (r.watch ? big(r.watch.uptime + '%', 'זמינות האתר (' + n(r.watch.checks) + ' בדיקות)') : '') +
      big(n(r.requests.done), 'בקשות טופלו') + (r.answerH != null ? big(hrs(r.answerH), 'זמן תגובה רגיל') : '') +
      (r.visits ? big(n(r.visits.views), 'צפיות באתר') : '') + '</div>' +
      '<h3>🛡️ שמירה על האתר</h3><p>' + (r.watch ? 'האתר נבדק אוטומטית כל כמה דקות, מהטלפון כמו לקוח. ' : '') +
      (r.incidents.length ? (r.incidents.length === 1 ? 'הייתה תקלה אחת' : 'היו ' + r.incidents.length + ' תקלות') + ': ' + r.incidents.map(function (i) { return esc(i.what || 'תקלה') + (i.mins ? ' (' + i.mins + ' דקות)' : ' (בטיפול)'); }).join(', ') + '.' : r.watch ? 'לא היו תקלות.' : 'השמירה על האתר עוד לא התחילה החודש.') + '</p>' +
      '<h3>📨 בקשות</h3><p>' + (r.requests.opened === 1 ? 'בקשה אחת נפתחה' : r.requests.opened + ' בקשות נפתחו') + ', ' + (r.requests.done === 1 ? 'אחת טופלה' : r.requests.done + ' טופלו') + (r.requests.open ? ', ו-' + r.requests.open + ' בטיפול.' : '.') + '</p>' +
      (r.changes.length ? '<h3>🚀 מה עלה לאתר</h3><ul>' + r.changes.map(function (c) { return '<li>' + esc(c.subject) + '</li>'; }).join('') + '</ul>' :
        r.requests.list.length ? '<h3>✅ מה טופל</h3><ul>' + r.requests.list.map(function (c) { return '<li>' + esc(c.subject) + '</li>'; }).join('') + '</ul>' : '') +
      (r.visits ? '<h3>👀 באתר</h3><p>' + n(r.visits.views) + ' צפיות, ו-' + n(r.visits.actions) + ' לחיצות על וואטסאפ, טלפון, טופס או סל.</p>' : '') +
      '<p class="rfoot">' + esc(b.name || '') + (r.demo ? ' · דוח לדוגמה' : '') + '</p>';
  }
  var repState = { slug: '', month: '' };
  function openReport(slug, month) {
    repState = { slug: slug, month: month || monthNow(0) };
    var el = $('rep');
    el.innerHTML = '<div class="rbar"><select id="rmon" aria-label="חודש">' + [0, 1, 2].map(function (k) { var m = monthNow(k); return '<option value="' + m + '"' + (m === repState.month ? ' selected' : '') + '>' + MON(m) + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="btn" data-rep="print">🖨️ הדפסה / PDF</button><button type="button" class="btn ghost" data-rep="copy">📋 העתקה לוואטסאפ</button>' +
      '<button type="button" class="btn ghost" data-rep="close" aria-label="סגירה">✕</button></div><div class="rbody" id="rbody">טוען…</div>';
    if (!el.open) { if (el.showModal) el.showModal(); else el.setAttribute('open', ''); }
    var got = demo ? Promise.resolve(demoReport(slug, repState.month)) : fetch(API + '?op=report&agency=' + agency + '&site=' + encodeURIComponent(slug) + '&month=' + repState.month, { headers: { authorization: 'Bearer ' + key } })
      .then(function (r) { if (!r.ok) throw new Error('הדוח לא נטען. נסו שוב בעוד דקה.'); return r.json(); });
    got.then(function (r) { repState.r = r; $('rbody').innerHTML = repHtml(r); }).catch(function (e) { $('rbody').textContent = e.message; });
  }
  function copy(text) {
    var done = function () { toast('הועתק. אפשר להדביק בוואטסאפ'); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    fallback();
    function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (x) { toast('לא הצלחתי להעתיק'); } t.remove(); }
  }
  // The check-in: three times a day the system looks over the desk and every
  // site, and writes what to do. It reads and advises; it never changes a site.
  function lastSlot() {
    var d = new Date(), slots = [18, 13, 8];
    for (var i = 0; i < slots.length; i++) if (d.getHours() > slots[i] || (d.getHours() === slots[i] && d.getMinutes() >= 13)) { d.setHours(slots[i], 13, 0, 0); return d; }
    d.setDate(d.getDate() - 1); d.setHours(18, 13, 0, 0); return d;
  }
  function demoBrief() {
    var open = state.tickets.filter(function (t) { return t.status !== 'done'; }).length;
    var slow = state.sites.filter(function (s) { return (s.health || {}).status === 'slow'; });
    return { at: lastSlot().toISOString(), line: 'כל ' + state.sites.length + ' האתרים עובדים · ' + open + ' פניות פתוחות',
      todo: ['🔒 תעודת האבטחה של פרחי השרון פגה בעוד 12 ימים. לוודא שהחידוש האוטומטי עובד',
             '✨ עבודה שאפשר להציע ללקוחות: כפתור וואטסאפ קבוע בפינה (אתר אחד), תמונה ותיאור כשמשתפים קישור (2 אתרים). הודעה מוכנה לכל לקוח בלשונית האתרים'],
      tips: [(slow[0] ? 'האתר של ' + slow[0].name + ' נטען לאט כבר כמה בדיקות. בדרך כלל זו תמונה גדולה מדי בראש העמוד, ושווה לבדוק לפני שהלקוח ישים לב.' : ''),
             'פרחי השרון פתחו 3 פניות החודש. שיחה קצרה איתם עכשיו יכולה לחסוך את הרביעית, וגם לשמור אותם מרוצים.',
             'שינוי שמחכה לאישור הוא הדבר הכי מהיר לסגור היום: לקוח שרואה שהבקשה שלו עלתה תוך יום ממליץ עליכם.'].filter(Boolean) };
  }
  function briefCard(b) {
    var el = $('brief'); if (!el) return;
    if (!b) { el.hidden = true; return; }
    var t = ''; try { t = new Date(b.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); } catch (x) {}
    el.hidden = false;
    el.innerHTML = '<div class="brain-top"><div class="core" aria-hidden="true"><i></i><i></i><i></i><b>AI</b></div><div><h2>הבדיקה של ' + esc(t) + '</h2><p class="sub">' + esc(b.line) + '</p></div></div>' +
      '<div class="advice">' + (b.todo || []).filter(function (x) { return /^(🔒|✨|📅)/.test(x); }).map(function (x) {
        return '<div class="tip ' + (/^🔒/.test(x) ? 'alert' : /^✨/.test(x) ? 'good' : 'info') + '"><div class="ic">' + x.slice(0, 2) + '</div><div><p>' + esc(x.slice(2).trim()) + '</p></div></div>'; }).join('') +
      (b.tips || []).map(function (x) { return '<div class="tip info"><div class="ic">💡</div><div><p>' + esc(x) + '</p></div></div>'; }).join('') + '</div>';
  }
  function apply(d) {
    state.tickets = d.tickets || []; state.team = d.team || []; state.sites = d.sites || []; state.me = d.me;
    if (d.seasons) state.seasons = d.seasons;
    briefCard(demo ? demoBrief() : d.brief);
    brand(d.brand); $('who').textContent = d.me ? 'מחובר/ת: ' + d.me.name : ''; render(); hud();
  }
  function load() {
    if (demo) {
      D = D || demoData(); apply(D);
      // the calendar is real in the demo too: the same dates the desk shows a studio
      if (!state.seasons.length) fetch(API + '?op=seasons').then(function (r) { return r.json(); }).then(function (x) { state.seasons = x.upcoming || []; render(); }).catch(function () {});
      return;
    }
    call('desk').then(apply).catch(function (e) { $('err').hidden = false; $('err').textContent = e.message; });
  }

  // ── acting ──
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-view]');
    if (tab) { document.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('on', b === tab); }); $('tickets').hidden = tab.dataset.view !== 'tickets'; $('sites').hidden = tab.dataset.view !== 'sites'; return; }
    var cp = e.target.closest('[data-copy]');
    if (cp) { copy(copies[+cp.dataset.copy] || ''); return; }
    var wc = e.target.closest('[data-wpcode]');
    if (wc) {
      wc.disabled = true;
      act('wp-code', { site: wc.dataset.wpcode }).then(function (r) { codes[wc.dataset.wpcode] = r; render(); })
        .catch(function (err) { wc.disabled = false; toast(err.message); });
      return;
    }
    var rb = e.target.closest('[data-report]');
    if (rb) { openReport(rb.dataset.report); return; }
    var rp = e.target.closest('[data-rep]');
    if (rp) {
      if (rp.dataset.rep === 'close') { var dl = $('rep'); if (dl.close) dl.close(); else dl.removeAttribute('open'); }
      if (rp.dataset.rep === 'print') window.print();
      if (rp.dataset.rep === 'copy' && repState.r) copy(repState.r.text);
      return;
    }
    var qb = e.target.closest('[data-q]');
    if (qb) { var ta = qb.closest('form').querySelector('textarea'); ta.value = QUICK[+qb.dataset.q] + (/:$/.test(QUICK[+qb.dataset.q]) ? ' ' : ''); ta.focus(); return; }
    var f = e.target.closest('[data-f]');
    if (f) { state.filter = f.dataset.f; render(); return; }
    var a = e.target.closest('[data-act]');
    if (a) {
      if (a.dataset.act === 'ticket-revert' && !confirm('לבטל את השינוי ולהחזיר את האתר לגרסה הקודמת?')) return;
      a.disabled = true;
      act(a.dataset.act, { no: a.dataset.no }).then(function () {
        toast({ 'ticket-wp': '🛒 השינוי מוכן. בדקו את הרשימה ואשרו', 'ticket-patch': '🎨 השינוי מוכן. פתחו את התצוגה המקדימה ואשרו', 'ticket-agent': '🤖 Claude התחיל. תקבלו עדכון כשהשינוי מוכן', 'ticket-approve': '🚀 מאשר ומעלה לאתר…', 'ticket-revert': '↩️ מבטל…' }[a.dataset.act]); load();
      }).catch(function (err) {
        a.disabled = false;
        // a site that draws itself in the browser: open it once, so Claude sees what a visitor sees
        if (err.data && err.data.snapshotUrl) {
          if (confirm('האתר הזה נבנה בדפדפן, ו-Claude צריך לראות אותו פעם אחת. לפתוח אותו עכשיו? אחרי כמה שניות לוחצים שוב על הכפתור.')) window.open(err.data.snapshotUrl, '_blank', 'noopener');
          return;
        }
        toast(err.message);
      });
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'rmon') { openReport(repState.slug, e.target.value); return; }
    var s = e.target.closest('[data-set]'); if (!s) return;
    var b = { no: s.dataset.no }; b[s.dataset.set] = s.value;
    act('ticket-set', b).then(load).catch(function (err) { toast(err.message); });
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form.reply'); if (!f) return;
    e.preventDefault();
    var text = f.t.value.trim(); if (!text) return;
    var b = { no: f.dataset.no }; b[f.n.checked ? 'note' : 'reply'] = text;
    act('ticket-set', b).then(function () { toast(f.n.checked ? 'ההערה נשמרה' : 'נשלח ללקוח'); load(); }).catch(function (err) { toast(err.message); });
  });
  $('q').addEventListener('input', function () { state.q = $('q').value; render(); });

  // alerts to this phone: every new ticket, every answer, every change ready
  $('bell').addEventListener('click', function () {
    if (demo) return toast('בדוגמה אין התראות. במסך האמיתי כל פנייה חדשה מגיעה לטלפון.');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return toast('הדפדפן הזה לא תומך בהתראות. נסו בכרום, או באייפון מהמסך הראשי.');
    var reg, vk, here = location.pathname.replace(/[^/]*$/, '');
    var key64 = function (k) { var p = '='.repeat((4 - k.length % 4) % 4), r = atob((k + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; };
    fetch(API + '?op=push-key').then(function (r) { if (!r.ok) throw new Error('ההתראות עוד לא הופעלו בשרת'); return r.json(); })
      .then(function (d) { vk = d.key; return navigator.serviceWorker.register(here + 'push-sw.js?home=' + encodeURIComponent(location.href.split('#')[0]), { scope: here }); })
      .then(function (r) { reg = r; return Notification.requestPermission(); })
      .then(function (p) { if (p !== 'granted') throw new Error('ההתראות חסומות בדפדפן'); return navigator.serviceWorker.ready; })
      .then(function () { return reg.pushManager.getSubscription(); })
      .then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key64(vk) }); })
      .then(function (s) { return call('desk-push', { sub: s.toJSON() }); })
      .then(function () { $('bell').classList.add('on'); $('bell').textContent = '🔔 התראות פועלות'; toast('מעכשיו כל פנייה חדשה מגיעה לטלפון הזה'); })
      .catch(function (e) { toast(e.message || 'משהו השתבש'); });
  });

  // ── the room: a status strip, and a sky of points that join when near and lean toward the pointer ──
  function hud() {
    var open = state.tickets.filter(function (t) { return t.status !== 'done'; }).length;
    var c = $('hud-clock'); if (!c) return;
    c.textContent = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('hud-name').textContent = state.sites.length + ' אתרים · ' + open + ' פניות פתוחות';
    var l = $('hud-link'); l.textContent = demo ? '◉ נתוני דוגמה' : '◉ מחובר · נתונים חיים'; l.className = demo ? 'hud-demo' : 'hud-ok';
  }
  setInterval(hud, 1000);
  // the room, as in the owner's panel (sitebuilder/panel/panel.js): the same sky, the same light under the pointer,
  // the same instruments leaning toward it
// a sky that follows the mouse, a light under it, and instruments that tilt toward it. Decoration only.
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
      for (var k = rings.length - 1; k >= 0; k--) {
        var rg = rings[k]; rg.r += 7; var life = 1 - rg.r / 320;
        if (life <= 0) { rings.splice(k, 1); continue; }
        g.strokeStyle = 'rgba(62,230,255,' + (0.6 * life) + ')'; g.lineWidth = 2;
        g.beginPath(); g.arc(rg.x, rg.y, rg.r, 0, 6.283); g.stroke();
        g.strokeStyle = 'rgba(139,108,255,' + (0.4 * life) + ')'; g.lineWidth = 1;
        g.beginPath(); g.arc(rg.x, rg.y, rg.r * .6, 0, 6.283); g.stroke();
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
})();

  $('demo').hidden = !demo;
  load();
  if (!demo) setInterval(load, 30000);
})();
