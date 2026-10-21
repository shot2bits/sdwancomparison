import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Directory from '../src/components/ShortlistProviderDirectory';
import content from '../data/shortlist-buyer-profiles.json';
const vendors = content.profiles.map(p => ({slug:p.slug,name:p.name,category:p.role.toLowerCase()}));
const html = renderToStaticMarkup(<Directory vendors={vendors} selected={{'cato-networks':['demo']}} onChoose={()=>{}} onReview={()=>{}} reviewMessage=""/>);
assert.equal(content.profiles.length,30);
assert.equal(new Set(content.profiles.map(p=>p.slug)).size,30);
assert(html.includes('Self-managed, co-managed or fully managed'));
assert(html.includes('Hands-Free Management'));
assert(html.includes('Customer deployments'));
assert(html.includes('Ulta Beauty'));
assert(html.includes('customer-requested') || html.includes('Customer-requested'));
assert(!html.includes('research completeness'));
assert(!html.includes('Not confirmed'));
assert(!html.includes('Evidenced'));
assert(html.includes('1 provider selected'));
for(const p of content.profiles){
  assert(p.facts.length>0,p.slug);
  assert(html.includes(`id="provider-${p.slug}"`),p.slug);
  for(const f of p.facts){assert.equal(new URL(f.url).protocol,'https:');assert(f.qualification!==undefined);}
  assert(p.offers.every(o=>!o.name.includes('Black Lotus Labs')));
}
console.log('PASS: all 30 profiles are server-rendered; Cato management, source links, case scope and selection state retained; grading labels absent.');
