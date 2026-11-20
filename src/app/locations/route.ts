import {coreCanonicalOrigin,coreLocationPath} from '@/lib/core-host';
/** One migration redirect only. New links are generated at /marketplace/ directly. */
export function GET(request:Request){const source=new URL(request.url),target=new URL(coreCanonicalOrigin(source.origin)+coreLocationPath());target.search=source.search;return Response.redirect(target,308);}
export const runtime='nodejs';
export const dynamic='force-dynamic';
