#!/usr/bin/env python3
import argparse, hashlib, json, re
from collections import Counter
from pathlib import Path

PILOTS=("versa-networks-profile","bt-managedsase-profile","cato-networks-profile")
def clean(value): return re.sub(r"\s*\[\d+\]", "", value or "").strip()
def main():
 p=argparse.ArgumentParser(); p.add_argument("--extracted-root",required=True); p.add_argument("--normalised-root",required=True); p.add_argument("--report",default="docs/provider-pilot-technical-review.json"); a=p.parse_args(); reviews=[]
 for stem in PILOTS:
  raw=json.loads((Path(a.extracted_root)/(stem+".json")).read_text()); bundle=json.loads((Path(a.normalised_root)/(stem+".json")).read_text())
  failures=[]; evidence_ids={e["id"] for e in bundle["evidence_sources"]}; raw_cells={clean(c["text"]) for t in raw["tables"] for row in t["rows"] for c in row}
  if not raw["integrity"]["main_document_text_complete"]: failures.append("incomplete_source_text")
  if raw["source"]["sha256"]!=bundle["revision"]["source_checksum"]: failures.append("source_checksum_mismatch")
  if any(clean(p["name"]) not in raw_cells or clean(p["category"]) not in raw_cells for p in bundle["products"]): failures.append("product_not_traceable")
  if any(clean(c["capability_code"].replace("_"," ")) and clean(c["qualification"] or "") not in raw_cells for c in bundle["capabilities"] if c["qualification"]): failures.append("capability_qualification_not_traceable")
  if any(c["support_state"] in {"supported","partially_supported","partner_delivered"} and not c["evidence_source_ids"] for c in bundle["capabilities"]): failures.append("positive_capability_without_evidence")
  if any(not set(row["evidence_source_ids"]).issubset(evidence_ids) for group in (bundle["products"],bundle["capabilities"],bundle["claims"]) for row in group): failures.append("broken_evidence_reference")
  if any(e["public"] for e in bundle["evidence_sources"]) or any(c["public"] or c["review_state"]!="unreviewed" for c in bundle["claims"]): failures.append("premature_publication")
  diagnostics=Counter(d["type"] for d in bundle["diagnostics"])
  reviews.append({"provider_id":bundle["entity"]["id"],"revision_id":bundle["revision"]["id"],"source_checksum":bundle["revision"]["source_checksum"],"technical_status":"approved" if not failures else "failed","failures":failures,"qualifications":dict(sorted(diagnostics.items())),"counts":{"tables":len(raw["tables"]),"products":len(bundle["products"]),"capabilities":len(bundle["capabilities"]),"evidence_sources":len(bundle["evidence_sources"]),"evidence_linked_claims":len(bundle["claims"])}})
 report={"review_version":"provider-technical-review/1.0.0","reviewer":"ChatGPT/Codex","method":"Automated source-integrity, traceability, evidence-reference and publication-boundary review.","pilots":reviews}
 Path(a.report).write_text(json.dumps(report,indent=2)+"\n"); print(f"Reviewed {len(reviews)} pilots; {sum(r['technical_status']=='approved' for r in reviews)} approved technically.")
if __name__=="__main__": main()
