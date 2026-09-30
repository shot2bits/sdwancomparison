import { SOURCING_DESCRIPTION } from "@/lib/sourcing-contract";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Your Netify project shortlist", robots: { index: false, follow: false } };
export default function ShortlistPrintPage() {
  return <main className="mx-auto max-w-3xl p-8"><h1>Your personalised shortlist is part of your project</h1><p className="mt-4">{SOURCING_DESCRIPTION}</p><a className="mt-4 inline-block underline" href="/sase-sd-wan-rfp-builder/?journey=find_providers">Find providers for my project</a><p className="mt-4"><a className="underline" href="/sase/shortlist/">Compare public provider evidence</a></p></main>;
}
