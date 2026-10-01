import assert from 'node:assert/strict';
import {requestOriginAllowed} from '../src/lib/request-origin';
const original={...process.env};
try {
 process.env.VERCEL_ENV='production';process.env.VERCEL_URL='netify-build.vercel.app';delete process.env.VERCEL_BRANCH_URL;
 const request=(origin?:string, extra:Record<string,string>={})=>new Request('https://project-8q2xb.vercel.app/sase/api/sourcing/plan',{headers:{...(origin?{origin}:{}),...extra}});
 assert.equal(requestOriginAllowed(request('https://netify.co.uk')),true);
 assert.equal(requestOriginAllowed(request('https://project-8q2xb.vercel.app')),true);
 assert.equal(requestOriginAllowed(request('https://netify-build.vercel.app')),true);
 for(const origin of ['https://evil.example','https://netify.co.uk.evil.example','https://other.vercel.app','null','http://netify.co.uk','https://netify.co.uk/path'])assert.equal(requestOriginAllowed(request(origin,{'x-forwarded-host':'netify.co.uk'})),false,origin);
 process.env.VERCEL_ENV='preview';assert.equal(requestOriginAllowed(request('https://netify.co.uk')),false);assert.equal(requestOriginAllowed(request('https://netify-build.vercel.app')),true);
 assert.equal(requestOriginAllowed(request()),true);
} finally {process.env=original;}
console.log('PASS exact proxy origins, preview separation, spoofed forwarded host and lookalike rejection');
