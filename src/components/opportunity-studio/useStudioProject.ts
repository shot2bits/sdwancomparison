"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioDraft } from "@/lib/opportunity-studio";
import {
  MARKETPLACE_PUBLICATION_CONSENT_TEXT,
  MARKETPLACE_PUBLICATION_CONSENT_VERSION,
} from "@/lib/publication-policy";
// This is a pure browser-safe constant. The server independently checks the same text.
const supplierConsent =
  "I have removed identifying details from my requirement and approve sharing this reviewed requirement with signed-in, approved suppliers.";
type Credential = {
  project_reference: string;
  project_session_token: string;
  revision: number;
};
type ProjectRead = {
  studio_draft: StudioDraft | null;
  buyer: { organisation: string };
  market_unlocked: boolean;
  publication_complete: boolean;
  unpublished_changes?: boolean;
  prepared: boolean;
  publication_receipt: { notice_url: string | null } | null;
  revision: number;
};
export async function studioJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const r = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const d = await r.json();
  if (!r.ok || d.ok === false || d.error)
    throw new Error(
      d.message ?? d.error ?? "This change could not be saved. Try again.",
    );
  return d;
}
export function useStudioProject(
  onLoad: (d: StudioDraft, published: boolean, hasLiveVersion?: boolean) => void,
) {
  const [recoveryCopy, setRecoveryCopy] = useState<StudioDraft | null>(null);
  const [recoveryProject, setRecoveryProject] = useState("");
  const [legacyUrl, setLegacyUrl] = useState("");
  const [returnPath, setReturnPath] = useState("/sase/studio-preview/");
  const [credential, setCredential] = useState<Credential | null>(null),
    ref = useRef<Credential | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [company, setCompany] = useState(""),
    [noticeUrl, setNoticeUrl] = useState("");
  const [hasLiveVersion,setHasLiveVersion]=useState(false);
  const [authenticated, setAuthenticated] = useState(false),
    [prepared, setPrepared] = useState(false);
  const running = useRef(false),
    loadCallback = useRef(onLoad);
  useEffect(() => {
    loadCallback.current = onLoad;
  }, [onLoad]);
  const remember = useCallback((c: Credential) => {
    setReturnPath(window.location.pathname);
    ref.current = c;
    setCredential(c);
    try {
      localStorage.setItem("netify_studio_project_v1", JSON.stringify(c));
    } catch {
      /* The private URL still provides recovery when browser storage is unavailable. */
    }
    const u = new URL(window.location.href);
    u.searchParams.set("project", c.project_reference);
    u.hash = `project_session=${encodeURIComponent(c.project_session_token)}`;
    window.history.replaceState(null, "", u);
  }, []);
  async function session() {
    const s = await studioJson<{ authenticated: boolean; role?: string }>(
      "/sase/api/auth/session/",
    );
    const ok = s.authenticated && ["buyer", "netify"].includes(s.role ?? "");
    setAuthenticated(ok);
    return ok;
  }
  const read = useCallback(
    async (c: Credential) => {
      const p = await studioJson<ProjectRead>(
        `/sase/api/marketplace/projects/${encodeURIComponent(c.project_reference)}/`,
        { headers: { authorization: `Bearer ${c.project_session_token}` } },
      );
      if (!p.studio_draft) {
        setLegacyUrl(`/sase/rfp-builder/${c.project_reference}/`);
        throw new Error(
          "This saved project belongs to the original detailed editor. Open it from your account; its history has been preserved.",
        );
      }
      remember({ ...c, revision: p.revision });
      setCompany(p.buyer.organisation);
      setPrepared(p.prepared === true);
      try {
        localStorage.setItem(
          `netify_studio_backup_${c.project_reference}`,
          JSON.stringify(p.studio_draft),
        );
      } catch {
        /* Server remains authoritative. */
      }
      setNoticeUrl(
        p.publication_receipt?.notice_url
          ? new URL(p.publication_receipt.notice_url).pathname
          : "",
      );
      loadCallback.current(p.studio_draft, p.publication_complete && !p.unpublished_changes, p.publication_complete);
      setHasLiveVersion(p.publication_complete);
      return p;
    },
    [remember],
  );
  const restore = useCallback(async () => {
    const u = new URL(window.location.href);
    const id = u.searchParams.get("project");
    const token = new URLSearchParams(u.hash.slice(1)).get("project_session");
    let c: Credential | null = null;
    if (id && token)
      c = { project_reference: id, project_session_token: token, revision: 0 };
    else if (id) {
      try {
        const local = JSON.parse(
          localStorage.getItem("netify_studio_project_v1") ?? "null",
        );
        if (local?.project_reference === id && local.project_session_token)
          c = local;
      } catch {
        /* Try verified owner recovery. */
      }
      if (!c)
        try {
          c = await studioJson<Credential>(
            `/sase/api/marketplace/projects/${encodeURIComponent(id)}/recover/`,
            { method: "POST" },
          );
        } catch {
          setRecoveryProject(id);
          throw new Error(
            "Verify the work email that owns this project to reopen it.",
          );
        }
    } else {
      try {
        c = JSON.parse(
          localStorage.getItem("netify_studio_project_v1") ?? "null",
        );
      } catch {
        throw new Error("No readable saved project was found.");
      }
    }
    if (!c?.project_reference || !c.project_session_token)
      throw new Error("No saved project was found in this browser.");
    try {
      const result = await read(c);
      setRecoveryProject("");
      return result;
    } catch (error) {
      try {
        const fresh = await studioJson<Credential>(
          `/sase/api/marketplace/projects/${encodeURIComponent(c.project_reference)}/recover/`,
          { method: "POST" },
        );
        const result = await read(fresh);
        setRecoveryProject("");
        return result;
      } catch {
        setRecoveryProject(c.project_reference);
        try {
          const cached = JSON.parse(
            localStorage.getItem(
              `netify_studio_backup_${c.project_reference}`,
            ) ?? "null",
          );
          if (
            cached &&
            typeof cached.requirement === "string" &&
            Array.isArray(cached.regions) &&
            Array.isArray(cached.questionIds)
          )
            setRecoveryCopy(cached);
        } catch {
          /* No usable browser copy. */
        }
        throw error;
      }
    }
  }, [read]);
  useEffect(() => {
    let active = true;
    studioJson<{ authenticated: boolean; role?: string }>(
      "/sase/api/auth/session/",
    )
      .then((s) => {
        if (active)
          setAuthenticated(
            s.authenticated && ["buyer", "netify"].includes(s.role ?? ""),
          );
      })
      .catch(() => {});
    if (new URL(window.location.href).searchParams.has("project"))
      void Promise.resolve()
        .then(restore)
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [restore]); // only restore explicit navigation, never overwrite new typing
  async function save(draft: StudioDraft) {
    let c = ref.current;
    if (!c) {
      c = await studioJson<Credential>("/sase/api/marketplace/projects/", {
        method: "POST",
        body: JSON.stringify({
          mode: draft.format === "rfp" ? "build_rfp" : "quick_list",
          entrance_context: {
            version: "project-entrance/1.0.0",
            source: "rfp_builder",
            source_url: window.location.origin + window.location.pathname,
            captured_at: Date.now(),
            requirement_text: draft.requirement,
            raw_input: { studio_draft: draft },
            buyer_input: { organisation: company },
          },
        }),
      });
      remember(c);
    } else {
      const saved = await studioJson<{ revision: number }>(
        `/sase/api/marketplace/projects/${c.project_reference}/`,
        {
          method: "PATCH",
          headers: { authorization: `Bearer ${c.project_session_token}` },
          body: JSON.stringify({
            base_revision: c.revision,
            idempotency_key: crypto.randomUUID(),
            buyer_patch: { organisation: company },
            raw_input: { studio_draft: draft },
          }),
        },
      );
      c = { ...c, revision: saved.revision };
      remember(c);
    }
    try {
      localStorage.setItem(
        `netify_studio_backup_${c.project_reference}`,
        JSON.stringify(draft),
      );
    } catch {
      /* Server save already succeeded. */
    }
    return c;
  }
  async function prepare(draft: StudioDraft) {
    const c = await save(draft);
    const r = await studioJson<{ revision: number }>(
      `/sase/api/marketplace/projects/${c.project_reference}/prepare-publication/`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${c.project_session_token}` },
        body: JSON.stringify({
          base_revision: c.revision,
          consent_version: MARKETPLACE_PUBLICATION_CONSENT_VERSION,
          consent_text: MARKETPLACE_PUBLICATION_CONSENT_TEXT,
          supplier_consent_text: supplierConsent,
        }),
      },
    );
    remember({ ...c, revision: r.revision });
    setPrepared(true);
    await session();
  }
  async function publish() {
    const c = ref.current;
    if (!c) throw new Error("Save and review your requirement first.");
    const r = await studioJson<{ opportunity_url: string }>(
      `/sase/api/marketplace/projects/${c.project_reference}/publish/`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${c.project_session_token}` },
        body: JSON.stringify({
          base_revision: c.revision,
          consent_version: MARKETPLACE_PUBLICATION_CONSENT_VERSION,
          consent_text: MARKETPLACE_PUBLICATION_CONSENT_TEXT,
        }),
      },
    );
    setNoticeUrl(new URL(r.opportunity_url).pathname);
    await read(c);
  }
  async function run(work: () => Promise<unknown>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      return await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The request failed. Your draft is unchanged.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return {
    hasLiveVersion,
    recoveryCopy,
    restartFromCopy: () => {
      if (!recoveryCopy) return;
      ref.current = null;
      setCredential(null);
      setPrepared(false);
      setCompany("");
      setRecoveryProject("");
      setError("");
      try {
        localStorage.removeItem("netify_studio_project_v1");
      } catch {}
      window.history.replaceState(null, "", window.location.pathname);
      loadCallback.current(recoveryCopy, false);
      setRecoveryCopy(null);
    },
    recoveryProject,
    legacyUrl,
    returnPath,
    credential,
    busy,
    error,
    company,
    setCompany,
    noticeUrl,
    authenticated,
    prepared,
    setPrepared,
    save,
    restore,
    prepare,
    publish,
    session,
    run,
  };
}
