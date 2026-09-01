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
import re
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


def pick_models(preferred: str = "") -> list[str]:
    """The models that can answer, best first, rather than one name.

    Model names move faster than this file will, and a name baked in today is
    a failing job in three months for no reason anyone will remember. A list
    rather than a single name because the newest flash is also the busiest:
    a run that picks one model and meets a wall of 503s has measured Google's
    capacity that minute and nothing about our pages.
    """
    if preferred:
        return [preferred]
    try:
        req = urllib.request.Request(f"{API}/models",
                                     headers={"x-goog-api-key": KEY})
        with urllib.request.urlopen(req, timeout=60) as r:
            models = json.loads(r.read().decode("utf-8")).get("models", [])
    except Exception as e:  # noqa: BLE001
        print(f"  ! could not list models ({e}); falling back", file=sys.stderr)
        return ["gemini-2.5-flash"]
    usable = [m["name"].split("/")[-1] for m in models
              if "generateContent" in (m.get("supportedGenerationMethods") or [])]
    # Prefer a current flash: fast, cheap, and the tier most assistants
    # actually run on. Preview and experimental names are skipped — they
    # disappear without notice.
    good = [m for m in usable if "flash" in m
            and not any(x in m for x in ("preview", "exp", "thinking", "tts",
                                         "image", "live", "embedding", "8b"))]
    good.sort(key=lambda m: [int(p) if p.isdigit() else 0
                             for p in m.replace("-", ".").split(".")],
              reverse=True)
    return good or usable[:1] or ["gemini-2.5-flash"]


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


def _http_code(err: str) -> int:
    """The status in 'HTTP 503: {...}', or 0 for a transport failure."""
    m = re.match(r"HTTP (\d{3})", err)
    return int(m.group(1)) if m else 0


def unanswered(err: str) -> bool:
    """Did the question never get an answer, as opposed to a wrong one?

    Any error at all means the model never spoke: a 429 from the rate
    limiter, a 503 from an overloaded model, a read timeout, a malformed
    request of ours. None of those is a fact about the page we pointed at,
    and scoring them as failures produces a number that reads as "our pages
    are unreadable" when the truth is "we never got to ask". A run that does
    that has measured Google's weather and then lied about what it measured,
    which is precisely the mistake this whole project exists to avoid.

    So an unanswered question is counted as unasked and named as such.
    """
    return bool(err)


def out_of_quota(err: str) -> bool:
    """Past the free tier's twenty requests every further call is doomed."""
    return _http_code(err) == 429 or "RESOURCE_EXHAUSTED" in err


class Asker:
    """Asks, rotating away from a model that is refusing to answer.

    A wall of 503s from one model is not a result. After three unanswered
    calls in a row it moves to the next model and starts the count again;
    when the list runs out it says so and stops, rather than spending the
    remaining minutes collecting zeros.
    """

    LIMIT = 3

    def __init__(self, models: list[str]) -> None:
        self.models = models
        self.i = 0
        self.misses = 0
        self.dead = False

    @property
    def model(self) -> str:
        return self.models[self.i]

    def ask(self, prompt: str, tool: str = "") -> tuple[str, list[str], str]:
        if self.dead:
            return "", [], "no model answering"
        text, sources, err = ask(self.model, prompt, tool)
        if not unanswered(err):
            self.misses = 0
            return text, sources, err
        if out_of_quota(err):
            return text, sources, err          # the caller stops the run
        self.misses += 1
        if self.misses >= self.LIMIT:
            if self.i + 1 < len(self.models):
                self.i += 1
                self.misses = 0
                print(f"  ! switching to {self.model} after "
                      f"{self.LIMIT} unanswered calls")
            else:
                self.dead = True
                print("  ! every model tried is refusing to answer; stopping")
        return text, sources, err


