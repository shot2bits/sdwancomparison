import {startFakeKv} from './lib/fake-kv-server.mjs';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
const feed = {};
if (process.env.ACCEPTANCE_FEED_ENV) {
  const source = parseEnv(readFileSync(process.env.ACCEPTANCE_FEED_ENV, 'utf8'));
  for (const name of ['PROVIDER_MATCH_DATA_URL', 'PROVIDER_MATCH_SERVICE_TOKEN', 'PROVIDER_MATCH_PROTECTION_BYPASS']) {
    if (source[name]) feed[name] = source[name];
  }
}
if (process.env.ACCEPTANCE_FIXTURE_FEED === '1') {
  const catalogue = JSON.parse(readFileSync(new URL('../data/governed-provider-catalogue.json', import.meta.url), 'utf8'));
  const supported = {support_state:'supported',freshness_state:'current',confidence:'high',qualification:'Local acceptance fixture, not market evidence'};
  const records = catalogue.providers.map(({provider})=>({provider_id:provider.id,slug:provider.slug,display_name:provider.display_name,provider_types:provider.provider_types,revision_id:'acceptance-fixture',dataset_version:'acceptance-fixture',capabilities:{sd_wan:supported,ztna:supported,secure_web_gateway:supported,high_availability:supported},regions:{'United Kingdom':supported,Europe:supported},service_models:{fully_managed:supported},sectors:{Manufacturing:{...supported,evidence_strength:'strong'}}}));
  const fixture = createServer((_req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({contract_version:'provider-match-records/2.0.0',providers:records}));});
  await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
  feed.PROVIDER_MATCH_DATA_URL = `http://127.0.0.1:${fixture.address().port}`;
  feed.PROVIDER_MATCH_SERVICE_TOKEN = 'local-fixture-only';
}
const kv=await startFakeKv();
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3137'],{stdio:'inherit',env:{...process.env,...feed,RESEND_API_KEY:'',KV_REST_API_URL:kv.url,KV_REST_API_TOKEN:kv.token}});
process.on('SIGINT',()=>{server.kill();process.exit();});
