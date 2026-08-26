import { getShortlistFaqSchema } from "@/lib/structured-data";

/**
 * What Netify does, as an FAQ (Robert's ruling, 30 Jul 2026: "styled as an
 * FAQ with expand button, this way we can include more text to rank").
 *
 * WHY THIS EXISTS. The front page was not competing in AI search at all.
 * Of 284 Bing-cited pages the top 156 by volume contain no apex root, and
 * the only platform address in the set is /rfp-builder/ with nine
 * citations against six thousand for one comparison page. The cause was in
 * the HTML: the page's own copy ran to 197 words and contained none of
 * shortlist, ranked, price, cost, RFP, RFI, document or download.
 *
 * WHY AN FAQ. A collapsed <details> is still fully present in the served
 * HTML, so a crawler and an agent read every answer while a human sees a
 * short, calm list. That is what lets this carry real depth on a page
 * whose job is a single input box. Native <details> and <summary> are used
 * deliberately: no client state, no hydration, works with JavaScript off,
 * and the disclosure behaviour is the browser's own rather than ours.
 *
 * THE QUESTIONS ARE THE DEMAND. Each one is phrased as buyers actually
 * search, taken from the live pull of 30 Jul 2026: 1,068 distinct Bing
 * grounding queries and the GSC impressions table. "scalable SASE
 * providers for multinational organizations" (933 citations, and 1,606
 * Google impressions as a full question), "managed sd wan providers"
 * (2,995), "affordable SASE providers for global enterprise networks"
 * (968), "secure SD-WAN vendors for financial institutions" (1.2K), "sase
 * rfp" (1,569), "managed SASE services for mid market companies" (413).
 *
 * ONE ARRAY, TWO OUTPUTS. The FAQPage JSON-LD is built from the SAME array
 * the HTML renders, so the structured data can never drift from what a
 * person reads. Nothing is asserted here that the app does not already do,
 * and every figure is one the estate already publishes (30 suppliers, 40
 * capabilities, 20 sectors). Copy laws (rule 16): no em dashes, no fluff,
 * countable claims counted. PROVISIONAL: Harry rewrites this, keeping the
 * load-bearing search terms.
 */

/** The load-bearing terms, listed for whoever edits this next: shortlist,
 *  ranked, indicative price, RFP, RFI, download, managed SD-WAN, managed
 *  SASE, SSE, mid-market, global enterprise, multinational. Each traces to
 *  a query with real volume. Rephrase freely around them; do not drop them. */
const FAQS: { q: string; a: string }[] = [
  {
    q: "Can Netify check an RFP created by ChatGPT, Claude or another AI?",
    a: "Yes. Paste the text or upload the Word, PDF, text or spreadsheet file. Netify gives it a deterministic procurement-readiness score, identifies missing technical, security, resilience, commercial, implementation, support, evidence, scoring and response-format requirements, and maps the gaps to its governed question bank. Your original wording is preserved and no recommended question is added without your approval.",
  },
  {
    q: "What is Netify?",
    a: "Netify is a procurement platform for SASE, SD-WAN, SSE and managed network security. It does four jobs in one place. Netify builds your requirement into a project notice, an RFI or a full RFP. Netify compares vendors and service providers on graded evidence rather than on marketing claims. Netify publishes your opportunity anonymously to a marketplace of evaluated vendors. And Netify brings their responses back side by side so you can compare them. 30 vendors and service providers are graded on 40 capabilities, every grade carrying the date it was verified and the source it came from.",
  },
  {
    q: "Can I use Netify to run a SASE or SD-WAN RFP or RFI?",
    a: "Yes. Netify writes your requirement up as a document you can download as Word or PDF. What it comes out as depends on what the requirement has earned: a project notice for a straightforward need, an RFI when you are still gathering information, or a full RFP once you have set priorities and made a commercial claim. You do not choose a template and you do not start from a blank page. Netify then publishes it to vendors and service providers, and collects their responses against it.",
  },
  {
    q: "How does Netify compare vendors and service providers?",
    a: "Netify grades 30 vendors and service providers on 40 capabilities and ranks them against the requirement you have described. Every grade carries the date it was verified and the source it came from, and a vendor moves only when its own evidence changes. Where a capability is not published, the record says so rather than guessing. Netify publishes vendor and provider comparisons you can read in full, including the sources behind each grade and the claims that conflict.",
  },
  {
    q: "What do I get when I publish a requirement?",
    a: "Six things. Vendors and service providers ranked against your requirement, with the reason each one is in or out. An indicative price band, computed under the Netify TCO methodology. Your requirement written up as a project notice, an RFI or a full RFP, ready to download as Word or PDF. Your opportunity posted anonymously to the public opportunities board. Full detail released to signed in approved vendors and service providers, while the public never sees your company name or your contact details. And their responses side by side, with pricing private to you.",
  },
  {
    q: "Can Netify shortlist SASE providers for a multinational organisation?",
    a: "Yes. Describe the estate in your own words, including the countries and regions you operate in, and Netify ranks vendors and service providers on graded evidence of coverage in those places rather than on a marketing claim. Multi-site and multi-country estates are the normal case here, not the exception. Netify serves global enterprises, multinational organisations and mid-market companies on the same engine.",
  },
  {
    q: "Does Netify cover managed SD-WAN and managed SASE, or only the technology vendors?",
    a: "Both, and Netify grades the difference. 30 vendors and service providers are recorded, some of which build the technology, some of which run it as a managed service, and some of which do both. If you want managed SD-WAN or managed SASE delivered as a service, say so and the ranking weights the ones who genuinely operate it. Each record names which it is. Security service edge, or SSE, is graded on the same records: 17 of the 30 build their own SSE and 13 run a partner's, which the record states either way.",
  },
  {
    q: "Can I get an indicative price before I speak to any vendor?",
    a: "Yes. Netify computes an indicative price band under its own TCO methodology, based on the sites, users, scope and locations you have described. It is a band rather than a quote, because a real price depends on the vendor and the detail. Firm pricing comes from the vendors and service providers themselves, in their responses, and stays private to you.",
  },
  {
    q: "Which sectors and situations does Netify cover?",
    a: "Netify publishes ranked shortlists for 20 sectors and situations, including healthcare, retail, financial services and manufacturing, along with situations such as MPLS migration, security consolidation, remote and hybrid work, and regulated industries with residency or audit requirements. Sector shapes the requirement itself, not just the label on it, so a PCI DSS retail estate and an audited financial services network produce different shortlists.",
  },
  {
    q: "Who sees my project, and does my company name go public?",
    a: "Netify publishes your notice anonymously. The public opportunities board and search engines see the shape of the requirement, such as sector and size, and never your company name or your contact details. Signed in approved vendors and service providers see the full detail. You choose which of them receive your contact details, and when.",
  },
  {
    q: "Do I need an account to use Netify?",
    a: "No account is needed to build, paste, upload, check or preview an RFP. A verified work email is required when you publish it anonymously to the Netify Opportunity Board. Publication creates the buyer account and unlocks the final document downloads, provider matching and structured supplier responses.",
  },
  {
    q: "Can an AI agent use Netify on our behalf?",
    a: "Yes. Netify exposes its research and drafting tools over MCP, so your organisation's approved AI agent can research the market, draft a requirement, compare vendors and monitor responses. Publishing, selecting and awarding stay with your team. An agent never signs anything.",
  },
];

