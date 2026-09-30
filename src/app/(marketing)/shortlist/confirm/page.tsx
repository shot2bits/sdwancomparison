import SourcingConfirmation from '@/components/SourcingConfirmation';
import '../sourcing.css';
export const metadata={title:'Confirm your Netify sourcing request',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function Page(){return <main className="sourcing"><SourcingConfirmation/></main>;}
