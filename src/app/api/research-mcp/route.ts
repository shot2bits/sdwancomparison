import {buyerMcpResponse} from '@/lib/core-buyer-mcp';
export async function GET(request:Request){return buyerMcpResponse(request,{},true);}
export async function POST(request:Request){return buyerMcpResponse(request,{},true);}
export async function OPTIONS(request:Request){return buyerMcpResponse(request,{},true);}
