#!/usr/bin/env python3
"""Map lossless provider extracts into non-public governed staging bundles."""

from __future__ import annotations
import argparse, hashlib, json, re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

CONTRACT_VERSION = "provider-knowledge/1.0.0"
NORMALISER_VERSION = "provider-normaliser/1.0.0"

def clean(value): return re.sub(r"\s*\[\d+\]", "", value or "").strip()
def key(value): return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
def stable(prefix, *values): return f"{prefix}:{hashlib.sha256('|'.join(values).encode()).hexdigest()[:24]}"
def refs(values): return sorted({int(n) for value in values for n in re.findall(r"\[(\d+)\]", value or "")})
def urls(value):
    result=[]
    for candidate in (value or "").split(";"):
      candidate=re.sub(r"\s+\([^)]*\)\s*$","",candidate.strip())
      if candidate and not urlparse(candidate).scheme: candidate="https://"+candidate
      parsed=urlparse(candidate)
      if candidate and parsed.scheme in {"http","https"} and parsed.netloc and not any(c.isspace() for c in candidate): result.append(candidate)
    return result
def date(value):
    value=clean(value)
    for fmt in ("%d %b %Y","%d %B %Y","%Y-%m-%d"):
        try: return datetime.strptime(value,fmt).date().isoformat()
        except ValueError: pass
    return None
def confidence(value):
    v=(value or "").lower().replace("-","_")
    for token in ("medium_high","low_medium","high","medium","low"):
        if token in v: return token
    return "unresolved"
def support(value):
    v=(value or "").lower()
    if "not publicly" in v: return "not_publicly_disclosed"
    if "requires confirmation" in v or "confirm" in v: return "requires_confirmation"
    if re.search(r"\bnot supported\b|\bno\b",v): return "not_supported"
    if "partner" in v: return "partner_delivered"
    if "partial" in v: return "partially_supported"
    if any(x in v for x in ("native","available","supported","included","yes")): return "supported"
    return "unknown"
def rows(table):
    headers=[key(x) for x in table["headers"]]
    return [dict(zip(headers,[cell["text"] for cell in row])) for row in table["rows"][1:]]
def table(profile,name): return next((t for t in profile["tables"] if t["mapping"] and t["mapping"]["name"]==name),None)
def field_map(profile):
    t=table(profile,"provider_entity")
    return {key(r[0]["text"]):r[1]["text"] for r in t["rows"][1:] if len(r)>1}
def provider_slug(source_id):
    slug=source_id.split(":",1)[1].replace("-profile","").replace("-managedsase","").replace("-sase","")
    return {"att":"att","bt":"bt","nttdata":"ntt-data","vmo2":"virgin-media-o2","hpe-aruba-edgeconnect":"hpe-aruba-edgeconnect","paloalto-prisma":"palo-alto-prisma-sase","ericssoncradlepoint":"ericsson-cradlepoint"}.get(slug,slug)
def provider_types(value):
    v=value.lower(); result=[]
    if "technology" in v: result.append("technology_vendor")
    if "managed" in v: result.append("managed_service_provider")
    if "telecommunication" in v or "carrier" in v or "network provider" in v: result.append("carrier_network_provider")
    if "integrator" in v: result.append("integrator")
    return result or ["hybrid_provider"]
def linked_evidence(values,evidence_by_number):
    return list(dict.fromkeys(eid for number in refs(values) for eid in evidence_by_number.get(number,[])))

