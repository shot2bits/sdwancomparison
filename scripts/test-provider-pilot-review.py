#!/usr/bin/env python3
import json, os, subprocess, tempfile
from pathlib import Path
extracted=os.environ.get("PROVIDER_EXTRACTED_ROOT"); normalised=os.environ.get("PROVIDER_NORMALISED_ROOT")
if not extracted or not normalised: raise SystemExit("Set PROVIDER_EXTRACTED_ROOT and PROVIDER_NORMALISED_ROOT")
with tempfile.TemporaryDirectory(prefix="provider-review-test-") as temp:
 subprocess.run(["python3","scripts/build-provider-pilot-review.py",f"--extracted-root={extracted}",f"--normalised-root={normalised}",f"--output-root={temp}"],check=True,capture_output=True)
 pages=list(Path(temp).glob("*.html")); assert {p.stem for p in pages}=={"versa-networks","bt","cato-networks"}
 for page in pages:
  body=page.read_text(); assert "Private review only" in body; assert "not approved for public pages or matching" in body; assert "evidence_register" in body
 status=json.load(open("docs/provider-pilot-review-status.json")); assert len(status["pilots"])==3; assert all(p["editorial_status"]=="pending" and p["approved_revision"] is None for p in status["pilots"])
print("PASS  private pilot reviews are complete and cannot imply editorial approval")
