/** The standalone Node preview supplies Next's server-only build alias. */
import {registerHooks,createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
registerHooks({resolve(specifier,context,next){if(specifier==='server-only')return {url:pathToFileURL(require.resolve('next/dist/compiled/server-only/empty.js')).href,shortCircuit:true};return next(specifier,context);}});
// Reuse the deployed read-only AI service, without exporting its protected key.
if(!process.argv.includes('--offline-ai'))process.env.CONTEXT_AI_SERVICE='netify';
const {serveContextPreview}=await import('./context-space-preview.ts');const {renderProviderFirst}=await import('./context-provider-first.ts');serveContextPreview(renderProviderFirst);
