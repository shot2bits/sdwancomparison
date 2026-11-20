import type {ReactNode} from 'react';
import ProcurementMarketingShell from '@/components/opportunity-studio/ProcurementMarketingShell';
import '@/components/opportunity-studio/studio.css';
export default function MarketingLayout({children}:{children:ReactNode}) {return <ProcurementMarketingShell>{children}</ProcurementMarketingShell>}
