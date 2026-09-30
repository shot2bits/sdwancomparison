import {writeFileSync} from 'node:fs';
import snapshot from '../data/shortlist-public-snapshot.json';
import {getLiveShortlistDataset} from '../src/lib/live-shortlist';
import {SECTOR_KEYS} from '../src/lib/shortlist-core';
const after=await getLiveShortlistDataset();const positive=(v:unknown)=>['yes','partial','partner_integrated'].includes(String(v));
const rows=SECTOR_KEYS.map(sector=>({sector,before:snapshot.vendors.filter(v=>positive(v.sectors[sector])).length,after:after.vendors.filter(v=>positive(v.sectors[sector])).length}));
writeFileSync('docs/action-first/sector-counts.json',JSON.stringify({source:after.source,rows},null,2));console.log(rows);
