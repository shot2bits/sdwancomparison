import type { Metadata } from 'next';
import OpportunityStudio from '@/components/opportunity-studio/OpportunityStudio';
import { canonicalQuestions } from '@/lib/rfp-question-bank';
import '@/components/opportunity-studio/studio.css';

export const metadata: Metadata = {
  title: 'Opportunity Studio design preview', robots: {index:false,follow:false},
};
export default function StudioPreviewPage() {
  return <main id="main-content"><OpportunityStudio questions={canonicalQuestions()} /></main>;
}
