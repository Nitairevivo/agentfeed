"""What is actually in a shop's catalogue, so a message to its owner can say so.

`qualify.py` answers "can this shop be connected at all". This answers the next
question, which is the one that decides whether a cold message gets read: what
does this particular shop sell, at what prices, and what is the shape of its
catalogue. A message that quotes a real product and a real price range is a
message from somebody who looked; everything else is a template.

It reads the shop's own public catalogue endpoint — the same one a price
comparison site reads — once, sixty items, and nothing else. **No contact
details are read and no message is sent from here.** Bulk unsolicited
commercial messaging is illegal in Israel and would undo the only thing this
project has going for it; what comes out of this is material for a person to
write one message, by hand, to one shop.

The output goes to the log as JSON, because the machine that needs it is a
chat session that can read job logs and cannot download artifacts.
"""

from __future__ import annotations

import json
import os
import statistics
import sys
import urllib.error
import urllib.request
from collections import Counter

UA = ("Mozilla/5.0 (compatible; AgentFeedBot/1.0; "
      "+https://nitairevivo.github.io/agentfeed/)")
TIMEOUT = 25
WANT = 60


def get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8", errors="replace")), r.headers


def _money(raw) -> float | None:
    try:
        v = float(str(raw).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    # A Woo Store API price comes as minor units when the shop says so; a zero
    # is a "call us" placeholder either way and is not a price.
    return v if v > 0 else None


def woo(base: str) -> dict | None:
    body, headers = get(f"{base}/wp-json/wc/store/products?per_page={WANT}")
    rows = body.get("products") if isinstance(body, dict) else body
    if not isinstance(rows, list) or not rows:
        return None
    total = headers.get("X-WP-Total")
    prices, cats, names = [], Counter(), []
    for r in rows:
        names.append(str(r.get("name") or ""))
        p = (r.get("prices") or {})
        minor = int(p.get("currency_minor_unit") or 2)
        v = _money(p.get("price"))
        if v is not None:
            prices.append(v / (10 ** minor))
        for c in (r.get("categories") or []):
            if c.get("name"):
                cats[c["name"]] += 1
    return {"platform": "WooCommerce",
            "total": int(total) if total and str(total).isdigit() else len(rows),
            "read": len(rows), "prices": prices,
            "categories": cats.most_common(6), "names": names}


def shopify(base: str) -> dict | None:
    body, _ = get(f"{base}/products.json?limit={WANT}")
    rows = (body or {}).get("products") or []
    if not rows:
        return None
    prices, cats, names = [], Counter(), []
    for r in rows:
        names.append(str(r.get("title") or ""))
        if r.get("product_type"):
            cats[r["product_type"]] += 1
        for v in (r.get("variants") or []):
            m = _money(v.get("price"))
            if m is not None:
                prices.append(m)
    # products.json is paged at 250 and never states a total, so the honest
    # answer is "at least this many", not a number we made up.
    return {"platform": "Shopify", "total": None, "read": len(rows),
            "prices": prices, "categories": cats.most_common(6), "names": names}


def dossier(host: str) -> dict:
    base = host if host.startswith("http") else "https://" + host
    base = base.rstrip("/")
    out = {"host": host}
    for fn in (woo, shopify):
        try:
            got = fn(base)
        except (urllib.error.URLError, urllib.error.HTTPError, OSError,
                ValueError) as exc:
            out.setdefault("tried", []).append(f"{fn.__name__}: {exc}")
            continue
        if got:
            prices = sorted(got.pop("prices"))
            out.update(got)
            if prices:
                out["price_min"] = round(prices[0], 2)
                out["price_max"] = round(prices[-1], 2)
                out["price_median"] = round(statistics.median(prices), 2)
                out["priced"] = len(prices)
            # Three real items, longest names first: a long name usually
            # carries the size, the flavour or the model, which is exactly the
            # detail that proves somebody opened the shop.
            out["examples"] = sorted(out.pop("names"), key=len, reverse=True)[:3]
            return out
    out["ok"] = False
    return out


def main() -> int:
    raw = " ".join(sys.argv[1:]) or os.environ.get("DOSSIER_DOMAINS", "")
    hosts = [x for x in raw.replace(",", " ").split() if x]
    if not hosts:
        print("No domains. Pass them as arguments or set DOSSIER_DOMAINS.")
        return 1
    out = []
    for h in hosts:
        d = dossier(h)
        out.append(d)
        if d.get("platform"):
            print(f"  ✓ {h}: {d['platform']}, total={d.get('total')}, "
                  f"priced {d.get('priced', 0)}/{d.get('read')}, "
                  f"₪{d.get('price_min')}–₪{d.get('price_max')} "
                  f"(median ₪{d.get('price_median')})")
            print(f"      categories: {d.get('categories')}")
            for name in d.get("examples", []):
                print(f"      · {name}")
        else:
            print(f"  ✗ {h}: {d.get('tried')}")
    print("\n----- BEGIN dossiers.json -----")
    print(json.dumps(out, ensure_ascii=False))
    print("----- END dossiers.json -----")
    return 0


if __name__ == "__main__":
    sys.exit(main())
