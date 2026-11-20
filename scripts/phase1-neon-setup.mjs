// One-use loopback credential handoff. Never logs or returns the connection string.
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const nonce=randomBytes(24).toString('hex');
const origin='http://127.0.0.1:3021';
const server=createServer(async(req,res)=>{
 res.setHeader('cache-control','no-store');res.setHeader('referrer-policy','no-referrer');
 res.setHeader('content-security-policy',"default-src 'none'; form-action 'self'; frame-ancestors 'none'");
 if(req.headers.host!=='127.0.0.1:3021'){res.writeHead(403);res.end();return;}
 if(req.method==='GET'&&req.url===`/${nonce}`){res.setHeader('content-type','text/html');res.end(`<title>Local Neon branch connection</title><h1>Connect the isolated Phase 1 branch</h1><p>Only the approved development endpoint is accepted. No production settings change.</p><form method="post" action="/${nonce}"><label>Development connection string <input name="connection" type="password" autocomplete="off" size="80" required></label><button>Connect local preview</button></form>`);return;}
 // The desktop's isolated browser submits forms with an opaque Origin.
 // The one-use 192-bit URL nonce, strict loopback host and endpoint allowlist remain mandatory.
 if(req.method==='POST'&&req.url===`/${nonce}`&&[origin,'null'].includes(req.headers.origin)){
  let raw='';for await(const c of req){raw+=c;if(raw.length>10000){res.writeHead(413);res.end();return;}}
  try {const connection=new URLSearchParams(raw).get('connection');const u=new URL(connection);
   if(u.hostname!=='ep-old-union-zaxn5pyr-pooler.c-2.eu-west-2.aws.neon.tech'||u.protocol!=='postgresql:'||u.pathname!=='/neondb'||!u.password)throw Error();
   await writeFile('.env.phase1.local',`NETIFY_CORE_DATABASE_URL=${connection}\nNETIFY_CORE_BRANCH_ID=br-aged-union-zar77mut\nNETIFY_CORE_ENABLED=1\n`,{mode:0o600,flag:'wx'});
   res.end('Development connection saved privately. No tables or production settings changed.');server.close();
  }catch{res.writeHead(400);res.end('Connection not saved. Use the approved branch connection.');}return;
 }res.writeHead(404);res.end();
});server.listen(3021,'127.0.0.1',()=>console.log(`${origin}/${nonce}`));
