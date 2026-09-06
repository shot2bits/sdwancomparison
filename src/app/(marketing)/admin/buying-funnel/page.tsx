import type {Metadata} from 'next';
import BuyingFunnelReport from '@/components/BuyingFunnelReport';
export const metadata:Metadata={title:'Buying outcomes',robots:{index:false,follow:false}};
export default function Page(){return <article className="mx-auto max-w-6xl px-6 py-12 text-slate-800"><a href="/sase/admin/" className="text-sm underline">Marketplace admin</a><h1 className="mt-5 text-3xl font-semibold">Buying outcomes</h1><p className="mt-4 max-w-3xl leading-7">Track saved projects, preparation, business verification, board publication and supplier responses. These are operational counts from the server, separate from search impressions and clicks.</p><BuyingFunnelReport/></article>;}
