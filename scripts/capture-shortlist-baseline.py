"""Archive the unmodified Search Console exports before any release edits."""
import csv
import hashlib
import io
import json
import re
import shutil
import zipfile
from pathlib import Path

target = Path('docs/provider-first/2026-11-12-baseline')
target.mkdir(parents=True, exist_ok=True)
exports = {
    'search': Path.home() / 'Downloads/netify.co.uk-Performance-on-Search-2026-11-12.zip',
    'generative': Path.home() / 'Downloads/netify.co.uk-Performance-on-Search-Generative-AI-Features-2026-11-12.zip',
}
result = {'captured_on': '2026-11-12', 'release_status': 'not_released', 'page': 'https://netify.co.uk/sase/shortlist/', 'start': '2026-10-14', 'end': '2026-11-10', 'reports': {}}
normalise = lambda q: re.sub(r'\s+', ' ', q.lower().replace('sdwan', 'sd wan').replace('sd-wan', 'sd wan')).strip()
# Freeze explicit commercial provider intent before the change. Longer natural
# language queries remain in the raw export, not treated as proven human prompts.
core = re.compile(r'^(?:(?:best|top|compare) )?(?:managed )?(?:sd wan|sase)(?: managed)?(?: service)? (?:providers?|vendors?)(?: (?:uk|comparison|companies))?$')
for kind, source in exports.items():
    raw = source.read_bytes()
    archive = target / source.name
    if archive.exists() and archive.read_bytes() != raw:
        raise RuntimeError('Refusing to overwrite a different baseline export')
    shutil.copyfile(source, archive)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        tables = {n: list(csv.DictReader(io.StringIO(z.read(n).decode('utf-8-sig')))) for n in z.namelist()}
    assert tables['Pages.csv'][0]['Top pages'] == result['page']
    chart = tables['Chart.csv']
    assert len(chart) == 28 and chart[0]['Date'] == result['start'] and chart[-1]['Date'] == result['end']
    report = {'sha256': hashlib.sha256(raw).hexdigest(), 'archive': archive.name, 'totals': tables['Pages.csv'][0], 'tables': {n: len(rows) for n, rows in tables.items()}}
    if kind == 'search':
        rows = tables['Queries.csv']
        fixed = [r for r in rows if core.fullmatch(normalise(r['Top queries']))]
        (target / 'fixed-provider-queries.json').write_text(json.dumps([r['Top queries'] for r in fixed], indent=2) + '\n')
        groups = {}
        for name, subset in [('fixed_provider_intent', fixed), ('managed_sd_wan', [r for r in fixed if 'managed' in normalise(r['Top queries']) and 'sd wan' in normalise(r['Top queries'])]), ('sd_wan_other', [r for r in fixed if 'managed' not in normalise(r['Top queries']) and 'sd wan' in normalise(r['Top queries'])]), ('sase', [r for r in fixed if 'sase' in normalise(r['Top queries'])])]:
            impressions = sum(int(r['Impressions']) for r in subset)
            clicks = sum(int(r['Clicks']) for r in subset)
            groups[name] = {'queries': len(subset), 'clicks': clicks, 'impressions': impressions, 'ctr_percent': 100 * clicks / impressions if impressions else None, 'impression_weighted_position': sum(float(r['Position']) * int(r['Impressions']) for r in subset) / impressions if impressions else None}
        report['groups'] = groups
        report['query_rows'] = len(rows)
        report['query_clicks'] = sum(int(r['Clicks']) for r in rows)
        report['query_impressions'] = sum(int(r['Impressions']) for r in rows)
    result['reports'][kind] = report
result['limitations'] = [
    'Page, query and device totals do not necessarily reconcile. Preserve reported scopes; do not manufacture missing rows.',
    'The export provides separate country/device/query tables, not a joint query-country-device cube. Position bands use query-average positions, not impression-level rankings.',
    'Query wording does not identify generative fan-outs or prove buyer demand. The generative report has no query, click or CTR fields.',
    'Baseline ends at the latest complete reported day. Refresh before a later release if this window becomes stale.',
]
(target / 'baseline.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