def normalise(profile):
    source=profile["source"]; fm=field_map(profile); slug=provider_slug(source["source_document_id"]); pid=f"provider:{slug}"
    entity_name=clean(fm.get("entity_name",slug.replace("-"," ").title()))
    entity={"id":pid,"slug":slug,"display_name":entity_name,"legal_names":[entity_name],"trading_names":[],"provider_types":provider_types(fm.get("entity_type","")),"ownership":clean(fm.get("ownership")) or None,"headquarters":clean(fm.get("headquarters")) or None,"primary_geographies":[],"status":"active"}
    evidence=[]; evidence_by_number={}; evidence_by_url={}; diagnostics=[]
    et=table(profile,"evidence_register")
    if et:
      for row in rows(et):
        number=row.get("","") or row.get("#","")
        # key('#') is empty; recover the first cell through source row order.
      for raw in et["rows"][1:]:
        values=[c["text"] for c in raw]; number=values[0].strip(); source_urls=urls(values[3] if len(values)>3 else "")
        verified=date(values[5] if len(values)>5 else "")
        if not source_urls: diagnostics.append({"type":"malformed_source_url","row":number,"value":values[3] if len(values)>3 else ""}); continue
        if not verified: diagnostics.append({"type":"missing_verified_date","row":number}); continue
        tier_match=re.search(r"([1-4])",values[1] if len(values)>1 else ""); tier=f"tier_{tier_match.group(1)}" if tier_match else "tier_4"
        linked=[]
        for source_index,source_url in enumerate(source_urls,1):
          if source_url in evidence_by_url:
            linked.append(evidence_by_url[source_url]); diagnostics.append({"type":"duplicate_source_url","row":number,"existing_evidence_id":evidence_by_url[source_url]}); continue
          eid=f"evidence:{slug}:{number}" + (f":{source_index}" if len(source_urls)>1 else ""); evidence_by_url[source_url]=eid; linked.append(eid)
          evidence.append({"id":eid,"provider_id":pid,"url":source_url,"title":clean(values[2]),"publisher":"","publication_date":date(values[4]) if len(values)>4 else None,"verified_date":verified,"reliability_tier":tier,"archived_reference":None,"source_status":"current","public":False})
        evidence_by_number[int(number)]=linked
    default_verified=max((e["verified_date"] for e in evidence),default="2026-09-01")
    products=[]
    pt=table(profile,"products_services")
    if pt:
      for row in rows(pt):
        name=clean(row.get("product_service",""));
        if not name: continue
        relation="partner" if "partner" in row.get("native_or_partner","").lower() else "native" if "native" in row.get("native_or_partner","").lower() else "unknown"
        products.append({"id":stable("product",slug,name),"provider_id":pid,"name":name,"category":clean(row.get("category","Unknown")) or "Unknown","delivery_relationship":relation,"target_buyer":clean(row.get("target_buyer","")) or None,"delivery_model":clean(row.get("delivery_model","")) or None,"status":"current","evidence_source_ids":linked_evidence(row.values(),evidence_by_number)})
    definitions={}; capabilities=[]
    for table_name in ("core_capabilities","architecture","remote_access","reporting_analytics","ai_automation"):
      ct=table(profile,table_name)
      if not ct: continue
      for row in rows(ct):
        label=clean(next((row.get(k,"") for k in ("capability","data_point","use_case","feature") if row.get(k)),""));
        if not label: continue
        code=key(label)[:80] or stable("cap",label)
        if not code[0].isalpha(): code=f"cap_{code}"
        definitions[code]={"code":code,"category":table_name,"label":label,"explanation":label,"valid_values":["supported","partially_supported","partner_delivered","not_supported","unknown","not_publicly_disclosed","requires_confirmation"],"matching_behaviour":"weighted_preference"}
        state_value=next((row.get(k,"") for k in ("availability","supported","available","finding","specific_function") if row.get(k)),"")
        evidence_ids=linked_evidence(row.values(),evidence_by_number)
        state=support(state_value)
        if state in {"supported","partially_supported","partner_delivered"} and not evidence_ids:
          state="requires_confirmation"
          diagnostics.append({"type":"positive_capability_without_evidence","table":table_name,"capability":label})
        capabilities.append({"id":stable("capability",slug,table_name,label),"provider_id":pid,"product_id":None,"capability_code":code,"support_state":state,"qualification":clean(row.get("key_limitations","") or row.get("limitations","") or row.get("finding","")) or None,"confidence":confidence(row.get("confidence","")),"verified_date":date(row.get("last_verified","") or row.get("evidence_date","")) or default_verified,"freshness_state":"current","evidence_source_ids":evidence_ids})
    generic={"geographies":[],"service_models":[],"compliance":[],"integrations":[],"sector_evidence":[],"commercial":[],"case_studies":[],"evaluations":[]}
    specs={
      "geography_coverage":"geographies","deployment_models":"service_models","operations_support":"service_models","administration":"service_models","compliance":"compliance","integrations":"integrations","sector_evidence":"sector_evidence","commercial":"commercial","case_studies":"case_studies","strengths_and_watchouts":"evaluations","buyer_suitability":"evaluations","implementation_migration":"evaluations","risks_limitations":"evaluations","netify_evaluation":"evaluations"}
    claims=[]
    for table_name,bucket in specs.items():
      gt=table(profile,table_name)
      if not gt: continue
      for idx,row in enumerate(rows(gt),1):
        values=[clean(v) for v in row.values() if clean(v)];
        if not values: continue
        evidence_ids=linked_evidence(row.values(),evidence_by_number)
        base={"id":stable(bucket,slug,table_name,str(idx)),"provider_id":pid,"qualification":" | ".join(values[1:])[:4000] or None,"confidence":confidence(row.get("confidence","")),"verified_date":date(row.get("last_verified","") or row.get("evidence_date","")) or default_verified,"freshness_state":"current","evidence_source_ids":evidence_ids}
        first=values[0]
        if bucket=="geographies": base.update({"geography":first,"delivery_type":clean(row.get("verified_finding","")) or "unspecified","delivery_relationship":"partner" if "partner" in row.get("direct_or_partner","").lower() else "owned" if "direct" in row.get("direct_or_partner","").lower() else "unknown"})
        elif bucket=="service_models": base.update({"model":"other","support_state":support(row.get("supported","") or row.get("availability","") or row.get("how_it_works",""))})
        elif bucket=="compliance": base.update({"framework":first,"scope":clean(row.get("scope","")) or None,"support_state":support(row.get("status","")),"expiry_or_review_date":None})
        elif bucket=="integrations": base.update({"integration_name":first,"integration_type":clean(row.get("category","")) or "other","delivery_relationship":"api" if "api" in row.get("native_certified_api_partner","").lower() else "partner" if "partner" in row.get("native_certified_api_partner","").lower() else "native" if "native" in row.get("native_certified_api_partner","").lower() else "certified" if "certified" in row.get("native_certified_api_partner","").lower() else "unknown"})
        elif bucket=="sector_evidence": base.update({"sector":first,"suitability_state":support(row.get("suitability","")),"named_evidence":clean(row.get("supporting_case_studies","")) or None,"case_study_strength":"strong" if row.get("supporting_case_studies") and "none" not in row.get("supporting_case_studies","").lower() else "none"})
        elif bucket=="commercial": base.update({"pricing_state":"public" if "yes" in row.get("publicly_disclosed","").lower() else "not_publicly_disclosed","licensing_model":clean(row.get("finding","")) or None,"minimums":None,"caveats":clean(row.get("buyer_questions","")) or None,"restricted":False})
        elif bucket=="case_studies": base.update({"customer_type":clean(row.get("customer_anonymous","")) or None,"named_customer":None,"sector":clean(row.get("sector","")) or None,"geography":clean(row.get("country_region","")) or None,"estate":"; ".join(filter(None,[clean(row.get("users","")),clean(row.get("sites",""))])) or None,"outcome":clean(row.get("measured_outcomes","")) or None,"quantified_result":clean(row.get("measured_outcomes","")) or None})
        else: base.update({"evaluation_type":"summary","finding":" | ".join(values),"buyer_implication":clean(row.get("buyer_implication","") or row.get("buyer_impact","")) or None})
        generic[bucket].append(base)
        if evidence_ids:
          claims.append({"id":stable("claim",slug,table_name,str(idx)),"provider_id":pid,"subject":first,"predicate":table_name,"value":row,"claim_text":" | ".join(values),"evidence_source_ids":evidence_ids,"confidence":base["confidence"],"public":False,"review_state":"unreviewed","freshness_state":"current"})
        else: diagnostics.append({"type":"orphan_candidate_claim","table":table_name,"row":idx})
    overview=max((b["text"] for b in profile["blocks"] if b["type"]=="paragraph" and b.get("heading_level")==3),key=len,default="")
    editorial={"provider_id":pid,"overview":overview,"section_introductions":{},"buying_guidance":"","page_title":f"{entity_name} SD-WAN and SASE profile","meta_description":"","editorial_revision":"unreviewed-import","approved_by":None,"approved_at":None}
    revision={"id":stable("revision",pid,source["source_version"]),"provider_id":pid,"dataset_version":source["source_version"],"source_document_id":source["source_document_id"],"source_checksum":source["sha256"],"extractor_version":profile["extractor_version"],"publication_state":"imported","technical_reviewed_by":None,"technical_reviewed_at":None,"editorial_reviewed_by":None,"editorial_reviewed_at":None,"publication_decision_by":None,"publication_decision_at":None}
    return {"contract_version":CONTRACT_VERSION,"normaliser_version":NORMALISER_VERSION,"entity":entity,"products":products,"capability_definitions":list(definitions.values()),"capabilities":capabilities,**generic,"evidence_sources":evidence,"claims":claims,"editorial":editorial,"revision":revision,"diagnostics":diagnostics}

