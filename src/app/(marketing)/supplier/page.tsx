import type { Metadata } from "next";
import SupplierDashboard from "@/components/SupplierDashboard";

export const metadata: Metadata = {
  title: "Vendor dashboard",
  description: "Your vendor home: opportunities to bid on, invitations and your profile.",
  robots: { index: false, follow: false },
};

export default function SupplierDashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-8 max-w-3xl">
        <p className="eyebrow mb-3">Vendor portal</p>
        <h1 id="page-h1" className="mb-3">Your vendor dashboard</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">Opportunities you can bid on, your invitations, and your marketplace profile. Sign in with your domain-verified work email.</p>
      </div>
      <SupplierDashboard />
    </div>
  );
}
