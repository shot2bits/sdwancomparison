import type { Metadata } from "next";
import VerifyClient from "./VerifyClient";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function VerifyPage() {
  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center">
      <VerifyClient />
    </div>
  );
}
