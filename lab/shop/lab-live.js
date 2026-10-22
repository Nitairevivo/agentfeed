// The test shop's products, as they are now: what was approved in the owner's chat (server/lib/live.mjs)
// is laid over the catalogue written into the page, before the cart and the product page are drawn.
// A product taken off is gone from every list and cannot be bought. If the server does not answer in
// time, the shop opens as it was built.
(function () {
  var me = document.currentScript, store = me.getAttribute('data-store'), S = window.SHOP;
  // ?af-draft=<id>: the chat's "after" picture of a change not yet approved, for this view only
  var draft = (location.search.match(/[?&]af-draft=(R[a-z0-9]{4,20})/) || [])[1] || '';
  var API = 'https://agentfeed-plum.vercel.app/api/panel?op=live&site=lab-shop' + (draft ? '&draft=' + draft : '');
  // ?af-try=<products as JSON>: the example panel's before and after, for this view only. Text is set as text,
  // and only what a product carries here (price, name, description, taken off) is read
  var tried = {};
  try {
    var raw = (location.search.match(/[?&]af-try=([^&]+)/) || [])[1];
    var t = raw ? JSON.parse(decodeURIComponent(raw)) : {};
    Object.keys(t).slice(0, 30).forEach(function (id) {
      var x = t[id]; if (!/^[a-z0-9_-]{1,40}$/i.test(id) || !x || typeof x !== 'object') return;
      var y = { hidden: x.hidden === true };
      if (typeof x.price === 'number' && x.price > 0 && x.price < 1e6) y.price = x.price;
      if (typeof x.name === 'string' && x.name.trim()) y.name = x.name.slice(0, 120);
      if (typeof x.desc === 'string' && x.desc.trim()) y.desc = x.desc.slice(0, 600);
      tried[id] = y;
    });
  } catch (x) { tried = {}; }
  var over = function (o) { o = o || {}; Object.keys(tried).forEach(function (id) { o[id] = Object.assign({}, o[id] || {}, tried[id]); }); return o; };

  // The example panel (panel/?demo) and this shop share one address, so the changes a visitor approved there are
  // on this shop for them: the products as their example has them, and the changes of look they said yes to.
  // Only in this browser, only on a page opened as itself (a picture in the chat, ?af-try / ?af-draft, keeps its own).
  var mine = {}, looks = [], solo = /[?&]af-(try|draft|preview|before)=/.test(location.search);
  if (!solo) try {
    (JSON.parse(localStorage.getItem('democat:demo-wholesale') || 'null') || []).forEach(function (p) {
      // p.mine: changed by this visitor at some point (p.changed only marks the latest change, for the panel's table)
      if (!p || !(p.changed || p.mine) || !/^[a-z][0-9]{1,3}$/.test(p.id)) return;
      var y = { hidden: p.hidden === true };
      if (typeof p.price === 'number' && p.price > 0 && p.price < 1e6) y.price = p.price;
      if (typeof p.name === 'string' && p.name.trim()) y.name = p.name.slice(0, 120);
      if (typeof p.desc === 'string' && p.desc.trim()) y.desc = p.desc.slice(0, 600);
      mine[p.id] = y;
    });
    looks = (JSON.parse(localStorage.getItem('demolooks:demo-wholesale') || '[]') || []).filter(function (x) { return /^[a-f0-9]{24}$/.test(x); }).slice(-10);
  } catch (x) { mine = {}; looks = []; }
  var ours = Object.keys(mine).length || looks.length;
  var overMine = function (o) { o = over(o); Object.keys(mine).forEach(function (id) { o[id] = Object.assign({}, o[id] || {}, mine[id]); }); return o; };
  // the changes of look: each fetched as the preview it is (checked on the server), and put on this page the way the line
  // does it (patches.mjs): CSS that cannot load or run anything, text as text, hidden parts, the line across the top
  var BAD = /<|\\|\/\*|\/\/|url\s*\(|image-set|src\s*\(|@import|@font-face|expression\s*\(|javascript:|behavio(u)?r\s*:|-moz-binding|@charset/i;
  var FONTS = ["Heebo", "Assistant", "Rubik", "Frank Ruhl Libre", "Secular One", "Varela Round", "Noto Sans Hebrew", "Noto Serif Hebrew", "Alef", "Suez One", "Amatic SC", "Bellefair", "Karantina", "IBM Plex Sans Hebrew", "David Libre", "Miriam Libre"];   // the same list as server/lib/patches.mjs FONTS
  function putLooks(list) {
    var css = '', text = [], pics = [], bar = null;
    list.forEach(function (d) {
      if (!d || !d.preview) return;
      (d.fonts || []).forEach(function (f) {
        if (FONTS.indexOf(f) < 0 || document.querySelector('link[data-af-font="' + f + '"]')) return;
        var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-af-font', f);
        l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':wght@400;500;700;800&display=swap';
        (document.head || document.documentElement).appendChild(l);
      });
      if (d.css && !BAD.test(d.css)) css += '\n' + d.css;
      (d.hide || []).forEach(function (h) { if (!/[<>{}\\;@]|\/\*|\*\//.test(h) && !BAD.test(h)) css += '\n' + h + '{display:none!important}'; });
      text = text.concat(d.text || []); pics = pics.concat(d.images || []); if (d.bar && d.bar.text) bar = d.bar;
    });
    var st = document.getElementById('af-mine') || document.createElement('style'); st.id = 'af-mine'; st.textContent = css; (document.head || document.documentElement).appendChild(st);
    var setText = function () { text.forEach(function (t) { try { [].forEach.call(document.querySelectorAll(t.selector), function (el) {
      if (/^(SCRIPT|STYLE|TITLE|NOSCRIPT|TEMPLATE|TEXTAREA|IFRAME|OBJECT|HEAD|META|LINK|svg|SVG)$/.test(el.tagName) || el.closest('svg,head')) return;
      if (!el.children.length && el.textContent !== t.text) el.textContent = t.text; }); } catch (x) {} }); };
    // a picture swapped for another this shop already shows: https, this same site, never anything else
    var setPics = function () { pics.forEach(function (m) { var src = String(m && m.src || ''), host = '';
      try { host = new URL(src).host; } catch (x) {}
      if (!/^https:\/\/[^\s"'()<>\\]+$/i.test(src) || host !== location.host) return;
      try { [].forEach.call(document.querySelectorAll(m.selector), function (el) {
        if (el.closest('head')) return;
        if (el.tagName === 'IMG') { if (el.getAttribute('src') !== src) { el.removeAttribute('srcset'); el.src = src; } }
        else el.style.backgroundImage = 'url("' + src + '")'; }); } catch (x) {} }); };
    setText(); setTimeout(setText, 600); setTimeout(setText, 1800);
    setPics(); setTimeout(setPics, 600); setTimeout(setPics, 1800);
    var shopBar = document.getElementById('af-bar'); if (bar && shopBar) shopBar.style.display = 'none';
    if (bar && !document.getElementById('af-mine-bar')) {
      var HEX = /^#(?:[0-9a-f]{3}){1,2}$/i, b = document.createElement('div'); b.id = 'af-mine-bar'; b.textContent = bar.text;
      b.setAttribute('style', 'text-align:center;padding:9px 16px;font:600 15px/1.4 system-ui,sans-serif;direction:rtl;background:' + (HEX.test(bar.bg) ? bar.bg : '#14171f') + ';color:' + (HEX.test(bar.fg) ? bar.fg : '#fff'));
      document.body.insertBefore(b, document.body.firstChild);
    }
  }
  // said on the page, small: these changes are this visitor's, from the example
  function badge() {
    if (!ours || document.getElementById('af-mine-note') || !document.body) return;
    var n = document.createElement('div'); n.id = 'af-mine-note';
    try { if (sessionStorage.getItem('af-mine-note-x')) return; } catch (x) {}
    n.setAttribute('style', 'position:fixed;left:12px;right:12px;top:calc(8px + env(safe-area-inset-top,0px));margin:0 auto;width:max-content;max-width:calc(100vw - 24px);z-index:2147483000;background:#14171f;color:#fff;font:13px/1.4 system-ui,sans-serif;padding:7px 10px 7px 12px;border-radius:10px;direction:rtl;box-shadow:0 6px 18px rgba(0,0,0,.25);display:flex;gap:8px;align-items:center');
    var tx = document.createElement('span'); tx.textContent = '🧪 השינויים שעשיתם בהדגמה מוצגים כאן, רק בדפדפן הזה'; n.appendChild(tx);
    var x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'לסגור');
    x.setAttribute('style', 'background:none;border:0;color:#fff;font:15px system-ui;cursor:pointer;padding:0 4px');
    x.onclick = function () { try { sessionStorage.setItem('af-mine-note-x', '1'); } catch (e) {} n.remove(); }; n.appendChild(x);
    document.body.appendChild(n);
  }
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
  // what this visitor changed is in this browser: put on the page now, whatever the server does
  if (Object.keys(mine).length || Object.keys(tried).length) apply(overMine({}));
  setTimeout(go, 2500);
  fetch(API + '&t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (d) { if (!done) apply(overMine(d.items)); }, function () { if (!done) apply(overMine({})); }).then(go);
  if (looks.length) Promise.all(looks.map(function (id) {
    // only the visitor's own change: the shop's live changes are already on the page, through its own line
    return fetch('https://agentfeed-plum.vercel.app/api/panel?op=patches&site=lab-shop&only=1&preview=' + id, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }, function () { return null; });
  })).then(function (list) { var run = function () { putLooks(list); badge(); }; if (document.body) run(); else document.addEventListener('DOMContentLoaded', run); });
  else if (ours) { if (document.body) badge(); else document.addEventListener('DOMContentLoaded', badge); }
})();
