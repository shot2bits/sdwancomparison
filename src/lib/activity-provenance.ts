/** Server-owned activity provenance. Unknown history is never promoted by hostname or missing flags. */
export const ACTIVITY_ENVIRONMENTS = ['production','preview','development','unknown'] as const;
export type ActivityEnvironment = typeof ACTIVITY_ENVIRONMENTS[number];
export type TestClassification = 'test'|'non_test'|'unknown';
export type ActivityMetadata = {version:1; environment:ActivityEnvironment; correlation_id:string; acquisition_source:string; classification:{value:TestClassification;reason:string;actor:string;at:number}; buyer_intent?:{verified:boolean;evidence_ref:string;actor:string;at:number}};
export function activityEnvironment(value:unknown=process.env.VERCEL_ENV ?? process.env.NETIFY_ACTIVITY_ENV):ActivityEnvironment {
 return ACTIVITY_ENVIRONMENTS.includes(value as ActivityEnvironment)?value as ActivityEnvironment:'unknown';
}
export function explicitTestEvidence(record:unknown):string|null {
 if(!record||typeof record!=='object')return null;
 const p=record as {test?:boolean;company?:string;applicantMessage?:string;buyer?:{organisation?:string;notes?:string};owner_email?:string;entrance_context?:{requirement_text?:string}};
 if(p.test===true)return 'explicit_test_flag';
 const text=[p.company,p.applicantMessage,p.buyer?.organisation,p.buyer?.notes,p.entrance_context?.requirement_text].filter(Boolean).join(' ');
 if(/\b(?:synthetic|automated QA|do not publish|usability test|QA control|QA audit|private acceptance draft|HTML testing|Netify QA)\b/i.test(text))return 'explicit_internal_or_test_statement';
 if(p.buyer?.organisation?.trim().toLowerCase()==='test'&&/@netify\.(com|co\.uk)$/i.test(p.owner_email??''))return 'internal_owner_and_explicit_test_organisation';
 return null;
}
export function activityClassification(record:unknown):'test'|'unverified' {
 const p=record as {activity?:ActivityMetadata}|null;
 return p?.activity?.classification.value==='test'||(!p?.activity&&explicitTestEvidence(record))?'test':'unverified';
}
export const applicationClassification=(company:string,message='')=>activityClassification({company,applicantMessage:message});
export function createActivity(record:unknown, source='unknown', now=Date.now()):ActivityMetadata {
 const reason=explicitTestEvidence(record);
 return {version:1,environment:activityEnvironment(),correlation_id:crypto.randomUUID(),acquisition_source:/^[a-z0-9_-]{1,60}$/i.test(source)?source:'unknown',classification:{value:reason?'test':'unknown',reason:reason??'not_independently_classified',actor:'server',at:now}};
}
export function activityIdentity(app:string,environment:ActivityEnvironment,id:string){return `${app}:${environment}:${id}`;}
