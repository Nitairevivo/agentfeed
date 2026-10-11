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
  var state = { tickets: [], team: [], sites: [], me: null, filter: 'open', q: '' };

  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); setTimeout(function () { el.classList.remove('on'); }, 2600); }
  function call(op, body) {
    var h = { 'content-type': 'application/json', authorization: 'Bearer ' + key };
    return fetch(API + '?op=' + op + '&agency=' + agency, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) throw new Error('הקישור לא תקין או שהמפתח הוחלף. בקשו קישור חדש.');
        if (!r.ok) throw new Error(d.error || 'השרת לא ענה. נסו שוב בעוד דקה.'); return d; }); });
  }

  // ── the demo: a studio, its team, its clients, on this device ──
  var DK = 'desk-demo', h = function (n) { return new Date(Date.now() - n * 3600e3).toISOString(); };
  function demoData() {
    var kept = null; try { kept = JSON.parse(localStorage.getItem(DK) || 'null'); } catch (x) {}
    if (kept) return kept;
    return { me: { id: 'noam', name: 'נועם' }, brand: { name: 'סטודיו לדוגמה', color: '#5b4bdb', accent: '#00b5b8' },
      team: [{ id: 'noam', name: 'נועם' }, { id: 'dana', name: 'דנה' }],
      sites: [{ slug: 'pizza', name: 'פיצה דרור', platform: 'lovable', repo: 'studio/pizza', health: { watched: true, status: 'ok', uptime7: 100 } },
              { slug: 'flowers', name: 'פרחי השרון', platform: 'base44', repo: '', health: { watched: true, status: 'ok', uptime7: 99.6 } },
              { slug: 'bakery', name: 'מאפיית אורן', platform: 'lovable', repo: 'studio/bakery', health: { watched: true, status: 'slow', uptime7: 100 } }],
      tickets: [
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
    if (b.logo) { $('logo').src = b.logo; $('logo').hidden = false; }
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
      return '<button type="button" data-f="' + s + '" class="' + (state.filter === s ? 'on' : '') + '"><b>' + c(s) + '</b><span>' + ST[s] + '</span></button>'; }).join('');
    var chips = [['open', 'פתוחות'], ['mine', 'שלי'], ['urgent', '🔴 דחופות'], ['all', 'הכול']];
    var tp = tips();
    $('tips').innerHTML = tp.length ? '<b>💡 מה הכי כדאי עכשיו</b><ul>' + tp.map(function (x) { return '<li' + (x[2] ? ' data-f="' + (x[2] === 'late' ? 'open' : x[2] === 'unassigned' ? 'new' : x[2]) + '"' : '') + '><span>' + x[0] + '</span>' + esc(x[1]) + '</li>'; }).join('') + '</ul>' : '<b>💡 הכול מטופל. יופי של עבודה.</b>';
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
      return '<span class="wl"><b>' + esc(m.name) + '</b> ' + n + ' פתוחות</span>'; }).join('');
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
      (ag.preview ? ' · <a href="' + esc(ag.preview) + '" target="_blank" rel="noopener">צילומי לפני ואחרי</a>' : '') +
      ' <button type="button" class="btn ok" data-act="ticket-approve" data-no="' + t.no + '">✓ לאשר ולהעלות</button>' +
      '<button type="button" class="btn ghost" data-act="ticket-revert" data-no="' + t.no + '">✕ לא לאשר</button></div>';
    if (ag.state === 'merged') agent = '<div class="agent">🚀 עלה לאתר <button type="button" class="btn ghost" data-act="ticket-revert" data-no="' + t.no + '">↩️ לבטל ולחזור לגרסה הקודמת</button></div>';
    return '<li class="tk' + (t.prio === 'urgent' ? ' urgent' : '') + '"><header><span class="no">#' + esc(t.no) + '</span><span class="client">' + esc(t.client) + '</span>' +
      age(t) + '<span class="st ' + t.status + '">' + ST[t.status] + '</span></header><div class="subj">' + (t.prio === 'urgent' ? '🔴 ' : '') + esc(t.subject) + '</div>' +
      '<div class="ctl"><select data-set="status" data-no="' + t.no + '" aria-label="סטטוס">' + opts(t.status) + '</select>' +
      '<select data-set="who" data-no="' + t.no + '" aria-label="משויך ל">' + who + '</select>' +
      (canAI && t.status !== 'done' && ag.state !== 'running' && t.status !== 'review' ? '<button type="button" class="btn ai" data-act="ticket-agent" data-no="' + t.no + '">🤖 לתת ל-Claude לבצע</button>' : '') +
      (!canAI ? '<small style="color:var(--dim)">' + (s.platform === 'base44' ? 'אתר Base44: שינוי ידני' : 'אין מאגר קוד מחובר') + '</small>' : '') + '</div>' +
      agent + '<div class="thread">' + thread + '</div>' +
      '<form class="reply" data-no="' + t.no + '"><div class="quick">' + QUICK.map(function (q, i) { return '<button type="button" data-q="' + i + '">' + esc(q.length > 26 ? q.slice(0, 24) + '…' : q) + '</button>'; }).join('') + '</div>' +
      '<textarea name="t" maxlength="2000" placeholder="תשובה ללקוח…"></textarea>' +
      '<div class="row"><label><input type="checkbox" name="n"> הערה פנימית (הלקוח לא רואה)</label><button class="btn" type="submit">שליחה</button></div></form></li>';
  }
  function render() {
    counts();
    var list = shown();
    $('list').innerHTML = list.length ? list.map(ticket).join('') : '<li class="empty">אין פניות כאן. 🎉</li>';
    $('slist').innerHTML = state.sites.length ? state.sites.map(function (s) {
      var hh = s.health || {};
      return '<li class="site"><span class="dot ' + esc(hh.status || '') + '"></span><b>' + esc(s.name || s.slug) + '</b>' +
        (s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener"><small>' + esc(s.url.replace(/^https:\/\//, '')) + '</small></a>' : '') +
        '<small>' + (hh.uptime7 != null ? 'זמינות השבוע ' + hh.uptime7 + '%' : 'עוד לא נבדק') + '</small>' +
        '<span class="tag">' + esc(s.platform || '') + (s.repo ? ' · Claude מחובר' : '') + '</span></li>'; }).join('') : '<li class="empty">עוד אין אתרים.</li>';
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
      tips: [(slow[0] ? 'האתר של ' + slow[0].name + ' נטען לאט כבר כמה בדיקות. בדרך כלל זו תמונה גדולה מדי בראש העמוד, ושווה לבדוק לפני שהלקוח ישים לב.' : ''),
             'פרחי השרון פתחו 3 פניות החודש. שיחה קצרה איתם עכשיו יכולה לחסוך את הרביעית, וגם לשמור אותם מרוצים.',
             'שינוי שמחכה לאישור הוא הדבר הכי מהיר לסגור היום: לקוח שרואה שהבקשה שלו עלתה תוך יום ממליץ עליכם.'].filter(Boolean) };
  }
  function briefCard(b) {
    var el = $('brief'); if (!el) return;
    if (!b) { el.hidden = true; return; }
    var t = ''; try { t = new Date(b.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); } catch (x) {}
    el.hidden = false;
    el.innerHTML = '<div class="bhead"><b>🔎 הבדיקה של ' + esc(t) + '</b><span>' + esc(b.line) + '</span></div>' +
      ((b.tips || []).length ? '<ul>' + b.tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="rule">הבדיקה רצה שלוש פעמים ביום, רק קוראת ומייעצת. Claude משנה אתר רק כשמישהו מהצוות לוחץ על פנייה, והשינוי עולה רק אחרי אישור.</p>';
  }
  function apply(d) {
    state.tickets = d.tickets || []; state.team = d.team || []; state.sites = d.sites || []; state.me = d.me;
    briefCard(demo ? demoBrief() : d.brief);
    brand(d.brand); $('who').textContent = d.me ? 'מחובר/ת: ' + d.me.name : ''; render();
  }
  function load() {
    if (demo) { D = D || demoData(); apply(D); return; }
    call('desk').then(apply).catch(function (e) { $('err').hidden = false; $('err').textContent = e.message; });
  }

  // ── acting ──
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-view]');
    if (tab) { document.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('on', b === tab); }); $('tickets').hidden = tab.dataset.view !== 'tickets'; $('sites').hidden = tab.dataset.view !== 'sites'; return; }
    var qb = e.target.closest('[data-q]');
    if (qb) { var ta = qb.closest('form').querySelector('textarea'); ta.value = QUICK[+qb.dataset.q] + (/:$/.test(QUICK[+qb.dataset.q]) ? ' ' : ''); ta.focus(); return; }
    var f = e.target.closest('[data-f]');
    if (f) { state.filter = f.dataset.f; render(); return; }
    var a = e.target.closest('[data-act]');
    if (a) {
      if (a.dataset.act === 'ticket-revert' && !confirm('לבטל את השינוי ולהחזיר את האתר לגרסה הקודמת?')) return;
      a.disabled = true;
      act(a.dataset.act, { no: a.dataset.no }).then(function () {
        toast({ 'ticket-agent': '🤖 Claude התחיל. תקבלו עדכון כשהשינוי מוכן', 'ticket-approve': '🚀 מאשר ומעלה לאתר…', 'ticket-revert': '↩️ מבטל…' }[a.dataset.act]); load();
      }).catch(function (err) { a.disabled = false; toast(err.message); });
    }
  });
  document.addEventListener('change', function (e) {
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

  $('demo').hidden = !demo;
  load();
  if (!demo) setInterval(load, 30000);
})();
