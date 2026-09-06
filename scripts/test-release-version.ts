import assert from 'node:assert/strict';
import {releaseVersion} from '../src/lib/build-info';
assert.equal(releaseVersion('2026-09-06T14:40:00Z'),'0609261540');
assert.equal(releaseVersion('2026-12-31T23:59:00Z'),'3112262359');
assert.equal(releaseVersion('2026-06-30T23:05:00Z'),'0107260005');
assert.equal(releaseVersion('invalid'),'development');
console.log('PASS UK release timestamp, summer time, midnight and invalid build time');
