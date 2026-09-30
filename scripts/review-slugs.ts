import { getLiveShortlistDataset } from "../src/lib/live-shortlist";
import { REVIEWED_PROVIDER_PROJECTIONS } from "../src/lib/provider-projection-review";
const ds = await getLiveShortlistDataset();
const slugs = new Set(ds.vendors.map(v => v.slug));
console.log("dataset source:", (ds as any).source ?? (ds as any).dataset_source, "vendors:", slugs.size);
const reviewed = Object.keys(REVIEWED_PROVIDER_PROJECTIONS);
console.log("reviewed slugs missing from dataset:", reviewed.filter(s => !slugs.has(s)));
console.log("dataset slugs with no review:", [...slugs].filter(s => !reviewed.includes(s)));
for (const s of ["bt-business","virgin-media-o2","vodafone-business","colt-technology-services","colt"]) { const v = ds.vendors.find(v=>v.slug===s); console.log(s, v ? `present uk_delivery=${(v as any).uk_delivery} resolution=${(v as any).projection_provenance?.resolution} sectors=${JSON.stringify((v as any).sectors ? Object.entries((v as any).sectors).filter(([,x])=>x==="yes"||x==="partial").map(([k])=>k):null)}` : "ABSENT"); }
