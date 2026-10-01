"""Fetch referenced primary sources; record availability and quote matches, not new approval."""
import json, urllib.request, concurrent.futures, hashlib, re, io
from pathlib import Path
from html.parser import HTMLParser
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/evidence-reconciliation'
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,t,a):
  if t in ['script','style']:self.skip+=1
 def handle_endtag(self,t):
  if t in ['script','style']:self.skip=max(0,self.skip-1)
 def handle_data(self,s):
  if not self.skip:self.parts.append(s)
def normalize(s):return re.sub(r'[^a-z0-9]+',' ',s.lower()).strip()
def fetch(url):
 try:
  r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; NetifyEvidenceReview/1.0)'}),timeout=15);b=r.read(12000000)
  if b.startswith(b'%PDF'):text=' '.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(b)).pages)
  else:
   p=Text();p.feed(b.decode('utf-8','replace'));text=' '.join(p.parts)
  return url,{'http_status':r.status,'final_url':r.url,'sha256':hashlib.sha256(b).hexdigest(),'text':normalize(text),'error':None}
 except Exception as e:return url,{'error':type(e).__name__,'http_status':getattr(e,'code',None),'text':''}
audit=json.loads((OUT/'capability-audit.json').read_text());urls=set()
for r in audit['cells']:
 if r['classification']=='dated_sourced_difference':urls.update(s['url'] for s in r['legacy_sources'] if s['tier']==1)
out={}
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
 for i,(u,r) in enumerate(pool.map(fetch,sorted(urls)),1):
  out[u]=r
  if i%40==0:print(f'Checked {i}/{len(urls)} sources',flush=True)
matches=[]
for r in audit['cells']:
 q=normalize(r['legacy_quote'] or '')
 matched=[s['url'] for s in r['legacy_sources'] if s['tier']==1 and q and len(q.split())>=6 and q in out.get(s['url'],{}).get('text','')]
 if matched:matches.append({'slug':r['slug'],'feature':r['feature'],'matched_primary_urls':matched})
result={'checked_on':'2026-10-01','method':'HTTP retrieval and exact normalized quote verification. A match is not semantic validation of the complete capability definition.','sources':{u:{k:v for k,v in r.items() if k!='text'} for u,r in out.items()},'quote_matches':matches}
(OUT/'source-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(f'Finished: {len(out)} sources; {len(matches)} field quotes matched.',flush=True)
