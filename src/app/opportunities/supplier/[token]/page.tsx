import type { Metadata } from "next";
import OpportunitySupplier from "@/components/OpportunitySupplier";
import SignIn from "@/components/SignIn";

export const metadata: Metadata = { title: "Respond to an opportunity", robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };

export default async function OpportunitySupplierPage({ params }: Props) {
  const { token } = await params;
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-6"><SignIn role="supplier" prompt="Sign in with your work email to comment and submit pricing. We verify your domain against the listed supplier." /></div>
      <OpportunitySupplier token={token} />
    </div>
  );
}
