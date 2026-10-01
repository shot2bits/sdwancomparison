import { requestOriginAllowed } from "@/lib/request-origin";
import {z} from 'zod';
import {sessionFromRequest} from '@/lib/auth';
import {sourcingAccess} from '@/lib/sourcing-access';
import {getProject} from '@/lib/rfp-store';
import {OutcomeText,outcomeAction,readOutcome,type OutcomeRecord} from '@/lib/market-outcomes';
import {CircuitError} from '@/lib/circuit-store';
const headers={'Cache-Control':'private, no-store'};
type Ctx={params:Promise<{id:string}>};
async function access(req:Request,id:string){
 if(!/^rfp_[a-z0-9]+$/.test(id))throw new CircuitError('Private project access required.',401);
 const session=await sessionFromRequest(req);const p=await getProject(id);
 if(!p?.entrance_context?.raw_input.sourcing_request_id)throw new CircuitError('Private sourcing project required.',401);
 if(session?.role==='netify')return {staff:true,email:session.email};
 const grant=await sourcingAccess(req,id);
 if(grant)return {staff:false,email:grant.email};
 if(session?.role==='buyer'&&p.owner_email?.toLowerCase()===session.email.toLowerCase())return {staff:false,email:session.email};
 throw new CircuitError('Verified buyer access required.',401);
}
function view(r:OutcomeRecord|null,staff:boolean){return {staff,record:r&&(staff||r.status!=='draft')?{revision:r.revision,status:r.status,public:r.public,...(staff?{evidence_references:r.evidence_references,audit:r.audit}:{})}:null};}
function failure(e:unknown){return Response.json({error:e instanceof CircuitError?e.message:e instanceof z.ZodError?'Check the outcome fields.':'Unable to access this outcome. Please retry.'},{status:e instanceof CircuitError?e.status:e instanceof z.ZodError?422:503,headers});}
export async function GET(req:Request,ctx:Ctx){try{const {id}=await ctx.params;const a=await access(req,id);return Response.json(view(await readOutcome(id),a.staff),{headers});}catch(e){return failure(e);}}
const Input=z.object({action:z.enum(['draft','review','approve','decline','publish','withdraw']),revision:z.number().int().nonnegative(),content:OutcomeText.optional(),redaction_reviewed:z.boolean().optional(),consent:z.string().max(500).optional()}).strict();
export async function POST(req:Request,ctx:Ctx){try{
 if(!requestOriginAllowed(req))throw new CircuitError('Origin not allowed.',403);
 const {id}=await ctx.params;const a=await access(req,id);const raw=await req.text();if(raw.length>10000)throw new CircuitError('Record too large.',413);
 const b=Input.parse(JSON.parse(raw));return Response.json(view(await outcomeAction(id,a.email,a.staff,b),a.staff),{headers});
}catch(e){return failure(e);}}
