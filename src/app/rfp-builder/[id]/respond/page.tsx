import type { Metadata } from "next";
import RfpResponder from "@/components/RfpResponder";
import SignIn from "@/components/SignIn";

export const metadata: Metadata = { title: "Respond to an RFP", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> };

export default async function RespondPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-6"><SignIn role="supplier" /></div>
      <RfpResponder id={id} token={token ?? ""} />
    </div>
  );
}
