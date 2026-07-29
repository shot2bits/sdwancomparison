import { PROMISES, VETTING_STANDARD_PATH } from "@/lib/publish-promises";

/**
 * The four promises block (Robert's Ruling Three, 29 Jul 2026), rendered
 * wherever a buyer is about to give the platform their information: the
 * notice wizard door and beside the publish control. Server-compatible,
 * no hooks, one source of words (lib/publish-promises). The vetting link
 * points at the published standard so the claim is checkable, not
 * asserted. WORDING PROVISIONAL pending Harry's copy pass.
 */
export default function PublishPromises({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "rounded-md bg-zinc-50 px-3 py-2.5" : "rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--ink-50,#fafafa)] p-4"}>
      <p className={compact ? "m-0 mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-400" : "eyebrow mb-2"}>What happens to your information</p>
      <ul className={compact ? "m-0 list-none space-y-1 p-0 text-[11px] leading-relaxed text-zinc-600" : "m-0 list-none space-y-1.5 p-0 text-sm text-[var(--ink-700)]"}>
        {PROMISES.map((p) => (
          <li key={p.key} className="flex gap-2">
            <span aria-hidden="true" className={compact ? "text-zinc-400" : "text-[var(--ink-400)]"}>·</span>
            <span>{p.full}</span>
          </li>
        ))}
      </ul>
      <p className={compact ? "m-0 mt-1.5 text-[10.5px] text-zinc-500" : "m-0 mt-2 text-xs text-[var(--ink-500)]"}>
        Vetted means our published standard:{" "}
        <a href={`/sase${VETTING_STANDARD_PATH}/`} className="underline">how Netify vets suppliers</a>.
      </p>
    </div>
  );
}
