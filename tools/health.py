"""Is the whole thing actually up, from outside?

Every other check here reads files. This one opens the site the way a reader
opens it, and the endpoints the way an assistant hits them, from a machine with
a network — which is the one thing the private repository cannot do at all. A
build that passes its own audit and a site that answers a request are different
facts, and until now only the first one was ever established.

Seven things, and each one is a separate answer rather than a tick:

  * the front page                       — is the site there
  * api/stores.json                      — does the directory parse, and how
                                           many businesses does it claim
  * every business page                  — 200, and does it carry its own name
  * every business's products.jsonl      — served, and how many lines
  * llms.txt, robots.txt, sitemap.xml    — the three files a crawler asks for
                                           before anything else
  * one item page per business           — the addresses in products.jsonl are
                                           promises; this opens one of them
  * the click counter                    — reachable, and what it currently
                                           holds. A counter nobody can reach is
                                           a counter reading zero for a reason
                                           that has nothing to do with clicks

Exit code is 1 if anything is broken, so a failed run is visible without
reading the log.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

SITE = "https://nitairevivo.github.io/agentfeed"
CLICKS = "https://agentfeed-plum.vercel.app"
UA = ("Mozilla/5.0 (compatible; AgentFeedBot/1.0; "
      "+https://nitairevivo.github.io/agentfeed/)")
TIMEOUT = 25

bad: list[str] = []
note: list[str] = []


def get(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read(2_000_000).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except (urllib.error.URLError, OSError, ValueError) as e:
        return 0, str(e)


def main() -> int:
    code, home = get(f"{SITE}/")
    print(f"front page: {code}")
    if code != 200:
        bad.append(f"the front page answers {code}")

    code, raw = get(f"{SITE}/api/stores.json")
    try:
        directory = json.loads(raw)
    except ValueError:
        bad.append(f"api/stores.json did not parse (status {code})")
        directory = {}
    businesses = directory.get("businesses") or []
    print(f"api/stores.json: {code}, {len(businesses)} businesses, "
          f"{len(directory.get('categories') or [])} categories, "
          f"{len(directory.get('comparisons') or [])} comparisons")

    for f in ("robots.txt", "sitemap.xml", "llms.txt"):
        code, body = get(f"{SITE}/{f}")
        print(f"{f}: {code} ({len(body)} bytes)")
        if code != 200:
            bad.append(f"{f} answers {code}")

    reviewed = 0
    for b in businesses:
        slug = b.get("slug", "")
        code, page = get(f"{SITE}/{slug}/")
        if code != 200:
            bad.append(f"{slug}: the business page answers {code}")
            continue
        if b.get("name") and b["name"] not in page:
            bad.append(f"{slug}: the page does not carry the business's name")
        if '<section class="revs"' in page:
            reviewed += 1

        code, rows = get(f"{SITE}/{slug}/products.jsonl")
        lines = [x for x in rows.splitlines() if x.strip()] if code == 200 else []
        if code != 200:
            bad.append(f"{slug}: products.jsonl answers {code}")
        elif not lines:
            bad.append(f"{slug}: products.jsonl is empty")
        print(f"{slug}: page 200, {len(lines)} catalogue line(s)")

        # The item page addresses in products.jsonl are promises made to a
        # machine. One per business is opened, because a promise nobody checks
        # is a 404 delivered to something that believed us.
        item = None
        for line in lines[:40]:
            try:
                item = json.loads(line)
            except ValueError:
                continue
            if item.get("page"):
                break
            item = None
        if item:
            code, _ = get(item["page"])
            if code != 200:
                bad.append(f"{slug}: the item page {item['page']} answers {code}")
        else:
            note.append(f"{slug}: no item in the first 40 lines carries a page "
                        f"address")

    print(f"\nbusiness pages showing reviews: {reviewed} of {len(businesses)}")

    code, raw = get(f"{CLICKS}/api/clicks")
    if code != 200:
        bad.append(f"the click counter answers {code} — a counter nobody can "
                   f"reach reads zero for a reason that is not about clicks")
        print(f"clicks: {code} {raw[:200]}")
    else:
        try:
            data = json.loads(raw)
        except ValueError:
            data = {}
            bad.append("the click counter answered something that is not JSON")
        print("clicks:", json.dumps(data, ensure_ascii=False)[:900])

    for n in note:
        print(f"  · {n}")
    for f in bad:
        print(f"  ✗ {f}")
    print(f"\n{len(bad)} problem(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
