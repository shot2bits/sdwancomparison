import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

// Render the actual component for each API recovery state, without network or effects.
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/components/SourcingConfirmation.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
for (const [already_confirmed, access, showProject] of [[false,false,true],[true,true,true],[true,false,false]] as const) {
  let stateCall = 0;
  const exports: { default?: React.ComponentType } = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    if (name === 'react') return { useEffect: () => {}, useState: () => [stateCall++ === 0 ? {
      status:'desk_review', already_confirmed, access,
      project_url:'/sase/rfp-builder/rfp_test/', sign_in_url:'/sase/account/'
    } : false, () => {}] };
    if (name === '@/lib/sourcing-contract') return { SOURCING_ACTION_LABELS: {} };
    return require(name);
  }});
  const html = renderToStaticMarkup(createElement(exports.default!));
  assert.equal(html.includes('Open your private project'), showProject);
  assert.equal(html.includes('Sign in with the same work email'), already_confirmed && !access);
}
console.log('PASS actual confirmation component: first confirmation and authorised refresh show project; other browser shows sign-in');
