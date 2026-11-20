import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {contextCatalogue} from '../src/lib/context-comparison-preview';
import {projectQuestionCatalogue} from '../src/lib/context-project-preview';
import {getShortlistDataset} from '../src/lib/vendors';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {finalWorkspaceClient} from '../src/lib/final-workspace-client';
import {finalPlatformClient,honestPlatformStatus} from '../src/lib/final-public-status';
import {serverResellerClient,disabledResellerClient,disabledWorkspaceMode} from '../src/lib/final-reseller-client';
assert.equal(contextCatalogue().sectors.length,10);assert.equal(contextCatalogue().products.length,13);assert.equal(projectQuestionCatalogue().length,386);assert.equal(getShortlistDataset().length,30);
const before=JSON.parse(await readFile('docs/final-nine-20261116/interface-baseline.json','utf8'));for(const [file,hash] of Object.entries(before)){const actual=createHash('sha256').update(await readFile('preview/context-space/'+file)).digest('hex');assert.equal(actual,hash,'Accepted interface changed: '+file);}await mkdir('/private/tmp/netify-final-nine-syntax',{recursive:true});
const sources={workspace:finalWorkspaceClient,status:finalPlatformClient,reseller:serverResellerClient(await readFile('preview/context-space/partner-workspace.js','utf8'))};for(const [name,text] of Object.entries(sources)){const path='/private/tmp/netify-final-nine-syntax/'+name+'.mjs';await writeFile(path,text);execFileSync(process.execPath,['--check',path]);}
assert(!sources.reseller.includes('simulate_customer_approval'));assert(!sources.reseller.includes('simulate_customer_revocation'));assert(sources.reseller.includes('customerEmail'));assert(sources.reseller.includes('/core/partners/'));assert(!honestPlatformStatus('Private local project Context room get bids from 30+ curated partners').includes('curated partners'));
console.log('PASS: every accepted interface source byte-identical, new script syntax, no simulated customer approval in server reseller adapter, factual status substitutions');

assert(disabledResellerClient.includes('Reseller access is not enabled.'));assert(disabledResellerClient.includes('/go/bt-reseller-application/'));assert(!/form|localStorage|fetch\(/.test(disabledResellerClient));assert(!disabledWorkspaceMode(await readFile('preview/context-space/workspace-mode.js','utf8')).includes('Reseller mode · Working with your customers'));
