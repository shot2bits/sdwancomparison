/**
 * Strips identifying details from free text before it reaches the public board.
 * Names, emails, phone numbers, web addresses, postcodes, street addresses and
 * the buyer's own company name are removed unless the buyer opted in to show
 * their company, in which case only the company name is kept.
 */
export type AnonymiseContext={company?:string;email?:string;keepCompany?:boolean;names?:string[]};
const STREET='(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|close|way|place|square|court|park|gardens|terrace|hill|crescent|grove|row|mews|walk|boulevard|business park|industrial estate|trading estate)';
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function identityTerms(ctx:AnonymiseContext){
 const terms=new Set<string>();
 const add=(s?:string)=>{const t=(s??'').trim();if(t.length>=3)terms.add(t);};
 if(!ctx.keepCompany){add(ctx.company);for(const w of (ctx.company??'').split(/\s+/))if(w.length>=4&&!/^(limited|group|holdings|services|solutions|systems|technologies|international|uk|plc|llp|the|and)$/i.test(w))add(w);}
 const email=(ctx.email??'').toLowerCase(),[local,domain]=email.split('@');
 if(local)for(const p of local.split(/[._+-]+/))if(p.length>=3&&!/^\d+$/.test(p))add(p);
 if(domain&&!ctx.keepCompany){const label=domain.split('.')[0];add(label);}
 for(const n of ctx.names??[])add(n);
 return [...terms].sort((a,b)=>b.length-a.length);
}
/** Phrases in the text that spell out the sender's email domain, such as "Acme Retail" for acmeretail.co.uk. */
function domainPhrases(text:string,email?:string){
 const label=(email??'').toLowerCase().split('@')[1]?.split('.')[0]??'';if(label.length<4)return [];
 const words=[...text.matchAll(/[A-Za-z0-9]+/g)].map(m=>({w:m[0],i:m.index??0}));const found=new Set<string>();
 for(let a=0;a<words.length;a++){let joined='';for(let b=a;b<Math.min(a+3,words.length);b++){joined+=words[b].w.toLowerCase();if(joined.length>=4&&label.startsWith(joined)){found.add(text.slice(words[a].i,words[b].i+words[b].w.length));}if(joined.length>label.length)break;}}
 return [...found].sort((x,y)=>y.length-x.length);
}
const COMPANY_FORM=/(?:\b[A-Z][\w&'’-]*\s+){1,5}(?:Limited|Ltd|LLP|PLC|plc|Inc|LLC|GmbH|Holdings|Group)\b\.?/g;
export function anonymiseText(input:unknown,ctx:AnonymiseContext={},max=4000):string{
 let t=String(input??'').normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').slice(0,max*2);
 t=t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email removed]');
 t=t.replace(/https?:\/\/[^\s)]+/gi,'[link removed]').replace(/\bwww\.[^\s)]+/gi,'[link removed]');
 t=t.replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:co\.uk|org\.uk|gov\.uk|ac\.uk|com|net|org|io|uk|eu|biz|info|cloud|tech|app|dev)\b(?:\/\S*)?/gi,'[link removed]');
 t=t.replace(/(?:\+|\b00)\d[\d\s().-]{7,}\d/g,'[phone removed]').replace(/\b0\d[\d\s().-]{8,}\d\b/g,'[phone removed]').replace(/\(\s*0\d{2,4}\s*\)\s*\d[\d\s-]{5,}\d/g,'[phone removed]');
 t=t.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi,'[postcode removed]');
 t=t.replace(new RegExp(`\\b(?:(?:flat|unit|suite|floor)\\s+)?\\d{1,4}[a-z]?(?:\\s*[-/]\\s*\\d{1,4})?,?\\s+(?:[A-Z][A-Za-z'’-]+\\s+){1,3}${STREET}\\b(?:,?\\s+(?:[A-Z][A-Za-z'’-]+))?`,'gi'),'[address removed]');
 if(!ctx.keepCompany){t=t.replace(COMPANY_FORM,'[name removed]');for(const ph of domainPhrases(t,ctx.email))t=t.replace(new RegExp(`(?<![A-Za-z0-9])${esc(ph)}(?![A-Za-z0-9])`,'gi'),'[name removed]');}
 for(const term of identityTerms(ctx))t=t.replace(new RegExp(`(?<![A-Za-z0-9])${esc(term)}(?![A-Za-z0-9])`,'gi'),'[name removed]');
 return t.replace(/(\[[a-z ]+ removed\])(?:\s*\1)+/g,'$1').replace(/[ \t]{2,}/g,' ').trim().slice(0,max);
}
export const anonymiseList=(items:unknown,ctx:AnonymiseContext={},each=120,max=20)=>(Array.isArray(items)?items:[]).filter(x=>typeof x==='string').slice(0,max).map(x=>anonymiseText(x,ctx,each)).filter(Boolean);
