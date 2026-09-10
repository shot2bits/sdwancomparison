import assert from 'node:assert/strict';
import {Document,Packer,Paragraph} from 'docx';
import {POST as readFile} from '../src/app/api/workspace/ingest-file/route';
import {chunkForIngest,ingestSummary} from '../src/lib/workspace/ingest';
const raw='  Original RFI\r\n'+('Manufacturing failover must protect OT.\r\n\r\n'.repeat(500))+'EXACT LAST APPENDIX';
const plan=chunkForIngest(raw);
assert.equal(plan.totalChars,raw.length);assert(plan.truncated);assert(ingestSummary(3,1,plan,'file').startsWith('Read your file:'));
async function request(text:string){const bytes=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph(text)]}]}));const form=new FormData();form.set('file',new File([new Uint8Array(bytes)],'test.docx'));return readFile(new Request('http://localhost/sase/api/workspace/ingest-file',{method:'POST',body:form}));}
const ok=await request('Original source ends with UNIQUE_APPENDIX');const data=await ok.json();assert.equal(ok.status,200);assert(data.text.includes('UNIQUE_APPENDIX'));assert.equal(data.original_chars,data.text.length);assert.equal(data.retained_chars,data.text.length);assert.equal(data.truncated,false);
const rejected=await request('A'.repeat(200001));const error=await rejected.json();assert.equal(rejected.status,413);assert(error.original_chars>200000);assert.equal(error.retained_chars,0);assert.equal(error.text,undefined);assert.match(error.error,/Nothing from this file was added/);
console.log('PASS ingestion: raw character counts, file source labels, complete accepted DOCX, explicit oversized rejection with no partial content');
