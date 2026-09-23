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

    # sitemap-core.xml is in here because Search Console showed "could not
    # fetch" against the full sitemap for eight days and nothing on our side
    # would have said so: the file is built, audited and published, and none
    # of those steps asks whether the address actually answers. A sitemap an
    # engine cannot read is the same as no sitemap, and it fails silently.
    for f in ("robots.txt", "sitemap.xml", "sitemap-core.xml", "llms.txt"):
        code, body = get(f"{SITE}/{f}")
        print(f"{f}: {code} ({len(body)} bytes)")
        if code != 200:
            bad.append(f"{f} answers {code}")
        elif f.endswith(".xml") and "<urlset" not in body:
            bad.append(f"{f} answers 200 but is not a sitemap — no <urlset>")
        elif f.endswith(".xml"):
            print(f"  {f}: {body.count('<loc>')} urls")

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
        # Printed in full, and in the shape the question is asked in.
        #
        # 900 characters of raw JSON was fine while the counter held three
        # numbers. It now holds five shelves, and the one question worth
        # asking of it — are these clicks people, a crawler, or an assistant —
        # is answered by the tables that were being cut off: who the clicks
        # came from, who read us by name, and whether arrivals moved on the
        # same days the clicks did. This is the only place in the project that
        # can reach the counter at all, so it is where that has to be legible.
        # Which fields the *deployed* counter actually returns.
        #
        # A field added here and never deployed is indistinguishable from a
        # field that is deployed and empty: both print {}. That gap already
        # cost a day once, when every arrival ping 404ed and the report looked
        # healthy. Presence is printed separately from contents, so "is the
        # code I wrote the code that is running" has an answer.
        top = ("businesses", "sources", "clients", "countries", "ours",
               "source_coverage", "intents")
        arr = data.get("arrivals") or {}
        print("  fields: " + " ".join(
            f"{k}={'yes' if k in data else 'MISSING'}" for k in top)
            + " | arrivals.countries="
            + ("yes" if "countries" in arr else "MISSING"))
        biz = data.get("businesses") or {}
        tot = lambda k: sum((b.get(k) or 0) for b in biz.values())
        print("\nCOUNTER")
        print(f"  clicks {tot('clicks')} · rendered {tot('rendered')} · "
              f"on_item {tot('on_item')} · carts {tot('carts')} · "
              f"enquiries {tot('enquiries')}")
        for slug, b in sorted(biz.items(), key=lambda kv: -(kv[1].get("clicks") or 0)):
            print(f"    {slug}: " + " ".join(
                f"{k}={b.get(k) or 0}" for k in
                ("clicks", "rendered", "on_item", "carts", "enquiries", "coded")))
        print("  sources: " + json.dumps(data.get("sources") or {},
                                         ensure_ascii=False))
        print("  coverage: " + json.dumps(data.get("source_coverage") or {},
                                          ensure_ascii=False))
        # Which kind of client pressed the link — browser family, and whether
        # the request carried the headers a real navigation sends. An empty
        # table here means the deployed counter predates the field, not that
        # nobody clicked.
        print("  clients: " + json.dumps(data.get("clients") or {},
                                         ensure_ascii=False))
        # The plainest answer to "where do they come from", and the one the
        # referrer could never give.
        print("  countries: " + json.dumps(data.get("countries") or {},
                                           ensure_ascii=False))
        arr = data.get("arrivals") or {}
        print("  arrivals.views: " + json.dumps(arr.get("views") or {},
                                                ensure_ascii=False))
        print("  arrivals.sources: " + json.dumps(arr.get("sources") or {},
                                                  ensure_ascii=False))
        print("  arrivals.countries: " + json.dumps(arr.get("countries") or {},
                                                    ensure_ascii=False))
        print("  arrivals.days: " + json.dumps(arr.get("days") or {},
                                               ensure_ascii=False))
        ag = data.get("agents") or {}
        print("  agents.names: " + json.dumps(ag.get("names") or {},
                                              ensure_ascii=False))
        print("  agents.businesses: " + json.dumps(ag.get("businesses") or {},
                                                  ensure_ascii=False))
        print("  agents.seen: " + json.dumps(ag.get("seen") or {},
                                             ensure_ascii=False))
        print("  agents.surfaces: " + json.dumps(ag.get("surfaces") or {},
                                                 ensure_ascii=False))
        print("  agents.tools: " + json.dumps(ag.get("tools") or {},
                                              ensure_ascii=False))
        print("  agents.days: " + json.dumps(ag.get("days") or {},
                                             ensure_ascii=False))
        # Distinct visitors per business per day: the clearest picture of
        # whether a spike is many people or one thing coming back.
        print("  visitors.days: " + json.dumps(data.get("days") or {},
                                               ensure_ascii=False))

    for n in note:
        print(f"  · {n}")
    for f in bad:
        print(f"  ✗ {f}")
    print(f"\n{len(bad)} problem(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
