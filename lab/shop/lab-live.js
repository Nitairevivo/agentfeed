// The test shop's products, as they are now: what was approved in the owner's chat (server/lib/live.mjs)
// is laid over the catalogue written into the page, before the cart and the product page are drawn.
// A product taken off is gone from every list and cannot be bought. If the server does not answer in
// time, the shop opens as it was built.
(function () {
  var me = document.currentScript, store = me.getAttribute('data-store'), S = window.SHOP;
  // ?af-draft=<id>: the chat's "after" picture of a change not yet approved, for this view only
  var draft = (location.search.match(/[?&]af-draft=(R[a-z0-9]{4,20})/) || [])[1] || '';
  var API = 'https://agentfeed-plum.vercel.app/api/panel?op=live&site=lab-shop' + (draft ? '&draft=' + draft : '');
  var done = false;
  function go() { if (done) return; done = true; var t = document.createElement('script'); t.src = store; document.body.appendChild(t); }
  var money = function (n) { var r = Math.round(n * 100) / 100; return '₪' + r.toLocaleString('he-IL', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  function apply(o) {
    if (!S || !o) return;
    S.products = S.products.filter(function (p) { var x = o[p.id]; return !(x && x.hidden); });
    S.products.forEach(function (p) { var x = o[p.id]; if (!x) return; if (x.price != null) p.price = x.price; if (x.name) p.name = x.name; });
    Object.keys(o).forEach(function (id) {
      var x = o[id];
      [].forEach.call(document.querySelectorAll('a.pc[href$="p/' + id + '.html"]'), function (a) {
        if (x.hidden) { a.style.display = 'none'; return; }
        var h = a.querySelector('h3'); if (h && x.name) h.textContent = x.name;
        var b = a.querySelector('.pr b'); if (b && x.price != null) b.textContent = money(x.price);
        // the old price stays only where it is still higher: a struck-out price below the new one is not a sale
        var s = a.querySelector('.pr s'); if (s && x.price != null && parseFloat(s.textContent.replace(/[^\d.]/g, '')) <= x.price) s.remove();
        var badge = a.querySelector('.badge'); if (badge && x.price != null) badge.remove();
        var tier = a.querySelector('.tier'); if (tier && x.price != null && S.tiers[1]) tier.textContent = '📦 מ-' + S.tiers[1][0] + ' יח׳: ' + money(x.price * (1 - S.tiers[1][1])) + ' ליחידה';
      });
    });
    // the product page itself
    var host = document.getElementById('buybox'), x = host && o[host.dataset.id];
    if (!x) return;
    if (x.hidden) {
      host.removeAttribute('id');
      host.innerHTML = '<p class="desc"><b>המוצר הזה לא זמין כרגע.</b></p>';
      var st = document.querySelector('.stock'); if (st) st.innerHTML = '<i style="background:#e53935"></i>לא זמין כרגע';
      var sticky = document.getElementById('stickyadd'); if (sticky) sticky.remove();
      return;
    }
    var h1 = document.querySelector('h1'); if (h1 && x.name) { h1.textContent = x.name; document.title = document.title.replace(/^[^|]*/, x.name + ' '); }
    var d = document.querySelector('p.desc'); if (d && x.desc) d.textContent = x.desc;
    var bs = document.querySelector('.bigprice s'); if (bs && x.price != null && parseFloat(bs.textContent.replace(/[^\d.]/g, '')) <= x.price) bs.remove();
  }
  setTimeout(go, 2500);
  fetch(API + '&t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (d) { if (!done) apply(d.items || {}); }).catch(function () {}).then(go);
})();
