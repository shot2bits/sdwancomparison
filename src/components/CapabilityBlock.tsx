/**
 * What publishing generates: the capability block below the input
 * (Robert's ruling, 30 Jul 2026, on the back of the Bing grounding-query
 * and GSC demand pull).
 *
 * WHY THIS EXISTS. The front page earned close to nothing in AI search
 * while the comparison and best-by-sector pages earned thousands, and the
 * reason was visible in the HTML: the page's own copy ran to 197 words
 * and did not contain the words shortlist, ranked, price, cost, RFP, RFI,
 * document or download. The three things buyers actually ask for are a
 * ranked shortlist, an indicative price and a document they can send, and
 * Netify produces all three. They were only ever named on step three of
 * the desk, which is client state, so no crawler and no agent ever saw
 * them. This block is the R1c value list moved into server-rendered text.
 *
 * It renders through ProjectDesk's afterPrompt slot, which means it is
 * present in the initial HTML and stands down the moment a project
 * exists, so a working buyer is never shown marketing copy.
 *
 * COPY LAWS (rule 16): no em dashes, no AI fluff, countable claims
 * counted. Every claim here is either a ruled promise (R1c) or a figure
 * already published elsewhere on the estate: 30 suppliers, 40
 * capabilities, 20 sectors and situations. Nothing is asserted that the
 * app does not already do. PROVISIONAL pending Harry's copy pass.
 */

export default function CapabilityBlock() {
  return (
    <section
      aria-label="What Netify produces"
      className="mx-auto mt-5 w-[min(860px,100%)] rounded-md border border-zinc-200 bg-white p-5 sm:p-6"
    >
      <h2
        className="m-0"
        style={{ fontSize: "15px", lineHeight: 1.3, fontWeight: 700, color: "#18181b", letterSpacing: "-0.01em" }}
      >
        What publishing generates
      </h2>
      <p className="m-0 mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        One description becomes a shortlist, an indicative price and a document you can send to suppliers.
      </p>
      <ul className="m-0 mt-3 list-none space-y-1.5 p-0 text-[13px] leading-relaxed text-zinc-700">
        <li>Vendors and service providers ranked against your requirement, with the reason each one is in or out.</li>
        <li>An indicative price band, computed under the Netify TCO methodology.</li>
        <li>
          Your requirement written up as a project notice, an RFI or a full RFP, ready to download as Word or PDF.
        </li>
        <li>Your opportunity posted anonymously to the public opportunities board.</li>
        <li>
          Signed in approved vendors and service providers see the full detail. The public never sees your company
          name or your contact details.
        </li>
        <li>Supplier responses side by side, with pricing private to you.</li>
      </ul>

      <h2
        className="m-0 mt-5"
        style={{ fontSize: "15px", lineHeight: 1.3, fontWeight: 700, color: "#18181b", letterSpacing: "-0.01em" }}
      >
        Who it is for
      </h2>
      <p className="m-0 mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
        Netify is for buyers comparing SD-WAN, SASE and SSE, including managed SD-WAN and managed SASE delivered as a
        service. They range from mid-market companies to global enterprises and multinational organisations running
        multi-site estates. 30 suppliers are graded on 40 capabilities, every grade dated and sourced. Ranked
        shortlists cover 20 sectors and situations, including healthcare, retail, financial services and
        manufacturing.
      </p>
    </section>
  );
}