def as_question(gap: str) -> str:
    """The subject of a declared gap, without our own answer attached to it.

    A gap reads "מחיר לליד — לא פורסם באתר, בשום תחום": a subject, then why we
    cannot fill it. Handing that whole line to a model and asking it to
    respond tests nothing. The model reads our sentence, agrees with our
    sentence, and scores a pass — while a customer, who asks "how much is a
    lead" and never sees our phrasing, might still be handed an invented
    number. Only the subject is asked about.
    """
    for dash in ("—", " - ", "–", ":"):
        if dash in gap:
            gap = gap.split(dash)[0]
            break
    return gap.strip().strip("⚠").strip()


def why_429(err: str) -> str:
    """What Google actually said, when a 429 might not mean what we assume.

    A spent daily allowance and a tool the key may not use at all return the
    same status. Reading every 429 as the first cost three days of concluding
    "come back tomorrow" about a suite that had never once run. The reply
    names the limit it hit; print it.
    """
    detail = err.split(":", 1)[1].strip() if ":" in err else err
    for line in detail.splitlines():
        line = line.strip().strip(',')
        if any(k in line for k in ('"message"', '"quotaId"', '"quotaMetric"',
                                   '"quotaValue"', '"reason"')):
            return line[:200]
    return detail[:200]


# A refusal in Hebrew is not one phrase. The suite has now scored a correct
# answer as a failure twice, both times over a form of the same verb: the
# model wrote "העסק לא פרסם מחירון" and the matcher was looking for the
# passive "לא פורסם". One letter.
DECLINES = ("לא פורסם", "לא פרסם", "לא פרסמה", "לא מפרסם", "לא מפרסמת",
            "אינו מפרסם", "אינה מפרסמת", "טרם פרסם", "טרם פורסם",
            "לא מצוין", "לא צוין", "לא מוזכר", "לא מופיע", "אין מידע",
            "לא נמסר", "לא ידוע", "יש לפנות", "לפנות", "נקבע מול",
            "בהתאם ללקוח", "הצעת מחיר")

# The prices this site publishes, so an answer can be checked against them.
_MONEY = re.compile(r"(\d[\d,.]*)\s*(?:₪|ש\"?ח|שקל)|(?:₪|ש\"?ח)\s*(\d[\d,.]*)")


def declines(text: str) -> bool:
    """Does the answer decline to state the fact, in any of its phrasings."""
    return any(w in text for w in DECLINES)


def invents_a_figure(text: str, gap: str) -> bool:
    """Did it name a sum for something the business never priced?

    Stronger than looking for a refusal, and the thing that actually matters:
    a shopper is harmed by an invented number, not by a missing sentence. If
    the gap is about price and the reply carries a figure in shekels, the
    model filled the silence — whatever else it said around it.
    """
    if not any(w in gap for w in ("מחיר", "עלות", "תמחור", "כמה עולה")):
        return False
    return bool(_MONEY.search(text))


def load_site() -> dict:
    return json.loads(_get(f"{SITE}/api/stores.json").decode("utf-8"))


