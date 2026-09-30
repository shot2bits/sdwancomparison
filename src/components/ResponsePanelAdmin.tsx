"use client";
import { useEffect, useState } from "react";
import type { ResponsePanelRow } from "@/lib/response-panel-contract";
export default function ResponsePanelAdmin() {
  const [rows, setRows] = useState<ResponsePanelRow[]>([]),
    [providers, setProviders] = useState<{ slug: string; name: string }[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/sase/api/sourcing/panel/", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (alive) {
          setRows(d.rows);
          setProviders(d.providers);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const input = {
        ...Object.fromEntries(f.entries()),
        agreed_response_working_days: Number(
          f.get("agreed_response_working_days"),
        ),
        introduction_terms_acknowledged_at: new Date(
          String(f.get("introduction_terms_acknowledged_at")),
        ).toISOString(),
      };
      const r = await fetch("/sase/api/sourcing/panel/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setRows((current) =>
        [...current.filter((x) => x.slug !== d.row.slug), d.row].sort((a, b) =>
          a.slug.localeCompare(b.slug),
        ),
      );
      setMessage("Panel record saved. No supplier message was sent.");
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  const field = "block w-full rounded border border-slate-300 p-2";
  return (
    <>
      <h1 className="text-3xl font-semibold">Private response panel</h1>
      <p className="my-3">
        Record written supplier commitments. The named contact, role, email
        domain and response time appear publicly. Acknowledgement evidence stays
        private.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <form onSubmit={save} className="my-6">
        <fieldset disabled={busy || !providers.length} className="space-y-4">
          <label className="block">
            Provider
            <select className={field} name="slug" required>
              <option value="">Choose provider</option>
              {providers.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          {[
            ["contact_name", "Contact name"],
            ["contact_role", "Contact role"],
            ["contact_email_domain", "Contact email domain (domain only)"],
            ["acknowledged_by", "Who acknowledged the introduction terms"],
            ["source", "Private written acknowledgement reference"],
          ].map(([name, label]) => (
            <label key={name} className="block">
              {label}
              <input
                className={field}
                name={name}
                required
                maxLength={name === "source" ? 1000 : 160}
              />
            </label>
          ))}
          <label className="block">
            Agreed response time (working days)
            <input
              className={field}
              name="agreed_response_working_days"
              type="number"
              min="1"
              max="365"
              required
            />
          </label>
          <label className="block">
            Terms acknowledged at (your local time)
            <input
              className={field}
              name="introduction_terms_acknowledged_at"
              type="datetime-local"
              required
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-white"
          >
            {busy ? "Saving…" : "Save panel record"}
          </button>
        </fieldset>
      </form>
      <h2 className="text-xl font-semibold">Recorded commitments</h2>
      {rows.length ? (
        rows.map((r) => (
          <article key={r.slug} className="my-3 border-t py-3">
            <strong>{r.slug}</strong>
            <p>
              {r.contact_name} · {r.contact_role} · {r.contact_email_domain}
            </p>
            <p>
              {r.agreed_response_working_days} working days · acknowledged{" "}
              {r.introduction_terms_acknowledged_at}
            </p>
            <p>
              Recorded acknowledgement: {r.acknowledged_by} · {r.source}
            </p>
          </article>
        ))
      ) : (
        <p>No response-panel commitments recorded.</p>
      )}
    </>
  );
}
