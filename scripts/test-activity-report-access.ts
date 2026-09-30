import assert from 'node:assert/strict';
// @ts-expect-error Node 24 hook; repository types target Node 20.
import {registerHooks} from 'node:module';
const mocks:Record<string,string>={'server-only':'export {};','@/lib/auth':'export async function sessionFromRequest(){return null}','@/lib/access-control':'export function isAdminEmail(){return false}'};
registerHooks({resolve(s:string,c:object,next:(s:string,c:object)=>{url:string}){return mocks[s]?{url:`data:text/javascript,${encodeURIComponent(mocks[s])}`,shortCircuit:true}:next(s,c)}});
const {GET,PATCH}=await import('../src/app/api/admin/activity-report/route');
assert.equal((await GET(new Request('http://fixture/api/admin/activity-report'))).status,403);
assert.equal((await PATCH(new Request('http://fixture/api/admin/activity-report',{method:'PATCH',body:'{}'}))).status,403);
console.log('PASS unauthorised report reads and classification corrections are denied');
