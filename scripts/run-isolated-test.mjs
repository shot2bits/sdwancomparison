/** Supply Next's server-only alias in isolated Node tests; never weakens application imports. */
import {registerHooks,createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const target=process.argv[2];if(!target||!/^scripts\/test-[a-z0-9-]+\.(?:ts|mjs)$/.test(target))throw Error('Select an existing local test script.');
registerHooks({resolve(specifier,context,next){if(specifier==='server-only')return {url:pathToFileURL(require.resolve('next/dist/compiled/server-only/empty.js')).href,shortCircuit:true};return next(specifier,context);}});
await import(pathToFileURL(resolve(target)).href);
