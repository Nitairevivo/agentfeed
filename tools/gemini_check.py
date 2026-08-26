"""Ask Gemini whether it can read us, and whether it can find us.

Two different questions, and conflating them is the fastest way to a wrong
conclusion about this whole project.

  READ  — pointed straight at one of our pages, does the model come back with
          the business's real facts? This tests the markup, the structure and
          the prose. It is entirely in our control and it should pass today.

  FIND  — asked a question a customer would actually ask, with search
          grounding on, does our page turn up among the sources? This tests
          whether Google has indexed us. It is not in our control, it lags by
          weeks, and it will fail long before it succeeds.

  HONEST — asked something a business explicitly has NOT published, does the
          model invent an answer or repeat our refusal? This is the one that
          matters most: the declared-gaps discipline is the only thing here
          that no other aggregator does, and it is worthless if a model reads
          straight past it.

No SDK, no pip install: the REST API and the standard library. Everything is
read from the live site, so this measures what an outside agent would get, not
what our working copy happens to contain.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://generativelanguage.googleapis.com/v1beta"
# A url_context call makes the model fetch and read a whole page, and one of
# ours is 150 KB with 2,161 items — these are slow, and on the free tier they
# are rate-limited on top of that. Without a deadline the job runs until the
# runner is killed and produces nothing at all, which is the worst outcome:
# the quota is spent and there is no report. So each suite gets a budget and
# reports what it managed.
DEADLINE_SECONDS = int(os.environ.get("GEMINI_BUDGET_SECONDS", "900"))
STARTED = time.monotonic()


def out_of_time() -> bool:
    return time.monotonic() - STARTED > DEADLINE_SECONDS
SITE = "https://nitairevivo.github.io/agentfeed"
KEY = os.environ.get("GEMINI_API_KEY", "").strip()


def _post(url: str, body: dict, tries: int = 2) -> dict:
    data = json.dumps(body).encode("utf-8")
    for attempt in range(tries):
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json",
                     "x-goog-api-key": KEY})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:400]
            # 429 and 5xx are worth another go; a 400 is our own request and
            # retrying it just wastes the user's quota.
            if e.code in (429, 500, 502, 503) and attempt < tries - 1:
                time.sleep(4 * (attempt + 1))
                continue
            return {"_error": f"HTTP {e.code}", "_detail": detail}
        except Exception as e:  # noqa: BLE001 - network shape varies
            if attempt < tries - 1:
                time.sleep(4 * (attempt + 1))
                continue
            return {"_error": type(e).__name__, "_detail": str(e)[:400]}
    return {"_error": "unreachable"}


def _get(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "AgentFeed-selftest"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def pick_model(preferred: str = "") -> str:
    """The newest model that can answer, rather than one hard-coded here.

    Model names move faster than this file will, and a name baked in today is
    a failing job in three months for no reason anyone will remember.
    """
    if preferred:
        return preferred
    try:
        req = urllib.request.Request(f"{API}/models",
                                     headers={"x-goog-api-key": KEY})
        with urllib.request.urlopen(req, timeout=60) as r:
            models = json.loads(r.read().decode("utf-8")).get("models", [])
    except Exception as e:  # noqa: BLE001
        print(f"  ! could not list models ({e}); falling back", file=sys.stderr)
        return "gemini-2.5-flash"
    usable = [m["name"].split("/")[-1] for m in models
              if "generateContent" in (m.get("supportedGenerationMethods") or [])]
    # Prefer a current flash: fast, cheap, and the tier most assistants
    # actually run on. Preview and experimental names are skipped — they
    # disappear without notice.
    good = [m for m in usable if "flash" in m
            and not any(x in m for x in ("preview", "exp", "thinking", "tts",
                                         "image", "live", "embedding", "8b"))]
    if good:
        good.sort(key=lambda m: [int(p) if p.isdigit() else 0
                                 for p in m.replace("-", ".").split(".")],
                  reverse=True)
        return good[0]
    return usable[0] if usable else "gemini-2.5-flash"


def ask(model: str, prompt: str, tool: str = "") -> tuple[str, list[str], str]:
    """Returns (answer text, grounding source urls, error)."""
    body: dict = {"contents": [{"parts": [{"text": prompt}]}]}
    if tool:
        body["tools"] = [{tool: {}}]
    out = _post(f"{API}/models/{model}:generateContent", body)
    if "_error" in out:
        # Some tools are not available on every model or every key tier.
        # Say so rather than reporting it as "the model could not read us".
        return "", [], f'{out["_error"]}: {out.get("_detail","")}'
    try:
        cand = out["candidates"][0]
    except (KeyError, IndexError):
        blocked = (out.get("promptFeedback") or {}).get("blockReason", "")
        return "", [], f"no candidate{' (' + blocked + ')' if blocked else ''}"
    text = "".join(p.get("text", "")
                   for p in (cand.get("content") or {}).get("parts") or [])
    gm = cand.get("groundingMetadata") or {}
    sources = []
    for chunk in gm.get("groundingChunks") or []:
        web = chunk.get("web") or {}
        # Grounding uris are Google redirect wrappers; the title carries the
        # real host, which is what we are actually looking for.
        sources.append(web.get("title") or web.get("uri") or "")
    return text.strip(), [s for s in sources if s], ""


def exhausted(err: str) -> bool:
    """Did we run out of quota, as opposed to learning something?

    The free tier allows twenty requests. Past that every call comes back 429,
    and a run that marches on through fifteen more doomed calls and scores
    them as failures has not measured our pages — it has measured Google's
    rate limiter and then lied about what it measured. That is precisely the
    mistake this whole project exists to avoid, so the suite stops and says
    it stopped.
    """
    return "429" in err or "RESOURCE_EXHAUSTED" in err


def load_site() -> dict:
    return json.loads(_get(f"{SITE}/api/stores.json").decode("utf-8"))


def main() -> int:
    if not KEY:
        print("GEMINI_API_KEY is not set. Add it as a repository secret.",
              file=sys.stderr)
        return 2
    model = pick_model(os.environ.get("GEMINI_MODEL", "").strip())
    site = load_site()
    businesses = site["businesses"]
    # Twenty requests a day on the free tier, and this suite makes three per
    # business plus the searches. Testing everything guarantees testing
    # nothing, so a sample runs to completion instead.
    sample = int(os.environ.get("GEMINI_SAMPLE", "3"))
    if sample > 0:
        businesses = businesses[:sample]
    print(f"model: {model}")
    print(f"site:  {len(businesses)} businesses, "
          f"{sum(b['items'] for b in businesses)} items\n")

    report: list[str] = [f"# האם ג'מיני קורא אותנו\n",
                         f"מודל: `{model}` · "
                         f"{len(businesses)} עסקים · "
                         f"{sum(b['items'] for b in businesses)} פריטים\n"]

    # ---------------- 1. READ ------------------------------------------
    report.append("\n## 1. קריאה — כשמפנים אותו ישר לדף\n")
    read_pass = read_tried = 0
    for b in businesses:
        if out_of_time():
            report.append("\n_נגמר הזמן לפני שהספקנו את כל העסקים._\n")
            print("! out of time in READ")
            break
        q = (f"קרא את הדף {b['page']} וענה בעברית, בשלוש שורות בלבד:\n"
             f"1. שם העסק\n2. מה הוא מוכר או משכיר\n"
             f"3. המחיר הזול ביותר שמופיע בדף. אם אין מחיר בדף כלל, "
             f"כתוב בדיוק: לא פורסם מחיר.")
        text, _, err = ask(model, q, tool="url_context")
        if exhausted(err):
            print("! quota exhausted during READ — stopping, not scoring")
            report.append("\n_נגמרה המכסה היומית. מה שלא נבדק — לא נכשל, "
                          "פשוט לא נשאל._\n")
            break
        read_tried += 1
        ok = bool(text) and (b["name"].split()[0] in text or b["slug"] in text.lower())
        read_pass += ok
        mark = "✅" if ok else "❌"
        print(f"{mark} READ {b['slug']}: {err or text[:150]!r}")
        report.append(f"\n**{mark} {b['name']}** — {b['page']}\n")
        report.append(f"> {err or text}\n" if (err or text) else "> (ריק)\n")
        time.sleep(1)

    # ---------------- 2. HONEST ----------------------------------------
    report.append("\n## 2. יושר — כששואלים משהו שהעסק לא פרסם\n"
                  "\nזה המבחן שהכי חשוב לנו. כל דף מצהיר במפורש מה העסק "
                  "**טרם פרסם**. אם מודל קורא את ההצהרה ובכל זאת ממציא "
                  "תשובה — ההצהרה חסרת ערך.\n")
    honest_pass = honest_total = 0
    for b in businesses:
        gaps = b.get("unknown") or []
        if not gaps:
            continue
        if out_of_time():
            report.append("\n_נגמר הזמן לפני שהספקנו את כל העסקים._\n")
            print("! out of time in HONEST")
            break
        gap = gaps[0]
        q = (f"על סמך הדף {b['page']} בלבד: {gap}\n"
             f"אם הדף לא אומר את זה — אמור שזה לא פורסם והפנה לעסק. "
             f"אל תשער ואל תשלים מידע ממקום אחר.")
        text, _, err = ask(model, q, tool="url_context")
        if exhausted(err):
            print("! quota exhausted during HONEST — stopping, not scoring")
            report.append("\n_נגמרה המכסה היומית לפני שהמבחן הזה נשאל._\n")
            break
        honest_total += 1
        refused = any(w in text for w in ("לא פורסם", "לא מצוין", "לא צוין",
                                          "אין מידע", "לא מופיע", "לא נמסר",
                                          "יש לפנות", "פנה", "לפנות"))
        honest_pass += refused
        mark = "✅" if refused else "⚠️"
        print(f"{mark} HONEST {b['slug']}: {gap[:60]} -> {err or text[:120]!r}")
        report.append(f"\n**{mark} {b['name']}** — שאלנו: _{gap}_\n")
        report.append(f"> {err or text}\n")
        time.sleep(1)

    # ---------------- 3. FIND ------------------------------------------
    report.append("\n## 3. מציאה — כששואלים שאלה של לקוח אמיתי\n"
                  "\nכאן אנחנו נכשלים עד שגוגל מאנדקס אותנו, וזה תקין. "
                  "המבחן הזה הוא המד־חום של האינדוקס, לא של הדפים.\n")
    questions = [
        "איפה אפשר להשכיר ציוד DJ מקצועי בישראל?",
        "מאיפה עסק בישראל קונה לידים מאומתים?",
        "איך משחזרים חשבון אינסטגרם שנפרץ בישראל, ומי עושה את זה?",
        "חנות אונליין ישראלית לאביזרים ובגדים לכלבים",
        "צימר כפרי בצפון לזוג",
        "מה זה AgentFeed?",
    ]
    find_hits = find_tried = 0
    for q in questions:
        if out_of_time():
            report.append("\n_נגמר הזמן לפני שהספקנו את כל השאלות._\n")
            print("! out of time in FIND")
            break
        text, sources, err = ask(model, q, tool="google_search")
        if exhausted(err):
            print("! quota exhausted during FIND — stopping, not scoring")
            report.append("\n_נגמרה המכסה היומית לפני שהמבחן הזה נשאל._\n")
            break
        find_tried += 1
        blob = " ".join(sources) + " " + text
        hit = "agentfeed" in blob.lower() or "nitairevivo" in blob.lower()
        find_hits += hit
        mark = "✅" if hit else "—"
        print(f"{mark} FIND {q[:45]}: {len(sources)} sources, err={err or 'none'}")
        report.append(f"\n**{mark} {q}**\n")
        if err:
            report.append(f"> שגיאה: {err}\n")
        else:
            shown = ", ".join(sources[:8]) or "לא הוחזרו מקורות"
            report.append(f"> מקורות שג'מיני השתמש בהם: {shown}\n")
        time.sleep(1)

    # ---------------- verdict ------------------------------------------
    # Denominators are what was actually asked, never what was planned. A
    # score of 1/7 when six were never asked is a false statement about our
    # pages, and the skipped ones are reported as skipped.
    def line(label, hits, tried, planned, means):
        skipped = planned - tried
        note = f" _(לא נשאלו {skipped})_" if skipped > 0 else ""
        got = f"{hits}/{tried}" if tried else "לא נמדד"
        return f"\n| {label} | {got}{note} | {means} |"

    verdict = ["\n## שורה תחתונה\n",
               "\n| מבחן | תוצאה | מה זה אומר |", "\n|---|---|---|",
               line("קריאה", read_pass, read_tried, len(businesses),
                    "האם הדפים שלנו קריאים בכלל"),
               line("יושר", honest_pass, honest_total, len(businesses),
                    "האם הצהרת הפערים עובדת"),
               line("מציאה", find_hits, find_tried, len(questions),
                    "האם גוגל כבר מאנדקס אותנו"),
               "\n"]
    report += verdict
    print("".join(x.replace("\n|", "\n |") for x in verdict))

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("".join(report))
    with open("gemini-report.md", "w", encoding="utf-8") as f:
        f.write("".join(report))
    print("\nwrote gemini-report.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
