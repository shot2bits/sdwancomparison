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
    q: "What do I get when I publish a requirement?",
    a: "Six things. Vendors and service providers ranked against your requirement, with the reason each one is in or out. An indicative price band, computed under the Netify TCO methodology. Your requirement written up as a project notice, an RFI or a full RFP, ready to download as Word or PDF. Your opportunity posted anonymously to the public opportunities board. Full detail released to signed in approved vendors and service providers, while the public never sees your company name or your contact details. And supplier responses side by side, with pricing private to you.",
  },
  {
    q: "Can Netify shortlist SASE providers for a multinational organisation?",
    a: "Yes. Describe the estate in your own words, including the countries and regions you operate in, and the shortlist ranks suppliers on graded evidence of coverage in those places rather than on a marketing claim. Multi-site and multi-country estates are the normal case here, not the exception, and global enterprises and multinational organisations sit alongside mid-market companies on the same engine.",
  },
  {
    q: "Do you cover managed SD-WAN and managed SASE, or only the technology vendors?",
    a: "Both, and the difference is graded. 30 suppliers are recorded, some of which build the technology, some of which run it as a managed service, and some of which do both. If you want managed SD-WAN or managed SASE delivered as a service, say so and the ranking weights the suppliers who genuinely operate it. Each supplier record names which it is. Security service edge, or SSE, is graded on the same records: 17 of the 30 build their own SSE and 13 run a partner's, which the record states either way.",
  },
  {
    q: "Can I get an indicative price before I speak to any supplier?",
    a: "Yes. Publishing computes an indicative price band under the Netify TCO methodology, based on the sites, users, scope and locations you have described. It is a band rather than a quote, because a real price depends on the supplier and the detail. Firm pricing comes from the suppliers themselves, in their responses, and stays private to you.",
  },
  {
    q: "Can I produce a SASE or SD-WAN RFP document?",
    a: "Yes. Your requirement is written up as a document you can download as Word or PDF. What it comes out as depends on what your requirement has earned: a project notice for a straightforward need, an RFI when you are still gathering information, or a full RFP once you have set priorities and made a commercial claim. You do not choose a template, and you do not start from a blank page.",
  },
  {
    q: "Which sectors and situations do you cover?",
    a: "Ranked shortlists cover 20 sectors and situations, including healthcare, retail, financial services and manufacturing, along with situations such as MPLS migration, security consolidation, remote and hybrid work, and regulated industries with residency or audit requirements. Sector shapes the requirement itself, not just the label on it, so a PCI DSS retail estate and an audited financial services network produce different shortlists.",
  },
  {
    q: "How are suppliers actually compared?",
    a: "30 suppliers are graded on 40 capabilities. Every grade carries the date it was verified and the source it came from, and a supplier moves only when its own evidence changes. Where a capability is not published, the record says so rather than guessing. You can read any supplier record in full, including the sources behind it and the claims that conflict.",
  },
  {
    q: "Who sees my project, and does my company name go public?",
    a: "Your notice is published anonymously. The public opportunities board and search engines see the shape of the requirement, such as sector and size, and never your company name or your contact details. Signed in approved vendors and service providers see the full detail. You choose which suppliers receive your contact details, and when.",
  },
  {
    q: "Do I need an account to use it?",
    a: "No. You can describe your project, build the requirement and see who fits without an account. Signing in is needed only to publish, because publishing reaches named suppliers and puts a notice on the board, so it has to be a verified person. A work email address is required for that.",
  },
  {
    q: "Can an AI agent use Netify on our behalf?",
    a: "Yes. Netify exposes its research and drafting tools over MCP, so your organisation's approved AI agent can research the market, draft a requirement, compare suppliers and monitor responses. Publishing, selecting and awarding stay with your team. An agent never signs anything.",
  },
];

export default function CapabilityBlock() {
  return (
    <section
      aria-label="What Netify does"
      className="mx-auto mt-5 w-[min(860px,100%)] rounded-md border border-zinc-200 bg-white p-5 sm:p-6"
    >
      {/* The same array the list below renders, so the structured data and
          the visible answers can never disagree. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getShortlistFaqSchema(FAQS)) }}
      />
      <h2
        className="m-0"
        style={{ fontSize: "15px", lineHeight: 1.3, fontWeight: 700, color: "#18181b", letterSpacing: "-0.01em" }}
      >
        What Netify does
      </h2>
      <p className="m-0 mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        One description becomes a shortlist, an indicative price and a document you can send to suppliers.
      </p>
      <div className="mt-3">
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
    </section>
  );
}
