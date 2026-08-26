"""Announce every url in the sitemap to the engines that accept IndexNow.

The key file has to be reachable at the location we claim it is, and ours is
not at the host root: this site lives in a subdirectory of a GitHub user page,
and there is no repository backing that user page to put a file in. IndexNow
allows that — a key below the root authorises the urls beneath it — but only
if keyLocation names where the file really is.

Claiming the root instead earned a 403 on every submission for three days,
and the job reported success each time because the failure was printed and
swallowed. So this exits non-zero when an engine refuses. A refusal is not
news to be logged; it means nothing was announced.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

KEY = "6207428dda82556a2a0a28d0e53ee533"
ENDPOINT = "https://api.indexnow.org/IndexNow"
SITE = "https://nitairevivo.github.io/agentfeed"


def main() -> int:
    sitemap = sys.argv[1] if len(sys.argv) > 1 else "sitemap.xml"
    urls = re.findall(r"<loc>([^<]+)</loc>",
                      Path(sitemap).read_text(encoding="utf-8"))
    if not urls:
        print("no urls in sitemap")
        return 0
    payload = json.dumps({
        "host": urlparse(urls[0]).netloc,
        "key": KEY,
        "keyLocation": f"{SITE}/{KEY}.txt",
        "urlList": urls,
    }).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT, data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"✓ {len(urls)} urls announced — HTTP {r.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        print(f"✗ IndexNow refused: HTTP {e.code} {body}")
        print(f"  keyLocation sent: {SITE}/{KEY}.txt")
        return 1
    except urllib.error.URLError as e:
        print(f"✗ could not reach IndexNow: {e.reason}")
        return 1
    for u in urls:
        print("   ", u)
    return 0


if __name__ == "__main__":
    sys.exit(main())
