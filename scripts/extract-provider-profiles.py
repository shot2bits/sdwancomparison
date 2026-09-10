#!/usr/bin/env python3
"""Extract private provider DOCX sources into deterministic staging JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
from zipfile import ZipFile
import xml.etree.ElementTree as ET

EXTRACTOR_VERSION = "provider-docx-extractor/1.0.0"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG_R = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def normalized_text(values: list[str]) -> str:
    return "\n".join(" ".join(value.split()) for value in values if " ".join(value.split()))


def text_hash(values: list[str]) -> str:
    return hashlib.sha256(normalized_text(values).encode()).hexdigest()


def relationship_map(archive: ZipFile, name: str) -> dict[str, str]:
    if name not in archive.namelist():
        return {}
    root = ET.fromstring(archive.read(name))
    return {
        rel.get("Id", ""): rel.get("Target", "")
        for rel in root.findall(f"{PKG_R}Relationship")
        if rel.get("Id")
    }


def style_map(archive: ZipFile) -> dict[str, str]:
    if "word/styles.xml" not in archive.namelist():
        return {}
    root = ET.fromstring(archive.read("word/styles.xml"))
    result: dict[str, str] = {}
    for style in root.findall(f"{W}style"):
        style_id = style.get(f"{W}styleId")
        name = style.find(f"{W}name")
        if style_id:
            result[style_id] = name.get(f"{W}val", style_id) if name is not None else style_id
    return result


def paragraph_value(paragraph: ET.Element, relationships: dict[str, str], styles: dict[str, str]) -> dict:
    text = "".join(node.text or "" for node in paragraph.iter(f"{W}t"))
    style_node = paragraph.find(f"./{W}pPr/{W}pStyle")
    style_id = style_node.get(f"{W}val", "") if style_node is not None else ""
    hyperlinks = []
    for hyperlink in paragraph.findall(f".//{W}hyperlink"):
        rel_id = hyperlink.get(f"{R}id")
        link_text = "".join(node.text or "" for node in hyperlink.iter(f"{W}t"))
        hyperlinks.append({"text": link_text, "url": relationships.get(rel_id or "", ""), "relationship_id": rel_id})
    footnote_ids = [
        node.get(f"{W}id", "")
        for node in paragraph.iter(f"{W}footnoteReference")
        if node.get(f"{W}id") not in {None, "-1", "0"}
    ]
    return {
        "text": " ".join(text.split()),
        "style_id": style_id or None,
        "style_name": styles.get(style_id, style_id) or None,
        "heading_level": int(match.group(1)) if (match := re.search(r"heading\s*([1-9])", styles.get(style_id, style_id), re.I)) else None,
        "hyperlinks": hyperlinks,
        "footnote_ids": footnote_ids,
    }


def table_value(table: ET.Element, relationships: dict[str, str], styles: dict[str, str], mapping: dict, position: int) -> dict:
    rows = []
    for row in table.findall(f"./{W}tr"):
        cells = []
        for cell in row.findall(f"./{W}tc"):
            paragraphs = [paragraph_value(p, relationships, styles) for p in cell.findall(f"./{W}p")]
            cells.append({
                "text": " ".join(part["text"] for part in paragraphs if part["text"]),
                "paragraphs": paragraphs,
            })
        rows.append(cells)
    headers = [cell["text"] for cell in rows[0]] if rows else []
    header_key = "|".join(headers)
    table_mapping = next((
        item for item in sorted(mapping["tables"], key=lambda candidate: len(candidate["header_anchor"]), reverse=True)
        if header_key.startswith(item["header_anchor"])
    ), None)
    return {
        "position": position,
        "mapping": table_mapping,
        "headers": headers,
        "rows": rows,
    }


def footnotes(archive: ZipFile, relationships: dict[str, str], styles: dict[str, str]) -> list[dict]:
    if "word/footnotes.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("word/footnotes.xml"))
    values = []
    for footnote in root.findall(f"{W}footnote"):
        note_id = footnote.get(f"{W}id", "")
        if note_id in {"-1", "0"}:
            continue
        paragraphs = [paragraph_value(p, relationships, styles) for p in footnote.findall(f"./{W}p")]
        values.append({"id": note_id, "paragraphs": paragraphs, "text": " ".join(p["text"] for p in paragraphs if p["text"])})
    return values


def extract_profile(path: Path, document_manifest: dict, mapping: dict) -> tuple[dict, list[str]]:
    warnings: list[str] = []
    with ZipFile(path) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
        relationships = relationship_map(archive, "word/_rels/document.xml.rels")
        footnote_relationships = relationship_map(archive, "word/_rels/footnotes.xml.rels")
        styles = style_map(archive)
        body = document.find(f"{W}body")
        if body is None:
            raise ValueError("DOCX has no document body")
        blocks = []
        tables = []
        extracted_text: list[str] = []
        for child in body:
            if child.tag == f"{W}p":
                paragraph = paragraph_value(child, relationships, styles)
                blocks.append({"type": "paragraph", **paragraph})
                if paragraph["text"]:
                    extracted_text.append(paragraph["text"])
            elif child.tag == f"{W}tbl":
                table = table_value(child, relationships, styles, mapping, len(tables) + 1)
                tables.append(table)
                blocks.append({"type": "table", "position": table["position"]})
                extracted_text.extend(cell["text"] for row in table["rows"] for cell in row if cell["text"])

        source_text = ["".join(node.text or "" for node in paragraph.iter(f"{W}t")) for paragraph in body.iter(f"{W}p")]
        # Paragraphs nested in tables appear in source order in the XML. Our block
        # representation retains them as cell paragraphs, so compare normalized
        # token streams rather than paragraph boundaries.
        source_tokens = " ".join(" ".join(value.split()) for value in source_text if value.strip()).split()
        extracted_tokens = " ".join(extracted_text).split()
        if source_tokens != extracted_tokens:
            warnings.append("main_document_text_mismatch")
        mapped_names = {table["mapping"]["name"] for table in tables if table["mapping"]}
        missing_mappings = [item["name"] for item in mapping["tables"] if item["name"] not in mapped_names]
        if missing_mappings:
            warnings.extend(f"missing_table_mapping:{name}" for name in missing_mappings)
        if any(table["mapping"] is None for table in tables):
            warnings.append("unmapped_table")
        if any(not table["headers"] for table in tables):
            warnings.append("empty_table_header")

        all_links = [
            link["url"]
            for block in blocks if block["type"] == "paragraph"
            for link in block["hyperlinks"] if link["url"]
        ] + [
            link["url"]
            for table in tables for row in table["rows"] for cell in row for paragraph in cell["paragraphs"]
            for link in paragraph["hyperlinks"] if link["url"]
        ]
        malformed = sorted({url for url in all_links if urlparse(url).scheme not in {"http", "https", "mailto"}})
        if malformed:
            warnings.extend(f"malformed_url:{url}" for url in malformed)

        evidence_rows = []
        evidence = next((table for table in tables if table["mapping"] and table["mapping"]["name"] == "evidence_register"), None)
        if evidence:
            keys = [re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_") for value in evidence["headers"]]
            for row in evidence["rows"][1:]:
                values = [cell["text"] for cell in row]
                evidence_rows.append(dict(zip(keys, values)))

        notes = footnotes(archive, footnote_relationships, styles)
        duplicate_urls = sorted(url for url, count in Counter(all_links).items() if count > 1)
        result = {
            "extractor_version": EXTRACTOR_VERSION,
            "mapping_version": mapping["mapping_version"],
            "source": document_manifest,
            "blocks": blocks,
            "tables": tables,
            "footnotes": notes,
            "hyperlinks": sorted(set(all_links)),
            "evidence_register": evidence_rows,
            "integrity": {
                "source_text_sha256": text_hash([" ".join(source_tokens)]),
                "extracted_text_sha256": text_hash([" ".join(extracted_tokens)]),
                "main_document_text_complete": source_tokens == extracted_tokens,
                "table_count": len(tables),
                "hyperlink_count": len(set(all_links)),
                "footnote_count": len(notes),
                "duplicate_urls": duplicate_urls,
            },
        }
        return result, warnings


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="docs/provider-source-manifest.json")
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--mapping", required=True)
    parser.add_argument("--output-root", default=".private/provider-staging")
    parser.add_argument("--report", default="docs/provider-extraction-report.json")
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text())
    mapping = json.loads(Path(args.mapping).read_text())
    output_root = Path(args.output_root).resolve() / manifest["source_version"]
    output_root.mkdir(parents=True, exist_ok=True)
    reports = []
    for document in manifest["documents"]:
        filename = document["supplied_filename"]
        source_path = Path(args.source_root) / filename
        result, warnings = extract_profile(source_path, document, mapping)
        output_path = output_root / f"{document['source_document_id'].split(':', 1)[1]}.json"
        output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
        output_path.chmod(0o600)
        reports.append({
            "source_document_id": document["source_document_id"],
            "supplied_filename": filename,
            "output_sha256": hashlib.sha256(output_path.read_bytes()).hexdigest(),
            "tables": result["integrity"]["table_count"],
            "hyperlinks": result["integrity"]["hyperlink_count"],
            "footnotes": result["integrity"]["footnote_count"],
            "text_complete": result["integrity"]["main_document_text_complete"],
            "evidence_rows": len(result["evidence_register"]),
            "warnings": warnings,
        })

    report = {
        "report_version": "provider-extraction-report/1.0.0",
        "extractor_version": EXTRACTOR_VERSION,
        "source_version": manifest["source_version"],
        "mapping_version": mapping["mapping_version"],
        "profile_count": len(reports),
        "successful_profiles": sum(not row["warnings"] for row in reports),
        "text_complete_profiles": sum(row["text_complete"] for row in reports),
        "profiles": reports,
    }
    Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
    print(f"Extracted {len(reports)} profiles; {report['text_complete_profiles']} retain complete main-document text.")


if __name__ == "__main__":
    main()
