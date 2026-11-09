import type {Metadata} from 'next';
import StudioProjects from '@/components/opportunity-studio/StudioProjects';
import '@/components/opportunity-studio/studio.css';
export const metadata:Metadata={title:'My procurement projects',robots:{index:false,follow:false}};
export default function Page(){return <StudioProjects/>}
