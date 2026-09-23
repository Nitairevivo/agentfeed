"""Does the link we publish actually open?

Every number in the counter is about somebody pressing a link. Not one of them
says whether the link *arrives* — and between our redirect and the shop's page
there is a hop nobody here has ever tested. A dead buy link produces exactly
the counter we have: clicks, carts, and a merchant who saw nothing.

So this walks the chain and reports every step: our /go/ address, the redirect
it answers with, and what the shop's own server says at the other end. Read
only, one request per hop, and it announces itself as us rather than pretending
to be a browser — the point is to see what a shop does with our link, not to
sneak past anything.
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request
from urllib.parse import quote, urlsplit, urlunsplit

UA = ("Mozilla/5.0 (compatible; AgentFeedBot/1.0; link check; "
      "+https://nitairevivo.github.io/agentfeed/)")
TIMEOUT = 25
MAX_HOPS = 8


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Stop at each hop, so the chain is reported rather than collapsed."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def once(url: str) -> tuple[int, str, str]:
    """`(status, location, note)` for a single hop."""
    parts = urlsplit(url)
    if not parts.path.isascii():
        url = urlunsplit((parts.scheme, parts.netloc, quote(parts.path, safe="/"),
                          parts.query, parts.fragment))
    opener = urllib.request.build_opener(_NoRedirect)
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,*/*;q=0.8",
        "Accept-Language": "he,en;q=0.8"})
    try:
        with opener.open(req, timeout=TIMEOUT) as r:
            body = r.read(200_000)
            return r.status, r.headers.get("location", ""), f"{len(body)} bytes"
    except urllib.error.HTTPError as e:
        loc = e.headers.get("location", "") if e.headers else ""
        return e.code, loc, (e.reason or "")
    except (urllib.error.URLError, OSError, ValueError) as e:
        return 0, "", f"did not answer: {e}"


def walk(url: str) -> int:
    print(f"\n→ {url}")
    seen = set()
    for hop in range(MAX_HOPS):
        status, where, note = once(url)
        print(f"  {hop + 1}. {status or 'no answer'}  {note}")
        if where:
            print(f"     → {where}")
        if not where or status == 0:
            return 0 if 200 <= status < 400 else 1
        if where in seen:
            print("     (a loop — stopping)")
            return 1
        seen.add(where)
        url = where if where.startswith("http") else url.rsplit("/", 1)[0] + where
    print("  too many hops")
    return 1


def main() -> int:
    raw = os.environ.get("PROBE_URLS", "").replace(",", "\n")
    urls = [u.strip() for u in raw.split("\n") if u.strip()]
    if not urls:
        print("PROBE_URLS is empty — nothing to check.")
        return 2
    bad = 0
    for u in urls:
        bad += walk(u)
    print(f"\n{len(urls)} link(s) walked, {bad} that did not end at a page.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
