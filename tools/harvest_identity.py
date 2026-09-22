"""Ask every business's own site which profiles it links to.

The private repository cannot do this: its environment has no outbound network
at all. Here the network is open and the minutes are free, because this
repository is public — the same arrangement the backlink check runs under.

It reads `api/stores.json` from this repository, which is the published
directory an assistant reads, so it needs no private data and no secrets. One
fetch per business, of its home page. Nothing is written to the site.

Why it is worth a fetch: fifteen of the businesses here publish exactly one
identity link — their own domain. To a model meeting them for the first time
they are a name nobody has heard of, and that is one reason a cold question
returns somebody else. A footer that links the business's own Facebook is the
business saying where else it is, and `sameAs` is the field that says so in a
form an engine reads.

Nothing here is published by this run: the candidates come out as an artifact
and in the log, and the private repository validates every one of them again
before anything reaches a page.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import identitysrc as I  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

PLATFORMS = ("facebook.com", "instagram.com", "goo.gl", "google.com",
             "wa.me", "api.whatsapp.com")


def main() -> int:
    try:
        directory = json.loads((ROOT / "api" / "stores.json").read_text("utf-8"))
    except (OSError, ValueError) as exc:
        print(f"could not read api/stores.json: {exc}")
        return 1

    out, lines, total = {}, [], 0
    businesses = directory.get("businesses") or []
    lines.append("# Where else each business says it can be found\n")
    lines.append(f"{len(businesses)} businesses in the directory.\n")

    for b in businesses:
        slug, site = b.get("slug", ""), (b.get("official_site") or "").strip()
        if not slug:
            continue
        if not site.startswith("http"):
            lines.append(f"- **{slug}** — no site of its own to read.")
            continue
        host = I.origin(site)
        if any(h in host for h in PLATFORMS):
            lines.append(f"- **{slug}** — {host} is a platform page, not the "
                         f"business's own site. Not read.")
            continue
        try:
            got = I.harvest(site)
        except Exception as exc:                                # noqa: BLE001
            lines.append(f"- **{slug}** — could not be read today ({exc}). "
                         f"This is not 'no profiles'.")
            continue
        if not got.get("read"):
            lines.append(f"- **{slug}** — {host} did not answer. This is not "
                         f"'no profiles'.")
            continue
        out[slug] = {"site": site, **got}
        found = got.get("found") or {}
        total += len(found)
        if found:
            lines.append(f"- **{slug}** — " +
                         ", ".join(f"{k}: {v}" for k, v in sorted(found.items())))
        else:
            lines.append(f"- **{slug}** — links to no profile of its own on "
                         f"its home page.")
        for name, urls in sorted((got.get("ambiguous") or {}).items()):
            lines.append(f"    - ⚠ {len(urls)} different {name} accounts on "
                         f"one page — none of them published: "
                         + ", ".join(urls))

    lines.append(f"\n**{total} profile link(s) in total.** None of them is "
                 f"published by this run: the private repository checks each "
                 f"one again and refuses anything that is a share button, a "
                 f"post, or the account of whoever built the site.")
    (ROOT / "identity-harvest.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "identity-report.md").write_text("\n".join(lines) + "\n",
                                             encoding="utf-8")
    print("\n".join(lines))
    # Also to stdout, between markers, for a session that can read job logs and
    # nothing else.
    print("\n----- BEGIN identity-harvest.json -----")
    print(json.dumps(out, ensure_ascii=False))
    print("----- END identity-harvest.json -----")
    return 0


if __name__ == "__main__":
    sys.exit(main())
