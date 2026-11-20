import 'server-only';
import {getShortlistDataset} from './vendors';
import {RESEARCH,CASE_PAGE_SECTORS,SECTORS as RESEARCH_SECTORS,formatDate,researchSummarySentence} from './workbook-research';

/** The bare https://netify.co.uk/marketplace/ landing is the product URL the
 *  sitemap lists and AI answers should cite. It used to ship
 *  `noindex,nofollow`, no canonical, no description and no structured data,
 *  so crawlers were told to drop it. Private states (any query string, and
 *  every capability link, which lives in the #cap= fragment and never reaches
 *  the server) keep noindex. */
export const MARKETPLACE_URL='https://netify.co.uk/marketplace/';
const TITLE='SD-WAN & SASE Marketplace: Compare Providers, Build an RFP | Netify';
const DESCRIPTION='Free for buyers. Compare 30 researched SD-WAN and SASE vendors and managed providers by sector and location, build a sector-specific RFP and request comparable bids. No account needed.';

const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function isIndexableLanding(rawPath:string,search:string,method:string){
 return (method==='GET'||method==='HEAD')&&(rawPath==='/locations/'||rawPath==='/locations')&&search==='';
}

function latestEvidenceDate(){
 try{const dates=getShortlistDataset().map(v=>String((v as {last_verified?:string}).last_verified??'')).filter(d=>/^\d{4}-\d{2}-\d{2}/.test(d)).sort();return dates.at(-1)?.slice(0,10)??'';}catch{return '';}
}

const SECTORS:[string,string][]=[
 ['Financial services','financial-services'],['Government','government'],['Retail','retail'],['Healthcare','healthcare'],['Manufacturing','manufacturing'],
 ['Energy & utilities','energy-and-utilities'],['Education','education'],['Transport & logistics','transport-and-logistics'],['Professional services','professional-services'],['Hospitality','hospitality'],
];
const COMPARISONS:[string,string][]=[
 ['Cato Networks vs Zscaler','cato-networks-vs-zscaler'],['Cato Networks vs Aryaka','cato-networks-vs-aryaka'],['Zscaler vs Netskope','zscaler-vs-netskope'],
 ['Fortinet vs Cisco','fortinet-vs-cisco'],['BT vs Vodafone Business','bt-business-vs-vodafone-business'],['Zscaler vs Cloudflare One','zscaler-vs-cloudflare-one'],
];

export const LANDING_FAQS:{q:string;a:string}[]=[
 {q:'What is the Netify SD-WAN and SASE Marketplace?',a:'A free UK marketplace where IT and procurement teams compare 30 researched SD-WAN and SASE technology vendors and managed service providers, build a sector-specific RFI or RFP from their own sites and requirements, and request comparable proposals. It is run by Netify, a BT Authorised Partner.'},
 {q:'Does it cost anything to use?',a:'No. Buyers never pay. Suppliers pay Netify a commission only when an introduction leads to business, and that commission does not change how providers are ordered.'},
 {q:'Do I need an account?',a:'No. You can choose your sector, add locations, compare providers, apply sector recommendations and build and download your RFP in Word or text without an account. When you send your request to the Netify sourcing desk, you add an email address so the desk can reply to you.'},
 {q:'Which sectors have starting requirements?',a:'Ten: financial services, government and councils, retail, healthcare, manufacturing, energy and utilities, education, transport and logistics, professional services, and hospitality and leisure. Each adds recommended requirements you can change or remove.'},
 {q:'How are providers researched?',a:'Each provider is graded against 40 published SD-WAN and SASE capabilities using public vendor sources, with the source and review date kept for every grade. Unconfirmed fields are shown as evidence gaps, not as missing features.'},
 {q:'Will suppliers contact me automatically?',a:'No. Nothing is sent until you review the exact brief and recipients. Netify reviews the request and only approaches the providers you approve.'},
];

export function landingHead(){
 const latest=latestEvidenceDate();
 const ld={
  '@context':'https://schema.org',
  '@graph':[
   {'@type':'WebApplication','@id':MARKETPLACE_URL+'#app',name:'Netify SD-WAN & SASE Marketplace',url:MARKETPLACE_URL,description:DESCRIPTION,applicationCategory:'BusinessApplication',operatingSystem:'Web',inLanguage:'en-GB',isAccessibleForFree:true,offers:{'@type':'Offer',price:'0',priceCurrency:'GBP',description:'Free for buyers'},featureList:['Compare 30 SD-WAN and SASE vendors and managed providers','Sector starting requirements for 10 industries','Location and site schedule builder','Living RFI and RFP builder with Word download','Request comparable proposals'],...(latest?{dateModified:latest}:{}),publisher:{'@id':'https://netify.co.uk/#organization'}},
   {'@type':'Organization','@id':'https://netify.co.uk/#organization',name:'Netify',url:'https://netify.co.uk/',description:'BT Authorised Partner and SD-WAN and SASE marketplace for UK businesses.'},
   {'@type':'FAQPage','@id':MARKETPLACE_URL+'#faq',mainEntity:LANDING_FAQS.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))},
   {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Netify',item:'https://netify.co.uk/'},{'@type':'ListItem',position:2,name:'Marketplace',item:MARKETPLACE_URL}]},
  ],
 };
 return `<meta name="description" content="${esc(DESCRIPTION)}"/><link rel="canonical" href="${MARKETPLACE_URL}"/>`+
  `<meta property="og:type" content="website"/><meta property="og:site_name" content="Netify"/><meta property="og:locale" content="en_GB"/><meta property="og:url" content="${MARKETPLACE_URL}"/><meta property="og:title" content="${esc(TITLE)}"/><meta property="og:description" content="${esc(DESCRIPTION)}"/><meta name="twitter:card" content="summary"/>`+
  `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g,'\\u003c')}</script>`;
}

