import assert from 'node:assert/strict';
import {parseCompanyOverview} from '../preview/context-space/company-overview.js';
const original='We are a manufacturer with 12 sites and 1,200 users in the UK and Europe. We need SASE, audit evidence and a phased migration. We use Microsoft 365 and Azure.';
const p=parseCompanyOverview(original);assert.equal(p.original,original);assert.equal(p.fields.sector,'manufacturing');assert.equal(p.fields.sites,12);assert.equal(p.fields.users,1200);assert.deepEqual(p.fields.regions,['uk_ireland','europe']);assert.equal(p.fields.scope,'sase');assert.deepEqual(p.fields.applications,['Microsoft 365']);assert.deepEqual(p.fields.cloud_services,['Microsoft Azure']);assert.equal(p.featureNeeds[0],'We need SASE, audit evidence and a phased migration.');
const partial=parseCompanyOverview('We are a hospital.');assert.equal(partial.fields.sector,'healthcare');assert(!('sites' in partial.fields));assert(!('scope' in partial.fields));
const ambiguous=parseCompanyOverview('We work with healthcare and financial services.');assert(!('sector' in ambiguous.fields));assert(ambiguous.warnings.some(s=>s.includes('More than one sector')));
const large=parseCompanyOverview('Original words '.repeat(1000)+'END');assert(large.original.endsWith('END'));assert.equal(large.original.length,15003);
console.log('PASS: company overview suggestions preserve original wording, source matches, sector ambiguity, explicit scale, scope, regions, applications, cloud and unmet details.');
