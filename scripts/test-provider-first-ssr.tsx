import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Catalogue from '../src/components/ProviderCatalogue';
import { originalBuyerChecklist } from '../src/lib/original-buyer-checklist';
import type { PublishedProvider } from '../src/lib/sector-comparison';
const {JSDOM} = createRequire(import.meta.url)('jsdom') as {JSDOM: new(html:string) => {window:{document:Document}}};

const origin = 'http://127.0.0.1:3017';
const response = await fetch(origin + '/providers/', {headers:{connection:'close'}});
assert.equal(response.status, 200);
assert.match(response.headers.get('content-security-policy') ?? '', /script-src 'self'/);
assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
const html = await response.text();
const page = new JSDOM(html).window.document;
page.querySelectorAll('script').forEach(s => s.remove());
const library = await (await fetch(origin + '/api/context-preview/library', {headers:{connection:'close'}})).json();
assert.equal(library.unavailable_providers.length, 0, 'Cannot pass an incomplete catalogue');
assert.equal(library.provider_records.length, 30);
const providers: PublishedProvider[] = library.provider_records;
assert.equal(page.querySelectorAll('[data-pf-row]').length, providers.length);
assert.equal(page.querySelectorAll('[data-pf-profile-record]').length, providers.length);
let rows = 0, checklistParagraphs = 0;
for (const record of providers) {
  const profile = page.getElementById('pf-provider-' + record.provider.slug);
  assert(profile, record.provider.slug);
  assert(profile.textContent?.includes(record.revision.id));
  // Compare the source rows as text to prove they are in actual HTML, not script JSON.
  const sections = ['products','capabilities','geographies','service_models','compliance','integrations','sector_evidence','case_studies','evaluations','evidence_sources'] as const;
  for (const section of sections) for (const row of record[section] ?? []) {
    rows++;
    for (const value of Object.values(row)) {
      const text = typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value ?? '');
      assert(profile.textContent?.includes(text), `${record.provider.slug}/${section}: source value missing`);
    }
  }
  const checklist = originalBuyerChecklist(record.provider.slug, record.revision.dataset_version);
  for (const paragraph of checklist?.paragraphs ?? []) { assert(profile.textContent?.includes(paragraph)); checklistParagraphs++; }
}
// A future provider without a manually written profile must still be rendered.
const extra = structuredClone(providers[0]);extra.provider.slug='future-provider';extra.provider.display_name='Future provider';
const future = renderToStaticMarkup(<Catalogue providers={[extra]} />);
assert(future.includes('data-pf-row="future-provider"'));
assert(future.includes('data-pf-profile-record="future-provider"'));
const malicious = structuredClone(extra);malicious.provider.display_name='<script>bad()</script>';
assert(!renderToStaticMarkup(<Catalogue providers={[malicious]} />).includes('<script>bad()'));
for (const path of ['/sd-wan-for-healthcare/','/sd-wan-sase-for-manufacturing/','/sd-wan-sase-for-retail/','/sd-wan-sase-for-financial-services/']) assert(page.querySelector(`a[href="https://netify.co.uk${path}"]`));
assert(!html.includes('/sase/shortlist/sector/'));
const legacy = new JSDOM(await (await fetch(origin + '/locations/', {headers:{connection:'close'}})).text()).window.document;
assert(!legacy.querySelector('#provider-first-entrance'), 'Original location preview must remain unchanged');
for (const id of ['ns-living-rfp','ns-buying-workspace','ns-project-room']) assert(page.getElementById(id), id);
console.log(`PASS: HTTP initial HTML without scripts contains all ${providers.length} providers, ${rows} complete research rows and ${checklistParagraphs} original checklist paragraphs; approved metadata, existing sector URLs, CSP and original sections retained. ${html.length} HTML characters.`);
