import assert from 'node:assert/strict';
import {authReturnPath, publicationProjectFromReturn} from '../src/lib/auth-return';
for(const path of ['/sase/home/?project=rfp_abc123','/sase/home/?id=rfp_abc123','/sase-sd-wan-rfp-builder/?id=rfp_abc123','/sase/workspace/?journey=quick_list&project=rfp_abc123','/sase-sd-wan-rfp-builder/?project=rfp_abc123','/sase/rfp-builder/rfp_abc123/?welcome=submitting'])assert.equal(publicationProjectFromReturn(path),'rfp_abc123');
for(const path of ['https://evil.test/sase/workspace/?project=rfp_abc123','//evil.test/sase/workspace/?project=rfp_abc123','/sase/other/?project=rfp_abc123','/sase/workspace/?project=not-a-project','/sase/workspace/?project=rfp_abc%2F123'])assert.equal(publicationProjectFromReturn(path),null);
assert.equal(authReturnPath('//evil.test'),'');
console.log('PASS publication return paths, private project binding and external URL rejection');
