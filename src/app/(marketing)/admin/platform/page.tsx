import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {requirePlatformOwner} from '@/lib/final-owner';
import OwnerPlatform from '@/components/OwnerPlatform';
export const metadata={title:'Private platform records | Netify',robots:{index:false,follow:false}};
export default async function Page(){const h=await headers();try{await requirePlatformOwner(new Request('https://netify.co.uk/sase/admin/platform/',{headers:h}),'page_view');}catch{notFound();}return <OwnerPlatform/>;}
