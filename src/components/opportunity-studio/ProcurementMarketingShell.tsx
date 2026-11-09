'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import ProcurementHeader from './ProcurementHeader';
import MegaNav from '@/components/MegaNav';
import SiteFooter from '@/components/SiteFooter';
import CommercialFooter from '@/components/CommercialFooter';
export default function ProcurementMarketingShell({children}:{children:ReactNode}) {
 const path=usePathname(); const procurement=/\/(opportunities|for-suppliers)(\/|$)/.test(path);
 return <div className={procurement?'ns-studio ns-public-service':undefined}>{procurement?<ProcurementHeader/>:<MegaNav/>}<main id="main-content" className={procurement?'ns-public-workspace':'min-h-screen'}>{children}</main><SiteFooter><CommercialFooter/></SiteFooter></div>;
}
