/**
 * How-it-works diagram: describe, build, publish, compare — the four steps
 * from a network need to competing supplier bids, with the "why this is
 * simple" facts annotated under each step.
 *
 * Server-rendered inline SVG on purpose: the copy is real <text>, so search
 * engines and AI crawlers read the same words a person sees, it inherits the
 * site font and ink/paper/amber palette via CSS variables, and there is no
 * extra image request. On narrow screens the figure scrolls horizontally
 * rather than shrinking the type below legibility.
 */

export default function HowItWorksDiagram() {
  const card = { fill: "var(--paper-base, #ffffff)", stroke: "var(--ink-200, #e5e5e5)" };
  const title = { fill: "var(--ink-900, #18181b)", fontSize: 13.5, fontWeight: 600 } as const;
  const body = { fill: "var(--ink-600, #52525b)", fontSize: 11.5 } as const;
  const note = { fill: "var(--ink-500, #71717a)", fontSize: 10.5 } as const;

  return (
    <figure className="mb-14 overflow-x-auto">
      <svg
        viewBox="0 0 760 258"
        role="img"
        aria-labelledby="hiw-title hiw-desc"
        className="h-auto w-full min-w-[680px]"
      >
        <title id="hiw-title">How Netify gets you competing SASE and SD-WAN bids</title>
        <desc id="hiw-desc">
          Four steps: describe your project in about two minutes with no account, Netify builds the
          complete RFP from its question bank for you to review, publishing emails each matched
          supplier a private response link, and structured bids come back scored side by side with
          pricing private to you.
        </desc>
        <defs>
          <marker id="hiw-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-400, #9ca3af)" />
          </marker>
        </defs>

        {/* Step 1 */}
        <rect x="8" y="8" width="170" height="118" rx="6" fill={card.fill} stroke={card.stroke} />
        <circle cx="30" cy="32" r="12" fill="#f59e0b" />
        <text x="30" y="36.5" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#09090b">1</text>
        <text x="50" y="30" {...title}>Describe your</text>
        <text x="50" y="46" {...title}>project</text>
        <text x="20" y="72" {...body}>Five quick questions in</text>
        <text x="20" y="87" {...body}>plain English, about two</text>
        <text x="20" y="102" {...body}>minutes.</text>
        <text x="20" y="144" {...note}>No account needed</text>

        <line x1="178" y1="67" x2="196" y2="67" stroke="var(--ink-400, #9ca3af)" strokeWidth="1.5" markerEnd="url(#hiw-arr)" />

        {/* Step 2 */}
        <rect x="198" y="8" width="170" height="118" rx="6" fill={card.fill} stroke={card.stroke} />
        <circle cx="220" cy="32" r="12" fill="#f59e0b" />
        <text x="220" y="36.5" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#09090b">2</text>
        <text x="240" y="30" {...title}>Netify builds</text>
        <text x="240" y="46" {...title}>the RFP</text>
        <text x="210" y="72" {...body}>A complete document from</text>
        <text x="210" y="87" {...body}>the Netify question bank.</text>
        <text x="210" y="102" {...body}>You review and trim.</text>
        <text x="210" y="144" {...note}>Methodology v2026.1</text>

        <line x1="368" y1="67" x2="386" y2="67" stroke="var(--ink-400, #9ca3af)" strokeWidth="1.5" markerEnd="url(#hiw-arr)" />

        {/* Step 3 */}
        <rect x="388" y="8" width="170" height="118" rx="6" fill={card.fill} stroke={card.stroke} />
        <circle cx="410" cy="32" r="12" fill="#f59e0b" />
        <text x="410" y="36.5" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#09090b">3</text>
        <text x="430" y="30" {...title}>Publish to matched</text>
        <text x="430" y="46" {...title}>suppliers</text>
        <text x="400" y="72" {...body}>Each matched provider</text>
        <text x="400" y="87" {...body}>gets a private response</text>
        <text x="400" y="102" {...body}>link by email.</text>
        <text x="400" y="144" {...note}>One sign-in, only at publish</text>

        <line x1="558" y1="67" x2="576" y2="67" stroke="var(--ink-400, #9ca3af)" strokeWidth="1.5" markerEnd="url(#hiw-arr)" />

        {/* Step 4: the payoff */}
        <rect x="578" y="8" width="174" height="118" rx="6" fill="#fffbeb" stroke="#f59e0b" />
        <circle cx="600" cy="32" r="12" fill="#f59e0b" />
        <text x="600" y="36.5" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#09090b">4</text>
        <text x="620" y="30" {...title}>Competing bids</text>
        <text x="620" y="46" {...title}>come back</text>
        <text x="590" y="72" {...body}>Structured responses,</text>
        <text x="590" y="87" {...body}>scored side by side against</text>
        <text x="590" y="102" {...body}>the same questions.</text>
        <text x="590" y="144" {...note}>Pricing stays private to you</text>

        {/* Why it stays simple */}
        <rect x="8" y="170" width="744" height="66" rx="6" fill="var(--ink-100, #f4f4f5)" />
        <text x="380" y="192" textAnchor="middle" {...title}>Why this is the simple route to bids</text>
        <text x="380" y="210" textAnchor="middle" {...body}>One brief instead of five vendor calls · Free for buyers · Nothing is shared until you publish</text>
        <text x="380" y="226" textAnchor="middle" {...body}>Suppliers respond without creating an account</text>
      </svg>
      <figcaption className="sr-only">
        The Netify buying flow: describe your project, Netify builds the RFP, publish to matched suppliers, compare competing bids.
      </figcaption>
    </figure>
  );
}
