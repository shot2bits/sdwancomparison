"""Read-only HTTP acceptance against a local server; JavaScript is not executed."""
import json, sys, urllib.request
from html.parser import HTMLParser
from pathlib import Path
base=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:3127/sase'
def get(path):
    with urllib.request.urlopen(base+path) as r:
        assert r.status==200
        return r.read().decode()
class Page(HTMLParser):
    def __init__(self,html):
        super().__init__(); self.stack=[]; self.text=[]; self.h1=[]; self.h2=[]; self.h3=[]; self.summaries=[]; self.json=[]; self.script=''; self.best={}; self.count=''; self.title=''; self.feed(html)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); self.stack.append((tag,a)) if tag not in ['meta','link','input','img','br','hr','source','wbr'] else None
        if tag=='script':self.script=''
    def handle_endtag(self,tag):
        if tag=='script' and self.stack and self.stack[-1][1].get('type')=='application/ld+json':self.json.append(json.loads(self.script))
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:self.stack=self.stack[:i];break
    def handle_data(self,data):
        tags=[t for t,a in self.stack]
        if 'script' in tags:self.script+=data;return
        if 'style' in tags:return
        if 'main' in tags:self.text.append(data)
        if 'h1' in tags:self.h1.append(data)
        if 'h2' in tags:self.h2.append(data)
        if 'h3' in tags and 'article' in tags:self.h3.append(data)
        if 'summary' in tags:self.summaries.append(data)
        if 'title' in tags:self.title+=data
        for t,a in self.stack:
            if 'data-count-sentence' in a:self.count+=data
            if 'data-best-for' in a:self.best[a['data-best-for']]=self.best.get(a['data-best-for'],'')+data
feed=json.loads(get('/shortlist/data.json'))
raw=get('/shortlist/'); p=Page(raw)
assert ''.join(p.h1)==feed['entity']['h1'],p.h1
assert p.count==feed['entity']['count_sentence']
first=' '.join(' '.join(p.text).split()[:80]);assert p.count in first,first
assert len(p.best)==len(feed['vendors'])
for v in feed['vendors']:assert p.best[v['slug']]=='Best for: '+v['best_for'],v['slug']
graph=next(x['@graph'] for x in p.json if '@graph' in x)
item=next(x for x in graph if x['@type']=='ItemList');assert item['numberOfItems']==len(p.best)
assert [i['item']['name'] for i in item['itemListElement']]==p.h3
faq=next(x for x in graph if x['@type']=='FAQPage');assert [q['name'] for q in faq['mainEntity']]==[q for q in p.summaries if q in [f['q'] for f in feed['faqs']]]
for f in feed['faqs']:assert f['a'] in ''.join(p.text)
assert not any(x['@type']=='Person' for x in graph)
assert 'Get comparable SD-WAN and SASE proposals from UK providers' in p.h2
assert '—' not in ''.join(p.text)
assert '"unknown"' not in json.dumps(feed)
llms=get('/llms.txt').splitlines();assert llms[:3]==[feed['entity'][k] for k in ['h1','count_sentence','uk_sentence']]
print('PASS HTTP: approved H1; count in first 80 main-content words; 30 server-rendered cards and best-for lines; desk H2')
print('FIRST 80 WORDS:',first)
print('PASS graph: 30 organisations in card order; FAQ exact visible parity; no Person; no em dash or legacy status')
print('PASS llms/feed: first three lines byte-identical to entity block')
for view in ['sd-wan-vendors','sase-vendors','managed-sd-wan']:
    q=Page(get('/shortlist/'+view+'/'))
    assert len(q.best)==len(feed['market_views'][view]['providers'])
    print('PASS sibling:',view,'rows',len(q.best),'title',q.title,'h1',''.join(q.h1))
print('HTTP acceptance complete; no requests or emails submitted')
Path('docs/answer-first/shortlist-server.html').write_text(raw)
if '--all-pages' in sys.argv:
    import concurrent.futures, re
    paths=[line.split()[1].rstrip(':') for line in Path('docs/answer-first/all-pages.txt').read_text().splitlines() if line.startswith('PASS ')]
    def check_vocabulary(path):
        text=''.join(Page(get(path)).text)
        assert '\u2014' not in text,path
        assert not re.search(r'\bunknown\b',text,re.I),path
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check_vocabulary,paths))
    print(f'PASS {len(paths)} rendered provider/sector pages: no em dash or legacy unknown vocabulary')
