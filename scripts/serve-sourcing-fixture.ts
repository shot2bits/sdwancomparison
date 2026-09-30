// Local browser verification only. Synthetic state from test-sourcing-routes.
import http from 'node:http';
import fs from 'node:fs';
import { FakeKvStore } from './fake-kv-harness';
if(process.env.NODE_ENV==='production')throw Error('Fixture server is local testing only');
const fixture=JSON.parse(fs.readFileSync('/tmp/netify-sourcing-walkthrough-fixture.json','utf8'));
const store=new FakeKvStore();for(const c of fixture.commands)store.command(c);
http.createServer(async(req,res)=>{try{if(req.headers.authorization!=='Bearer local-synthetic-fixture'){res.writeHead(401);res.end();return;}let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>3000000)throw Error('too large');}const result=store.command(JSON.parse(raw));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({result}));}catch{res.writeHead(500);res.end(JSON.stringify({error:'Fixture command failed'}));}}).listen(8787,'127.0.0.1',()=>console.log('Synthetic KV ready on loopback:8787'));
