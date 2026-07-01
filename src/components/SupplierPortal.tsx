"use client";

/** Supplier portal: a vendor (or their agent) reads the buyer's messages on
 *  an RFP connection and replies, shares contact details or proposes a demo. */

import { useEffect, useState } from "react";

type Msg = { id: string; from: "buyer" | "supplier"; type: string; body: string; payload: Record<string, string>; created: number };
type Conn = { vendor_name: string; status: string; messages: Msg[] };
type Rfp = { title: string; status: string; sector: string | null; product_scope: string; operating_model: string; question_count: number };

const TYPE_LABEL: Record<string, string> = {
  intro: "Introduction", message: "Message", demo_request: "Demo requested", demo_response: "Demo proposal",
  contact_request: "Contact requested", contact_share: "Contact shared", decline: "Declined",
};

export default function SupplierPortal({ token }: { token: string }) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [reply, setReply] = useState("");
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function load() {
    try {
      const res = await fetch(`/sase/api/supplier/${token}`);
      if (!res.ok) { setError("This connection could not be found."); return; }
      const data = (await res.json()) as { connection: Conn; rfp: Rfp | null };
      setConn(data.connection); setRfp(data.rfp);
    } catch { setError("This connection could not be loaded."); }
  }

  async function post(action: string, body: string, payload: Record<string, string> = {}) {
    setError(null); setNotice(null);
    try {
      const res = await fetch(`/sase/api/supplier/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, body, payload }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not send."); }
      setConn((await res.json()) as Conn);
      setNotice("Sent.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send."); }
  }

  if (error && !conn) return <p className="text-red-700">{error}</p>;
  if (!conn) return <p className="text-[var(--ink-500)]">Loading...</p>;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Supplier portal</p>
        <h1 className="text-2xl mb-1">{conn.vendor_name}</h1>
        {rfp && <p className="text-sm text-[var(--ink-500)]">RFP: {rfp.title} · {rfp.status} · {rfp.question_count} questions · scope {rfp.product_scope} · {rfp.operating_model}{rfp.sector ? ` · ${rfp.sector}` : ""}</p>}
        <p className="text-sm text-[var(--ink-500)] mt-1">Connection status: {conn.status}</p>
      </div>

      <div className="space-y-3">
        {conn.messages.map((m) => (
          <div key={m.id} className={`text-sm rounded-sm p-3 ${m.from === "buyer" ? "bg-amber-50 border border-amber-200" : "border border-[var(--ink-300,#ccc)]"}`}>
            <p className="text-xs uppercase tracking-wide text-[var(--ink-500)] mb-1">{m.from === "buyer" ? "Buyer" : "You"} · {TYPE_LABEL[m.type] ?? m.type}</p>
            {m.body && <p className="text-[var(--ink-800)]">{m.body}</p>}
            {Object.keys(m.payload).length > 0 && (
              <ul className="mt-1 text-[var(--ink-700)]">{Object.entries(m.payload).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--ink-300,#ccc)] pt-5 space-y-4">
        <div>
          <p className="eyebrow mb-2">Reply to the buyer</p>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Your message" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
          <div className="mt-2 flex gap-2 flex-wrap">
            <button onClick={() => { post("message", reply); setReply(""); }} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors">Send message</button>
            <button onClick={() => { post("demo_response", reply || "We can offer a demo. Proposed times to follow."); setReply(""); }} className="px-4 py-2 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Propose a demo</button>
            <button onClick={() => post("decline", reply || "Thank you, we are declining this opportunity.")} className="px-4 py-2 text-sm border border-[var(--ink-300,#ccc)] rounded-full hover:border-[var(--ink-900)]">Decline</button>
          </div>
        </div>
        <div>
          <p className="eyebrow mb-2">Share contact details</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Contact name" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
            <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
            <input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="Phone" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
          </div>
          <button onClick={() => post("contact_share", "Contact details shared.", contact)} className="mt-2 px-4 py-2 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Share contact</button>
        </div>
      </div>
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
