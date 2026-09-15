"""Find the reviews a business already published on its own site.

Standalone on purpose: stdlib only, no imports from this package. The machine
that can reach a business's website is a GitHub Actions runner in the public
repository, which does not have this package — so the same file is copied there
as `tools/reviewsrc.py` and both sides read one implementation.

Two sources, and only two, because both say what they are:

  * **JSON-LD `Review`** the site already emits. The shop published the review
    as a review, in the field that means review. Nothing is inferred.
  * **The WooCommerce Store API** (`/wp-json/wc/store/v1/products/reviews`) —
    product reviews, with the reviewer, the rating, the date and the permalink
    of the product they are about. Public by default on any Woo shop.

What is deliberately not read: anything that merely looks like a testimonial in
the HTML. A block of text in a slider is sometimes three customers, sometimes
the owner's own marketing copy, and sometimes the cookie banner. Guessing there
puts a sentence nobody wrote under a customer's name, which is worse than
having no reviews at all.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urlsplit, urlunsplit

UA = ("Mozilla/5.0 (compatible; AgentFeedBot/1.0; "
      "+https://nitairevivo.github.io/agentfeed/)")
TIMEOUT = 25
MAX_BYTES = 1_500_000


# ------------------------------------------------------------------ fetching

def get(url: str, timeout: int = TIMEOUT) -> str:
    """Read a page, or return "". A site that is down is not a site with no reviews."""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "he,en;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(MAX_BYTES).decode(r.headers.get_content_charset() or "utf-8",
                                            errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError):
        return ""


def origin(url: str) -> str:
    p = urlsplit(url)
    return urlunsplit((p.scheme or "https", p.netloc, "", "", "")) if p.netloc else ""


# ------------------------------------------------------------------- parsing

class _Scripts(HTMLParser):
    """Collect the body of every ld+json script. A regex misses nested braces."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[str] = []
        self._in = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "script":
            t = dict(attrs).get("type", "") or ""
            self._in = "ld+json" in t.lower()

    def handle_endtag(self, tag):
        if tag.lower() == "script":
            self._in = False

    def handle_data(self, data):
        if self._in and data.strip():
            self.blocks.append(data)


def _loads(block: str):
    try:
        return json.loads(block)
    except json.JSONDecodeError:
        # Some themes emit several objects back to back, or a trailing comma.
        try:
            return json.loads("[" + re.sub(r"}\s*{", "},{", block.strip()) + "]")
        except json.JSONDecodeError:
            return None


def _walk(node, out: list):
    """Every dict in the tree. Reviews hide under @graph, itemListElement, review."""
    if isinstance(node, dict):
        out.append(node)
        for v in node.values():
            _walk(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, out)


def _types(node) -> set[str]:
    t = node.get("@type") or node.get("type") or ""
    vals = t if isinstance(t, list) else [t]
    return {str(v).split("/")[-1].lower() for v in vals}


def _text(v) -> str:
    if isinstance(v, dict):
        v = v.get("name") or v.get("@value") or v.get("text") or ""
    if isinstance(v, list):
        v = v[0] if v else ""
        return _text(v)
    return re.sub(r"<[^>]+>", " ", str(v or ""))


def _rating(node):
    r = node.get("reviewRating") or node.get("rating")
    if isinstance(r, dict):
        r = r.get("ratingValue")
    if isinstance(r, list) and r:
        r = r[0]
    try:
        return float(str(r).replace(",", "."))
    except (TypeError, ValueError):
        return None


def from_jsonld(html: str, page_url: str) -> list[dict]:
    """Every JSON-LD Review on this page, as raw records for `reviews.record`."""
    p = _Scripts()
    try:
        p.feed(html)
    except Exception:
        return []
    nodes: list = []
    for block in p.blocks:
        data = _loads(block)
        if data is not None:
            _walk(data, nodes)

    out = []
    for n in nodes:
        if "review" not in _types(n):
            continue
        body = _text(n.get("reviewBody") or n.get("description") or n.get("name"))
        # The review's own url when it has one; otherwise the page it sits on,
        # which is where a reader would go looking for it.
        url = str(n.get("url") or "").strip() or page_url
        if url.startswith("/"):
            url = origin(page_url) + url
        out.append({"text": body,
                    "author": _text(n.get("author")),
                    "date": str(n.get("datePublished") or n.get("dateCreated") or ""),
                    "rating": _rating(n),
                    "url": url})
    return out


def from_woo(site: str) -> list[dict]:
    """Product reviews from the WooCommerce Store API, if this is a Woo shop."""
    base = origin(site)
    if not base:
        return []
    raw = get(f"{base}/wp-json/wc/store/v1/products/reviews?per_page=50")
    data = _loads(raw) if raw else None
    if not isinstance(data, list):
        return []
    out = []
    for r in data:
        if not isinstance(r, dict):
            continue
        out.append({"text": re.sub(r"<[^>]+>", " ", str(r.get("review") or "")),
                    "author": str(r.get("reviewer") or ""),
                    "date": str(r.get("date_created") or "")[:10],
                    "rating": r.get("rating"),
                    "url": str(r.get("product_permalink") or base)})
    return out


# Pages worth opening beyond the home page. A testimonials page is the one
# place a business with no shop puts what customers said.
PATHS = ("/", "/reviews", "/testimonials", "/ביקורות", "/המלצות", "/recommendations",
         "/about", "/אודות")


def harvest(site: str, extra_pages=()) -> list[dict]:
    """Everything this site publishes about itself, as raw review records."""
    base = origin(site)
    if not base:
        return []
    seen, out = set(), []
    out += from_woo(base)
    for path in list(PATHS) + list(extra_pages):
        url = path if path.startswith("http") else base + path
        if url in seen:
            continue
        seen.add(url)
        html = get(url)
        if html:
            out += from_jsonld(html, url)
    return out
