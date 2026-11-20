// Match the standalone development server's Next server-only resolution.
import {registerHooks,createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);registerHooks({resolve(s,c,next){if(s==='server-only')return {url:pathToFileURL(require.resolve('next/dist/compiled/server-only/empty.js')).href,shortCircuit:true};return next(s,c);}});
