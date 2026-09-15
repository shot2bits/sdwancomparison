import {activityCommand} from './activity-audit';import {activityEnvironment,type ActivityMetadata} from './activity-provenance';
export async function recordPersistedActivity(app:'sase'|'bt',recordId:string,event:string,transitionId:string,activity?:ActivityMetadata,at=Date.now()){
 if(!/^[a-zA-Z0-9_-]{1,120}$/.test(recordId)||!transitionId)throw Error('Stable record and transition IDs required');
 const environment=activityEnvironment();const id=`${app}:${environment}:${recordId}:${event}:${transitionId}`;
 const row={id,app,environment,record_id:recordId,project_id:recordId,event,at,correlation_id:activity?.correlation_id??null,classification:activity?.classification.value??'unknown',acquisition_source:activity?.acquisition_source??'unknown'};
 await activityCommand(['EVAL',"-- activity-append-once\nif redis.call('exists',KEYS[1]) == 1 then return 0 end redis.call('lpush',KEYS[2],ARGV[1]) redis.call('set',KEYS[1],'1') return 1",2,`activity:dedup:${id}`,`activity:events:${app}:${environment}`,JSON.stringify(row)]);
 return row;
}
