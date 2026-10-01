import assert from "node:assert/strict";
import { sourcingReturnPath } from "../src/lib/sourcing-return-path";
import { validateSourcingOperations } from "./validate-sourcing-operations";
const path = "/sase/rfp-builder/rfp_abc123/";
assert.equal(sourcingReturnPath(`?return_to=${encodeURIComponent(path)}`),path);
for (const v of ["https://evil.test/", "//evil.test/", "/sase/rfp-builder/rfp_a/../", "/sase/account/", "/sase/rfp-builder/rfp_a/?x=y", "/sase/rfp-builder/rfp_a/\\evil"])
  assert.equal(sourcingReturnPath(`?return_to=${encodeURIComponent(v)}`),null);
assert.equal(sourcingReturnPath(`?return_to=${path}&return_to=${path}`),null);
const warnings:string[]=[]; const warn=console.warn;
try {
 console.warn=(v)=>warnings.push(String(v));
 assert.equal(validateSourcingOperations(Date.parse("2026-10-15T23:59:59Z"),"support@netify.com").expiring,0);
 assert.equal(validateSourcingOperations(Date.parse("2026-10-16T00:00:01Z"),"support@netify.com").expiring,23);
 assert.equal(validateSourcingOperations(Date.parse("2026-10-31T00:00:01Z"),"support@netify.com").expired,23);
 assert.equal(warnings.length,2);
 assert.throws(()=>validateSourcingOperations(Date.now(),""),/valid sourcing desk/);
} finally { console.warn=warn; }
console.log("PASS recovery paths reject external/ambiguous destinations; October review deadlines warn without blocking repairs; desk configuration remains mandatory");
