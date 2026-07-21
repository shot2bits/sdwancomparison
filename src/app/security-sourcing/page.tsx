import type { Metadata } from "next";
import { SecuritySourcingAdvisor } from "@/components/SecuritySourcingAdvisor";
import { RULEBOOK_VERSION } from "@/lib/security/rulebook";

/**
 * Netify Security Sourcing (Phase B step 2). Soft-launched per the pilot
 * gate: fully operational, deliberately unpromoted (no nav entry, no llms
 * or directory promotion until a real pilot completes end to end).
 *
 * One truth: the advisor renders assessSecurityRequirement, the same
 * function the assess_security_requirement MCP tool runs; project creation
 * recomputes the verdict server-side, and the input digests prove the
 * page and the tool can never disagree.
 */

export const metadata: Metadata = {
  title: "Netify Security Sourcing: assess, build the RFP, obtain responses",
  description:
    "Assess your security requirement under Netify's published rulebook, create the right RFP and obtain responses from matched providers. Every recommendation is reasoned, every assumption labelled, and the things we do not recommend are explained.",
};

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        Netify Security Sourcing · rulebook {RULEBOOK_VERSION}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
        Assess your security requirement
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-700">
        Answer what you know below. The assessment runs Netify&rsquo;s published security rulebook:
        every recommendation carries its reasoning and evidence, missing information becomes
        questions rather than guesses, and the things we do not recommend are explained, including
        when the honest answer earns Netify nothing. From the verdict you can create your project,
        build the right RFP and obtain responses from matched providers.
      </p>
      <div className="mt-8">
        <SecuritySourcingAdvisor />
      </div>
    </main>
  );
}
