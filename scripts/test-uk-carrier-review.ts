import assert from 'node:assert/strict';
import {UK_CARRIER_REVIEWS,applyProjectionReview} from '../src/lib/provider-projection-review';
import {getShortlistDataset} from '../src/lib/vendors';
import {buildShortlist} from '../src/lib/shortlist-core';
const expected=['bt-business','colt-technology-services','virgin-media-o2','vodafone-business'];assert.deepEqual(Object.keys(UK_CARRIER_REVIEWS).sort(),expected);
const before=getShortlistDataset(),after=structuredClone(before);for(const p of after){p.uk_delivery='not_confirmed';p.uk_basis='not confirmed';}
for(const p of after){const review=UK_CARRIER_REVIEWS[p.slug];if(review){assert(review.source_urls.every(u=>u.startsWith('https://')));assert(review.qualification);applyProjectionReview(p,{revision_id:'fixture',reviewed_at:undefined,sectors:{}},before.find(v=>v.slug===p.slug)!,review);assert.equal(p.regions.uk_ireland,'yes');}else assert.equal(p.uk_delivery,'not_confirmed');}
const result=buildShortlist(after,{uk_provider_only:true,required_regions:['uk_ireland'],shortlist_size:30},{});assert.deepEqual(result.shortlist.map(v=>v.slug).sort(),expected);
for(const p of after){const original=before.find(v=>v.slug===p.slug)!;assert.deepEqual(p.capabilities,original.capabilities);assert.deepEqual(p.sectors,original.sectors);}
console.log('PASS UK-only filter: bt-business, colt-technology-services, virgin-media-o2, vodafone-business; four sourced reviews; other UK grades remain not_confirmed; capability/sector grades unchanged');
