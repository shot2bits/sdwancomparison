import {GET as route} from '../../api/context-preview/core/oauth/[action]/route';
export const dynamic='force-dynamic';export const runtime='nodejs';
export const GET=(req:Request)=>route(req,{params:Promise.resolve({action:'resource'})});
