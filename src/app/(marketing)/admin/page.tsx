import type { Metadata } from "next";
import AdminClient from "@/components/AdminClient";

export const metadata: Metadata = {
  title: "Marketplace admin",
  description: "Internal Netify marketplace administration.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Internal</p>
        <h1 id="page-h1" className="mb-4">
          Marketplace admin
        </h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          View projects and approve suppliers. Sign in with your authorised
          Netify email and a six-digit code.
        </p>
      </div>
      <AdminClient />
      <details className="mt-8">
        <summary className="cursor-pointer">Other admin reports</summary>
        <div className="mt-4">
          {" "}
          <p className="mb-6">
            <a href="/sase/admin/circuit-pricing/">
              Circuit pricing sourcing queue →
            </a>
          </p>
          <p className="mb-6">
            <a href="/sase/admin/buying-funnel/">Buying outcomes report →</a>
          </p>
          <p className="mb-6">
            <a href="/sase/admin/sourcing/">Private sourcing desk →</a>
          </p>
          <p className="mb-6">
            <a href="/sase/admin/access-report/">
              Access and sign-in outcomes →
            </a>
          </p>
        </div>
      </details>
    </div>
  );
}
