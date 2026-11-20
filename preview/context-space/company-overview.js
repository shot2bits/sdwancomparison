/** Explicit text suggestions, reviewed by the buyer before use. No unstated fact is invented. */
export function parseCompanyOverview(original){
 const t=original; /** @type {Record<string, string | number | string[]>} */ const fields={}; const sources={};const add=(key,value,match)=>{fields[key]=value;sources[key]=match;};
 const sectors=[['financial_services',/\b(financial services|banking|bank|insurance|investment firm)\b/i],['government_public_sector',/\b(government|council|public sector|local authority)\b/i],['retail_ecommerce',/\b(retail|retailer|ecommerce|e-commerce)\b/i],['healthcare',/\b(healthcare|hospital|clinical|NHS|medical practice)\b/i],['manufacturing',/\b(manufacturing|manufacturer|factories|factory)\b/i],['energy_utilities',/\b(energy|utilities|oil and gas)\b/i],['education',/\b(education|university|school|college)\b/i],['transport_logistics',/\b(transport|logistics|shipping|haulage)\b/i],['professional_services',/\b(professional services|law firm|consultancy|accountancy)\b/i],['hospitality_leisure',/\b(hospitality|hotel|leisure|restaurant)\b/i]];
 const matched=sectors.map(([id,re])=>[id,t.match(re)?.[0]]).filter(([,m])=>m);if(matched.length===1)add('sector',matched[0][0],matched[0][1]);
 for(const [key,re,max] of [['sites',/\b([\d,]+)\s+(?:sites|offices|branches|stores|locations|factories)\b/i,100000],['users',/\b([\d,]+)\s+(?:users|employees|staff|people)\b/i,1000000]]){const m=t.match(re);if(m){const n=Number(m[1].replaceAll(',',''));if(Number.isSafeInteger(n)&&n>0&&n<=max)add(key,n,m[0]);}}
 if(/\bSASE\b/i.test(t))add('scope','sase',t.match(/\bSASE\b/i)[0]);else if(/\bSD[ -]?WAN\b/i.test(t))add('scope','sdwan',t.match(/\bSD[ -]?WAN\b/i)[0]);else if(/\bSSE\b/i.test(t))add('scope','secure_access',t.match(/\bSSE\b/i)[0]);
 const regions=[['uk_ireland',/\b(UK|United Kingdom|Ireland|Britain)\b/i],['europe',/\b(Europe|European)\b/i],['north_america',/\b(USA|United States|Canada|North America)\b/i],['asia_pacific',/\b(APAC|Asia Pacific)\b/i],['middle_east_africa',/\b(Middle East|Africa)\b/i],['latin_america',/\b(Latin America)\b/i],['china_mainland',/\b(China|Mainland China)\b/i]].filter(([,re])=>re.test(t));if(regions.length)add('regions',regions.map(([id])=>id),regions.map(([,re])=>t.match(re)[0]).join(', '));
 for(const [key,items] of [['applications',[['Microsoft 365',/\b(Microsoft 365|Office 365|M365)\b/i],['Microsoft Teams',/\bMicrosoft Teams\b/i],['SAP S/4HANA',/\bSAP(?: S\/4HANA)?\b/i],['Salesforce',/\bSalesforce\b/i]]],['cloud_services',[['Microsoft Azure',/\bAzure\b/i],['AWS',/\b(AWS|Amazon Web Services)\b/i],['Google Cloud',/\b(GCP|Google Cloud)\b/i]]]]){const names=items.filter(([,re])=>re.test(t));if(names.length)add(key,names.map(([name])=>name),names.map(([,re])=>t.match(re)[0]).join(', '));}
 const needs=t.split(/(?<=[.!?])\s+|\n+/).filter(s=>/\b(need|require|must|priority|priorities)\b/i.test(s)&&/\b(failover|segmentation|DLP|zero trust|ZTNA|resilience|audit|latency|routing|security|migration|remote access)\b/i.test(s));
 return {original,fields,sources,featureNeeds:needs,warnings:[...(matched.length>1?['More than one sector is mentioned. Choose the correct company sector.']:[]),'These are text suggestions. Review them before applying, including any negated, historic or approximate statements. Missing facts are left blank.']};
}

/** A small, editable starting plan from the original question catalogue. Never replaces buyer choices. */
export function sectorStartingPlan(sector,scope,questions,contexts){
 const core=['Q-SM-01','Q-DP-01','Q-CM-01','Q-VE-03'];
 const scopeQuestions=scope==='sdwan'?['Q-SD-01','Q-SD-02']:scope==='secure_access'?['Q-IZ-01','Q-SC-01','Q-DR-01']:scope==='sase'?['Q-IZ-01','Q-SC-01','Q-SD-01']:[];
 const sectorHints={manufacturing:['OT-First','Zero Trust','Identity & Access','Converged'],financial_services:['Low-Latency','Zero Trust','Data Loss','Converged'],retail_ecommerce:['Payment Resilience','PCI DSS','Deployment & Rapid','Zero Trust'],healthcare:['Track Record','Infrastructure','Clinical Security','Regional Compliance']};
 const pack=questions.filter(q=>q.sector===sector),chosen=[];
 for(const hint of sectorHints[sector]??[]){const match=pack.find(q=>q.category.includes(hint)&&(scope!=='sdwan'||!/(SSE:|SASE:)/.test(q.category))&&(scope!=='secure_access'||!/(SD-WAN:|SASE:)/.test(q.category)));if(match)chosen.push(match.id);}
 if(pack.length&&!chosen.length)chosen.push(...pack.filter(q=>(scope!=='sdwan'||!/(SSE:|SASE:)/.test(q.category))&&(scope!=='secure_access'||!/(SD-WAN:|SASE:)/.test(q.category))).slice(0,3).map(q=>q.id));
 if(!pack.length){if(['government_public_sector','energy_utilities','education'].includes(sector))chosen.push('Q-DR-01','Q-LS-01');if(['transport_logistics','hospitality_leisure','professional_services'].includes(sector))chosen.push('Q-SM-02','Q-DP-02');}
 const valid=new Set(questions.map(q=>q.id));return {contextIndices:(contexts??[]).slice(0,3).map((_,i)=>i),questionIds:[...new Set([...core,...scopeQuestions,...chosen])].filter(id=>valid.has(id)),hasSectorPack:Boolean(pack.length)};
}

/** Guided procurement journey. Optional research and technology never block progress. */
export function journeyNextStep(project){
 if(!project.sector)return 'sector';if(!project.scopeConfirmed)return 'scope';if(!(project.sites>0||project.users>0))return 'estate';if(!project.regions.length)return 'coverage';
 if(!project.requirementsReviewed)return 'sector-challenges';if(!project.selectedProviders.length)return 'project-shortlist';if(project.business.trim().length<20)return 'document-business';if(project.doc==='rfp'&&!project.questionIds.length)return 'questions';if(!project.timescale)return 'timing';return 'written-brief';
}
export function journeyLayer(task){if(!task||task==='research-library'||task.startsWith('knowledge:'))return 0;if(['written-brief','document-business','questions','timing','instructions'].includes(task))return 4;if(task==='project-shortlist'||task.startsWith('provider:'))return 3;if(['sector-challenges','optional-details','apps','clouds','technology','operating','custom-context'].includes(task)||/^c\d+$|^own/.test(task))return 2;return 1;}
