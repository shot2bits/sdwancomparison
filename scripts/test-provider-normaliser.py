#!/usr/bin/env python3
import json, os, subprocess, tempfile
from pathlib import Path
source=os.environ.get("PROVIDER_EXTRACTED_ROOT")
if not source: raise SystemExit("Set PROVIDER_EXTRACTED_ROOT")
with tempfile.TemporaryDirectory(prefix="provider-normaliser-test-") as temp:
 out=Path(temp)/"out"; report=Path(temp)/"report.json"
 cmd=["python3","scripts/normalise-provider-staging.py",f"--input-root={source}",f"--output-root={out}",f"--report={report}"]
 subprocess.run(cmd,check=True,capture_output=True); first=report.read_text(); subprocess.run(cmd,check=True,capture_output=True); assert report.read_text()==first
 data=json.loads(first); assert data["provider_count"]==30; assert data["duplicate_entity_names"]=={}
 bundles=[json.loads(p.read_text()) for p in out.glob("*.json")]
 assert len({b["entity"]["slug"] for b in bundles})==30
 assert all(b["revision"]["publication_state"]=="imported" for b in bundles)
 assert all(not e["public"] for b in bundles for e in b["evidence_sources"])
 assert all(not c["public"] and c["review_state"]=="unreviewed" for b in bundles for c in b["claims"])
 assert all(c["support_state"] not in {"supported","partially_supported","partner_delivered"} or c["evidence_source_ids"] for b in bundles for c in b["capabilities"]), "positive capabilities need evidence"
print("PASS  30 provider bundles normalise deterministically and remain non-public pending review")
