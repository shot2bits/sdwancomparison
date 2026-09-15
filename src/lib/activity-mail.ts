import {activityEnvironment} from './activity-provenance';
/** Fail closed before a non-production request reaches the real mail provider. */
export async function activityMailFetch(input:RequestInfo|URL,init?:RequestInit){
 if(activityEnvironment()!=='production')throw new Error('External mail is disabled outside production');
 return fetch(input,init);
}
