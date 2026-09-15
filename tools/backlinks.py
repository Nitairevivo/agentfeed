"""Ask each business's own site whether it links back to its page here.

This is the measurement the private repository cannot take. Its environment
has no outbound network at all, so the report there has read "0 of 10" since
10 September and nobody has been able to refresh it — while the owner reports
that several businesses have since added the link. Neither number can be
trusted until something actually looks.

Why it matters more than it sounds: Google has indexed twelve pages of this
site out of 2,399, and has not returned since late August. A new site on a
shared host with no inbound links is crawled rarely and shallowly, and a link
from a real business's own site is the strongest single signal available to
fix that. It is also free, and it is the one thing on the list that depends
on nobody but us.

It reads api/stores.json from this repository — the published directory, the
same file an assistant reads — so it needs no private data and no secrets.
Nothing is written to the site: this only looks.

Four answers, and they are deliberately not collapsed into two:

  * linked      — a plain link, which is the one that counts
  * nofollow    — the link is there and marked so an engine passes no weight.
                  A person sees it; a crawler does not count it. Worth a
                  different conversation from "there is no link".
  * wrong-url   — a link to the root, or to a page we renamed. Looks done and
                  accumulates nothing.
  * unreachable — we could not read the site today. **Not** "no link". A site
                  drawn by script returns an empty page to a plain fetch and
                  says nothing about what a browser would see.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = ("Mozilla/5.0 (compatible; AgentFeedBot/1.0; "
      "+https://nitairevivo.github.io/agentfeed/)")
TIMEOUT = 25
MAX_BYTES = 900_000
# Below this, the page we got is a shell a script fills in later, and its
# links are not on it yet. Saying "no link" about that is saying something we
# did not check.
THIN = 5

# How many pages inside a site to look at beyond the home page. Enough to
# reach an "about", a "contact" and a links page; small enough that checking
# fourteen businesses stays one short run and never looks like a crawl.
INNER = 6


def links(html: str) -> list[tuple[str, str]]:
    out = []
    for tag in re.findall(r"<a\b[^>]*>", html, re.I):
        href = re.search(r'href\s*=\s*["\']([^"\']+)', tag, re.I)
        rel = re.search(r'rel\s*=\s*["\']([^"\']*)', tag, re.I)
        if href:
            out.append((href.group(1).strip(), (rel.group(1) if rel else "").lower()))
    return out


def classify(html: str, page_url: str) -> dict:
    want = re.sub(r"^https?://", "", page_url).rstrip("/")
    followed, nofollowed, near = [], [], []
    for href, rel in links(html):
        bare = re.sub(r"^https?://", "",
                      href.split("#")[0].split("?")[0]).rstrip("/")
        if bare == want:
            (nofollowed if ("nofollow" in rel or "sponsored" in rel)
             else followed).append(href)
        elif "agentfeed" in bare or "nitairevivo.github.io" in bare:
            near.append(href)
    if followed:
        return {"state": "linked", "href": followed[0]}
    if nofollowed:
        return {"state": "nofollow", "href": nofollowed[0]}
    if near:
        return {"state": "wrong-url", "href": near[0]}
    return {"state": "missing", "href": ""}


def inner_pages(html: str, site: str) -> list[str]:
    """A few of the site's own pages, the ones a hand-added link lands on.

    Ordered by how likely they are to carry it — a links or about page first —
    so that the six we look at are the six worth looking at.
    """
    from urllib.parse import urljoin, urlparse
    host = urlparse(site).netloc
    seen, out = set(), []
    for href, _rel in links(html):
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        full = urljoin(site, href.split("#")[0])
        if urlparse(full).netloc != host or full.rstrip("/") == site.rstrip("/"):
            continue
        if full in seen:
            continue
        seen.add(full)
        out.append(full)
    likely = ("link", "about", "contact", "אודות", "קישור", "צור-קשר",
              "info", "more", "partner")
    out.sort(key=lambda u: (0 if any(w in u.lower() for w in likely) else 1,
                            len(u)))
    return out


def fetch(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.read(MAX_BYTES).decode("utf-8", errors="replace"), ""
    except urllib.error.HTTPError as e:
        return "", f"HTTP {e.code}"
    except Exception as e:                                # noqa: BLE001
        return "", type(e).__name__


def main() -> int:
    data = json.loads((ROOT / "api" / "stores.json").read_text(encoding="utf-8"))
    rows = []
    for b in data.get("businesses", []):
        site, page = b.get("official_site", ""), b.get("page", "")
        name = b.get("name", "")
        if not site or not page:
            continue
        # A business whose only address is a social profile or a wa.me link has
        # no site to carry a footer. Asking it for a link is asking for
        # something that cannot exist, and it should not be counted against it.
        if any(h in site for h in ("wa.me", "facebook.com", "instagram.com",
                                   "maps.app.goo.gl", "maps.google")):
            rows.append({"name": name, "state": "no-site", "why": site})
            continue
        html, err = fetch(site)
        if err:
            rows.append({"name": name, "state": "unreachable", "why": err})
            continue
        if len(links(html)) < THIN:
            rows.append({"name": name, "state": "unreadable",
                         "why": f"{len(links(html))} links — drawn by script"})
            continue

        # The home page, and then a few pages inside it. The first version
        # read the home page alone and reported seven businesses as having no
        # link; the owner said several had added one and had sent him
        # photographs of it. A footer is usually on every page, but a link
        # added by hand often lands on "about", "contact" or a links page and
        # nowhere else — and reporting that as "no link" is reporting our own
        # shortcut as the business's failure.
        hit = classify(html, page)
        found_on = site
        if hit["state"] == "missing":
            for inner in inner_pages(html, site)[:INNER]:
                more, ierr = fetch(inner)
                if ierr:
                    continue
                deeper = classify(more, page)
                if deeper["state"] != "missing":
                    hit, found_on = deeper, inner
                    break
        rows.append({"name": name, **hit,
                     "found_on": found_on if hit["state"] != "missing" else "",
                     "pages": 1 + (0 if hit["state"] != "missing" else INNER)})
        where = "" if found_on == site or hit["state"] == "missing" else f"  ({found_on})"
        print(f"  {hit['state']:12} {name}{where}")

    read = [r for r in rows if r["state"] in
            ("linked", "nofollow", "wrong-url", "missing")]
    linked_ = [r for r in read if r["state"] == "linked"]
    out = ["# מי מקשר אלינו בחזרה", "",
           f"**{len(linked_)} מתוך {len(read)}** עסקים שנבדקו מקשרים לעמוד שלהם.",
           ""]
    for state, title in (("linked", "מקשרים ✓"),
                         ("nofollow", "מקשרים אבל מסומן nofollow"),
                         ("wrong-url", "מקשרים לכתובת הלא נכונה"),
                         ("missing", "לא מקשרים — כאן העבודה"),
                         ("unreachable", "לא הצלחנו לקרוא את האתר היום"),
                         ("unreadable", "האתר נטען בסקריפט — אי אפשר לדעת מכאן"),
                         ("no-site", "אין אתר — אין איפה לשים קישור")):
        sel = [r for r in rows if r["state"] == state]
        if not sel:
            continue
        out += [f"## {title}", ""]
        for r in sel:
            tail = r.get("why") or r.get("href", "")
            # Where it was found, when it was not the home page. A person has
            # to be able to open the page and see the link for themselves.
            if r.get("found_on"):
                tail = f'{tail}  ·  נמצא ב: {r["found_on"]}' if tail else \
                       f'נמצא ב: {r["found_on"]}'
            out.append(f'- {r["name"]}' + (f" — {tail}" if tail else ""))
        out.append("")
    Path("backlinks-report.md").write_text("\n".join(out) + "\n", encoding="utf-8")
    print("\n" + "\n".join(out[:4]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
