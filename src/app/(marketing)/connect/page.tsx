import {redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {SITE_URL} from '@/lib/structured-data';

/** /connect/ existed briefly in Phase A. The single page is /connector/. */
export const metadata:Metadata={
 alternates:{canonical:`${SITE_URL}/connector/`},
 robots:{index:false,follow:true}
};
export default function ConnectRedirect(){redirect('/connector/');}
