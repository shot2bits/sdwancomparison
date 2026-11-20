/** Explicit local-only setup. Prints file paths, never credentials. */
import {registerHooks,createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
registerHooks({resolve(specifier,context,next){if(specifier==='server-only')return {url:pathToFileURL(require.resolve('next/dist/compiled/server-only/empty.js')).href,shortCircuit:true};return next(specifier,context);}});
const path=process.argv[2];if(!path)throw Error('Pass a local JSON file containing scope, projectUrl and optional test suppliers. Never use live credentials or supplier records.');
const input=JSON.parse(await readFile(path,'utf8'));const {configureLocalPricingWorkflow}=await import('./context-pricing-workflow.ts');console.log(JSON.stringify(await configureLocalPricingWorkflow(input.scope,input.projectUrl,input.suppliers??[]),null,2));
