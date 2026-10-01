"""Read-only, reproducible reconciliation of all 30 x 40 public capability cells."""
import json, re, hashlib, csv
from pathlib import Path
from collections import Counter
from zipfile import ZipFile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/evidence-reconciliation'
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

def key(value):
    value = re.sub(r'[^a-z0-9]+', '_', value.lower()).strip('_')[:80]
    return value if value[:1].isalpha() else 'cap_' + value

def source_rows(path):
    with ZipFile(path) as z:
        doc = ET.fromstring(z.read('word/document.xml'))
    found = {}
    for table in doc.iter(W+'tbl'):
        rows = [[ ''.join(n.text or '' for n in c.iter(W+'t')) for c in row.findall(W+'tc')] for row in table.findall(W+'tr')]
        if not rows or rows[0][0] not in ['Capability','Data point','Use case','Feature']: continue
        for values in rows[1:]:
            row = dict(zip([key(h) for h in rows[0]], values))
            label = next((row[k] for k in ['capability','data_point','use_case','feature'] if row.get(k)), '')
            state = next((row[k] for k in ['availability','supported','available','finding','specific_function'] if row.get(k)), '')
            if label and state: found[key(label)] = {'state_text':state, 'row':row}
    return found

def main():
    live = json.loads((OUT/'neon-public-before.json').read_text())['providers']
    public = json.loads((OUT/'shortlist-before.json').read_text())['vendors']
    by_slug = {p['slug']:p for p in public}
    mapping = dict(re.findall(r'"?([a-z0-9-]+)"?: "([a-z0-9-]+)"', (ROOT/'src/lib/governed-provider-catalogue.ts').read_text().split('const NAMES')[0]))
    feature_ids = [f['id'] for f in json.loads((ROOT/'data/feature-definitions.json').read_text())['features']]
    ts = (ROOT/'src/lib/live-shortlist.ts').read_text()
    aliases = {k:re.findall(r'"([^"]+)"',v) for k,v in re.findall(r'(f\d\d_\w+): \[([^\]]*)\]', ts)}
    manifest = json.loads((ROOT/'docs/provider-source-manifest.json').read_text())
    documents = list((ROOT/'.private/provider-source/reconciliation/profiles').glob('*.docx'))
    # Use source filenames and manifest identity rather than legal-entity copy.
    import importlib.util
    spec=importlib.util.spec_from_file_location('normaliser',ROOT/'scripts/normalise-provider-staging.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    raw={mod.provider_slug(d['source_document_id']): source_rows(next(p for p in documents if p.name==d['supplied_filename'])) for d in manifest['documents']}
    rows=[]; parser=[]
    for provider in live:
        slug=mapping.get(provider['provider']['slug'],provider['provider']['slug']); current=by_slug[slug]
        path=ROOT/'data/vendors'/f'{slug}.json'; old=json.loads(path.read_text()) if path.exists() else {}
        registry={str(s['n']):s for s in old.get('evidence_register',[])}
        caps={c['capability_code']:c for c in provider['capabilities']}
        for code,c in caps.items():
            original=raw.get(provider['provider']['slug'],{}).get(code)
            if original and 'confirm' in original['state_text'].lower():
                parser.append({'slug':slug,'code':code,'source_text':original['state_text'],'live_state':c['support_state'],'source_ids':c['evidence_source_ids']})
        for f in feature_ids:
            prior=old.get('capabilities',{}).get(f); now=current['capabilities'].get(f)
            fact=old.get('sourced_facts',{}).get(f,{})
            sources=[registry[str(n)] for n in fact.get('evidence',[]) if str(n) in registry]
            state_rows=[caps[c] for c in [f]+aliases.get(f,[]) if c in caps]
            classification=('no_legacy_record' if not old else 'same_grade' if (prior or 'unknown').replace('unknown','not_confirmed')==now else 'legacy_without_field_source' if not sources else 'dated_sourced_difference')
            rows.append({'slug':slug,'feature':f,'legacy_grade':prior,'live_grade':now,'classification':classification,'legacy_fact_value':fact.get('value'),'legacy_date':old.get('last_verified'),'legacy_quote':fact.get('quote'),'legacy_sources':sources,'neon_fields':state_rows,'neon_source_urls':[s['url'] for s in provider['evidence_sources'] if s['id'] in {i for c in state_rows for i in c.get('evidence_source_ids',[])}]})
    assert len(rows)==1200 and len({(r['slug'],r['feature']) for r in rows})==1200
    result={'cells':rows,'parser_candidates':parser,'summary':dict(Counter(r['classification'] for r in rows))}
    (OUT/'capability-audit.json').write_text(json.dumps(result,indent=2)+'\n')
    with (OUT/'capability-audit.csv').open('w') as f:
        w=csv.DictWriter(f,fieldnames=['slug','feature','legacy_grade','live_grade','classification','legacy_fact_value','legacy_date']);w.writeheader();w.writerows({k:r[k] for k in w.fieldnames} for r in rows)
    print(json.dumps({'cells':len(rows),'summary':result['summary'],'confirmation_parser_candidates':len(parser)},indent=2))

if __name__=='__main__':main()
