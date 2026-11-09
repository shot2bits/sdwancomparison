import type { Metadata } from "next";
import OpportunityStudio from "@/components/opportunity-studio/OpportunityStudio";
import { canonicalQuestions } from "@/lib/rfp-question-bank";
import "@/components/opportunity-studio/studio.css";

export const metadata: Metadata = {
  title: "Netify procurement service — preview",
  robots: { index: false, follow: false },
};
export default function StudioPreviewPage() {
  return (
    <div id="studio-service">
      <OpportunityStudio
        questions={canonicalQuestions()}
        testEnvironment={process.env.VERCEL_ENV !== "production"}
      />
    </div>
  );
}
