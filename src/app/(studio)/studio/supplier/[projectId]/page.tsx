import type {Metadata} from 'next';
import StudioSupplier from '@/components/opportunity-studio/StudioSupplier';
import '@/components/opportunity-studio/studio.css';
export const metadata:Metadata={title:'Supplier project workspace',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{projectId:string}>}){const {projectId}=await params;return <StudioSupplier projectId={projectId} testEnvironment={process.env.VERCEL_ENV!=="production"}/>;}
