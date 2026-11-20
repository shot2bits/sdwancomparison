import type {Metadata} from 'next';
import ThreadOpen from '@/components/ThreadOpen';

export const metadata:Metadata={title:'Open your Netify conversation',robots:{index:false,follow:false}};
export default function ThreadOpenPage(){
 return (
  <div className="mx-auto min-w-0 max-w-2xl px-6 py-12">
   <h1 id="page-h1" className="mb-4">Open your conversation</h1>
   <ThreadOpen/>
  </div>
 );
}