def main():
    p=argparse.ArgumentParser(); p.add_argument("--input-root",required=True); p.add_argument("--output-root",default=".private/provider-normalised"); p.add_argument("--report",default="docs/provider-normalisation-report.json"); a=p.parse_args()
    out=Path(a.output_root); out.mkdir(parents=True,exist_ok=True); reports=[]; names={}
    for path in sorted(Path(a.input_root).glob("*.json")):
      bundle=normalise(json.loads(path.read_text())); target=out/path.name; target.write_text(json.dumps(bundle,indent=2,ensure_ascii=False)+"\n"); target.chmod(0o600)
      name=bundle["entity"]["display_name"]; names.setdefault(name,[]).append(bundle["entity"]["id"])
      reports.append({"provider_id":bundle["entity"]["id"],"slug":bundle["entity"]["slug"],"products":len(bundle["products"]),"capabilities":len(bundle["capabilities"]),"evidence_sources":len(bundle["evidence_sources"]),"claims":len(bundle["claims"]),"diagnostics":bundle["diagnostics"]})
    report={"report_version":"provider-normalisation-report/1.0.0","normaliser_version":NORMALISER_VERSION,"provider_count":len(reports),"duplicate_entity_names":{k:v for k,v in names.items() if len(v)>1},"providers":reports}
    Path(a.report).write_text(json.dumps(report,indent=2)+"\n"); print(f"Normalised {len(reports)} providers; {sum(len(r['diagnostics']) for r in reports)} diagnostics retained.")
if __name__=="__main__": main()
