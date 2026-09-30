// Loopback-only synthetic browser verification; never deployed as an app route.
import http from 'node:http';
import fs from 'node:fs';
import {FakeKvStore} from './fake-kv-harness';
if(process.env.NODE_ENV==='production')throw Error('Local verification only');
const fixture=JSON.parse(fs.readFileSync('/tmp/netify-outcome-browser-fixture.json','utf8'));
const store=new FakeKvStore();for(const command of fixture.commands)store.command(command);
http.createServer(async(req,res)=>{
 if(req.method==='GET'&&['/staff','/buyer'].includes(req.url??'')){
  // Synthetic cookies only, on localhost. Clear staff identity before buyer grant.
  res.setHeader('Set-Cookie',req.url==='/staff'?[fixture.staff_cookie+'; Path=/; HttpOnly; SameSite=Lax']:[fixture.buyer_cookie+'; Path=/sase/; HttpOnly; SameSite=Lax','netify_session=; Path=/; Max-Age=0']);
  res.writeHead(302,{Location:req.url==='/staff'?'http://localhost:3112/sase/admin/sourcing/':`http://localhost:3112/sase/rfp-builder/${fixture.id}/`});res.end();return;
 }
 if(req.headers.authorization!=='Bearer local-synthetic-fixture'){res.writeHead(401);res.end();return;}
 try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>3000000)throw Error('Too large');}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({result:store.command(JSON.parse(raw))}));}catch{res.writeHead(500);res.end(JSON.stringify({error:'Synthetic fixture command failed'}));}
}).listen(8791,'127.0.0.1',()=>console.log('Synthetic outcome fixture ready on loopback:8791'));
