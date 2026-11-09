import type {ReactNode} from 'react';
import {buildStamp} from '@/lib/build-info';
export default function ProcurementHeader({children}:{children?:ReactNode}) {
 return <header className="ns-header"><a className="ns-logo" href="https://netify.co.uk/" aria-label="Netify home">netify<span>®</span></a><span className="ns-product">Procurement service</span><nav aria-label="Workspace utilities">{children??<><a href="/sase/studio/projects/">My projects</a><a href="https://netify.co.uk/sase-sd-wan-rfp-builder/">Start a project</a></>}<span className="ns-build">{buildStamp()}</span></nav></header>;
}
