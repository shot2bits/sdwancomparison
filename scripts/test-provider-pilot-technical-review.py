#!/usr/bin/env python3
import json, os, subprocess, tempfile
from pathlib import Path
extracted=os.environ.get("PROVIDER_EXTRACTED_ROOT"); normalised=os.environ.get("PROVIDER_NORMALISED_ROOT")
if not extracted or not normalised: raise SystemExit("Set PROVIDER_EXTRACTED_ROOT and PROVIDER_NORMALISED_ROOT")
with tempfile.TemporaryDirectory(prefix="provider-tech-review-") as temp:
 report=Path(temp)/"report.json"; cmd=["python3","scripts/review-provider-pilots.py",f"--extracted-root={extracted}",f"--normalised-root={normalised}",f"--report={report}"]
 subprocess.run(cmd,check=True,capture_output=True); first=report.read_text(); subprocess.run(cmd,check=True,capture_output=True); assert report.read_text()==first
 data=json.loads(first); assert len(data["pilots"])==3; assert all(p["technical_status"]=="approved" and not p["failures"] for p in data["pilots"])
 status=json.load(open("docs/provider-pilot-review-status.json")); assert all(p["technical_status"]=="approved" and p["technical_reviewer"]=="ChatGPT/Codex" for p in status["pilots"]); assert all(p["editorial_status"]=="pending" and p["approved_revision"] is None for p in status["pilots"])
print("PASS  pilot facts are technically traceable while editorial approval remains pending")
