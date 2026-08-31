"""Ask a shop's website whether we could connect it, before anyone is contacted.

Most outreach is wasted on shops that cannot be connected at all, and the
question has a yes-or-no answer that costs one request. A WooCommerce store
answers with its whole catalogue size; a Shopify store answers on a different
address; anything else answers with a 404. Asking first changes what there is
to say:

    "I looked at your site — it runs WooCommerce and carries 1,847 products.
     I can have an AI page live for you this week, free."

instead of a pitch that hopes.

What this deliberately does not do is collect phone numbers. Sending an
unsolicited commercial message to a business that never asked for one is
against Israeli law and it is the opposite of the thing that makes this
project worth anything. This finds which shops are worth a personal message
from a person; sending it is still a person's job.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LEADS = ROOT / "leads.txt"
UA = "AgentFeed/0.1 (+https://github.com/Nitairevivo/agentfeed)"


def _normalise(raw: str) -> str:
    host = raw.strip().rstrip("/").strip(",")
    if not host:
        return ""
    return host if host.startswith("http") else "https://" + host


def _get(url: str, timeout: int = 25):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", errors="replace")), r.headers


def probe(base: str) -> dict:
    """One shop, two addresses, whichever answers first."""
    try:
        body, headers = _get(f"{base}/wp-json/wc/store/products?per_page=1")
        rows = body.get("products") if isinstance(body, dict) else body
        if isinstance(rows, list) and rows:
            total = headers.get("X-WP-Total")
            return {"ok": True, "platform": "WooCommerce",
                    "products": int(total) if total and total.isdigit() else None,
                    "sample": rows[0].get("name", "")}
    except Exception:                              # noqa: BLE001 — try the next one
        pass

    try:
        body, _ = _get(f"{base}/products.json?limit=1")
        rows = (body or {}).get("products") or []
        if rows:
            return {"ok": True, "platform": "Shopify", "products": None,
                    "sample": rows[0].get("title", "")}
    except urllib.error.HTTPError as exc:
        return {"ok": False, "why": f"HTTP {exc.code} — not Woo and not Shopify"}
    except Exception as exc:                       # noqa: BLE001 — reported, not hidden
        return {"ok": False, "why": f"{exc.__class__.__name__}: {exc}"}
    return {"ok": False, "why": "answered, but published no catalogue"}


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    raw = " ".join(argv) or os.environ.get("QUALIFY_DOMAINS", "")
    items = [x for x in raw.replace(",", " ").split() if x]
    if not items and LEADS.is_file():
        items = [l for l in LEADS.read_text(encoding="utf-8").splitlines()]
    domains = [_normalise(l) for l in items
               if l.strip() and not l.strip().startswith("#")]
    if not domains:
        print("No domains. Pass them as arguments or list them in tools/leads.txt.")
        return 1

    good, bad = [], []
    for base in domains:
        result = probe(base)
        host = base.split("//", 1)[-1]
        if result["ok"]:
            good.append((host, result["platform"], result["products"], result["sample"]))
            n = result["products"]
            print(f"  ✓ {host}: {result['platform']}"
                  + (f", {n} products" if n is not None else ""))
        else:
            bad.append((host, result["why"]))
            print(f"  ✗ {host}: {result['why']}")

    lines = ["## חנויות שנבדקו", "",
             f"נבדקו {len(domains)} אתרים. **ל-{len(good)} מהם אפשר לחבר קטלוג אוטומטית.**", ""]
    if good:
        lines += ["### שווה לפנות — הקטלוג נקרא מיד", "",
                  "| אתר | פלטפורמה | מוצרים | דוגמה מהקטלוג |", "|---|---|---|---|"]
        # Biggest catalogue first: a shop with more to publish has more to gain,
        # and is the more convincing first customer.
        for host, platform, size, sample in sorted(good, key=lambda r: -(r[2] or 0)):
            lines.append(f"| {host} | {platform} | {size if size is not None else '?'} "
                         f"| {sample[:44]} |")
        lines.append("")
    if bad:
        lines += ["### לא נקרא אוטומטית", "",
                  "אפשר עדיין לפנות, אבל הרישום ייכתב ביד מהתשובות של בעל העסק.", "",
                  "| אתר | למה |", "|---|---|"]
        lines += [f"| {host} | {why} |" for host, why in bad]
        lines.append("")
    lines += ["_הרשימה הזאת אומרת למי שווה לכתוב. היא לא אוספת טלפונים "
              "ולא נועדה לדיוור — הודעה מסחרית למי שלא ביקש אותה אסורה לפי "
              "חוק התקשורת, וגם שוברת בדיוק את מה שהופך את הפרויקט הזה לשווה משהו._"]

    report = "\n".join(lines)
    Path("qualify-report.md").write_text(report, encoding="utf-8")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(report)
    print(f"\n{len(good)}/{len(domains)} connectable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