/**
 * COLLAPSED TO ONE LINE, 20 Aug 2026. Robert, on a screenshot of the
 * entry page: "Probably best to remove this to the about page or
 * somewhere else."
 *
 * He is right that twelve rows of FAQ under a single input box is the
 * wrong weight for a page whose job is "type one sentence". But MOVING
 * it would have cost real ground: this is the entry page's only FAQPage
 * JSON-LD and its only crawlable depth, and /how-it-works already emits
 * its own FAQPage (two on one page conflict -- a crawler picks one, and
 * which one is not ours to choose).
 *
 * So the whole block is now itself a closed <details>. This costs
 * nothing, for the exact reason the inner questions were built as
 * <details> in the first place (see the header above): a collapsed
 * <details> is FULLY PRESENT in the served HTML. A crawler and an agent
 * still read every answer, the JSON-LD still describes content that is
 * genuinely on the page (Google's own requirement -- which is why the
 * schema was NOT simply left behind with the visible block removed), and
 * a human sees one line instead of twelve.
 *
 * Nested <details> is deliberate and works natively: opening the outer
 * one reveals the eleven inner ones, still individually collapsed.
 */
export default function CapabilityBlock() {
  return (
    <section
      aria-label="What Netify does"
      className="mx-auto mt-5 w-[min(860px,100%)] rounded-md border border-zinc-200 bg-white"
    >
      {/* The same array the list below renders, so the structured data and
          the visible answers can never disagree. Kept OUTSIDE the
          <details> so it is unconditionally in the document head order,
          though a collapsed <details> would serve it either way. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getShortlistFaqSchema(FAQS)) }}
      />
      <details className="group">
        <summary className="flex cursor-pointer list-none items-baseline gap-2 p-5 marker:hidden sm:p-6">
          <span
            aria-hidden="true"
            className="mt-[2px] shrink-0 text-[11px] text-zinc-400 transition-transform group-open:rotate-90"
          >
            &#9654;
          </span>
          <span className="min-w-0 flex-1">
            <h2
              className="m-0"
              style={{ fontSize: "15px", lineHeight: 1.3, fontWeight: 700, color: "#18181b", letterSpacing: "-0.01em" }}
            >
              What Netify does
            </h2>
            <span className="m-0 mt-1.5 block max-w-2xl text-[13px] leading-relaxed text-zinc-600">
              One description becomes a shortlist, an indicative price and a document you can send to vendors and service providers.
            </span>
          </span>
        </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        {FAQS.map((f) => (
          <details key={f.q} className="group border-t border-zinc-100 py-2 first:border-t-0">
            <summary className="flex cursor-pointer list-none items-baseline gap-2 text-[13.5px] font-semibold leading-relaxed text-zinc-900 marker:hidden hover:text-amber-800">
              <span
                aria-hidden="true"
                className="mt-[2px] shrink-0 text-[11px] text-zinc-400 transition-transform group-open:rotate-90"
              >
                ▶
              </span>
              <h3 className="m-0 text-[13.5px] font-semibold leading-relaxed">{f.q}</h3>
            </summary>
            <p className="m-0 mb-1 mt-1.5 max-w-2xl pl-[18px] text-[13px] leading-relaxed text-zinc-600">{f.a}</p>
          </details>
        ))}
      </div>
      </details>
    </section>
  );
}
