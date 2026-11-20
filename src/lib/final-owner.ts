import 'server-only';
import {randomUUID} from 'node:crypto';
import {sessionFromRequest} from './auth';
import {coreDatabase,CoreError,sha} from './core-phase1';
import {platformOwner,requireFinalFlag} from './final-platform-flags';
/** Existing verified session, exact owner identity. Other administrators do not qualify. */
export async function requirePlatformOwner(req:Request,action='view'){
 requireFinalFlag('owner');const s=await sessionFromRequest(req);
 if(!s||s.email.trim().toLowerCase()!==platformOwner()||s.expires<=Date.now())throw new CoreError(403,'verified_owner_required');
 if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers.get('origin')!==new URL(req.url).origin)throw new CoreError(403,'same_origin_required');
 await coreDatabase().query('INSERT INTO netify_core_phase1.owner_access_log(id,actor_hash,action) VALUES($1,$2,$3)',[randomUUID(),sha(s.email),action]);return s;
}
export const privateHeaders={'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
export function csvCell(value:unknown){let s=value==null?'':String(value);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function csvRows(rows:Record<string,unknown>[]){const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];return '\uFEFF'+[keys.map(csvCell).join(','),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n');}
