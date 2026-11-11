// The owner's inbox, in their panel (step 18 of agentfeed/AGENCY-PRODUCT.md): what visitors wrote on the
// site, the assistant's draft waiting for a yes, the visitor's number where they agreed to leave one, and
// the switch that decides whether the assistant answers alone. Every action goes to inboxapi.mjs with the
// site's own key (the one panel.js keeps for this tab). Nothing from the server is drawn as HTML unescaped.
(function () {
  var cfg = window.PANEL; if (!cfg || !cfg.site || !document.querySelector) return;
  var key = ''; try { key = sessionStorage.getItem('pk:' + cfg.site) || ''; } catch (x) {}
  var demo = !key || /[?&]demo/.test(location.search);
  var API = String(cfg.api || 'https://agentfeed-plum.vercel.app').replace(/\/+$/, '');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var when = function (iso) { try { return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }); } catch (x) { return ''; } };
  var ST = { new: ['חדשה', 'info'], drafted: ['טיוטה מחכה לך', 'warn'], handed: ['צריך תשובה שלך', 'warn'], answered: ['נענתה', 'good'], closed: ['סגורה', ''] };
  var card = null, data = null, busy = false;

  function call(op, body) {
    return fetch(API + '/panel?op=' + op + '&site=' + encodeURIComponent(cfg.site), { method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'השרת לא ענה. נסו שוב בעוד דקה.'); return d; }); });
  }
  function demoData() {
    var h = function (n) { return new Date(Date.now() - n * 3600e3).toISOString(); };
    return { demo: true, mode: 'copilot', topics: ['products', 'info'], leads: [
      { id: 'd1', state: 'drafted', at: h(1), contact: { phone: '0500000000' }, thread: [{ who: 'visitor', text: 'יש לי לברדור בן 4, איזה מזון יבש אתם ממליצים? (דוגמה)', at: h(1) }],
        draft: { text: 'לכלב גדול בוגר יש לנו כמה אפשרויות במלאי. רוצים שנחזור אליכם עם המלצה? (דוגמה)', cards: [] } },
      { id: 'd2', state: 'handed', at: h(5), contact: null, thread: [{ who: 'visitor', text: 'אפשר מחיר מיוחד ל-10 שקים לפנסיון? (דוגמה)', at: h(5) }] },
      { id: 'd3', state: 'answered', at: h(26), contact: null, thread: [{ who: 'visitor', text: 'עד מתי אתם פתוחים בשישי? (דוגמה)', at: h(26) }, { who: 'assistant', text: 'בשישי פתוחים עד 16:00. (דוגמה)', at: h(26) }] }] };
  }
  function mount() {
    if (card) return card;
    var anchor = document.getElementById('tks') || document.querySelector('.brain') || document.querySelector('main section');
    if (!anchor) return null;
    card = document.createElement('section'); card.className = 'cardp glass inbx'; card.id = 'inbx';
    anchor.parentNode.insertBefore(card, anchor);
    card.addEventListener('click', onClick); card.addEventListener('submit', onSubmit); card.addEventListener('change', onChange);
    return card;
  }
  function load() {
    if (!mount()) return;
    if (demo) { data = data || demoData(); draw(); return; }
    call('inbox-list').then(function (d) { data = d; draw(); }).catch(function (e) { card.innerHTML = '<h2>✉️ פניות מהאתר</h2><p class="sub">' + esc(e.message) + '</p>'; });
  }
  function modeBox() {
    var o = function (v, l) { return '<label><input type="radio" name="imode" value="' + v + '"' + (data.mode === v ? ' checked' : '') + '> ' + l + '</label>'; };
    var t = function (v, l) { return '<label><input type="checkbox" name="itopic" value="' + v + '"' + ((data.topics || []).indexOf(v) >= 0 ? ' checked' : '') + (data.mode !== 'auto' ? ' disabled' : '') + '> ' + l + '</label>'; };
    return '<fieldset class="imode"><legend>מי עונה למבקרים</legend>' + o('off', 'החלון כבוי') + o('copilot', 'העוזר מכין טיוטה, ואני מאשר/ת') + o('auto', 'העוזר עונה לבד') +
      '<div class="itopics">' + t('products', 'על מוצרים ומחירים') + t('info', 'על שעות, משלוחים ותנאים') + '</div></fieldset>';
  }
  function lead(l) {
    var st = ST[l.state] || [l.state, ''];
    var first = (l.thread || []).filter(function (m) { return m.who === 'visitor'; })[0] || {};
    var phone = l.contact && l.contact.phone ? l.contact.phone : '';
    var wa = phone ? 'https://wa.me/' + phone.replace(/\D/g, '').replace(/^0/, '972') : '';
    var thread = (l.thread || []).map(function (m) {
      var who = m.who === 'visitor' ? 'המבקר' : m.who === 'owner' ? 'אתם' : m.who === 'assistant' ? 'העוזר' : 'הצוות';
      var cards = (m.cards || []).map(function (c) { return '<span class="icard">' + esc(c.name) + (c.price != null ? ' · ' + esc(c.price) + ' ₪' : '') + '</span>'; }).join('');
      return '<p class="tkmsg ' + (m.who === 'visitor' ? 'client' : 'team') + '"><b>' + who + ':</b> ' + esc(m.text) + ' <small>' + esc(when(m.at)) + '</small>' + cards + '</p>';
    }).join('');
    var draft = l.draft ? '<form class="idraft" data-send="' + esc(l.id) + '"><label class="sub" for="d-' + esc(l.id) + '">הטיוטה של העוזר — אפשר לתקן לפני ששולחים</label>' +
      '<textarea id="d-' + esc(l.id) + '" name="t" rows="3" maxlength="1000">' + esc(l.draft.text) + '</textarea>' +
      ((l.draft.cards || []).length ? '<p class="sub">יוצגו גם: ' + l.draft.cards.map(function (c) { return esc(c.name); }).join(' · ') + '</p>' : '') +
      '<button class="btn btn-brand btn-s" type="submit">לשלוח למבקר</button></form>' : '';
    var reply = l.state !== 'closed' ? '<form class="tkreply" data-reply="' + esc(l.id) + '"><input name="r" maxlength="1000" placeholder="תשובה במילים שלכם…" aria-label="תשובה למבקר"><button class="btn btn-s" type="submit">לשלוח</button></form>' : '';
    return '<li><div class="tkrow"><b>' + esc((first.text || '').slice(0, 80)) + '</b><span class="pill ' + st[1] + '"><i></i>' + st[0] + '</span></div>' +
      '<small class="sub">' + esc(when(l.at)) + (phone ? ' · השאיר/ה מספר: <a href="' + esc(wa) + '" target="_blank" rel="noopener" dir="ltr">' + esc(phone) + '</a>' : '') + '</small>' +
      thread + draft + reply + (l.state !== 'closed' ? '<button type="button" class="btn btn-s ghost" data-close="' + esc(l.id) + '">לסגור</button>' : '') + '</li>';
  }
  function draw() {
    var open = (data.leads || []).filter(function (l) { return l.state === 'drafted' || l.state === 'handed'; }).length;
    card.innerHTML = '<div class="tkhead"><h2>✉️ פניות מהאתר' + (open ? ' <span class="pill warn"><i></i>' + open + ' מחכות לך</span>' : '') + '</h2></div>' +
      (data.demo ? '<p class="sub">דוגמה: פניות לדוגמה. שום דבר לא נשלח.</p>' : '') +
      '<p class="sub">מה שמבקרים כתבו בחלון "כתבו לנו" באתר. העוזר עונה רק ממה שכתוב באתר; מה שלא כתוב בו מגיע אליכם. מספר טלפון נשמר רק כשהמבקר סימן שמותר לחזור אליו.</p>' +
      modeBox() + ((data.leads || []).length ? '<ul class="tklist">' + data.leads.map(lead).join('') + '</ul>' : '<p class="sub">עוד אין פניות.</p>');
  }
  function act(op, body, ok) {
    if (busy) return; busy = true;
    if (demo) { busy = false; toast('בדוגמה לא נשלח כלום.'); return; }
    call(op, body).then(function (r) { busy = false; ok(r); load(); }).catch(function (e) { busy = false; toast(e.message); });
  }
  function toast(m) {
    var el = document.getElementById('pntoast'); if (!el) { el = document.createElement('div'); el.id = 'pntoast'; el.className = 'pntoast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = m; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }
  function onClick(e) { var c = e.target.closest('[data-close]'); if (c) act('inbox-close', { id: c.dataset.close }, function () { toast('נסגרה'); }); }
  function onSubmit(e) {
    var f = e.target; e.preventDefault();
    if (f.dataset.send) act('inbox-send', { id: f.dataset.send, text: f.elements.t.value }, function () { toast('✓ נשלח למבקר'); });
    if (f.dataset.reply && f.elements.r.value.trim()) act('inbox-reply', { id: f.dataset.reply, text: f.elements.r.value }, function () { toast('✓ נשלח למבקר'); });
  }
  function onChange(e) {
    if (e.target.name !== 'imode' && e.target.name !== 'itopic') return;
    var mode = (card.querySelector('[name=imode]:checked') || {}).value || 'copilot';
    var topics = [].map.call(card.querySelectorAll('[name=itopic]:checked'), function (x) { return x.value; });
    if (demo) { data.mode = mode; data.topics = topics; draw(); toast('בדוגמה לא נשמר כלום.'); return; }
    act('inbox-mode', { mode: mode, topics: topics }, function (r) { toast(r.mode === 'off' ? 'החלון כבוי' : r.mode === 'auto' ? 'העוזר עונה לבד' : 'העוזר מכין טיוטות'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
  setInterval(function () { if (!document.hidden && !busy && card && !card.contains(document.activeElement)) load(); }, 60000);
})();