/** Visible, server-rendered answer block. Kept in sync with the FAQPage JSON-LD
 *  above (structured data must describe content a reader can see). */
export function landingAnswers(){
 const latest=latestEvidenceDate();
 const a=(href:string,text:string)=>`<a href="${href}">${esc(text)}</a>`;
 return `<section id="ns-public-answers" aria-labelledby="ns-public-answers-h" style="max-width:1040px;margin:0 auto;padding:40px 20px 56px;font:15px/1.6 system-ui,sans-serif;color:#24473e">`+
  `<style>#ns-public-answers a{color:#1f6b4a}</style><h2 id="ns-public-answers-h" style="font-size:24px;margin:0 0 6px">About the Netify SD-WAN &amp; SASE Marketplace</h2>`+
  `<p style="margin:0 0 20px;color:#4d6b62">Free for buyers · No account needed to compare or build your RFP · Run by Netify, a BT Authorised Partner${latest?` · Provider evidence last reviewed ${esc(latest)}`:''}</p>`+
  LANDING_FAQS.map(f=>`<h3 style="font-size:17px;margin:20px 0 4px">${esc(f.q)}</h3><p style="margin:0">${esc(f.a)}</p>`).join('')+
  `<h3 style="font-size:17px;margin:28px 0 6px">Best SD-WAN and SASE providers by sector</h3><p style="margin:0">${SECTORS.map(([n,s])=>a(`/sase/best/sd-wan-sase-providers-for-${s}/`,n)).join(' · ')}</p>`+
  `<h3 style="font-size:17px;margin:20px 0 6px">Head-to-head comparisons</h3><p style="margin:0">${COMPARISONS.map(([n,s])=>a(`/sase/compare/${s}/`,n)).join(' · ')} · ${a('/sase/compare/','All comparisons')}</p>`+
  `<h3 style="font-size:17px;margin:20px 0 6px">Desk research, updated ${esc(formatDate(RESEARCH.updated_date))}</h3><p style="margin:0 0 6px">${esc(researchSummarySentence())}</p><p style="margin:0">${[
   a('/sase/research/','All provider research'),
   ...CASE_PAGE_SECTORS.map(s=>a(`/sase/research/cases/${s}/`,`${RESEARCH_SECTORS.find(x=>x.slug===s)?.name??s} SD-WAN and SASE case studies`)),
   a('/sase/research/list-prices/','Published SD-WAN and SASE list prices'),
   ...RESEARCH_SECTORS.map(s=>a(`/sase/research/sectors/${s.slug}/`,`${s.name}: providers with cited cases`)),
  ].join(' · ')}</p>`+
  `<h3 style="font-size:17px;margin:20px 0 6px">Research and RFP resources</h3><p style="margin:0">${[
   a('/sase/shortlist/','SD-WAN and SASE provider shortlist'),a('/sase/shortlist/sd-wan-vendors/','SD-WAN vendors compared'),a('/sase/shortlist/sase-vendors/','SASE vendors compared'),a('/sase/shortlist/managed-sd-wan/','Managed SD-WAN providers compared'),
   a('/sase/alternatives/bt-business/','BT alternatives'),a('/sase/rfp-builder/questions/','SASE and SD-WAN RFP question bank'),a('/sase/rfp-builder/sample-rfp/','Sample RFP'),a('/sase/shortlist/data.json','Research dataset (JSON)'),
  ].join(' · ')}</p></section>`;
}

export function withIndexableLanding(html:string,production:boolean){
 const robots=production?'index,follow':'noindex,nofollow';
 return html
  .replace('<meta content="noindex,nofollow" name="robots"/>',`<meta content="${robots}" name="robots"/>`)
  .replace(/<title>[^<]*<\/title>/,`<title>${esc(TITLE)}</title>`+landingHead())
  .replace(/<\/body>(?![\s\S]*<\/body>)/,landingAnswers()+'</body>');
}
