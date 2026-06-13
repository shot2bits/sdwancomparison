import type { Metadata } from "next";
import SupplierPortal from "@/components/SupplierPortal";
import SignIn from "@/components/SignIn";

export const metadata: Metadata = { title: "Supplier portal", robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };

export default async function SupplierPortalPage({ params }: Props) {
  const { token } = await params;
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-6"><SignIn role="supplier" /></div>
      <SupplierPortal token={token} />
    </div>
  );
}
