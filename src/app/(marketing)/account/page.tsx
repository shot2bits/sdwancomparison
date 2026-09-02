import type { Metadata } from "next";
import Link from "next/link";
import BuyerMemoryPanel from "@/components/BuyerMemoryPanel";
import BuyerDigests from "@/components/BuyerDigests";
import MyProcurements from "@/components/MyProcurements";
import SignIn from "@/components/SignIn";

export const metadata: Metadata = { title: "Your account: opportunities, RFPs and agent memory", robots: { index: false, follow: false } };

/**
 * Buyer account hub: everything tied to the signed-in account in one place —
 * published opportunities (with room recovery), saved RFPs, agent memory and
 * digests. This page is also the nav's "Sign in" destination, so it carries
 * the sign-in box itself (SignIn shows "signed in as…" once authenticated)
 * and points suppliers and admins at their own areas — previously neither
 * was reachable from the menu at all (Harry's retest, 03/07/2026).
 */
export default function AccountPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-8">
        <p className="eyebrow mb-2">Your account</p>
        <h1 className="text-2xl mb-1">Your marketplace activity</h1>
        {/* One list, one procurement, one row (Robert's R9 on Harry's
            Section 1 test, 28 Jul 2026). */}
        <p className="text-sm text-[var(--ink-600)]">Your procurements and what the agent remembers, all tied to your signed-in email and recoverable from any device.</p>
      </div>

      {/* ONE ROUTE TO PUBLISH, AND THEREFORE ONE ROUTE TO AN ACCOUNT
          (Robert's ruling, 30 Jul 2026, after a buyer in Mauritius arrived
          from Google, clicked Sign in and verified an email address without
          ever describing a project). An account is what publishing
          PRODUCES. This page stops presenting itself as a place to join.

          The old prompt offered to "recover your opportunities and RFPs on
          this device", which R2 made untrue this morning when it removed
          saved drafts. There is nothing on a device to recover.

          The sign-in box stays, deliberately and secondary, because people
          who HAVE published must be able to get back to their record when
          the link in their confirmation email is gone. What has gone is
          the invitation to a stranger. */}
      <div className="mb-8 rounded-md border border-[var(--ink-200,#e5e5e5)] p-5">
        <p className="m-0 text-sm text-[var(--ink-600,#555)]">
          Accounts are created by publishing a project, not before it. If you have not published yet,{" "}
          <Link href="/#describe" className="underline">describe your project on the front page</Link> and your account is
          made when you sign the publish.
        </p>
      </div>

      <div className="mb-8">
        <p className="eyebrow mb-2">Already published with us?</p>
        <SignIn role="buyer" prompt="Sign in with the work email you published under, to reach your record and your responses." />
        <p className="mt-3 text-xs text-[var(--ink-500)]">
          Vendor or service provider? <Link href="/for-suppliers#register" className="underline">Register or sign in to bid</Link> · your dashboard is at{" "}
          <Link href="/supplier" className="underline">Vendor area</Link>.
        </p>
      </div>

      <MyProcurements />

      <div className="mt-4 mb-6">
        <h2 className="text-xl mb-1">What the agent remembers about you</h2>
        <p className="text-sm text-[var(--ink-600)]">Transparent and editable. The agent uses this to avoid re-asking what it already knows, and carries it across all your RFPs.</p>
      </div>
      <BuyerMemoryPanel />

      <div className="mt-12 mb-6">
        <h2 className="text-xl mb-1">Agent digests</h2>
        <p className="text-sm text-[var(--ink-600)]">The following recommendations have been made based on what our agent has monitored from your live RFPs. Please note: our agent will never contact a vendor without your approval.</p>
      </div>
      <BuyerDigests />
    </div>
  );
}
