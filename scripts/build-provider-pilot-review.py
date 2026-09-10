#!/usr/bin/env python3
import argparse, html, json
from pathlib import Path

PILOTS={"versa-networks-profile","bt-managedsase-profile","cato-networks-profile"}
STYLE="""body{font:15px/1.5 system-ui;max-width:1200px;margin:auto;padding:24px;color:#18181b}table{border-collapse:collapse;width:100%;margin:16px 0 36px}th,td{border:1px solid #d4d4d8;padding:7px;vertical-align:top}th{background:#f4f4f5;text-align:left}.warn{background:#fff7ed;border:1px solid #fdba74;padding:12px}.meta{color:#52525b}h2{margin-top:42px}"""
def esc(v): return html.escape(str(v or ""))
def main():
 p=argparse.ArgumentParser(); p.add_argument("--extracted-root",required=True); p.add_argument("--normalised-root",required=True); p.add_argument("--output-root",default=".private/provider-review"); a=p.parse_args(); out=Path(a.output_root); out.mkdir(parents=True,exist_ok=True)
 for stem in sorted(PILOTS):
  raw=json.loads((Path(a.extracted_root)/(stem+".json")).read_text()); bundle=json.loads((Path(a.normalised_root)/(stem+".json")).read_text())
  sections=[f"<h1>{esc(bundle['entity']['display_name'])}</h1>",f"<p class='meta'>Source {esc(raw['source']['source_document_id'])} · checksum {esc(raw['source']['sha256'])} · revision {esc(bundle['revision']['id'])}</p>","<p class='warn'><strong>Private review only.</strong> Unreviewed extraction; not approved for public pages or matching.</p>",f"<h2>Extracted overview</h2><p>{esc(bundle['editorial']['overview'])}</p>"]
  for table in raw["tables"]:
   name=table["mapping"]["name"] if table["mapping"] else f"unmapped-{table['position']}"; sections.append(f"<h2>{esc(name)}</h2><table>")
   for ri,row in enumerate(table["rows"]):
    tag="th" if ri==0 else "td"; sections.append("<tr>"+"".join(f"<{tag}>{esc(cell['text'])}</{tag}>" for cell in row)+"</tr>")
   sections.append("</table>")
  target=out/(bundle["entity"]["slug"]+".html"); target.write_text("<!doctype html><meta charset='utf-8'><style>"+STYLE+"</style>"+"".join(sections)); target.chmod(0o600)
 print(f"Built {len(PILOTS)} private pilot review pages in {out}.")
if __name__=="__main__": main()
