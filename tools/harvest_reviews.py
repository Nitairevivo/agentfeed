"""Ask every business's own site what its customers wrote there.

The private repository cannot do this: its environment has no outbound network
at all. Here the network is open and the minutes are free, because this
repository is public — the same arrangement the backlink check runs under.

It reads `api/stores.json` from this repository, which is the published
directory an assistant reads, so it needs no private data and no secrets.
Nothing is written to the site. Two files come out:

  * `reviews-harvest.json` — the candidates, raw, for the private repository to
    validate and publish. Nothing here is published by this run.
  * `reviews-report.md`    — what was found, per business, in words.

Everything it collects is something the business already published on its own
site, in a field that says "review". Google and Facebook are not read: those
reviews stay where they were earned, and `reputation.py` links the profile
instead. `reviewsrc.py`, which does the reading, is byte-for-byte the copy the
private repository tests.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import reviewsrc as S  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    try:
        directory = json.loads((ROOT / "api" / "stores.json").read_text("utf-8"))
    except (OSError, ValueError) as exc:
        print(f"could not read api/stores.json: {exc}")
        return 1

    out, lines, total = {}, [], 0
    businesses = directory.get("businesses") or []
    lines.append(f"# Reviews on the businesses' own sites\n")
    lines.append(f"{len(businesses)} businesses in the directory.\n")

    for b in businesses:
        slug, site = b.get("slug", ""), (b.get("official_site") or "").strip()
        if not slug:
            continue
        if not site.startswith("http"):
            lines.append(f"- **{slug}** — no site of its own to read.")
            continue
        host = S.origin(site)
        # A business whose "site" is a Facebook page or a map pin has no site
        # of its own, and the one thing we will not do is read reviews off
        # those. Saying so is the honest outcome, not a failure.
        if any(h in host for h in ("facebook.com", "instagram.com", "goo.gl",
                                   "google.com", "wa.me", "api.whatsapp.com")):
            lines.append(f"- **{slug}** — {host} is a platform page, not the "
                         f"business's own site. Not read.")
            continue
        try:
            found = S.harvest(site)
        except Exception as exc:                        # noqa: BLE001
            lines.append(f"- **{slug}** — could not be read today ({exc}). "
                         f"This is not 'no reviews'.")
            continue
        out[slug] = {"site": site, "candidates": found}
        total += len(found)
        if found:
            rated = sum(1 for r in found if r.get("rating"))
            lines.append(f"- **{slug}** — {len(found)} candidate(s), "
                         f"{rated} with a rating.")
        else:
            lines.append(f"- **{slug}** — nothing published as a review on "
                         f"{host}. Either there are none, or the shop keeps "
                         f"them somewhere a plain fetch does not see.")

    lines.append(f"\n**{total} candidates in total.** None of them is "
                 f"published by this run: the private repository validates "
                 f"each one against the business's own host, shortens the "
                 f"reviewer's name and refuses anything with no source page.")
    (ROOT / "reviews-harvest.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "reviews-report.md").write_text("\n".join(lines) + "\n",
                                            encoding="utf-8")
    print("\n".join(lines))
    # Also to stdout, between markers. The artifact is the file; the log is how
    # somebody without the artifact — a session that can read job logs and
    # nothing else — still gets the candidates out of here.
    print("\n----- BEGIN reviews-harvest.json -----")
    print(json.dumps(out, ensure_ascii=False))
    print("----- END reviews-harvest.json -----")
    return 0


if __name__ == "__main__":
    sys.exit(main())
