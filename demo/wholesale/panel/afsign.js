// AFSign: this browser's signing key, for approving changes on a site that checks signatures.
//
// The key is made here (WebCrypto, Ed25519) as not extractable: the page can ask the browser to sign
// with it, and nothing, this page included, can read it out. It is kept in this browser's IndexedDB,
// so it lives on this device only. Only the public half is ever sent anywhere. What is signed is the
// exact text built here from what the screen shows (server/lib/sign.mjs reads the same bytes, and so
// does the plugin inside the site), so an approval covers the change the approver saw and no other.
(function () {
  var NO = 'הדפדפן הזה לא יודע לחתום. פתחו את המסך בכרום, ספארי או פיירפוקס עדכניים.';
  function open() {
    return new Promise(function (ok, no) {
      if (!window.indexedDB) return no(new Error(NO));
      var r = indexedDB.open('agentfeed-sign', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('keys'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(new Error(NO)); };
    });
  }
  function io(mode, fn) {
    return open().then(function (db) { return new Promise(function (ok, no) {
      var tx = db.transaction('keys', mode), q = fn(tx.objectStore('keys'));
      tx.oncomplete = function () { ok(q && q.result); }; tx.onerror = function () { no(tx.error); };
    }); });
  }
  function b64u(buf) {
    var s = '', a = new Uint8Array(buf);
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(''); }
  function fp(kid) { return String(kid || '').toUpperCase().replace(/(.{4})(?=.)/g, '$1 '); }

  /** This browser's device for one role ("desk:<agency>:<member>", "panel:<site>"): kept, or made now. */
  function device(name) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error(NO));
    return io('readonly', function (st) { return st.get(name); }).then(function (have) {
      if (have && have.key && have.pub) return have;
      return crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']).catch(function () { throw new Error(NO); }).then(function (pair) {
        return crypto.subtle.exportKey('raw', pair.publicKey).then(function (raw) {
          return crypto.subtle.digest('SHA-256', raw).then(function (h) {
            var d = { key: pair.privateKey, pub: b64u(raw), kid: hex(h).slice(0, 16), at: new Date().toISOString() };
            return io('readwrite', function (st) { return st.put(d, name); }).then(function () { return d; });
          });
        });
      });
    }).then(function (d) { d.fp = fp(d.kid); return d; });
  }
  function sign(d, msg) {
    return crypto.subtle.sign({ name: 'Ed25519' }, d.key, new TextEncoder().encode(msg)).then(b64u);
  }
  var line = function (s, n) { return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').slice(0, n); };
  function keyMsg(agency, k) { return ['AF-KEY-1', agency, k.kid, k.pub, k.scope, line(k.name, 60), k.at].join('\n'); }
  function revokeMsg(agency, kid, at) { return ['AF-REVOKE-1', agency, kid, at].join('\n'); }
  function rid() { return hex(crypto.getRandomValues(new Uint8Array(12))); }
  /** One change to one site, valid for a day, signed here. */
  function order(d, o) {
    var iat = Math.floor(Date.now() / 1000);
    var msg = JSON.stringify({ v: 1, agency: o.agency, site: o.site, id: rid(), kind: o.kind, body: o.body, iat: iat, exp: iat + 86400 });
    return sign(d, msg).then(function (sig) { return { msg: msg, sig: sig, kid: d.kid }; });
  }
  function stamp() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function label() { return /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'טלפון' : 'מחשב'; }
  window.AFSign = { device: device, sign: sign, order: order, keyMsg: keyMsg, revokeMsg: revokeMsg, fp: fp, stamp: stamp, label: label };
})();
