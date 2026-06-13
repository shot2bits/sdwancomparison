import type { Metadata } from "next";
import AdminClient from "@/components/AdminClient";

export const metadata: Metadata = {
  title: "Marketplace admin | Netify",
  description: "Internal Netify marketplace administration.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Internal</p>
        <h1 id="page-h1" className="mb-4">Marketplace admin</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">Manage signed-in users, supplier email domains, the blocked-domain policy and pending access requests. Visible to Netify admins only.</p>
      </div>
      <AdminClient />
    </div>
  );
}
