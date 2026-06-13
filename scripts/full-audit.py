#!/usr/bin/env python3
"""Full site audit: SEO standards, agentic surfaces and AI indexing.

Usage: python3 scripts/full-audit.py [base_url]
Defaults to http://localhost:3784. Run against production after deploys.
"""
import json
import re
import sys
import urllib.request
from html.parser import HTMLParser

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3784"
FAILS, WARNS = [], []


def fetch(path, binary=False):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "NetifyAudit/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read() if binary else r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)


class Extractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.in_title = False
        self.metas = {}
        self.canonical = None
        self.h1 = []
        self.in_h1 = None
        self.jsonld = []
        self.in_ld = False
        self.links = []
        self.buf = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "meta" and a.get("name"):
            self.metas[a["name"]] = a.get("content", "")
        if tag == "meta" and a.get("property"):
            self.metas[a["property"]] = a.get("content", "")
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        if tag == "h1":
            self.in_h1 = a.get("id", "")
        if tag == "script" and a.get("type") == "application/ld+json":
            self.in_ld = True
            self.buf = ""
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "h1":
            self.in_h1 = None
        if tag == "script" and self.in_ld:
            self.in_ld = False
            self.jsonld.append(self.buf)

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_h1 is not None:
            self.h1.append((self.in_h1, data))
        if self.in_ld:
            self.buf += data


def audit_page(path, expect_h1_id=True):
    status, html = fetch(path)
    if status != 200:
        FAILS.append(f"{path}: HTTP {status}")
        return None
    ex = Extractor()
    ex.feed(html)
    t = len(ex.title)
    if not 30 <= t <= 70:
        WARNS.append(f"{path}: title length {t} ('{ex.title[:60]}')")
    d = len(ex.metas.get("description", ""))
    if not 70 <= d <= 165:
        WARNS.append(f"{path}: description length {d}")
    if not ex.canonical:
        FAILS.append(f"{path}: canonical missing")
    if "og:title" not in ex.metas:
        FAILS.append(f"{path}: og:title missing")
    if ex.metas.get("og:locale") not in ("en_GB", None) and "og:locale" in ex.metas:
        WARNS.append(f"{path}: og:locale {ex.metas.get('og:locale')}")
    if expect_h1_id and not any(hid == "page-h1" for hid, _ in ex.h1):
        WARNS.append(f"{path}: h1 lacks id=page-h1")
    if len(set(h for h, _ in ex.h1)) > 1 and len(ex.h1) > 4:
        WARNS.append(f"{path}: multiple h1 elements")
    types = []
    for raw in ex.jsonld:
        try:
            types.append(json.loads(raw).get("@type"))
        except Exception:
            FAILS.append(f"{path}: JSON-LD parse error")
    return {"links": ex.links, "ld": types, "html": html}


# 1. Sitemap drives the crawl
status, sm = fetch("/sitemap.xml")
assert status == 200, "sitemap unreachable"
urls = re.findall(r"<loc>([^<]+)</loc>", sm)
paths = [re.sub(r"^https?://[^/]+", "", u) or "/" for u in urls]
print(f"Sitemap URLs: {len(paths)}")

ld_expect = {
    "/shortlist": {"WebApplication", "Dataset", "FAQPage", "BreadcrumbList"},
    "/best/": {"ItemList", "Article", "FAQPage", "Person"},
    "/alternatives/": {"ItemList", "FAQPage"},
    "/compare/": {"Article", "FAQPage"},
    "/vendors/": {"FAQPage", "WebPage"},
}

all_links = set()
for p in paths:
    res = audit_page(p)
    if not res:
        continue
    for prefix, expected in ld_expect.items():
        if p.startswith(prefix) and p != "/vendors":
            missing = expected - set(res["ld"])
            if missing:
                FAILS.append(f"{p}: JSON-LD missing {sorted(missing)}")
            break
    for href in res["links"]:
        if href.startswith("/"):
            all_links.add(href.split("#")[0].split("?")[0])

# 2. Internal links all resolve
print(f"Distinct internal links: {len(all_links)}")
for href in sorted(all_links):
    if not href or href == "/":
        continue
    st, _ = fetch(href)
    if st not in (200, 308):
        FAILS.append(f"internal link {href}: HTTP {st}")

