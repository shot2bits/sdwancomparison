import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import ThreadRoom from '@/components/ThreadRoom';
import {validThreadId} from '@/lib/agent-threads';

export const metadata:Metadata={title:'Netify conversation',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function ThreadPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validThreadId(id))notFound();
 return (
  <div className="mx-auto min-w-0 max-w-2xl px-6 py-12">
   <h1 id="page-h1" className="mb-4">Conversation</h1>
   <ThreadRoom id={id}/>
  </div>
 );
}
