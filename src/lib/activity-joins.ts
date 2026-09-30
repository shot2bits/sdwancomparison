import type {ActivityEnvironment} from './activity-provenance';
/** Explicit conflicting references are evidence gaps, never candidates for fallback. */
export function invitationOpportunity(connection:{opportunity_id?:string;activity_environment?:ActivityEnvironment},opportunities:string[],environment:ActivityEnvironment):string|undefined {
 if(connection.activity_environment!==undefined&&connection.activity_environment!==environment)return undefined;
 if(connection.opportunity_id!==undefined)return opportunities.includes(connection.opportunity_id)?connection.opportunity_id:undefined;
 return opportunities.length===1?opportunities[0]:undefined;
}
