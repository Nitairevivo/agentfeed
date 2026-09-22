"""The profiles a business links to from its own site, and nothing beyond them.

Standalone on purpose: stdlib only, no imports from this package. The machine
that can reach a business's website is a GitHub Actions runner in the public
repository, which does not have this package — so the same file is copied there
as `tools/identitysrc.py` and both sides read one implementation.

**Why this exists.** A page that says "LeadOn" is a string. A page that says
"LeadOn, and here is its Facebook and its LinkedIn" is an entity, and an engine
can line it up with what it already knows about that business. Fifteen of the
twenty businesses here publish one identity link — their own domain — and to a
model meeting them for the first time they are therefore a name nobody has
heard of. That is the gap this closes, and it is the same gap that makes a cold
question return somebody else.

**Where the claim comes from.** Only from a link the business put on its own
site. A footer icon pointing at facebook.com/X is the business saying, on its
own page, that X is where to find it — the same act as printing its price
there, and the same thing we are already permitted to quote. Nothing is
searched for, nothing is guessed from the business's name, and a profile we
merely believe exists is not published.

**Two things are deliberately not read:**

  * **Google Maps, g.page and maps.app.goo.gl.** They are the strongest
    identity link there is, and they are also a street address. One business
    here is listed on the explicit condition that its location is never
    published, and a harvester that has to remember an exception will one day
    forget it. A map link goes in by hand, per business, or not at all.
  * **Share buttons.** `facebook.com/sharer.php?u=…` is on half the pages on
    the internet and identifies nobody. Each network below says what a profile
    looks like on it, and everything else is dropped.
"""

from __future__ import annotations

import re
import urllib.error
import urllib.request
from html.parser import HTMLParser
from urllib.parse import parse_qs, quote, urljoin, urlsplit, urlunsplit

UA = ("Mozilla/5.0 (compatible; AgentFeedBot/1.0; "
      "+https://nitairevivo.github.io/agentfeed/)")
TIMEOUT = 25
MAX_BYTES = 1_500_000

# What a profile looks like on each network. The value is the set of first path
# segments that introduce one; an empty set means the handle is the whole path.
NETWORKS: dict[str, tuple[str, frozenset[str]]] = {
    "facebook.com": ("Facebook", frozenset({"pages", "people", "profile.php"})),
    "instagram.com": ("Instagram", frozenset()),
    "linkedin.com": ("LinkedIn", frozenset({"company", "in", "showcase"})),
    "youtube.com": ("YouTube", frozenset({"channel", "c", "user"})),
    "tiktok.com": ("TikTok", frozenset()),
    "x.com": ("X", frozenset()),
    "twitter.com": ("X", frozenset()),
    "pinterest.com": ("Pinterest", frozenset()),
}

# The host each network's own links settle on, so one business linked as
# twitter.com/x and x.com/x is not published as two different businesses.
CANON = {
    "facebook.com": "www.facebook.com",
    "instagram.com": "www.instagram.com",
    "linkedin.com": "www.linkedin.com",
    "youtube.com": "www.youtube.com",
    "tiktok.com": "www.tiktok.com",
    "x.com": "x.com",
    "twitter.com": "x.com",
    "pinterest.com": "www.pinterest.com",
}

# First path segments that are a button, a post or a policy — never a profile.
NOT_A_PROFILE = frozenset({
    "sharer", "sharer.php", "share", "share.php", "sharearticle", "intent",
    "dialog", "plugins", "login", "signup", "logout", "home", "help",
    "policies", "privacy", "legal", "terms", "settings", "search", "explore",
    "hashtag", "hashtags", "tag", "groups", "events", "marketplace", "watch",
    "embed", "results", "feed", "reel", "reels", "stories", "story", "p",
    "posts", "photo", "photos", "video", "videos", "media", "accounts",
    "direct", "i", "tr", "sharing", "oauth", "pub", "l.php", "flx", "discover",
})

# Handles that belong to the platform, the shop system or whoever built the
# site. A "Built with Wix" footer links Wix's own Facebook, and publishing it
# would say this business is Wix.
NOT_THE_BUSINESS = frozenset({
    "wix", "wixcom", "wixlounge", "shopify", "woocommerce", "wordpress",
    "wordpressdotcom", "elementor", "squarespace", "godaddy", "webflow",
    "bigcommerce", "magento", "paypal", "stripe", "cardcom", "tranzila",
    "meshulam", "grow", "whatsapp", "facebook", "instagram", "meta",
    "google", "youtube", "tiktok", "linkedin", "twitter", "x", "pinterest",
    "bitly", "canva", "mailchimp", "activetrail", "smoove", "rav-messer",
})

