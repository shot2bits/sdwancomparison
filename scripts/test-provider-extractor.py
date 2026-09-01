#!/usr/bin/env python3

import json
import os
import subprocess
import tempfile
from pathlib import Path

SOURCE_ROOT = os.environ.get("PROVIDER_PROFILE_SOURCE_ROOT")
MAPPING = os.environ.get("PROVIDER_FIELD_MAPPING")
if not SOURCE_ROOT or not MAPPING:
    raise SystemExit("Set PROVIDER_PROFILE_SOURCE_ROOT and PROVIDER_FIELD_MAPPING.")

with tempfile.TemporaryDirectory(prefix="provider-extractor-test-") as temp:
    output = Path(temp) / "staging"
    report = Path(temp) / "report.json"
    command = [
        "python3", "scripts/extract-provider-profiles.py",
        f"--source-root={SOURCE_ROOT}",
        f"--mapping={MAPPING}",
        f"--output-root={output}",
        f"--report={report}",
    ]
    subprocess.run(command, check=True, capture_output=True, text=True)
    first = report.read_text()
    subprocess.run(command, check=True, capture_output=True, text=True)
    assert report.read_text() == first, "extraction report must be deterministic"
    data = json.loads(first)
    assert data["profile_count"] == 30
    assert data["text_complete_profiles"] == 30
    assert sorted(set(row["tables"] for row in data["profiles"])) == [21, 22]
    velocloud = next(row for row in data["profiles"] if row["source_document_id"] == "provider-source:velocloud-profile")
    assert velocloud["warnings"] == ["missing_table_mapping:case_studies"]
    assert all(not any(warning == "unmapped_table" for warning in row["warnings"]) for row in data["profiles"])

    version_root = output / data["source_version"]
    fixtures = {
        "provider-source:versa-networks-profile": (22, ["Evaluation Area", "Strengths & Differentiators", "Weaknesses & Watch-Outs"]),
        "provider-source:bt-managedsase-profile": (22, ["Evaluation Area", "Strengths & Differentiators", "Weaknesses & Watch-Outs"]),
        "provider-source:cato-networks-profile": (22, ["Evaluation Area", "Strengths & Differentiators", "Weaknesses & Watch-Outs"]),
    }
    by_id = {row["source_document_id"]: row for row in data["profiles"]}
    for source_id, (table_count, first_header) in fixtures.items():
        assert by_id[source_id]["tables"] == table_count
        profile = json.loads((version_root / f"{source_id.split(':', 1)[1]}.json").read_text())
        assert profile["tables"][0]["headers"] == first_header
        assert profile["tables"][21]["mapping"]["name"] == "evidence_register"
        assert profile["integrity"]["main_document_text_complete"] is True
        assert profile["integrity"]["source_text_sha256"] == profile["integrity"]["extracted_text_sha256"]

print("PASS  all profiles extract deterministically; Versa, BT and Cato retain complete source structures")
