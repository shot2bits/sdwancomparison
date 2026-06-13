import type { Metadata } from "next";
import RfpResponder from "@/components/RfpResponder";

export const metadata: Metadata = { title: "Respond to an RFP", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> };

export default async function RespondPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <RfpResponder id={id} token={token ?? ""} />
    </div>
  );
}
