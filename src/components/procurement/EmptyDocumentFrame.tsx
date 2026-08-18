/**
 * State 0's empty living document (18 Aug 2026 correction): "A blank
 * project must still show a compelling empty living document -- not a
 * huge marketing landing page... a compact proposition, the primary
 * prompt, an elegant empty document frame, ghosted future sections, a
 * restrained preview of what will populate. No invented project-specific
 * content. No invented MCP evidence."
 *
 * The section names ghosted below are NOT invented for this component --
 * they are the exact real titles `buildSectionOutline()`
 * (procurement-outline.ts) uses once facts exist (compare "Organisation
 * and scale", "Solution scope", "Current estate", "Resilience and
 * availability", "Security, identity and data", "Operating model and
 * support" here to that function's own literal strings). This IS the
 * document's real future shape, shown empty, not a mockup of a different
 * shape. Every row renders with zero specific content -- no site counts,
 * no sector, no vendor names -- only the structural label and a muted
 * "not yet stated" placeholder, so nothing here could be mistaken for a
 * real fact.
 */
const GHOST_SECTIONS = [
  "Organisation and scale",
  "Solution scope",
  "Current estate",
  "Resilience and availability",
  "Security, identity and data",
  "Operating model and support",
] as const;

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

export default function EmptyDocumentFrame() {
  return (
    <div
      className="mx-auto mt-6 w-full max-w-[1000px] rounded-[18px] border px-5 py-5 sm:px-7 sm:py-6"
      style={{ borderColor: "var(--nf-rule, #E4D9C2)", background: "var(--nf-ivory-card, #FFFDF8)" }}
      aria-label="Your living procurement document, not yet started"
    >
      <div className="flex items-center justify-between gap-3">
        <div style={{ ...mono, fontSize: "10.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#655F52" }}>
          Your living procurement document
        </div>
        <span
          className="rounded-full px-2 py-[3px] text-[9.5px] font-semibold uppercase"
          style={{ ...mono, letterSpacing: "0.07em", background: "var(--nf-ink-100, #EDE7D9)", color: "#655F52" }}
        >
          Not started
        </span>
      </div>
      <p className="m-0 mt-2 max-w-[46em] text-[14px] leading-[1.6]" style={{ color: "var(--nf-ink-600, #4A4438)" }}>
        Say what you need in the prompt above. Every sentence lands here as a stated fact, and this frame fills in
        section by section — nothing is added until you say it.
      </p>
      {/* Contrast fix (verification pass, 18 Aug 2026): the ghosting effect
          ("ghosted future sections, a restrained preview" -- this file's
          own header comment, an explicit approved-prototype aesthetic) used
          to apply `opacity` to the WHOLE row, diluting the row's TEXT along
          with its border -- axe-core caught the real result: rows 4-6
          measured 1.88:1-3.32:1 against their own #FFFDF8 background, well
          under WCAG AA's 4.5:1. The fade now applies only to the row's own
          border colour (computed per-row as a real rgba alpha, not a fixed
          swatch) -- the "later sections feel further away" ghosting is
          still visible in the border, but every row's TEXT stays at the
          same flat, always-accessible colour regardless of position, so
          "section 6" is exactly as legible as "section 1". */}
      <div className="mt-5 flex flex-col gap-2.5">
        {GHOST_SECTIONS.map((title, i) => (
          <div
            key={title}
            className="flex items-center justify-between gap-3 rounded-[10px] border border-dashed px-3.5 py-3"
            style={{ borderColor: `rgba(220, 211, 192, ${1 - i * 0.12})` }}
          >
            <span className="text-[13px] font-medium" style={{ color: "#655F52" }}>{title}</span>
            <span className="text-[10.5px]" style={{ ...mono, color: "#655F52" }}>not yet stated</span>
          </div>
        ))}
      </div>
    </div>
  );
}
