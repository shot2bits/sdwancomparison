import assert from 'node:assert/strict';
import {POST} from '../src/app/api/sector-comparison/review/route';
const input={sector:'manufacturing',sites:30,users:200,regions:['uk_ireland'],service_model:'fully_managed',scope:'sase',challenges:[],requirements:[],notes:'We operate 30 manufacturing sites in the UK. We retain existing firewalls.'};
const request=(value:unknown,origin='https://netify.co.uk',type='application/json')=>new Request('https://netify.co.uk/sase/api/sector-comparison/review/',{method:'POST',headers:{origin,'content-type':type},body:JSON.stringify(value)});
assert.equal((await POST(request(input,'https://example.org'))).status,403);
assert.equal((await POST(request(input,undefined,'text/plain'))).status,415);
assert.equal((await POST(request({...input,sector:'invented'}))).status,400);
assert.equal((await POST(request({...input,notes:''}))).status,400,'No model run for an empty project note');
assert.equal((await POST(request({...input,notes:'A'.repeat(31000)}))).status,413,'Oversized input is rejected, never shortened');
const key=process.env.ANTHROPIC_API_KEY;delete process.env.ANTHROPIC_API_KEY;
try{const response=await POST(request(input));assert.equal(response.status,200);const body=await response.json();assert.equal(body.engine,'deterministic_fallback');assert.ok(!body.brief.includes('Publishing issues'));assert.ok(body.read_summary.includes(String(input.notes.length)));assert.ok(!body.updates.filter((u:{path:string})=>u.path==='organisation.regions').some((u:{value:string[]})=>u.value.includes('ie')),'Grouped UK/Ireland coverage never becomes a stated Irish estate');}finally{if(key!==undefined)process.env.ANTHROPIC_API_KEY=key;}
console.log('PASS brief review origin/type/size guards, empty-note handling, honest fallback, full original note read and no inherited publication wording or grouped-region overclaim.');
