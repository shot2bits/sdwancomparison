import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const protocol=JSON.parse(readFileSync('docs/citation-panel/protocol.json','utf8'));
for(const f of ['retrieval_observability','netify_retrieved','cited_urls','named_next_step','qualified_request_count','retrieved_page_version','deployment_sha'])assert(protocol.record_fields.includes(f));
assert(protocol.definitions.retrieval_observability.includes('null, not false'));
assert(protocol.limitations.includes('Royal London'));
assert(protocol.buyer_variations.length===3);
console.log('PASS retrieval uncertainty, citations, recommendations and buyer outcomes remain separate');
