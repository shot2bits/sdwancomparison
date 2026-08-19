import type { Metadata } from "next";
import Link from "next/link";
import RfpBuilder from "@/components/RfpBuilder";
import { RFP_PATHS, getRfpPath } from "@/lib/rfp-paths";
import { getProject } from "@/lib/rfp-store";
import ProjectNav from "@/components/ProjectNav";
import { saseExtendedQuestions, EXTENDED_CATEGORY_LABELS, SASE_EXTENDED_BANK } from "@/lib/rfp-question-bank";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

/**
 * This route serves two things:
 * 1. /rfp-builder/{sase|sd-wan|sse} — server-rendered, indexable path pages
 *    (education + question-bank preview + scope-prefilled CTA). These slugs
 *    are reserved and can never collide with RFP ids (rfp_ prefix).
 * 2. /rfp-builder/{rfp id} — the private, noindexed builder workspace.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = getRfpPath(id);
  if (!p) return { title: "Your SASE & SD-WAN RFP", robots: { index: false, follow: false } };
  return {
    title: `${p.title} | Netify RFP Builder`,
    description: p.description,
    alternates: { canonical: `${SITE_URL}/rfp-builder/${p.slug}/` },
    openGraph: { title: p.title, description: p.description, url: `${SITE_URL}/rfp-builder/${p.slug}`, type: "website", locale: "en_GB" },
  };
}

export default async function RfpProjectOrPathPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { manage } = await searchParams;
  const p = getRfpPath(id);

  if (!p) {
    // Private builder workspace. The Preview/Agent-review buttons live inside
    // RfpBuilder (client) so they can carry the owner's manage key — server
    // markup cannot know it, and without the key those owner-gated pages
    // refuse anonymous owners.
    //
    // Engine-aware header (Harry's QA F4/F15): a Security Sourcing project
    // used to land here under "Your SASE and SD-WAN RFP" with no explanation
    // of the hand-off. The header reads the project's engine flag only; no
    // private matter is rendered server-side.
    const proj = await getProject(id).catch(() => null);
    const isEngine = proj?.engine === "security_sourcing";
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* The project navigation renders on the builder too (Robert,
            21 July 2026: clicking RFP from the project was a one-way door;
            the browser back button was the only route home). Same bar as
            every project surface, the RFP tab active. */}
        {/* The builder is the escape hatch off the engine journey; the bar
            marks Requirement so the way back to the goal stays visible. */}
        {isEngine && <ProjectNav id={id} manage={manage} active="preview" engine />}
        <div className="mb-8">
          <p className="eyebrow mb-2">{isEngine ? "Security Sourcing" : "Agentic RFP builder"}</p>
          <h1 className="text-2xl">{isEngine ? "Your Security Sourcing RFP" : "Your SASE and SD-WAN RFP"}</h1>
          {isEngine && (
            <p className="mt-2 max-w-2xl text-sm text-[var(--ink-600,#555)]">
              Generated from your security assessment and opened here, in the Netify RFP builder, for review.
              Refine the document as you need; your project home keeps the assessment, story and timeline
              alongside it, and nothing goes to vendors until you publish.
            </p>
          )}
        </div>
        <RfpBuilder initialId={id} />
      </div>
    );
  }

  const previewQuestions = saseExtendedQuestions().filter((q) => p.extendedCategories.includes(q.category_id)).slice(0, 8);

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema(p.title, `/rfp-builder/${p.slug}`),
    getSpeakableSchema(`/rfp-builder/${p.slug}`),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  const builderHref = `/sase/rfp-builder/?prefill=1&scope=${p.scopeValue}`;

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      <nav className="mb-6 text-sm text-[var(--ink-500)]">
        <Link href="/rfp-builder" className="underline">RFP Builder</Link> / {p.label}
      </nav>

      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">{p.label} RFP path</p>
        <h1 id="page-h1" className="mb-4">{p.title}</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">{p.intro}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={builderHref} className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Start in the RFP Builder</a>
          <Link href="/opportunities/new" className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2.5 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">Just need pricing? Post a project instead</Link>
        </div>
        <p className="mt-3 text-xs text-[var(--ink-500)]">
          This opens the main RFP Builder with the {p.label} scope preloaded — the same builder every path uses, so you
          can still change scope, delivery model and questions there.
        </p>
      </div>

      <div className="mb-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-2">Who this path is for</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--ink-700)]">
            {p.whoFor.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">What the RFP covers</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--ink-700)]">
            {p.covers.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      </div>

      <div className="mb-12">
        <h2 className="text-lg font-semibold mb-1">Sample questions from the Netify bank</h2>
        <p className="text-sm text-[var(--ink-600)] mb-4">
          Drawn from the {SASE_EXTENDED_BANK.question_bank_version} canonical bank ({saseExtendedQuestions().length} questions).
          Every question carries the evidence vendors should provide and the red-flag answers to watch for.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {previewQuestions.map((q) => (
            <div key={q.question_id} className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--ink-400,#9ca3af)]">{EXTENDED_CATEGORY_LABELS[q.category_id] ?? q.category_id}</p>
              <p className="text-sm">{q.question}</p>
              <p className="mt-1.5 text-xs text-[var(--ink-500)]">Evidence: {q.evidence_required.join("; ")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-12 max-w-3xl">
        <h2 className="text-lg font-semibold mb-3">Common questions</h2>
        {p.faq.map((f) => (
          <div key={f.q} className="mb-4">
            <p className="text-sm font-medium mb-1">{f.q}</p>
            <p className="text-sm text-[var(--ink-700)]">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 text-sm text-[var(--ink-600)]">
        <p className="eyebrow mb-2">Methodology and citations</p>
        <p>
          Questions cite the <Link href="/rfp-builder/questions" className="underline">Netify question bank</Link>,{" "}
          <Link href="/rfp-builder/sample-rfp" className="underline">sample RFP</Link> and{" "}
          <a href="https://netify.co.uk/methodology/" className="underline">research methodology</a>. Machine-readable bank:{" "}
          <a href="/sase/question-bank.json" className="underline">/question-bank.json</a>. Other paths:{" "}
          {RFP_PATHS.filter((x) => x.slug !== p.slug).map((x, i) => (
            <span key={x.slug}>{i > 0 && " · "}<Link href={`/rfp-builder/${x.slug}`} className="underline">{x.title}</Link></span>
          ))}
          {" · "}<Link href="/rfp-builder/start" className="underline">Not sure? Get a recommendation</Link>
        </p>
      </div>
    </div>
  );
}
