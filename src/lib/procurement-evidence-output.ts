/** Server-rendered output from permission-cleared evidence only. Not mounted on a public route. */
import {publicProcurementEvidence,ProcurementEvidenceSchema} from './procurement-foundation';
import type {z} from 'zod';
const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderProcurementEvidence(records:z.infer<typeof ProcurementEvidenceSchema>[],now:number){
 const visible=publicProcurementEvidence(records,now);
 return '<main data-contract="netify-procurement-evidence/1" data-record-count="'+visible.length+'">'+visible.map(r=>'<article data-evidence-id="'+escape(r.id)+'"><h2>'+escape(r.statement)+'</h2><dl><dt>Source</dt><dd>'+escape(r.source)+'</dd><dt>Evidence type</dt><dd>'+escape(r.verification)+'</dd><dt>Observed</dt><dd><time>'+escape(r.observedAt)+'</time></dd><dt>Service</dt><dd>'+escape(r.service)+'</dd><dt>Method</dt><dd>'+escape(r.method)+'</dd><dt>Review due</dt><dd><time>'+escape(r.reviewAt)+'</time></dd>'+('sampleSize' in r&&r.sampleSize!==null?'<dt>Sample size</dt><dd>'+escape(r.sampleSize)+'</dd>':'')+'</dl><ul>'+r.limitations.map(l=>'<li>'+escape(l)+'</li>').join('')+'</ul></article>').join('')+'</main>';
}
