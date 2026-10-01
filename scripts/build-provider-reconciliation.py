"""Build bounded, source-traceable repairs without rewriting provider approvals."""
import json, re, hashlib, importlib.util
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/evidence-reconciliation'
spec=importlib.util.spec_from_file_location('audit',ROOT/'scripts/audit-provider-reconciliation.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
spec=importlib.util.spec_from_file_location('normaliser',ROOT/'scripts/normalise-provider-staging.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
records=json.loads((OUT/'neon-public-before.json').read_text())['providers']
audit=json.loads((OUT/'capability-audit.json').read_text())
checks=json.loads((OUT/'source-checks.json').read_text())
quotes={(r['slug'],r['feature']):r['matched_primary_urls'] for r in checks['quote_matches']}
mapping=dict(re.findall(r'"?([a-z0-9-]+)"?: "([a-z0-9-]+)"',(ROOT/'src/lib/governed-provider-catalogue.ts').read_text().split('const NAMES')[0]))
docs=json.loads((ROOT/'docs/provider-source-manifest.json').read_text())['documents']
raw={n.provider_slug(d['source_document_id']):a.source_rows(ROOT/'.private/provider-source/reconciliation/profiles'/d['supplied_filename']) for d in docs}
grade={'yes':'supported','partial':'partially_supported','partner_integrated':'partner_delivered'}
result={};decisions=[]
for p in records:
 slug=p['provider']['slug'];comparison=mapping.get(slug,slug);sources={s['id']:s for s in p['evidence_sources']};caps={c['capability_code']:c for c in sorted(p['capabilities'],key=lambda c:({'unresolved':0,'low':1,'low_medium':2,'medium':3,'medium_high':4,'high':5}.get(c['confidence'],0),c['id']))};fixes={}
 for code,c in caps.items():
  row=raw.get(slug,{}).get(code)
  if not row:continue
  text=row['state_text'];state=n.support(text)
  refs=[sources[i] for i in c['evidence_source_ids'] if i in sources and sources[i]['reliability_tier']=='tier_1' and sources[i]['source_status']=='current']
  # Mechanical parser repairs only: do not promote inference or reverse a denial.
  if c['support_state'] not in ['unknown','requires_confirmation'] or state not in ['supported','partially_supported','partner_delivered'] or not refs or re.search(r'\bimplied\b|\binferred\b|not (?:independently )?confirmed',text,re.I):continue
  fixes[code]={'expected_state':c['support_state'],'expected_qualification':c['qualification'],'support_state':state,'qualification':c['qualification'],'confidence':c['confidence'],'verified_date':c['verified_date'],'source_urls':[s['url'] for s in refs],'reason':'Restore the explicit source finding misclassified by the confirmation substring parser.','source_finding':text,'basis':'parser_repair'}
 for r in audit['cells']:
  if r['slug']!=comparison:continue
  decision='retain_live_evidence'
  urls=quotes.get((comparison,r['feature']),[])
  if r['live_grade']=='not_confirmed' and r['legacy_fact_value'] in grade and urls:
   # Restore only a field-specific documented grade with a quote still present
   # on its primary source. Do not copy the old unsourced headline grades.
   path=ROOT/'data/vendors'/f'{comparison}.json';old=json.loads(path.read_text());fact=old['sourced_facts'][r['feature']]
   fixes[r['feature']]={'expected_state':None,'expected_qualification':None,'support_state':grade[r['legacy_fact_value']],'qualification':fact.get('note',''),'confidence':fact.get('confidence','medium'),'verified_date':r['legacy_date'],'source_urls':urls,'reason':'Recover field-specific historic evidence; primary-source quote checked 2026-10-01. Original evidence date retained.','source_finding':fact.get('quote',''),'basis':'source_quote_recovered'}
   decision='recover_source_linked_field'
  elif r['classification']=='legacy_without_field_source':decision='withhold_unsourced_legacy_grade'
  elif r['classification']=='dated_sourced_difference':decision='retain_live_pending_new_field_review'
  decisions.append({'slug':comparison,'feature':r['feature'],'decision':decision,'legacy_grade':r['legacy_grade'],'previous_live_grade':r['live_grade']})
 result[slug]={'revision_id':p['revision']['id'],'comparison_slug':comparison,'fields':fixes}
# Explicit current primary-source adjudications, separate from automated quote recovery.
for slug,fields in json.loads((ROOT/'data/provider-reconciliation-source-reviews.json').read_text()).items():
 caps={c['capability_code']:c for p in records if p['provider']['slug']==slug for c in p['capabilities']}
 for code,fact in fields.items():
  old=caps.get(code,{})
  result[slug]['fields'][code]={**fact,'expected_state':old.get('support_state'),'expected_qualification':old.get('qualification'),'basis':'primary_source_review','reason':'Current primary technical documentation reviewed for the specific capability; no human editorial approval implied.'}
out={'version':'provider-reconciliation/2026-10-01','checked_on':'2026-10-01','review_due':'2026-12-30T00:00:00Z','method':'Versioned repairs applied to published Neon records; source publication approvals and original verification dates are preserved. Missing evidence is not an absent capability. Newer source revisions require reconciliation review.','providers':result}
(ROOT/'data/provider-reconciliation.json').write_text(json.dumps(out,indent=2)+'\n')
(OUT/'field-decisions.json').write_text(json.dumps(decisions,indent=2)+'\n')
print(json.dumps({'providers':len(result),'repaired_fields':sum(len(p['fields']) for p in result.values()),'decisions':dict(Counter(d['decision'] for d in decisions))},indent=2))
