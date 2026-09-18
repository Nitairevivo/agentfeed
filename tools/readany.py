"""One reader, every door, for any site — and it says which door opened.

Until now the knowledge of how to read a business was spread across four
tools, each of which knew one thing: qualify asked whether a shop is Woo or
Shopify, dossier read a catalogue, harvest_reviews read JSON-LD, and the
browser workflow rendered pages. A site that was none of those got the answer
"not readable", which was never true — it only ever meant "none of the four
doors I know how to open".

So this tries every door there is, in the order that costs the least, and
stops at the first one that actually gives something. **What it reports is
which door opened**, because that is the fact everything downstream needs: a
shop with a catalogue is converted, a site with a sitemap is read page by page,
and a site that answers with a shell is sent to the browser.

Seven doors:

  1. WooCommerce Store API        — a whole catalogue in one request
  2. Shopify products.json        — the same
  3. A product feed named in robots.txt or sitting at a usual address
  4. sitemap.xml                  — every page of any site, whatever built it
  5. The home page, plainly       — words, title, description
  6. JSON-LD of any type anywhere — what the site already declares about itself
  7. The verdict                  — enough to work with, or needs a browser

It reads. It writes nothing anywhere, stores no contact details, and decides
nothing about publishing: a business still consents before a page exists.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from urllib.parse import urljoin, urlsplit, urlunsplit

UA = ("Mozilla/5.0 (compatible; AgentFeedBot/1.0; "
      "+https://nitairevivo.github.io/agentfeed/)")
TIMEOUT = 25
MAX = 2_000_000
# Below this a page is a shell that a script fills in later. Saying "no
# content" about that is saying something we did not check.
#
# Four hundred and not one hundred, because a hundred was measured wrong in
# practice: transplant-israel returns 299 words to a fetch and 15,680 to a
# browser, and a threshold of 120 called that "server-rendered" — the one
# verdict that would have sent us past the site that needs us most.
THIN = 400


def get(url: str, timeout: int = TIMEOUT) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept-Language": "he,en;q=0.8",
        "Accept": "text/html,application/xml,application/json;q=0.9,*/*;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(MAX)
            enc = r.headers.get_content_charset() or "utf-8"
            return r.status, body.decode(enc, errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except (urllib.error.URLError, OSError, ValueError):
        return 0, ""


def origin(raw: str) -> str:
    raw = raw.strip()
    if not raw.startswith("http"):
        raw = "https://" + raw
    p = urlsplit(raw)
    return urlunsplit((p.scheme, p.netloc, "", "", "")) if p.netloc else ""


def words_of(html: str) -> int:
    body = re.sub(r"(?is)<(script|style|noscript|template)[^>]*>.*?</\1>", " ", html)
    return len(re.sub(r"<[^>]+>", " ", body).split())


# ------------------------------------------------------------------- doors

def woo(base: str) -> dict | None:
    code, raw = get(f"{base}/wp-json/wc/store/products?per_page=1")
    if code != 200:
        return None
    try:
        rows = json.loads(raw)
    except ValueError:
        return None
    rows = rows.get("products") if isinstance(rows, dict) else rows
    return {"platform": "WooCommerce", "catalogue": True} if rows else None


def shopify(base: str) -> dict | None:
    code, raw = get(f"{base}/products.json?limit=1")
    if code != 200:
        return None
    try:
        rows = (json.loads(raw) or {}).get("products") or []
    except ValueError:
        return None
    return {"platform": "Shopify", "catalogue": True} if rows else None


FEED_PATHS = ("/feed.xml", "/product-feed.xml", "/google-feed.xml",
              "/merchant-feed.xml", "/feeds/products.xml", "/xmlfeed")


def feed(base: str, robots: str) -> dict | None:
    """A Google Shopping feed, named in robots.txt or at a usual address.

    Worth trying before anything heavier: a shop that maintains one for Google
    already keeps it correct, which is the whole reason this project prefers
    it — the business does no work and nothing is derived by guesswork.
    """
    seen = [m for m in re.findall(r"(?im)^\s*sitemap:\s*(\S+)", robots)
            if "feed" in m.lower()]
    for path in seen + [base + p for p in FEED_PATHS]:
        code, raw = get(path if path.startswith("http") else base + path)
        if code == 200 and "<item" in raw and "g:" in raw:
            return {"feed": path, "items": raw.count("<item")}
    return None


def sitemap(base: str, robots: str) -> dict | None:
    """Every page of any site, whatever built it — the one door that is not
    platform-specific. Indexes are followed one level, which is where the
    per-section maps live on almost every site that has them."""
    named = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", robots)
    urls: list[str] = []
    for where in named + [f"{base}/sitemap.xml", f"{base}/sitemap_index.xml"]:
        code, raw = get(where)
        if code != 200 or "<" not in raw:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            continue
        tag = root.tag.rsplit("}", 1)[-1]
        locs = [e.text.strip() for e in root.iter()
                if e.tag.rsplit("}", 1)[-1] == "loc" and (e.text or "").strip()]
        if tag == "sitemapindex":
            for child in locs[:5]:
                c, craw = get(child)
                if c != 200:
                    continue
                try:
                    urls += [e.text.strip() for e in ET.fromstring(craw).iter()
                             if e.tag.rsplit("}", 1)[-1] == "loc" and e.text]
                except ET.ParseError:
                    continue
        else:
            urls += locs
        if urls:
            return {"sitemap": where, "urls": len(set(urls)),
                    "sample": sorted(set(urls))[:5]}
    return None


def declared(html: str) -> list[str]:
    """Every schema.org type the page declares about itself, of any kind."""
    kinds: list[str] = []

    def walk(node):
        if isinstance(node, dict):
            t = node.get("@type")
            for v in ([t] if isinstance(t, str) else (t or [])):
                kinds.append(str(v))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    for block in re.findall(
            r'(?is)<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html):
        try:
            walk(json.loads(block))
        except ValueError:
            continue
    # Microdata too: plenty of older Israeli shops carry it and no JSON-LD.
    kinds += [m.rsplit("/", 1)[-1] for m in
              re.findall(r'itemtype=["\']https?://schema\.org/([A-Za-z]+)', html)]
    return sorted(set(kinds))


# ------------------------------------------------------------------ verdict

def read(host: str) -> dict:
    base = origin(host)
    out: dict = {"host": urlsplit(base).netloc, "doors": []}
    if not base:
        return {**out, "verdict": "not a usable address"}

    _, robots = get(f"{base}/robots.txt")
    code, home = get(base + "/")
    out["home_status"] = code
    out["words"] = words_of(home) if home else 0
    m = re.search(r"(?is)<title[^>]*>(.*?)</title>", home or "")
    out["title"] = m.group(1).strip()[:120] if m else ""
    out["schema"] = declared(home or "")

    for name, fn in (("catalogue", lambda: woo(base) or shopify(base)),
                     ("feed", lambda: feed(base, robots)),
                     ("sitemap", lambda: sitemap(base, robots))):
        found = fn()
        if found:
            out[name] = found
            out["doors"].append(name)

    # What to do with it, said plainly, because "unreadable" was never true —
    # it only ever meant nobody had tried the right door.
    if "catalogue" in out:
        out["verdict"] = "catalogue — convert it, no owner effort at all"
    elif "feed" in out:
        out["verdict"] = "product feed — convert it"
    elif (out["words"] >= THIN and "sitemap" in out
            and set(out["schema"]) - {"WebSite", "Organization"}):
        out["verdict"] = "server-rendered with a sitemap — read page by page"
    elif "sitemap" in out and not (set(out["schema"]) - {"WebSite", "Organization"}):
        # A site that declares only its own name, and nothing about anything on
        # it, is a shell however many words the shell happens to contain. The
        # four sites read yesterday all looked like this and all of them turned
        # out to hold thousands of words a crawler never sees.
        out["verdict"] = ("declares only its own name and nothing about its "
                          "content — almost certainly a shell. Send it to the "
                          "browser reader before deciding")
    elif "sitemap" in out:
        out["verdict"] = ("thin to a plain fetch but has a sitemap — needs the "
                          "browser reader, and this is the case worth the most "
                          "to the owner")
    elif out["words"] >= THIN:
        out["verdict"] = "server-rendered, no sitemap — read the home page and ask"
    elif code == 200:
        out["verdict"] = ("answers, but a crawler gets almost nothing — needs "
                          "the browser reader")
    else:
        out["verdict"] = f"could not be read today (HTTP {code}) — not 'has nothing'"
    return out


def main() -> int:
    raw = " ".join(sys.argv[1:]) or os.environ.get("READANY_HOSTS", "")
    hosts = [h for h in raw.replace(",", " ").split() if h]
    if not hosts:
        print("No hosts. Pass them as arguments or set READANY_HOSTS.")
        return 1
    rows = []
    for h in hosts:
        r = read(h)
        rows.append(r)
        doors = ", ".join(r["doors"]) or "—"
        print(f"\n  {r['host']}")
        print(f"    doors opened : {doors}")
        print(f"    home         : HTTP {r.get('home_status')}, "
              f"{r.get('words', 0)} words to a crawler")
        if r.get("schema"):
            print(f"    declares     : {', '.join(r['schema'][:8])}")
        if r.get("sitemap"):
            print(f"    sitemap      : {r['sitemap']['urls']} urls")
        print(f"    → {r['verdict']}")
    print("\n----- BEGIN readany.json -----")
    print(json.dumps(rows, ensure_ascii=False))
    print("----- END readany.json -----")
    return 0


if __name__ == "__main__":
    sys.exit(main())
