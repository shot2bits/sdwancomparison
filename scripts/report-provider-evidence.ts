import {writeFileSync,mkdirSync} from 'node:fs';
import {getLiveShortlistDataset} from '../src/lib/live-shortlist';
import {editorialReviewStatus} from '../src/lib/provider-editorial-review';
import {evidenceReviewHealth} from '../src/lib/evidence-review-health';
import reconciliation from '../data/provider-reconciliation.json';
const now=Date.now();
const dataset=await getLiveShortlistDataset();
const assessments=dataset.vendors.map(v=>({slug:v.slug,...editorialReviewStatus(v,undefined,now)}));
const report={generated_at:new Date(now).toISOString(),source:dataset.source,evidence_issues:dataset.evidenceIssues??[],dataset_versions:dataset.datasetVersions,assessments,evidence:evidenceReviewHealth(now),reconciliation:{version:reconciliation.version,review_due:reconciliation.review_due,days_remaining:Math.ceil((Date.parse(reconciliation.review_due)-now)/86400000)}};
mkdirSync('docs/evidence-reconciliation',{recursive:true});
writeFileSync('docs/evidence-reconciliation/review-health.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.evidence_issues.length||assessments.some(r=>['invalidated','expired','invalid'].includes(r.status))||report.evidence.expired||report.reconciliation.days_remaining<=0)process.exitCode=1;
if(process.argv.includes('--require-live') && dataset.source!=='neon'){console.error('Live feed required for release evidence report');process.exitCode=1;}
