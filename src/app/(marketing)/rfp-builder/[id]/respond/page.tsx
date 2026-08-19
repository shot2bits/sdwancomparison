import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RfpResponder from "@/components/RfpResponder";
import SignIn from "@/components/SignIn";

export const metadata: Metadata = { title: "Respond to an RFP", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string; vt?: string }> };

export default async function RespondPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token, vt } = await searchParams;
  // Piece 3B-2 credential exchange (Robert's ruling, 9 Aug 2026): the
  // per-supplier bearer credential is no longer accepted here as a URL
  // parameter at all — every current invitation link points at
  // /api/rfp/[id]/supplier-credential first, which validates it and sets an
  // HttpOnly cookie before ever reaching this page. If a `vt` shows up here
  // anyway (a stale bookmark, a manually edited link, or a future bug that
  // reintroduces the old respond?...&vt= shape), this page does not read it
  // as a credential — it forwards to that same exchange endpoint so the
  // credential still gets validated and turned into a cookie the proper
  // way, then lands back here on a clean URL. This is a server-side
  // redirect, not a client-side history rewrite: nothing here ever renders
  // with `vt` in a URL client JS, GA4 or SignIn.tsx's return_to could read.
  if (vt) {
    const qs = new URLSearchParams();
    if (token) qs.set("token", token);
    qs.set("vt", vt);
    redirect(`/api/rfp/${id}/supplier-credential?${qs.toString()}`);
  }
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-6"><SignIn role="supplier" /></div>
      <RfpResponder id={id} token={token ?? ""} />
    </div>
  );
}
