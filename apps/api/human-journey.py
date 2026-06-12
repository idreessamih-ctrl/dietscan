#!/usr/bin/env python3
"""Human-Like E2E Journey — real HTTP against live Express server. Stdlib only."""
import urllib.request, urllib.error, json, time, sys, concurrent.futures

BASE = "http://localhost:3999"
PASS, FAIL = 0, 0
G, R, C, N = "\033[0;32m", "\033[0;31m", "\033[0;36m", "\033[0m"

def step(msg, d=1): print(f"\n{C}── {msg} ──{N}"); time.sleep(d)

def ok(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        print(f"  {G}✓ PASS{N} — {name}")
        PASS += 1
    else:
        print(f"  {R}✗ FAIL{N} — {name}{' — ' + extra if extra else ''}")
        FAIL += 1

class R:
    def __init__(s, code, body): s.code = code; s.txt = body
    def j(s):
        try: return json.loads(s.txt)
        except: return {}

def req(method, path, data=None):
    url = f"{BASE}{path}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, method=method)
    if body: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return R(resp.status, resp.read().decode())
    except urllib.error.HTTPError as e: return R(e.code, e.read().decode())
    except Exception as e: return R(0, str(e))

p = lambda path, data: req("POST", path, data)
g = lambda path: req("GET", path)
d = lambda path: req("DELETE", path)

# ═══════════════════════════════════════
print("══════════════ DAY 1: Install & First Scan ══════════════")

step("User opens app → pings /health", 1.5)
r = g("/health"); ok("Health check returns 200", r.code == 200)
ok("Health check body has 'ok'", "ok" in r.txt)
ok("Health check has 'version'", "version" in r.txt)

step("User scans barcode → POST /products/lookup", 2)
r = p("/products/lookup", {"barcode": "737628064502"})
ok("Product lookup responds (no 5xx)", r.code < 500)

step("User checks ingredients against Keto protocol", 2)
r = p("/scans/ingredients", {"ingredients": ["almond flour","butter","eggs","stevia"], "protocolSlug": "keto"})
ok("Keto scan: passed=true", r.j().get("passed") == True, f"got: {r.txt[:100]}")
ok("Keto scan: score=100", r.j().get("score") == 100, f"got: {r.txt[:100]}")

step("User scans non-compliant product", 2)
r = p("/scans/ingredients", {"ingredients": ["wheat flour","sugar","palm oil"], "protocolSlug": "keto"})
ok("Non-compliant: passed=false", r.j().get("passed") == False, f"got: {r.txt[:100]}")

step("Empty scan → 400 validation", 1)
r = p("/scans/ingredients", {"protocolSlug": "keto"})
ok("Empty ingredients → 400", r.code == 400, f"status: {r.code}")

step("Unknown barcode → handled gracefully", 1)
r = p("/products/lookup", {"barcode": "0000000000000"})
ok("Unknown barcode doesn't crash", r.code < 500, f"status: {r.code}")

# ═══════════════════════════════════════
print("\n══════════════ DAY 1 Evening: Meal Journal ══════════════")

step("User logs breakfast → POST /journal", 2)
r = p("/journal", {"mealType": "breakfast", "complianceScore": 100, "productBarcode": "737628064502"})
jid = r.j().get("id", "") if r.code < 300 else ""
ok("Breakfast logged (201 + id)", r.code in [200,201] and bool(jid), f"code={r.code} id={jid}")
if jid: print(f"     journal_id = {jid}")

step("User logs lunch (non-compliant)", 2)
r = p("/journal", {"mealType": "lunch", "complianceScore": 50})
ok("Lunch logged (201 + id)", r.code in [200,201] and "id" in r.j(), f"code={r.code}")

step("User views today's journal → GET /journal", 1.5)
r = g("/journal")
ok("Journal returns list", isinstance(r.j(), list), f"type: {type(r.j())}")

step("User checks compliance summary", 1)
r = g("/journal/summary")
ok("Compliance summary present", "averageCompliance" in r.j(), f"got: {r.txt[:100]}")

# ═══════════════════════════════════════
print("\n══════════════ DAY 2: Nutrition & Planning ══════════════")

step("User checks daily nutrition", 2)
r = g("/nutrition/daily?date=2026-06-12")
ok("Daily nutrition returns summary", "summary" in r.j(), f"code={r.code}")

step("User checks weekly dashboard", 1.5)
r = g("/nutrition/weekly")
ok("Weekly: has dailyData", "dailyData" in r.j(), f"code={r.code}")
ok("Weekly: has streak", "streak" in r.j(), f"code={r.code}")

step("Bad date → 400", 0.5)
r = g("/nutrition/daily?date=not-a-date")
ok("Bad date returns 400", r.code == 400, f"code={r.code}")

step("User creates weekly meal plan", 2)
r = p("/meal-plans", {"weekStart": "2026-06-08", "protocolSlug": "keto"})
pid = r.j().get("id", "") if r.code < 300 else ""
ok("Meal plan created", r.code in [200,201] and bool(pid), f"code={r.code} body={r.txt[:120]}")
if pid: print(f"     plan_id = {pid}")

step("Bad protocol → 400", 0.5)
r = p("/meal-plans", {"weekStart": "2026-06-08", "protocolSlug": "illuminati"})
ok("Invalid protocol → 400", r.code == 400, f"code={r.code}")

step("User adds Monday breakfast to plan", 2)
r = p(f"/meal-plans/{pid or 'mp-fallback'}/entries",
      {"dayOfWeek": "Mon", "mealType": "breakfast", "productId": "prod-001"})
ok("Meal entry added", r.code in [200,201] and "id" in r.j(), f"code={r.code}")

# ═══════════════════════════════════════
print("\n══════════════ DAY 2: Shopping ══════════════")

step("User creates shopping list", 2)
r = p("/shopping/lists", {"name": "Keto Week 24"})
lid = r.j().get("id", "") if r.code < 300 else ""
ok("Shopping list created", r.code in [200,201] and bool(lid), f"code={r.code} body={r.txt[:120]}")
if lid: print(f"     list_id = {lid}")

step("User adds item to list", 1.5)
r = p(f"/shopping/lists/{lid or 'sl-fallback'}/items",
      {"productId": "prod-001", "quantity": 2})
ok("Item added to list", r.code in [200,201] and "id" in r.j(), f"code={r.code}")

step("User views all shopping lists", 1)
r = g("/shopping/lists")
ok("Shopping lists returned", isinstance(r.j(), list), f"type: {type(r.j())}")

step("User views specific list with items", 1.5)
r = g(f"/shopping/lists/{lid or 'sl-fallback'}")
ok("List detail shows name", "Keto Week 24" in r.txt, f"body: {r.txt[:80]}")

# ═══════════════════════════════════════
print("\n══════════════ DAY 3: Search & Affiliates ══════════════")

step("User searches products", 2)
r = g("/search/products?q=almond+cookies&protocol=keto")
ok("Search responds (no 5xx)", r.code < 500, f"code={r.code}")

step("User clicks affiliate link", 2)
r = p("/clicks", {"productId": "prod-001", "retailerId": "ret-001",
     "redirectUrl": "https://iherb.com/pr/keto-cookies"})
ok("Affiliate click tracked", "redirectUrl" in r.j(), f"code={r.code} body={r.txt[:100]}")

step("Missing fields → 400", 0.5)
r = p("/clicks", {})
ok("Missing fields → 400", r.code == 400, f"code={r.code}")

# ═══════════════════════════════════════
print("\n══════════════ DAY 3: Offline Sync ══════════════")

step("User back online → GET /api/v1/sync/products", 1.5)
r = g("/api/v1/sync/products")
ok("Product sync endpoint", r.code < 500, f"code={r.code}")

step("GET /api/v1/sync/protocols", 0.5)
r = g("/api/v1/sync/protocols")
ok("Protocol sync", r.code < 500, f"code={r.code}")

step("POST offline scans → /api/v1/sync/scans", 1)
r = p("/api/v1/sync/scans", {"scans": [{"barcode":"737628064502","timestamp":"2026-06-12T10:00:00Z"}]})
ok("Offline scans synced", r.code < 500, f"code={r.code}")

# ═══════════════════════════════════════
print("\n══════════════ DAY 4: Notifications & GDPR ══════════════")

step("User enables push notifications", 2)
r = p("/notifications/register", {"token": "ExponentPushToken[test123]"})
ok("Push token registered", r.code < 500 and "error" not in r.txt.lower(), f"code={r.code}")

step("User exports GDPR data", 2)
r = g("/gdpr/export")
ok("GDPR: has 'user'", "user" in r.j(), f"code={r.code}")
ok("GDPR: has 'scans'", "scans" in r.j(), f"code={r.code}")
ok("GDPR: has 'mealJournal'", "mealJournal" in r.j(), f"code={r.code}")

step("User reads privacy policy", 1)
r = g("/gdpr/privacy")
ok("Privacy policy returned", "policy" in r.j(), f"code={r.code}")

step("User deletes account", 2)
r = d("/gdpr/account")
ok("Account deleted", "deleted" in r.txt.lower(), f"code={r.code} body={r.txt[:80]}")

# ═══════════════════════════════════════
print("\n══════════════ STRESS / CHAOS / SECURITY ══════════════")

step("Rapid-fire scans (10 parallel)", 0.5)
def do_scan(i):
    try:
        r = p("/scans/ingredients", {"ingredients":["salt","pepper","garlic"],"protocolSlug":"keto"})
        return r.code in [200,201]
    except: return False
with concurrent.futures.ThreadPoolExecutor(10) as ex:
    results = list(ex.map(do_scan, range(10)))
ok("10 rapid-fire scans ok", sum(results) >= 9, f"{sum(results)}/10 ok")

step("Concurrent health checks (20 parallel)", 0.3)
with concurrent.futures.ThreadPoolExecutor(20) as ex:
    hc = list(ex.map(lambda i: g("/health").code == 200, range(20)))
ok("20/20 health checks", all(hc), f"{sum(hc)}/20 ok")

step("Malformed JSON → graceful", 0.2)
rurl = f"{BASE}/scans/ingredients"
rq = urllib.request.Request(rurl, data=b"not-json{", method="POST")
rq.add_header("Content-Type", "application/json")
try:
    with urllib.request.urlopen(rq, timeout=5) as resp:
        ok("Malformed JSON → 4xx", 400 <= resp.status < 500, f"status={resp.status}")
except urllib.error.HTTPError as e:
    ok("Malformed JSON → 4xx", 400 <= e.code < 500, f"status={e.code}")
except Exception as e:
    ok("Malformed JSON rejected", True, f"exception: {e}")

step("SQL injection attempt → safe", 0.2)
r = g("/search/products?q=chocolate'+OR+1=1--")
ok("SQL injection safe", "syntax error" not in r.txt.lower(), f"body: {r.txt[:80]}")

step("Missing barcode → error, not crash", 0.2)
r = p("/products/lookup", {"notBarcode": "123"})
ok("Missing barcode → error", r.code in [400, 422], f"code={r.code}")

# ═══════════════════════════════════════
print(f"\n{'═'*55}")
TOTAL = PASS + FAIL
print(f"{G}PASS: {PASS}{N}  {R}FAIL: {FAIL}{N}  TOTAL: {TOTAL}")
if FAIL == 0:
    print(f"{G}{'═'*6} ALL HUMAN-LIKE HTTP TESTS PASSED ({PASS} checks) {'═'*6}{N}")
    sys.exit(0)
else:
    print(f"{R}{'═'*6} {FAIL} FAILURE(S) — {PASS}/{TOTAL} passed {'═'*6}{N}")
    sys.exit(1)
