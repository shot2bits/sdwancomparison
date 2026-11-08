/** Local acceptance only: a REST bridge to a dedicated real Redis and synthetic provider feed. */
import {createServer} from 'node:http';
import {RealRedisFixture} from './real-redis-fixture';
import {getShortlistDataset} from '../src/lib/vendors';
import {ProviderMatchRecordSchema} from '../src/lib/provider-matching';
const port=process.env.NETIFY_TEST_REDIS_PORT;
if(!port)throw new Error('A dedicated local test Redis port is required.');
const store=new RealRedisFixture(port,process.env.NETIFY_TEST_REDIS_CLI||'redis-cli');
const providers=getShortlistDataset().map(v=>ProviderMatchRecordSchema.parse({provider_id:v.slug,slug:v.slug,display_name:v.name,provider_types:['managed_service_provider'],revision_id:`fixture:${v.slug}`,dataset_version:'fixture:studio',capabilities:{},regions:{},service_models:{},sectors:{}}));
const server=createServer(async(req,res)=>{
 if(req.url==='/providers'){res.setHeader('content-type','application/json');res.end(JSON.stringify({contract_version:'provider-match-records/2.0.0',providers}));return;}
 if(req.method!=='POST'||req.headers.authorization!=='Bearer studio-local-fixture'){res.writeHead(403);res.end();return;}
 try{const parts:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4000000)throw new Error('Limit');parts.push(chunk);}const result=store.command(JSON.parse(Buffer.concat(parts).toString()));res.setHeader('content-type','application/json');res.end(JSON.stringify({result}));}catch{res.writeHead(500);res.end(JSON.stringify({error:'Local fixture command failed'}));}
});
server.listen(6398,'127.0.0.1',()=>console.log('Isolated Redis REST and synthetic provider feed ready on 6398. No hosted storage or external email.'));
