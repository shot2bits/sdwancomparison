import {readFileSync,writeFileSync} from 'node:fs';
import {buildShortlistMarketView} from '../src/lib/shortlist-market-views';
import {PUBLIC_EVIDENCE_ORDER,PUBLIC_EVIDENCE_NOTICE,PUBLIC_EVIDENCE_CONTRACT} from '../src/lib/public-provider-evidence';
const before=JSON.parse(readFileSync('../facts-validation/shortlist-before-live.json','utf8'));
const view='sase-vendors';
const result={capture:'Live JSON captured 15 September 2026; after replays the same captured catalogue through the patched projection. This does not deploy it.',source:before.runtime_provider_source,before:{ordering:before.ordering,...before.market_views[view]},after:{...before.market_views[view],contract:PUBLIC_EVIDENCE_CONTRACT,ordered_by:PUBLIC_EVIDENCE_ORDER,answer:PUBLIC_EVIDENCE_NOTICE,providers:buildShortlistMarketView(before.vendors,view)}};
writeFileSync('../../outputs/Netify_Public_Evidence_Order_Before_After_2026-09-15.json',JSON.stringify(result,null,2));
console.log(result.before.providers[0].name+' -> '+result.after.providers[0].name);
