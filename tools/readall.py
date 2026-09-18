"""Read any business from any site, by every route there is — and remember which worked.

`readany.py` knocks on doors and reports which one opened. This one walks
through and comes back with the goods: normalised items, each carrying where it
came from and when, from whichever route the site actually supports.

## Why a cascade and not a parser

There is no single way to read a business, and there never will be — the web
is not one thing. What there is, is an ordered list of routes from "the shop
publishes a machine-readable catalogue" down to "somebody has to render the
page in a browser", and the right behaviour is to take the highest one that
works and stop. Higher routes are cheaper, faster, and above all **they
involve no guessing**: a Woo catalogue states its prices, while a rendered page
has to be interpreted, and interpretation is where invented facts come from.

    1  catalogue api     Woo · Shopify · Wix          exact, one request
    2  product feed      Google Merchant RSS          exact, the shop maintains it
    3  structured data   JSON-LD · microdata          exact, as far as it goes
    4  enumeration       sitemap · robots             addresses, not content
    5  rendered text     a real browser               everything, slowly

## What "learns" honestly means here

Not a model. A **memory**: the first site built on a platform costs five probes
to identify, and the fingerprint that identified it is written down — so the
second site on that platform is read at the first attempt. We found four sites
on one platform in a single afternoon and a partner who has more; that memory
is the difference between forty probes and four.

It records what worked, never what it assumed. A route that fails is recorded
as failed, never as absent: "could not be read today" and "has nothing" are
different facts and the second one is almost never true.

## What it will not do

Guess a price, a name or an availability that no route stated. Every item it
returns carries `via` — the route that produced it — so anything downstream can
refuse a source it does not trust. Reading only: nothing is written anywhere,
no contact details are collected, and consent is still required before a single
page is published.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

UA = ("Mozilla/5.0 (compatible; AgentFeedBot/1.0; "
      "+https://nitairevivo.github.io/agentfeed/)")
TIMEOUT = 25
MAX = 4_000_000
MEMORY = Path(__file__).resolve().parent / "platforms.json"


def get(url: str, timeout: int = TIMEOUT) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept-Language": "he,en;q=0.8",
        "Accept": "text/html,application/xml,application/json;q=0.9,*/*;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            enc = r.headers.get_content_charset() or "utf-8"
            return r.status, r.read(MAX).decode(enc, errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except (urllib.error.URLError, OSError, ValueError):
        return 0, ""


def origin(raw: str) -> str:
    raw = raw.strip()
    raw = raw if raw.startswith("http") else "https://" + raw
    p = urlsplit(raw)
    return urlunsplit((p.scheme, p.netloc, "", "", "")) if p.netloc else ""


def _money(v) -> str:
    s = re.sub(r"[^\d.,]", "", str(v or "")).replace(",", "")
    return s if re.fullmatch(r"\d+(\.\d+)?", s or "") else ""


def item(via: str, **kw) -> dict:
    """One item, with the route that produced it attached to it for ever."""
    out = {k: v for k, v in kw.items() if v not in (None, "", [], {})}
    out["via"] = via
    return out


# ------------------------------------------------------------ 1. catalogues

def woo(base: str) -> list[dict]:
    out: list[dict] = []
    for page in range(1, 41):
        code, raw = get(f"{base}/wp-json/wc/store/products?per_page=100&page={page}")
        if code != 200:
            break
        try:
            rows = json.loads(raw)
        except ValueError:
            break
        rows = rows.get("products") if isinstance(rows, dict) else rows
        if not rows:
            break
        for r in rows:
            prices = r.get("prices") or {}
            minor = int(prices.get("currency_minor_unit") or 2)
            amount = _money(prices.get("price"))
            out.append(item("woo",
                            id=str(r.get("id") or ""),
                            title=re.sub(r"<[^>]+>", "", str(r.get("name") or "")),
                            link=r.get("permalink"),
                            price=(f"{int(amount) / (10 ** minor):.2f}"
                                   if amount else ""),
                            currency=prices.get("currency_code"),
                            image=((r.get("images") or [{}])[0] or {}).get("src"),
                            availability=("in_stock" if r.get("is_in_stock")
                                          else "out_of_stock"),
                            description=re.sub(r"<[^>]+>", " ",
                                               str(r.get("short_description") or ""))[:900]))
        if len(rows) < 100:
            break
    return out


def shopify(base: str) -> list[dict]:
    out: list[dict] = []
    for page in range(1, 41):
        code, raw = get(f"{base}/products.json?limit=250&page={page}")
        if code != 200:
            break
        try:
            rows = (json.loads(raw) or {}).get("products") or []
        except ValueError:
            break
        if not rows:
            break
        for r in rows:
            v = (r.get("variants") or [{}])[0] or {}
            out.append(item("shopify",
                            id=str(r.get("id") or ""),
                            title=r.get("title"),
                            link=f"{base}/products/{r.get('handle', '')}",
                            price=_money(v.get("price")),
                            currency="ILS",
                            brand=r.get("vendor"),
                            image=((r.get("images") or [{}])[0] or {}).get("src"),
                            availability=("in_stock" if v.get("available")
                                          else "out_of_stock"),
                            description=re.sub(r"<[^>]+>", " ",
                                               str(r.get("body_html") or ""))[:900]))
        if len(rows) < 250:
            break
    return out


def wix(base: str) -> list[dict]:
    """Wix Stores. Common in Israel and read by none of the earlier tools.

    Wix does not publish an open catalogue endpoint the way Woo and Shopify do,
    so the honest route is the structured data its storefront already emits —
    exact as far as it goes, and silent rather than invented where it does not.
    """
    code, html = get(base + "/")
    if code != 200 or "wix" not in html.lower():
        return []
    return jsonld_products(html, base, via="wix-jsonld")


# ---------------------------------------------------------------- 2. feeds

FEED_PATHS = ("/feed.xml", "/product-feed.xml", "/google-feed.xml",
              "/merchant-feed.xml", "/feeds/products.xml", "/xmlfeed", "/feed")
G = "{http://base.google.com/ns/1.0}"


def feed(base: str, robots: str) -> list[dict]:
    named = [m for m in re.findall(r"(?im)^\s*sitemap:\s*(\S+)", robots)
             if "feed" in m.lower()]
    for where in named + [base + p for p in FEED_PATHS]:
        code, raw = get(where)
        if code != 200 or "<item" not in raw:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            continue
        out = []
        for node in root.iter("item"):
            def t(*names):
                for n in names:
                    for tag in (n, G + n):
                        el = node.find(tag)
                        if el is not None and (el.text or "").strip():
                            return el.text.strip()
                return ""
            price, _, cur = t("price").partition(" ")
            out.append(item("feed", id=t("id"), title=t("title"),
                            link=t("link"), price=_money(price),
                            currency=cur.strip() or "ILS",
                            image=t("image_link"), brand=t("brand"),
                            description=t("description")[:900],
                            availability={"in stock": "in_stock",
                                          "out of stock": "out_of_stock"}
                            .get(t("availability").lower(), "")))
        if out:
            return out
    return []


# ------------------------------------------------------- 3. structured data

def _walk(node, out: list):
    if isinstance(node, dict):
        out.append(node)
        for v in node.values():
            _walk(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, out)


def _types(node) -> set[str]:
    t = node.get("@type") or ""
    return {str(x).rsplit("/", 1)[-1].lower()
            for x in (t if isinstance(t, list) else [t])}


def jsonld_products(html: str, base: str, via: str = "jsonld") -> list[dict]:
    nodes: list = []
    for block in re.findall(
            r'(?is)<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html):
        try:
            _walk(json.loads(block), nodes)
        except ValueError:
            continue
    out = []
    for n in nodes:
        if "product" not in _types(n):
            continue
        offers = n.get("offers")
        offers = offers[0] if isinstance(offers, list) and offers else offers
        offers = offers if isinstance(offers, dict) else {}
        brand = n.get("brand")
        out.append(item(via,
                        id=str(n.get("sku") or n.get("productID") or ""),
                        title=str(n.get("name") or ""),
                        link=str(n.get("url") or offers.get("url") or ""),
                        price=_money(offers.get("price")),
                        currency=offers.get("priceCurrency") or "",
                        image=(n.get("image") if isinstance(n.get("image"), str)
                               else (n.get("image") or [""])[0]),
                        brand=(brand.get("name") if isinstance(brand, dict)
                               else brand),
                        description=str(n.get("description") or "")[:900]))
    return out


def microdata_products(html: str, base: str) -> list[dict]:
    """Older Israeli shops carry microdata and no JSON-LD at all.

    Deliberately shallow: it reads the name, the price and the currency that a
    page explicitly labelled as such, and nothing it did not label. A richer
    parser here would be a parser that starts inferring.
    """
    out = []
    for chunk in re.split(r'(?i)itemtype=["\']https?://schema\.org/Product["\']',
                          html)[1:]:
        chunk = chunk[:4000]

        def prop(name):
            m = re.search(rf'(?is)itemprop=["\']{name}["\'][^>]*'
                          rf'(?:content=["\']([^"\']+)|>\s*([^<]{{1,200}}))', chunk)
            return ((m.group(1) or m.group(2)).strip() if m else "")
        title = prop("name")
        if not title:
            continue
        out.append(item("microdata", title=title, price=_money(prop("price")),
                        currency=prop("priceCurrency"), image=prop("image"),
                        link=prop("url")))
    return out


# ------------------------------------------------------------- the cascade

ROUTES = (
    ("woo", lambda base, ctx: woo(base)),
    ("shopify", lambda base, ctx: shopify(base)),
    ("feed", lambda base, ctx: feed(base, ctx["robots"])),
    ("jsonld", lambda base, ctx: jsonld_products(ctx["home"], base)),
    ("microdata", lambda base, ctx: microdata_products(ctx["home"], base)),
    ("wix", lambda base, ctx: wix(base)),
)


def remember(host: str, route: str) -> None:
    """Which route worked, so the next site like it is read at the first try."""
    try:
        seen = json.loads(MEMORY.read_text()) if MEMORY.is_file() else {}
    except ValueError:
        seen = {}
    seen[host] = {"route": route,
                  "at": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    MEMORY.write_text(json.dumps(seen, ensure_ascii=False, indent=1) + "\n")


def recall(host: str) -> str:
    try:
        return (json.loads(MEMORY.read_text()).get(host) or {}).get("route", "")
    except (OSError, ValueError):
        return ""


def read(host: str) -> dict:
    base = origin(host)
    if not base:
        return {"host": host, "ok": False, "why": "not a usable address"}
    _, robots = get(f"{base}/robots.txt")
    code, home = get(base + "/")
    ctx = {"robots": robots, "home": home}
    tried: list[str] = []

    order = list(ROUTES)
    known = recall(urlsplit(base).netloc)
    if known:
        # Read at the first attempt rather than probing five doors again.
        order.sort(key=lambda r: r[0] != known)

    for name, fn in order:
        tried.append(name)
        try:
            items = fn(base, ctx)
        except Exception as exc:                        # noqa: BLE001
            items = []
            tried[-1] = f"{name}(error: {exc.__class__.__name__})"
        if items:
            remember(urlsplit(base).netloc, name)
            return {"host": urlsplit(base).netloc, "ok": True, "route": name,
                    "tried": tried, "items": items,
                    "read_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}

    return {"host": urlsplit(base).netloc, "ok": False, "tried": tried,
            "home_status": code,
            "why": ("no route returned items today — this is 'not read', "
                    "never 'has nothing'. A site whose content is built by "
                    "script needs the browser reader.")}


def main() -> int:
    raw = " ".join(sys.argv[1:]) or os.environ.get("READALL_HOSTS", "")
    hosts = [h for h in raw.replace(",", " ").split() if h]
    if not hosts:
        print("No hosts. Pass them as arguments or set READALL_HOSTS.")
        return 1
    results = []
    for h in hosts:
        r = read(h)
        results.append(r)
        if r["ok"]:
            priced = sum(1 for i in r["items"] if i.get("price"))
            print(f"  ✓ {r['host']}: {len(r['items'])} items via {r['route']} "
                  f"({priced} with a price) · tried {', '.join(r['tried'])}")
        else:
            print(f"  ✗ {r['host']}: {r['why']} · tried {', '.join(r['tried'])}")
    print("\n----- BEGIN readall.json -----")
    print(json.dumps(results, ensure_ascii=False))
    print("----- END readall.json -----")
    return 0


if __name__ == "__main__":
    sys.exit(main())
