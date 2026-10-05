
// The owner's panel counts what happens here: a page seen, and the presses
// that are the business — WhatsApp, call, add-to-cart, email, the enquiry
// form. Only counts: no cookie, no name, no address.
(function () {
  var S = window.SITE; if (!S || navigator.webdriver) return;
  function send(e, item) {
    // where the visitor came from; a page of this same site is "internal",
    // so an arrival is counted once and not again for every page read
    var ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (x) {}
    if (ref && ref === location.hostname) ref = 'internal';
    // the home page is "/", every other page its own title
    var home = S.home || document.body.hasAttribute('data-home');
    var u = S.api + '/t?s=' + S.s + '&e=' + e + '&f=' + encodeURIComponent(ref) +
            '&p=' + encodeURIComponent(home ? '/' : document.title.split(' | ')[0].slice(0, 80)) +
            '&m=' + (matchMedia('(max-width: 760px)').matches ? 1 : 0) +
            (item ? '&i=' + encodeURIComponent(item.slice(0, 80)) : '');
    if (navigator.sendBeacon) navigator.sendBeacon(u); else fetch(u, { mode: 'no-cors', keepalive: true });
  }
  send('view');
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a'); if (!a) return;
    var h = a.getAttribute('href') || '';
    // the product a press was about: its card on a shelf, or the product's
    // own page — so the panel can say which items people ask for
    var card = a.closest('.pc'), t = card && card.querySelector('h3');
    var item = t ? t.textContent.trim() : (/\/p\/[^\/]+\.html$/.test(location.pathname) ? document.title.split(' | ')[0] : '');
    if (/wa\.me|whatsapp/.test(h)) send('wa', item);
    else if (/^tel:/.test(h)) send('call', item);
    else if (/^mailto:/.test(h)) send('email', item);
    else if (/add-to-cart|\/cart\//.test(h)) send('cart', item);
  }, true);
})();
(function () {
  var q = document.getElementById('q'), box = document.getElementById('qres');
  var idx = null, prefix = q ? q.dataset.prefix : '';
  function load(cb) { if (idx) return cb(); fetch(prefix + 'search.json').then(function (r) { return r.json(); })
    .then(function (d) { idx = d; cb(); }).catch(function () {}); }
  function norm(s) { return (s || '').toLowerCase().replace(/["״׳']/g, ''); }
  if (q) q.addEventListener('input', function () {
    var v = norm(q.value.trim());
    if (v.length < 2) { box.classList.remove('on'); box.innerHTML = ''; return; }
    load(function () {
      var words = v.split(/\s+/), hits = [];
      for (var i = 0; i < idx.length && hits.length < 12; i++) {
        var n = norm(idx[i].n + ' ' + idx[i].b);
        if (words.every(function (w) { return n.indexOf(w) > -1; })) hits.push(idx[i]);
      }
      box.innerHTML = hits.length ? hits.map(function (h) {
        return '<a role="option" href="' + prefix + 'p/' + h.i + '.html">' + (h.t ? '<img src="' + (/^https?:/.test(h.t) ? '' : prefix) + h.t + '" alt="">' : '<span class="noimg"></span>') + '<span>' +
          h.n.replace(/</g, '&lt;') + '</span><span class="pr">₪' + h.p + '</span></a>';
      }).join('') : '<p style="padding:12px">לא נמצאו מוצרים</p>';
      box.classList.add('on');
    });
  });
  document.addEventListener('click', function (e) { if (box && !box.contains(e.target) && e.target !== q) box.classList.remove('on'); });

  var holder = document.getElementById('items');
  if (!holder) return;
  // The page carries its first shelf; the rest of the aisle arrives beside it,
  // so a phone does not download a thousand products to show forty-eight.
  var all = JSON.parse(holder.textContent), grid = document.getElementById('grid');
  var total = +holder.dataset.total || all.length, whole = all.length >= total ? Promise.resolve() :
    fetch(holder.dataset.all).then(function (r) { return r.json(); }).then(function (d) { all = d; render(); }).catch(function () {});
  var more = document.getElementById('more'), sort = document.getElementById('sort'), count = document.getElementById('count');
  var sub = new URLSearchParams(location.search).get('sub') || '', shown = 48;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function card(p) {
    var sale = p.r && p.r > p.p;
    return '<article class="pc">' + (sale ? '<span class="badge">מבצע</span>' : '') +
      '<div class="img">' + (p.t ? '<img' + (p.u ? ' class="cut"' : '') + ' src="' + esc(p.t) + '" alt="' + esc(p.a) + '" loading="lazy" width="300" height="300">' : '<span class="noimg" role="img" aria-label="' + esc(p.a) + '"></span>') + '</div>' +
      '<div class="body">' + (p.b ? '<span class="brand">' + esc(p.b) + '</span>' : '') +
      '<h3><a href="' + esc(p.h) + '">' + esc(p.n) + '</a></h3>' +
      '<div class="price"><b>₪' + p.pf + '</b>' + (sale ? '<s>₪' + p.rf + '</s>' : '') + '</div>' +
      (p.k ? '<a class="btn btn-brand btn-s buy" href="' + esc(p.k) + '" rel="nofollow">' + esc(p.kl || 'הוספה לסל') + '</a>' : '') + '</div></article>';
  }
  function render() {
    var list = all.filter(function (p) { return !sub || p.c.indexOf(sub) > -1; });
    if (sort.value === 'asc') list = list.slice().sort(function (a, b) { return a.p - b.p; });
    if (sort.value === 'desc') list = list.slice().sort(function (a, b) { return b.p - a.p; });
    grid.innerHTML = list.slice(0, shown).map(card).join('');
    var full = all.length >= total, n = full || sub ? list.length : total;
    count.textContent = (full || !sub ? n.toLocaleString('he-IL') : '…') + ' מוצרים';
    more.style.display = (full ? list.length : n) > shown ? '' : 'none';
    document.querySelectorAll('.chips button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.sub === sub ? 'true' : 'false'); });
  }
  document.querySelectorAll('.chips button').forEach(function (b) {
    b.addEventListener('click', function () { sub = b.dataset.sub; shown = 48; render(); whole.then(render); });
  });
  sort.addEventListener('change', function () { render(); whole.then(render); });
  more.addEventListener('click', function () { shown += 48; whole.then(render); });
  render();
})();
