import assert from 'node:assert/strict';
import {coreEnvironment,coreOriginAllowed,coreCanonicalOrigin,coreBuyerRegistryEnabled} from '../src/lib/core-host';
const original={...process.env};
try {
 process.env.VERCEL_ENV='production';process.env.NETIFY_CORE_LIVE='0';process.env.NETIFY_CORE_PHASE23='1';process.env.VERCEL_URL='approved-test.vercel.app';
 assert.equal(coreEnvironment(),'production');assert(!coreOriginAllowed('https://netify.co.uk'));assert(!coreBuyerRegistryEnabled());
 process.env.NETIFY_CORE_LIVE='1';assert(coreOriginAllowed('https://netify.co.uk'));assert(coreOriginAllowed('https://approved-test.vercel.app'));assert(!coreOriginAllowed('https://attacker.example'));assert(!coreOriginAllowed('http://netify.co.uk'));assert(!coreOriginAllowed('http://127.0.0.1'));assert.equal(coreCanonicalOrigin('https://approved-test.vercel.app'),'https://netify.co.uk');
 process.env.NETIFY_CORE_LEGACY_MCP='0';assert(coreBuyerRegistryEnabled());process.env.NETIFY_CORE_LEGACY_MCP='1';assert(!coreBuyerRegistryEnabled());
 process.env.VERCEL_ENV='preview';assert(coreOriginAllowed('https://approved-test.vercel.app'));assert(!coreOriginAllowed('https://netify.co.uk'));assert(coreBuyerRegistryEnabled());
 console.log('PASS: exact HTTPS origins, canonical project links, production-off default, and one legacy registry restore switch.');
} finally {process.env=original;}
