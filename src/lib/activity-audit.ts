import {activityKvBinding} from './activity-storage';
import type {ActivityMetadata,ActivityEnvironment} from './activity-provenance';
export async function activityCommand(command:(string|number)[]):Promise<unknown>{
 const {url,token}=activityKvBinding();if(!url||!token)throw Error('Isolated activity storage is not configured');
 const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(command),cache:'no-store'});
 if(!response.ok)throw Error('Activity storage unavailable');const body=await response.json();if(body.error)throw Error('Activity storage command failed');return body.result;
}
export function auditKey(app:'sase'|'bt',env:ActivityEnvironment,id:string){if(!/^[a-zA-Z0-9_-]{1,120}$/.test(id))throw Error('Invalid record ID');return `activity:audit:${app}:${env}:${id}`;}
export async function readActivityAudit(app:'sase'|'bt',env:ActivityEnvironment,id:string){const rows=await activityCommand(['LRANGE',auditKey(app,env,id),0,-1]);return (Array.isArray(rows)?rows:[]).map(r=>JSON.parse(String(r)) as {activity:ActivityMetadata;reason:string;actor:string;at:number});}
export async function correctActivity(app:'sase'|'bt',env:ActivityEnvironment,id:string,base:ActivityMetadata,expectedVersion:number,change:{classification?:'test'|'non_test'|'unknown';buyer_intent?:boolean;evidence_ref?:string;reason:string},actor:string){
 if(!actor||!change.reason.trim()||change.reason.length>500)throw Error('Actor and bounded reason required');
 if(change.buyer_intent===true&&!change.evidence_ref?.trim())throw Error('Independent intent evidence reference required');
 const now=Date.now();const activity={...base,environment:env,classification:change.classification?{value:change.classification,reason:change.reason,actor,at:now}:base.classification,...(change.buyer_intent!==undefined?{buyer_intent:{verified:change.buyer_intent,evidence_ref:change.evidence_ref??'',actor,at:now}}:{})};
 const entry={activity,reason:change.reason,actor,at:now};
 const result=await activityCommand(['EVAL',"if redis.call('llen',KEYS[1]) ~= tonumber(ARGV[1]) then return -1 end return redis.call('rpush',KEYS[1],ARGV[2])",1,auditKey(app,env,id),expectedVersion,JSON.stringify(entry)]);
 if(Number(result)===-1)throw Error('Classification changed; reload before correcting');return entry;
}
