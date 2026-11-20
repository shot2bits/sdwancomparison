import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
/** Public HTML is data only. No scripts execute, external hosts or arbitrary links are followed. */
export function locationPageHints(html:string,base:string){
 const dom=new JSDOM(html),doc=dom.window.document as Document,url=new URL(base);
 const links=new Map<string,{url:string;label:string;score:number}>();
 for(const a of doc.querySelectorAll('a[href]')){const label=clean(a.textContent??'');if(!/^(?:(?:our|global|all|office)\s+)?(?:locations|offices|contact(?:\s+us)?|office locations|find (?:an? )?office|where (?:we are|to find us))$/i.test(label))continue;try{const u=new URL(a.getAttribute('href')!,url);u.hash='';if(u.origin!==url.origin||u.href===url.href||u.search||u.username||u.password)continue;links.set(u.href,{url:u.href,label,score:/contact/i.test(label)?0:1});}catch{}}
 doc.querySelectorAll('script,style,noscript,svg,form,iframe,nav,header,footer').forEach(n=>n.remove());
 doc.querySelectorAll('p,div,li,address,h1,h2,h3,h4,h5,h6,section,br').forEach(n=>n.after(doc.createTextNode(' ')));
 const root=doc.querySelector('main')??doc.querySelector('article')??doc.body,headings=[...root.querySelectorAll('h1,h2,h3,h4,h5,h6')],blocks:{city:string;country:string;quote:string}[]=[];
 if(/\b(?:office|offices|office addresses|headquarters|branches)\b/i.test(root.textContent??''))for(let i=0;i<headings.length;i++){
  const h=headings[i],level=Number(h.tagName.slice(1)),city=clean(h.textContent??'').replace(/[*†‡]+$/,'').trim();
  if(!city||city.length>80||level<3)continue;
  const later=headings.slice(i+1),next=later.find(n=>Number(n.tagName.slice(1))<=level);if(later[0]&&Number(later[0].tagName.slice(1))>level)continue;const range=doc.createRange();range.setStartBefore(h);if(next)range.setEndBefore(next);else range.setEndAfter(root.lastChild!);
  const quote=clean(range.cloneContents().textContent??'');
  if(quote.length>3000||!/[0-9]/.test(quote)||!/(?:\b(?:tel|phone|fax|street|road|floor|tower|square|avenue|boulevard|building|postcode|postal|address)\b|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b|\b\d{4,6}\s+[\p{L}])/iu.test(quote))continue;
  const parent=headings.slice(0,i).reverse().find(n=>Number(n.tagName.slice(1))<level);
  blocks.push({city,country:clean(parent?.textContent??''),quote});
 }
 dom.window.close();return {links:[...links.values()].sort((a,b)=>a.score-b.score),blocks};
}
