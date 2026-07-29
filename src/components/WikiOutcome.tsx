import { OUTCOMES } from "@/lib/vendor-edit";

/**
 * The sentence that follows a form post on the record wiki.
 *
 * The code travels in the URL and the words live in the code base, so a
 * redirect never carries message text, a supplier email or anything else
 * personal. An unrecognised code renders nothing rather than guessing.
 */
export default function WikiOutcome({ code }: { code?: string | string[] }) {
  const key = Array.isArray(code) ? code[0] : code;
  const o = key ? OUTCOMES[key] : undefined;
  if (!o) return null;
  const ok = o.tone === "ok";
  return (
    <p
      role="status"
      className={`text-sm rounded-lg border px-4 py-3 mb-6 max-w-3xl ${
        ok
          ? "border-[var(--ink-300,#c9ced6)] bg-[var(--ink-50,#f6f8fa)]"
          : "border-[#d9534f] bg-[#fdf3f3]"
      }`}
    >
      {o.text}
    </p>
  );
}