# 3. Agentic surfaces
st, body = fetch("/robots.txt")
if st != 200 or body.count("User-Agent:") < 10:
    FAILS.append("robots.txt: missing AI crawler allowlist")
for f in ["/llms.txt", "/llms-full.txt", "/.well-known/ai-plugin.json"]:
    st, body = fetch(f)
    if st != 200 or len(body) < 500:
        FAILS.append(f"{f}: HTTP {st} or too short")

# JSON twins (sample one per family + all best)
twins = ["/shortlist/data.json"] + [p + "/data.json" for p in paths if p.startswith(("/best/", "/alternatives/", "/compare/"))]
for t in twins:
    st, body = fetch(t)
    try:
        ok = st == 200 and json.loads(body)
    except Exception:
        ok = False
    if not ok:
        FAILS.append(f"twin {t}: invalid")
print(f"JSON twins checked: {len(twins)}")

# 4. MCP end to end
def rpc(method, params=None):
    req = urllib.request.Request(
        BASE + "/api/mcp",
        data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}).encode(),
        headers={"content-type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

tools = [t["name"] for t in rpc("tools/list")["result"]["tools"]]
shortlist_tools = {"build_sase_shortlist", "list_sase_features", "list_sase_vendors", "get_sase_vendor_profile"}
if not shortlist_tools.issubset(set(tools)):
    FAILS.append(f"MCP tools/list missing shortlist tools: {tools}")
r = json.loads(rpc("tools/call", {"name": "build_sase_shortlist", "arguments": {"sector": "healthcare", "service_model": "managed", "shortlist_size": 5}})["result"]["content"][0]["text"])
if len(r["shortlist"]) != 5 or r["shortlist"][0]["rank"] != 1:
    FAILS.append("MCP build_sase_shortlist verdict malformed")
bad = rpc("tools/call", {"name": "get_sase_vendor_profile", "arguments": {"slug": "nope"}})
if "Unknown vendor slug" not in bad["result"]["content"][0]["text"]:
    FAILS.append("MCP unknown-slug handling broken")
err = rpc("nonexistent/method")
if "error" not in err:
    FAILS.append("MCP unknown method should return JSON-RPC error")

# 5. OpenAPI per shortlist tool (RFP tools are MCP-only, KV-backed, no OpenAPI spec)
for t in sorted(shortlist_tools):
    st, body = fetch(f"/api/openapi/{t}")
    if st != 200 or "openapi" not in body:
        FAILS.append(f"openapi GET {t}: broken")

# 6. Edge cases
st, _ = fetch("/vendors/not-a-vendor")
if st != 404:
    FAILS.append(f"/vendors/not-a-vendor: expected 404 got {st}")
st, _ = fetch("/compare/not-a-pair")
if st != 404:
    FAILS.append(f"/compare/not-a-pair: expected 404 got {st}")
st, body = fetch("/shortlist?m=garbage&f=zzz&n=999")
if st != 200:
    FAILS.append("shortlist with garbage params should still render")
st, body = fetch("/shortlist/print?m=managed&r=uk_ireland")
if st != 200 or "shortlist" not in body.lower():
    FAILS.append("print view broken")

# 7. No-JS content: load-bearing strings present in raw HTML
st, body = fetch("/best/sd-wan-sase-providers-for-healthcare")
if "evaluation ranks" not in body:
    FAILS.append("/best/sd-wan-sase-providers-for-healthcare: quotable summary not server-rendered")
st, body = fetch("/compare/cato-networks-vs-zscaler")
if body.count("rounded-sm text-xs") < 50:
    WARNS.append("compare grade table may not be fully server-rendered")

# 8. Em-dash sweep on rendered output (sample)
for p in ["/", "/shortlist", "/best/sd-wan-providers", "/vendors/cato-networks"]:
    st, body = fetch(p)
    if "—" in body or "–" in body:
        FAILS.append(f"{p}: em/en dash in rendered HTML")

print()
print(f"RESULT: {len(FAILS)} failures, {len(WARNS)} warnings")
for f in FAILS:
    print("FAIL:", f)
for w in WARNS:
    print("WARN:", w)
sys.exit(1 if FAILS else 0)
