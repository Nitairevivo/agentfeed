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
    if (e.target.id === 'pay') return toast('💳 בהדגמה אין סליקה. באתר אמיתי אפשר לחבר סליקה ישראלית.');
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