def main() -> int:
    if not KEY:
        print("GEMINI_API_KEY is not set. Add it as a repository secret.",
              file=sys.stderr)
        return 2
    models = pick_models(os.environ.get("GEMINI_MODEL", "").strip())
    asker = Asker(models)
    site = load_site()
    businesses = site["businesses"]
    # Twenty requests a day on the free tier, and this suite makes three per
    # business plus the searches. Testing everything guarantees testing
    # nothing, so a sample runs to completion instead.
    # Twenty calls a day does not cover three suites, and the one that always
    # loses is FIND: it runs last, so the quota is gone before it is reached,
    # every time. It is also the only suite we cannot see any other way. READ
    # and HONEST test markup we can read ourselves; FIND measures whether
    # Google has indexed us at all. So a run can spend the day on one suite.
    only = (os.environ.get("GEMINI_ONLY", "") or "all").strip().lower()
    if only not in ("all", "read", "honest", "find"):
        print(f"GEMINI_ONLY={only!r}: expected all, read, honest or find",
              file=sys.stderr)
        return 2
    sample = int(os.environ.get("GEMINI_SAMPLE", "3"))
    if sample > 0:
        businesses = businesses[:sample]
    print(f"models: {', '.join(models[:3])}")
    print(f"suites: {only}")
    print(f"site:  {len(businesses)} businesses, "
          f"{sum(b['items'] for b in businesses)} items\n")

    report: list[str] = [f"# האם ג'מיני קורא אותנו\n",
                         f"מודל: `{models[0]}` · "
                         f"{len(businesses)} עסקים · "
                         f"{sum(b['items'] for b in businesses)} פריטים\n"]

    # ---------------- 1. READ ------------------------------------------
    report.append("\n## 1. קריאה — כשמפנים אותו ישר לדף\n")
    read_pass = read_tried = read_silent = 0
    for b in (businesses if only in ("all", "read") else []):
        if out_of_time():
            report.append("\n_נגמר הזמן לפני שהספקנו את כל העסקים._\n")
            print("! out of time in READ")
            break
        q = (f"קרא את הדף {b['page']} וענה בעברית, בשלוש שורות בלבד:\n"
             f"1. שם העסק\n2. מה הוא מוכר או משכיר\n"
             f"3. המחיר הזול ביותר שמופיע בדף. אם אין מחיר בדף כלל, "
             f"כתוב בדיוק: לא פורסם מחיר.")
        text, _, err = asker.ask(q, tool="url_context")
        if out_of_quota(err):
            print(f"! 429 during READ — stopping, not scoring")
            print(f"  google said: {why_429(err)}")
            report.append("\n_התקבל 429 מגוגל. מה שלא נבדק — לא נכשל, "
                          f"פשוט לא נשאל. מה שגוגל אמר: `{why_429(err)}`_\n")
            break
        if unanswered(err):
            read_silent += 1
            print(f"· READ {b['slug']}: no answer ({err[:60]})")
            report.append(f"\n**· {b['name']}** — {b['page']}\n"
                          f"> לא התקבלה תשובה: {err}\n")
            if asker.dead:
                break
            continue
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
    honest_pass = honest_total = honest_silent = 0
    for b in (businesses if only in ("all", "honest") else []):
        gaps = b.get("unknown") or []
        if not gaps:
            continue
        if out_of_time():
            report.append("\n_נגמר הזמן לפני שהספקנו את כל העסקים._\n")
            print("! out of time in HONEST")
            break
        # A contradiction we flagged is not something a shopper asks about,
        # and it states both sides of the answer inside itself. Prefer a plain
        # gap; fall back only if a business declared nothing else.
        gap = next((g for g in gaps if not g.lstrip().startswith("⚠")), gaps[0])
        topic = as_question(gap)
        q = (f"אתה עוזר קניות. קרא את הדף {b['page']} וענה ללקוח ששואל "
             f"על {topic} אצל {b['name']}.\n"
             f"ענה ללקוח במשפט או שניים כמו בשיחה. "
             f"אם הדף לא אומר את זה — אמור שהעסק לא פרסם את זה והפנה אליו. "
             f"אל תשער, אל תשלים מידע ממקום אחר, "
             f"ואל תצטט את רשימת מה שהעסק טרם פרסם — פשוט ענה.")
        text, _, err = asker.ask(q, tool="url_context")
        if out_of_quota(err):
            print(f"! 429 during HONEST — stopping, not scoring")
            print(f"  google said: {why_429(err)}")
            report.append("\n_התקבל 429 מגוגל לפני שהמבחן הזה נשאל. "
                          f"מה שגוגל אמר: `{why_429(err)}`_\n")
            break
        if unanswered(err):
            honest_silent += 1
            print(f"· HONEST {b['slug']}: no answer ({err[:60]})")
            report.append(f"\n**· {b['name']}** — לא התקבלה תשובה: {err}\n")
            if asker.dead:
                break
            continue
        honest_total += 1
        refused = declines(text)
        # Reciting our own disclosure back at us is not answering a customer,
        # and scoring it as a pass would let the suite grade its own prompt.
        recited = any(w in text for w in ("מה העסק טרם פרסם", "תחת החלק",
                                          "תחת הסעיף", "המידע שציינת"))
        invented = invents_a_figure(text, gap)
        ok = refused and not recited and not invented
        honest_pass += ok
        mark = "✅" if ok else ("💰" if invented else "📋" if recited else "⚠️")
        print(f"{mark} HONEST {b['slug']}: {gap[:60]} -> {err or text[:120]!r}")
        report.append(f"\n**{mark} {b['name']}** — שאלנו על: _{topic}_\n")
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
    find_hits = find_tried = find_silent = 0
    for q in (questions if only in ("all", "find") else []):
        if out_of_time():
            report.append("\n_נגמר הזמן לפני שהספקנו את כל השאלות._\n")
            print("! out of time in FIND")
            break
        text, sources, err = asker.ask(q, tool="google_search")
        if out_of_quota(err):
            print(f"! 429 during FIND — stopping, not scoring")
            print(f"  google said: {why_429(err)}")
            # A 429 on the very first grounded question, when ungrounded
            # questions in the same run went through, is not a spent
            # allowance. Live search grounding carries its own entitlement and
            # a free key may not have it at all — the two are indistinguishable
            # by status code, and reading it as the daily quota costs a day
            # every time, because tomorrow it says the same thing.
            if find_tried == 0:
                print("  first grounded call of the run. Live search "
                      "grounding has its own entitlement, and a key without "
                      "it answers exactly like this — every day. Measure FIND "
                      "by hand in the Gemini app until the key has it.")
                report.append(
                    "\n_מבחן זה נכשל על הקריאה הראשונה, לפני שנשאלה שאלה "
                    "אחת. חיפוש חי דרך ה-API הוא הרשאה נפרדת, ומפתח שאין לו "
                    "אותה עונה בדיוק כך בכל יום. עד שתהיה הרשאה — המדידה "
                    "נעשית ידנית באפליקציית Gemini._\n")
            report.append("\n_התקבל 429 מגוגל לפני שהמבחן הזה נשאל. "
                          f"מה שגוגל אמר: `{why_429(err)}`_\n")
            break
        if unanswered(err):
            find_silent += 1
            print(f"· FIND {q[:40]}: no answer ({err[:60]})")
            report.append(f"\n**· {q}**\n> לא התקבלה תשובה: {err}\n")
            if asker.dead:
                break
            continue
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
    def line(label, hits, tried, silent, planned, means):
        skipped = planned - tried - silent
        notes = []
        if silent > 0:
            notes.append(f"{silent} ללא מענה מהמודל")
        if skipped > 0:
            notes.append(f"{skipped} לא נשאלו")
        note = f" _({', '.join(notes)})_" if notes else ""
        got = f"{hits}/{tried}" if tried else "לא נמדד"
        return f"\n| {label} | {got}{note} | {means} |"

    verdict = ["\n## שורה תחתונה\n",
               "\n| מבחן | תוצאה | מה זה אומר |", "\n|---|---|---|",
               line("קריאה", read_pass, read_tried, read_silent,
                    len(businesses), "האם הדפים שלנו קריאים בכלל"),
               line("יושר", honest_pass, honest_total, honest_silent,
                    len(businesses), "האם הצהרת הפערים עובדת"),
               line("מציאה", find_hits, find_tried, find_silent,
                    len(questions), "האם גוגל כבר מאנדקס אותנו"),
               "\n"]
    if read_silent or honest_silent or find_silent:
        verdict.append(
            "\n_שאלה שהמודל לא ענה עליה אינה כישלון של הדף. היא נספרת "
            "בנפרד ואינה נכנסת לציון._\n")
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
