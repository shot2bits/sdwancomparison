import assert from 'node:assert/strict';
import test from 'node:test';
import { lockMenuScroll } from '../src/lib/menu-scroll-lock.ts';

function fixture(growth, padding = '', computedPadding = '0px', overflow = '') {
  const style = { overflow, paddingRight: padding };
  const doc = { body: { style }, documentElement: { get clientWidth() { return 1200 + (style.overflow === 'hidden' ? growth : 0); } } };
  const view = { getComputedStyle: () => ({ paddingRight: computedPadding }) };
  return { doc, view, style };
}
test('classic scrollbar removal keeps the body content width stable and restores styles', () => {
  const f = fixture(15); const restore = lockMenuScroll(f.doc, f.view);
  assert.equal(f.doc.documentElement.clientWidth - parseFloat(f.style.paddingRight), 1200);
  assert.equal(f.style.overflow, 'hidden'); restore();
  assert.deepEqual(f.style, { overflow: '', paddingRight: '' });
});
test('overlay scrollbars and reserved gutters do not get extra compensation', () => {
  const f = fixture(0); const restore = lockMenuScroll(f.doc, f.view);
  assert.equal(f.style.paddingRight, ''); restore();
  assert.equal(f.style.overflow, '');
});
test('existing computed padding is added and the original inline value restored', () => {
  const f = fixture(15, '2rem', '32px', 'auto'); const restore = lockMenuScroll(f.doc, f.view);
  assert.equal(f.style.paddingRight, '47px'); restore();
  assert.deepEqual(f.style, { overflow: 'auto', paddingRight: '2rem' });
});
test('nested locks restore in reverse order without unlocking the outer menu', () => {
  const f = fixture(15); const outer = lockMenuScroll(f.doc, f.view);
  const inner = lockMenuScroll(f.doc, f.view); inner();
  assert.deepEqual(f.style, { overflow: 'hidden', paddingRight: '15px' });
  outer(); assert.deepEqual(f.style, { overflow: '', paddingRight: '' });
});
test('a pre-existing lock is preserved when the menu closes', () => {
  const f = fixture(0, '12px', '12px', 'hidden'); const restore = lockMenuScroll(f.doc, f.view);
  restore(); assert.deepEqual(f.style, { overflow: 'hidden', paddingRight: '12px' });
});
