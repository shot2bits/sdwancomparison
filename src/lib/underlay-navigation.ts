import underlay from './underlay-navigation.json';
type Link = {label:string;href:string};
type Column = {title:string;links:readonly Link[]};
const brandedPaths=new Set([...underlay.items,...underlay.comparisonGroup.items,underlay.footerLink].map(l=>l.href));
export function isUnderlayLink(link:Link){return brandedPaths.has(link.href) || /\bBT\b|BTnet|Virgin|\bO2\b/i.test(link.label) || link.href==='https://reseller.netify.co.uk/';}
/** Preserve every existing destination while grouping branded partner content together. */
export function underlayFooter(columns:readonly Column[]):Column[]{
 const moved:Link[]=[],otherPartners:Link[]=[];
 const result=columns.map(c=>{const links=c.links.filter(l=>{if(isUnderlayLink(l)){moved.push(l);return false}return true});if(c.title==='Providers and partners'){otherPartners.push(...links);return {title:'Underlay',links:[]}}return {...c,links}});
 const unique=(links:readonly Link[])=>[...new Map(links.map(l=>[l.href,l])).values()];
 const target=result.find(c=>c.title==='Underlay')!;
 target.links=unique([underlay.items[0],underlay.items[1],...moved,...underlay.items,...underlay.comparisonGroup.items,underlay.footerLink]);
 const providers=result.find(c=>c.title==='Providers and comparisons');if(providers)providers.links=unique([...providers.links,...otherPartners]);
 return result;
}
