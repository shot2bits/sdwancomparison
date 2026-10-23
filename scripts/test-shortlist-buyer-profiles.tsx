import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Directory from '../src/components/ShortlistProviderDirectory';
import content from '../data/shortlist-buyer-profiles.json';
const vendors = content.profiles.map(p => ({slug:p.slug,name:p.name,category:p.role.toLowerCase()}));
const html = renderToStaticMarkup(<Directory vendors={vendors} selected={{'cato-networks':['demo']}} onChoose={()=>{}} onReview={()=>{}} reviewMessage=""/>);
assert.equal(content.profiles.length,30);
assert(html.includes('Showing 30 of 30 providers.'));
assert.equal((html.match(/class="buyer-profile"/g) ?? []).length,30);
assert.equal((html.match(/class="buyer-profile-toggle"/g) ?? []).length,30);
assert(!html.includes('hidden=""'));
assert(!html.includes('Show all 30 providers'));
assert(html.includes('Expand all profiles'));
assert(html.includes('Collapse all profiles'));
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
  const section = html.split(`id="provider-${p.slug}"`)[1].split('</details>')[0];
  assert(section.includes(`<h3>${p.name.replaceAll('&', '&amp;')}</h3>`),p.slug);
  if(p.slug!=='bt-business') assert(section.includes(p.facts[0].label),p.slug);
  for(const f of p.facts){assert.equal(new URL(f.url).protocol,'https:');assert(f.qualification!==undefined);}
  assert(p.offers.every(o=>!o.name.includes('Black Lotus Labs')));
}
assert(html.includes('data-original-author="Harry Yelland"'));
assert(html.includes('Read the full BT profile and research updates'));
console.log('PASS: all 30 profiles are server-rendered; Cato management, source links, case scope and selection state retained; grading labels absent.');
