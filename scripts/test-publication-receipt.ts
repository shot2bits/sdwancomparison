import assert from 'node:assert/strict';
import { publicationReceipt } from '../src/lib/publication-receipt';
assert.match(publicationReceipt(true), /published on the Opportunity Board/);
assert.match(publicationReceipt(true), /does not guarantee/);
assert.doesNotMatch(publicationReceipt(true), /Submitted to|don't need an account|with your matched vendors/);
assert.match(publicationReceipt(false), /publication is not complete/);
console.log('PASS publication receipt separates saved, published and supplier participation');
