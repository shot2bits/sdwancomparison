/** Local read-only Redis REST facade over synthetic publication fixtures. No upstream storage. */
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {FakeKvStore} from './fake-kv-harness';
const store=new FakeKvStore();
for(const command of JSON.parse(readFileSync('../facts-validation/preview-find_providers.json','utf8')))store.command(command);
const readOnly=new Set(['GET','MGET','LRANGE','SMEMBERS','SISMEMBER','HGETALL','HGET','ZRANGE','ZREVRANGE','SCAN','EXISTS']);
createServer(async(req,res)=>{
 try {const parts=[];for await(const part of req)parts.push(part);const command=JSON.parse(Buffer.concat(parts).toString());
 if(!Array.isArray(command)||!readOnly.has(String(command[0]).toUpperCase())){res.writeHead(403,{'content-type':'application/json'});res.end(JSON.stringify({error:'Synthetic preview is read-only'}));return;}
 const result=store.command(command);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({result}));
 }catch(error){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:String(error)}));}
}).listen(3190,'127.0.0.1',()=>console.log('Synthetic read-only storage listening on 127.0.0.1:3190'));