_TAG = re.compile(r"<[^>]+>")


# ------------------------------------------------------------------ fetching

def get(url: str, timeout: int = TIMEOUT) -> str:
    """Read a page, or return "". A site that is down is not a site with no links."""
    parts = urlsplit(url)
    if not parts.path.isascii():
        url = urlunsplit((parts.scheme, parts.netloc,
                          quote(parts.path, safe="/"), parts.query,
                          parts.fragment))
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,*/*;q=0.8",
        "Accept-Language": "he,en;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(MAX_BYTES).decode(r.headers.get_content_charset() or "utf-8",
                                            errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError):
        return ""


class _Links(HTMLParser):
    """Every href on the page, in the order they appear."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hrefs: list[str] = []

    def handle_starttag(self, tag, attrs) -> None:
        if tag != "a":
            return
        for name, value in attrs:
            if name == "href" and value:
                self.hrefs.append(value.strip())


def links(html: str, base: str) -> list[str]:
    """The absolute URLs a page points at."""
    p = _Links()
    try:
        p.feed(html)
    except Exception:                                          # noqa: BLE001
        pass
    out = []
    for href in p.hrefs:
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        try:
            out.append(urljoin(base, href))
        except ValueError:
            continue
    return out


# ------------------------------------------------------------------- reading

def origin(url: str) -> str:
    """The host, without www., lowercased."""
    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def network(url: str) -> str:
    """Which network this URL is on, or "". m.facebook.com counts as facebook."""
    host = origin(url)
    for known in NETWORKS:
        if host == known or host.endswith("." + known):
            return known
    return ""


def profile(url: str) -> tuple[str, str] | None:
    """`(network, canonical url)` if this is somebody's profile page, else None.

    Refusing is the common case and the safe one: of the links in a footer,
    most are posts, share buttons and the platform's own pages, and every one
    of those published as `sameAs` would be this page claiming to be something
    it is not.
    """
    known = network(url)
    if not known:
        return None
    parts = urlsplit(url)
    segments = [s for s in parts.path.split("/") if s]
    if not segments:
        return None                      # the network's own front page
    head = segments[0].lower()

    # facebook.com/profile.php?id=123 is a profile and carries its id in the
    # query, which is the one place a query is part of the name.
    if known == "facebook.com" and head == "profile.php":
        ident = (parse_qs(parts.query).get("id") or [""])[0]
        if not ident.isdigit():
            return None
        return known, f"https://www.facebook.com/profile.php?id={ident}"

    if head in NOT_A_PROFILE:
        return None

    _, introducers = NETWORKS[known]
    if head in introducers:
        if len(segments) < 2 or segments[1].lower() in NOT_A_PROFILE:
            return None
        handle, keep = segments[1], segments[:2]
        # facebook.com/pages/Some-Shop/12345 — the number is the page. Dropping
        # it leaves a URL that opens nothing, which is a broken claim rather
        # than a weaker one.
        if known == "facebook.com" and head in ("pages", "people"):
            if len(segments) < 3 or not segments[2].isdigit():
                return None
            keep = segments[:3]
    else:
        # A bare handle. More than one segment after it means a post, an album
        # or a tab — the profile itself is the first segment.
        handle, keep = segments[0], segments[:1]
        if known == "linkedin.com":
            return None                  # LinkedIn has no bare-handle profiles

    bare = handle.lstrip("@").lower()
    if not bare or bare in NOT_THE_BUSINESS:
        return None
    if known == "youtube.com" and head not in introducers and not handle.startswith("@"):
        return None                      # youtube.com/something is not a channel
    return known, "https://" + CANON[known] + "/" + "/".join(keep)


def harvest(site: str) -> dict:
    """What the business's own home page says about where else to find it.

    One fetch per site. A social cluster lives in the footer, and a footer is
    on the home page; a crawl of the whole site to find the same five links
    would be a crawl with a timestamp on it.
    """
    html = get(site)
    if not html:
        return {"read": False, "found": {}, "ambiguous": {}}
    seen: dict[str, set[str]] = {}
    for href in links(html, site):
        hit = profile(href)
        if hit:
            seen.setdefault(NETWORKS[hit[0]][0], set()).add(hit[1])
    found, ambiguous = {}, {}
    for name, urls in sorted(seen.items()):
        if len(urls) == 1:
            found[name] = next(iter(urls))
        else:
            # Two Instagram accounts on one page: one of them is somebody
            # else's, and we do not know which. Reported, not published.
            ambiguous[name] = sorted(urls)
    return {"read": True, "found": found, "ambiguous": ambiguous}
