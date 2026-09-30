import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {publicOutcome} from '@/lib/market-outcomes';
import MarketOutcomeView from '@/components/MarketOutcomeView';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const {id}=await params;return {title:'Anonymous sourcing outcome | Netify Market Record',alternates:{canonical:`https://netify.co.uk/sase/shortlist/outcomes/${id}/`}};}
export default async function OutcomePage({params}:{params:Promise<{id:string}>}){const r=await publicOutcome((await params).id);if(!r)notFound();return <main className="mx-auto max-w-4xl px-6 py-12"><p>Netify Market Record</p><h1 className="my-4 text-3xl font-semibold">Anonymous sourcing outcome</h1><MarketOutcomeView record={r}/><a className="underline" href="/sase/shortlist/#market-record">All published outcomes</a><p className="mt-5"><a className="underline" href="/sase/shortlist/">Prepare your own sourcing plan</a></p></main>;}
