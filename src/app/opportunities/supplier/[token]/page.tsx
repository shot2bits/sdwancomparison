import type { Metadata } from "next";
import OpportunitySupplier from "@/components/OpportunitySupplier";

export const metadata: Metadata = { title: "Respond to an opportunity | Netify", robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };

export default async function OpportunitySupplierPage({ params }: Props) {
  const { token } = await params;
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <OpportunitySupplier token={token} />
    </div>
  );
}
