// The demo shop's cart and product page. Data comes in window.SHOP
// (products, tiers, WhatsApp number, base path), written into every page.
(function () {
  var S = window.SHOP, P = S.products, BASE = S.base;
  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) { var r = Math.round(n * 100) / 100; return '₪' + r.toLocaleString('he-IL', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var byId = function (id) { return P.find(function (p) { return p.id === id; }); };
  var disc = function (q) { var d = 0; S.tiers.forEach(function (t) { if (q >= t[0]) d = t[1]; }); return d; };
  var unit = function (p, sel) { var x = p.price; p.opts.forEach(function (o, i) { x += o[1][sel[i]][2]; }); return Math.max(1, x); };
  var label = function (p, sel) { return p.opts.map(function (o, i) { return o[1][sel[i]][0]; }).join(' · '); };
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem('demo-wholesale-cart2') || '[]'); } catch (e) {}
  cart = cart.filter(function (l) { return byId(l.id); });
  var save = function () { try { localStorage.setItem('demo-wholesale-cart2', JSON.stringify(cart)); } catch (e) {} };

  // the drawer, shared by every page
  document.body.insertAdjacentHTML('beforeend',
    '<div class="dim" id="dim"></div><aside class="dr" id="dr" aria-label="עגלת קניות"><div class="h">העגלה שלכם <button id="drx" aria-label="סגירה">✕</button></div>' +
    '<div class="items" id="items"></div><div class="f" id="foot"></div></aside><div class="toast" id="toast"></div>');
  function openCart() { $('dr').classList.add('on'); $('dim').classList.add('on'); }
  function closeCart() { $('dr').classList.remove('on'); $('dim').classList.remove('on'); }
  $('drx').addEventListener('click', closeCart); $('dim').addEventListener('click', closeCart);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCart(); });
  [].forEach.call(document.querySelectorAll('[data-cart]'), function (b) { b.addEventListener('click', openCart); });

  var tt; function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2400); }
  function fly(img) {
    var btn = document.querySelector('.cartbtn'); if (!img || !btn) return;
    var r = img.getBoundingClientRect(), t = btn.getBoundingClientRect(), f = document.createElement('img');
    f.src = img.src; f.className = 'fly'; f.style.left = (r.left + r.width / 2 - 32) + 'px'; f.style.top = (r.top + r.height / 2 - 32) + 'px'; document.body.appendChild(f);
    requestAnimationFrame(function () { requestAnimationFrame(function () { f.style.left = (t.left + 8) + 'px'; f.style.top = (t.top) + 'px'; f.style.transform = 'scale(.3)'; f.style.opacity = '.3'; }); });
    setTimeout(function () { f.remove(); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); }, 700);
  }
  function totals() {
    var sum = 0, saved = 0;
    cart.forEach(function (l) { var p = byId(l.id), u = unit(p, l.s), d = disc(l.n); sum += u * (1 - d) * l.n; saved += u * d * l.n; });
    return { sum: sum, saved: saved };
  }
  function draw() {
    var n = cart.reduce(function (a, l) { return a + l.n; }, 0);
    [].forEach.call(document.querySelectorAll('.cartbtn .n'), function (e) { e.textContent = n; });
    if (!cart.length) { $('items').innerHTML = '<div class="empty"><b>🛒</b>העגלה ריקה עדיין.<br>בחרו מוצרים מהקטגוריות.</div>'; $('foot').innerHTML = ''; return; }
    $('items').innerHTML = cart.map(function (l, i) { var p = byId(l.id), u = unit(p, l.s), d = disc(l.n);
      return '<div class="ci"><a href="' + BASE + 'p/' + p.id + '.html"><img src="' + BASE + p.img + '" alt=""></a><div><b>' + esc(p.name) + '</b><small>' + esc(label(p, l.s)) + (d ? ' · ' + Math.round(d * 100) + '% הנחת כמות' : '') + '</small>' +
        '<div class="q"><button data-i="' + i + '" data-d="1" aria-label="עוד">+</button><b>' + l.n + '</b><button data-i="' + i + '" data-d="-1" aria-label="פחות">−</button></div><button class="rm" data-rm="' + i + '">הסרה</button></div>' +
        '<div class="p">' + money(u * (1 - d) * l.n) + '</div></div>'; }).join('');
    var t = totals(), left = Math.max(0, S.free - t.sum);
    $('foot').innerHTML = (t.saved ? '<div class="row" style="color:#00704f"><span>חסכתם בהנחת כמות</span><span>' + money(t.saved) + '</span></div>' : '') +
      '<div class="prog"><i style="width:' + Math.min(100, t.sum / S.free * 100) + '%"></i></div><div class="free">' + (left ? 'עוד ' + money(left) + ' למשלוח חינם 🚚' : '🎉 המשלוח עליכם חינם') + '</div>' +
      '<div class="row t"><span>סה״כ</span><span>' + money(t.sum) + '</span></div>' +
      '<button class="wa" id="send">💬 שליחת ההזמנה בוואטסאפ</button><button class="pay" id="pay">💳 תשלום באשראי</button>' +
      '<div class="note">בהדגמה, ההזמנה נשלחת בוואטסאפ. באתר אמיתי אפשר לחבר גם סליקה.</div>';
  }
  $('items').addEventListener('click', function (e) {
    var b = e.target.closest('[data-d]'), r = e.target.closest('[data-rm]');
    if (b) { var l = cart[+b.dataset.i]; l.n = Math.max(0, l.n + +b.dataset.d); if (!l.n) cart.splice(+b.dataset.i, 1); }
    if (r) cart.splice(+r.dataset.rm, 1);
    if (b || r) { save(); draw(); }
  });
  $('foot').addEventListener('click', function (e) {
    if (e.target.id === 'pay') return checkout();
    if (e.target.id !== 'send') return;
    var t = totals(), msg = 'היי! הזמנה מ' + S.name + ' (אתר לדוגמה):\n' + cart.map(function (l) { var p = byId(l.id);
      return '• ' + p.name + ' (' + label(p, l.s) + ') × ' + l.n; }).join('\n') + '\nסה״כ: ' + money(t.sum);
    window.open('https://wa.me/' + S.wa + '?text=' + encodeURIComponent(msg), '_blank');
  });
  function add(p, sel, n, img) {
    var k = p.id + ':' + sel.join('-'), line = cart.find(function (l) { return l.k === k; });
    if (line) line.n += n; else cart.push({ k: k, id: p.id, s: sel, n: n });
    save(); draw(); fly(img); toast('✓ נוסף לעגלה: ' + p.name + ' (' + label(p, sel) + ')');
  }
  draw();

  // Card payment. The cart sends ids, options and quantities; the server prices
  // them itself and asks the payment company for a page. The card is typed only
  // there. In this demo there is no account yet, so the server answers with a
  // pretend page that says so plainly.
  var API = S.api || 'https://agentfeed-plum.vercel.app/api/panel', SITE = S.site || 'demo-wholesale';
  function sheet(html) {
    var o = $('co'); if (!o) { document.body.insertAdjacentHTML('beforeend', '<div class="co" id="co" role="dialog" aria-modal="true"><div class="cobox" id="cobox"></div></div>'); o = $('co');
      o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('[data-x]')) shut(); }); }
    $('cobox').innerHTML = html; o.classList.add('on'); closeCart();
  }
  function shut() { var o = $('co'); if (o) o.classList.remove('on'); history.replaceState(null, '', location.pathname); }
  function call(op, method, body, q) {
    return fetch(API + '?op=' + op + (q || ''), method === 'POST' ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); });
  }
  function summary() {
    var t = totals();
    return '<div class="cosum">' + cart.map(function (l) { var p = byId(l.id), u = unit(p, l.s) * (1 - disc(l.n));
      return '<div><span>' + esc(p.name) + ' <small>' + esc(label(p, l.s)) + ' ×' + l.n + '</small></span><b>' + money(u * l.n) + '</b></div>'; }).join('') +
      '<div class="tot"><span>לתשלום</span><b>' + money(t.sum) + '</b></div></div>';
  }
  function checkout() {
    if (!cart.length) return toast('העגלה ריקה');
    sheet('<button class="cox" data-x aria-label="סגירה">✕</button><h3>💳 תשלום מאובטח באשראי</h3>' + summary() +
      '<form id="cof"><label>שם מלא<input name="name" required maxlength="60" autocomplete="name"></label>' +
      '<label>טלפון<input name="phone" required maxlength="20" inputmode="tel" autocomplete="tel" pattern="[0-9+\\- ]{9,20}"></label>' +
      '<button class="copay" type="submit">המשך לתשלום ←</button><p class="cosafe">🔒 פרטי הכרטיס מוקלדים רק בעמוד של חברת הסליקה. האתר לא רואה אותם.</p></form>');
    $('cof').addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, b = f.querySelector('button'); b.disabled = true; b.textContent = 'מכין את עמוד התשלום…';
      call('pay', 'POST', { site: SITE, lines: cart.map(function (l) { return { id: l.id, s: l.s, n: l.n }; }),
        customer: { name: f.name.value, phone: f.phone.value }, back: location.href.split('?')[0] })
        .then(function (d) { location.href = d.url; })
        .catch(function (err) { b.disabled = false; b.textContent = 'המשך לתשלום ←'; toast('לא הצלחנו לפתוח את עמוד התשלום. נסו שוב או הזמינו בוואטסאפ.'); });
    });
  }
  function mockPage(id) {
    call('order', 'GET', null, '&site=' + SITE + '&id=' + id).then(function (o) {
      sheet('<div class="mockbar">הדמיה: כך נראה עמוד התשלום. לא יורד כסף ואין להקליד כרטיס אמיתי.</div>' +
        '<h3>עמוד התשלום של חברת הסליקה</h3><div class="cosum"><div class="tot"><span>' + esc(S.name) + '</span><b>' + money(o.total) + '</b></div></div>' +
        '<div class="fakecard"><div>•••• •••• •••• 4242</div><div><span>12/29</span><span>•••</span></div></div>' +
        '<button class="copay" id="mok">אישור תשלום (הדמיה)</button><button class="cocan" data-x>ביטול</button>');
      $('mok').addEventListener('click', function () { this.disabled = true;
        call('mockpay', 'POST', { site: SITE, id: id }).then(function () { location.href = location.pathname + '?paid=' + id; })
          .catch(function () { toast('משהו השתבש. נסו שוב.'); }); });
    }).catch(function () { toast('ההזמנה לא נמצאה'); });
  }
  function thanks(id, tries) {
    call('order', 'GET', null, '&site=' + SITE + '&id=' + id).then(function (o) {
      if (o.status === 'pending' && tries < 6) return setTimeout(function () { thanks(id, tries + 1); }, 2000);
      var ok = o.status === 'paid';
      if (ok) { cart = []; save(); draw(); }
      sheet('<button class="cox" data-x aria-label="סגירה">✕</button><div class="coicon">' + (ok ? '🎉' : '⏳') + '</div><h3>' +
        (ok ? 'תודה! התשלום התקבל' : 'התשלום עוד לא אושר') + '</h3>' +
        '<p class="cop">' + (ok ? 'מספר הזמנה <b>' + esc(id) + '</b>. ההזמנה כבר אצלנו ונחזור אליכם לתיאום משלוח.' : 'אם חויבתם, ההזמנה תתעדכן תוך כמה דקות. מספר הזמנה ' + esc(id) + '.') +
        (o.mock ? '<br><small>(זו הדמיה, לא ירד כסף.)</small>' : '') + '</p>' +
        '<div class="cosum">' + o.lines.map(function (l) { return '<div><span>' + esc(l.name) + ' <small>' + esc(l.label) + ' ×' + l.n + '</small></span></div>'; }).join('') +
        '<div class="tot"><span>סה״כ</span><b>' + money(o.total) + '</b></div></div><button class="copay" data-x>המשך לגלוש</button>');
    }).catch(function () { toast('לא הצלחנו לבדוק את ההזמנה'); });
  }
  var qs = new URLSearchParams(location.search), oid = function (k) { var v = qs.get(k); return v && /^O[A-Z0-9]{6,20}$/.test(v) ? v : null; };
  if (oid('mockpay')) mockPage(oid('mockpay'));
  else if (oid('paid')) thanks(oid('paid'), 0);
  else if (oid('failed')) sheet('<button class="cox" data-x aria-label="סגירה">✕</button><div class="coicon">😕</div><h3>התשלום לא עבר</h3><p class="cop">לא חויבתם. העגלה נשמרה, אפשר לנסות שוב או להזמין בוואטסאפ.</p><button class="copay" data-x>חזרה לחנות</button>');

  // the product page
  var host = $('buybox'); if (!host) return;
  var p = byId(host.dataset.id), sel = p.opts.map(function () { return 0; }), qty = 1;
  function render() {
    var u = unit(p, sel), d = disc(qty);
    host.innerHTML = p.opts.map(function (o, i) { return '<div class="opt"><h4>' + o[0] + ': <span>' + esc(o[1][sel[i]][0]) + '</span></h4><div class="chips">' +
        o[1].map(function (v, j) { return '<button class="ch' + (j === sel[i] ? ' on' : '') + '" data-o="' + i + '" data-v="' + j + '">' + (v[1] ? '<i style="background:' + v[1] + '"></i>' : '') + esc(v[0]) +
          (v[2] ? ' <small style="color:var(--dim)">' + (v[2] > 0 ? '+' : '−') + money(Math.abs(v[2])) + '</small>' : '') + '</button>'; }).join('') + '</div></div>'; }).join('') +
      '<div class="opt"><h4>מחיר לפי כמות</h4><div class="tiers">' + S.tiers.map(function (t, i) { var nx = S.tiers[i + 1];
        return '<div' + (d === t[1] ? ' class="on"' : '') + '><span>' + (nx ? t[0] + '–' + (nx[0] - 1) : t[0] + '+') + ' יח׳</span><span>' + money(u * (1 - t[1])) + ' ליחידה' + (t[1] ? ' · ' + Math.round(t[1] * 100) + '% הנחה' : '') + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="buy"><div class="qty"><button data-q="1" aria-label="עוד">+</button><input id="qv" value="' + qty + '" inputmode="numeric" aria-label="כמות"><button data-q="-1" aria-label="פחות">−</button></div>' +
      '<button class="addbig" data-add>🛒 הוספה לעגלה</button></div>' +
      '<div class="total">סה״כ ל-' + qty + ' יח׳: <b>' + money(u * (1 - d) * qty) + '</b>' + (d ? ' · חסכתם ' + money(u * d * qty) : '') + '</div>';
    var sp = $('sprice'); if (sp) sp.textContent = money(u * (1 - d));
    var up = $('uprice'); if (up) up.textContent = money(u);
  }
  host.addEventListener('click', function (e) {
    var c = e.target.closest('.ch'); if (c) { sel[+c.dataset.o] = +c.dataset.v; return render(); }
    var b = e.target.closest('[data-q]'); if (b) { qty = Math.max(1, qty + +b.dataset.q); return render(); }
    if (e.target.closest('[data-add]')) add(p, sel.slice(), qty, document.querySelector('.gal img'));
  });
  host.addEventListener('change', function (e) { if (e.target.id === 'qv') { qty = Math.max(1, parseInt(e.target.value, 10) || 1); render(); } });
  var st = $('stickyadd'); if (st) st.addEventListener('click', function () { add(p, sel.slice(), qty, document.querySelector('.gal img')); });
  render();
})();
