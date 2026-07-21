/**
 * The three-act flow guide (Robert's approved mockup, 21 July 2026): every
 * engine surface tells the buyer exactly where they are on the road to the
 * goal, which is a published requirement on the Netify board. Server-safe
 * presentational component; replaces the eleven-phase machine strip on
 * engine surfaces (the machine's full phase remains in the health chip,
 * the Story and the Timeline).
 */

export default function EngineFlowGuide({
  published,
  gapCount,
  invitedCount,
  responseCount,
}: {
  published: boolean;
  gapCount: number;
  invitedCount: number;
  responseCount: number;
}) {
  const stage: "publish" | "responses" = published ? "responses" : "publish";
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-stretch gap-2" aria-label="Your route to supplier responses">
        <div className="min-w-[160px] flex-1 rounded-lg border border-emerald-300 bg-white p-2.5">
          <p className="m-0 text-xs font-semibold text-emerald-800">✓ 1 · Assess</p>
          <p className="m-0 mt-0.5 text-[11.5px] leading-snug text-[var(--ink-600,#555)]">Verdict attached from your answers</p>
        </div>
        <div className={`min-w-[200px] flex-[1.4] rounded-lg border p-2.5 ${stage === "publish" ? "border-2 border-amber-400 bg-white" : "border-emerald-300 bg-white"}`}>
          <p className={`m-0 text-xs font-semibold ${stage === "publish" ? "text-amber-800" : "text-emerald-800"}`}>
            {stage === "publish" ? "2 · Publish your requirement — you are here" : "✓ 2 · Requirement published"}
          </p>
          <p className="m-0 mt-0.5 text-[11.5px] leading-snug text-[var(--ink-600,#555)]">
            {stage === "publish"
              ? gapCount > 0
                ? `Resolve ${gapCount} scoping gap${gapCount === 1 ? "" : "s"}, preview, then publish to the board`
                : "Preview your requirement, then publish it to the board"
              : `Live on the board, ${invitedCount} supplier${invitedCount === 1 ? "" : "s"} invited`}
          </p>
        </div>
        <div className={`min-w-[160px] flex-1 rounded-lg border p-2.5 ${stage === "responses" ? "border-2 border-amber-400 bg-white" : "border-[var(--ink-200,#e5e5e5)] bg-white"}`}>
          <p className={`m-0 text-xs font-semibold ${stage === "responses" ? "text-amber-800" : "text-[var(--ink-500)]"}`}>
            3 · Compare responses{stage === "responses" ? " — you are here" : ""}
          </p>
          <p className={`m-0 mt-0.5 text-[11.5px] leading-snug ${stage === "responses" ? "text-[var(--ink-600,#555)]" : "text-[var(--ink-400,#9ca3af)]"}`}>
            {stage === "responses" ? `${responseCount} response${responseCount === 1 ? "" : "s"} so far, pricing private to you` : "Suppliers reply here, pricing private to you"}
          </p>
        </div>
      </div>
      <p className="m-0 mt-1.5 text-xs text-[var(--ink-600,#555)]">
        Your goal: publish this requirement so matched vendors and providers can respond. Nothing is shared until you publish.
      </p>
    </div>
  );
}
