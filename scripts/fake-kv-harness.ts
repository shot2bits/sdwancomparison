/**
 * Fifth amendment (13 Aug 2026), Robert's item 4: route-level integration
 * coverage. His review of the fourth amendment found every "end-to-end"
 * fixture drove the persistence-core functions (buildSecurityProject,
 * buildRescopedProject) directly -- proving the CORE merges correctly, but
 * never proving the actual Next.js route handlers (request parsing, owner
 * auth, saveProject's real read-modify-write) do the same thing with a
 * real Request in, a real Response out.
 *
 * This module is a minimal, in-process, in-memory emulator of the one
 * Upstash Redis REST calling convention this app's kv() function speaks
 * (rfp-store.ts: one POST to KV_REST_API_URL per command, body a JSON
 * array like ["GET", key] or ["SET", key, value], response {result: ...}).
 * It lets the real route handlers run their REAL saveProject/getProject/
 * session code against an in-memory store instead of a live KV instance --
 * so a fixture built on this harness exercises the actual HTTP route, not
 * a hand-reimplemented substitute (exactly what was missing before).
 *
 * Deliberately a generic small Redis-subset interpreter (GET/SET/DEL/
 * EXPIRE/PEXPIRE/SADD/SREM/SISMEMBER/SMEMBERS/HINCRBY/HGETALL/MGET/SCAN),
 * not a hand-picked set of exact keys: a real route touches several
 * incidental keys (auth sessions, buyer indexes, vendor connection tokens)
 * that have nothing to do with the source ledger, and a key-specific mock
 * would silently break the moment any of that incidental code changed --
 * the opposite of the honesty this round is about.
 *
 * IMPORTANT ordering constraint: rfp-store.ts reads KV_REST_API_URL/TOKEN
 * into module-level consts AT IMPORT TIME, once, the first time anything
 * imports it (directly or transitively). Callers of withFakeKv() MUST
 * reach every module that touches rfp-store.ts via a DYNAMIC import()
 * performed inside the callback passed to withFakeKv() (or otherwise only
 * after the env vars below are set) -- a static top-of-file `import` of a
 * route handler would evaluate rfp-store.ts, and lock in the real (unset)
 * env vars, before this module ever gets a chance to fake them.
 */

export const FAKE_KV_URL = "https://fake-kv.internal.test/redis";
export const FAKE_KV_TOKEN = "fake-kv-token-not-real";

type Entry =
  | { type: "string"; value: string }
  | { type: "set"; value: Set<string> }
  | { type: "hash"; value: Map<string, string> };

export class FakeKvStore {
  private store = new Map<string, Entry>();

  private str(key: string): string | null {
    const e = this.store.get(key);
    return e && e.type === "string" ? e.value : null;
  }
  private setEntry(key: string): Set<string> {
    let e = this.store.get(key);
    if (!e || e.type !== "set") {
      e = { type: "set", value: new Set() };
      this.store.set(key, e);
    }
    return e.value;
  }
  private hashEntry(key: string): Map<string, string> {
    let e = this.store.get(key);
    if (!e || e.type !== "hash") {
      e = { type: "hash", value: new Map() };
      this.store.set(key, e);
    }
    return e.value;
  }

  /** Debug/assertion escape hatch: read a raw string key without going
   *  through a route (used by fixtures to inspect what actually landed). */
  peekJson<T>(key: string): T | null {
    const raw = this.str(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  command(cmd: (string | number)[]): unknown {
    const [name, ...args] = cmd;
    const op = String(name).toUpperCase();
    switch (op) {
      case "GET":
        return this.str(String(args[0]));
      case "SET":
        this.store.set(String(args[0]), { type: "string", value: String(args[1]) });
        return "OK";
      case "DEL": {
        let n = 0;
        for (const k of args) if (this.store.delete(String(k))) n++;
        return n;
      }
      case "EXPIRE":
      case "PEXPIRE":
        // TTL is not modelled (these fixtures run and finish in
        // milliseconds); presence is acknowledged so callers that check
        // the return value see the same "key exists" signal Upstash gives.
        return this.store.has(String(args[0])) ? 1 : 0;
      case "SADD": {
        const s = this.setEntry(String(args[0]));
        let added = 0;
        for (const m of args.slice(1)) {
          const ms = String(m);
          if (!s.has(ms)) {
            s.add(ms);
            added++;
          }
        }
        return added;
      }
      case "SREM": {
        const s = this.setEntry(String(args[0]));
        let removed = 0;
        for (const m of args.slice(1)) if (s.delete(String(m))) removed++;
        return removed;
      }
      case "SISMEMBER":
        return this.setEntry(String(args[0])).has(String(args[1])) ? 1 : 0;
      case "SMEMBERS":
        return Array.from(this.setEntry(String(args[0])));
      case "HINCRBY": {
        const h = this.hashEntry(String(args[0]));
        const cur = Number(h.get(String(args[1])) ?? "0");
        const next = cur + Number(args[2]);
        h.set(String(args[1]), String(next));
        return next;
      }
      case "HGETALL": {
        const h = this.hashEntry(String(args[0]));
        const out: string[] = [];
        for (const [k, v] of h) out.push(k, v);
        return out;
      }
      case "MGET":
        return args.map((k) => this.str(String(k)));
      case "SCAN": {
        // Single-page emulation: MATCH is honoured, COUNT/cursor are not
        // (adequate for these fixtures' small key counts; cursor "0" tells
        // a real Upstash-shaped caller the scan is complete).
        const matchIdx = args.findIndex((a) => String(a).toUpperCase() === "MATCH");
        const pattern = matchIdx >= 0 ? String(args[matchIdx + 1]) : "*";
        const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
        const keys = Array.from(this.store.keys()).filter((k) => re.test(k));
        return ["0", keys];
      }
      case "LRANGE":
        // Not exercised by the flows these fixtures drive (create/
        // re-scope/reload/publish); returning empty lets an incidental
        // call degrade quietly instead of throwing.
        return [];
      default:
        throw new Error(`FakeKvStore: unhandled command ${op} (${JSON.stringify(cmd)})`);
    }
  }
}

/**
 * Installs the fake KV over global.fetch for the duration of `fn`, then
 * restores whatever fetch was in place before -- the same swap-then-
 * restore idiom this script already uses for its model-mocking block.
 *
 * `passThroughOtherHosts`: false (default) makes any fetch to a URL other
 * than the fake KV endpoint throw, matching this script's hermetic policy
 * (used by the build-gate fixtures). true lets other calls fall through
 * to the real original fetch -- used ONLY by the separate, NOT-build-gate
 * live publish demonstration, which deliberately wants real business-email
 * verification network calls.
 */
export async function withFakeKv<T>(
  fn: (store: FakeKvStore) => Promise<T>,
  opts: { passThroughOtherHosts?: boolean } = {},
): Promise<T> {
  process.env.KV_REST_API_URL = FAKE_KV_URL;
  process.env.KV_REST_API_TOKEN = FAKE_KV_TOKEN;
  const store = new FakeKvStore();
  const before = global.fetch;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url === FAKE_KV_URL) {
      const body = init?.body ? JSON.parse(String(init.body)) : [];
      try {
        const result = store.command(body as (string | number)[]);
        return { ok: true, status: 200, json: async () => ({ result }) } as unknown as Response;
      } catch (e) {
        return { ok: false, status: 500, json: async () => ({ error: (e as Error).message }) } as unknown as Response;
      }
    }
    if (opts.passThroughOtherHosts) return before(input as never, init);
    throw new Error(
      `FakeKvStore: unexpected fetch to ${url} (not the fake KV URL; mock this explicitly or pass passThroughOtherHosts:true)`,
    );
  }) as unknown as typeof fetch;
  try {
    return await fn(store);
  } finally {
    global.fetch = before;
  }
}

/** Build a plain Web-standard Request the same shape a real browser POST/
 *  PUT/GET carries -- no Next.js-specific request wrapper needed, since
 *  every route handler in this app is typed against the Fetch API's
 *  Request/Response, not NextRequest/NextResponse. */
export function makeRequest(
  method: string,
  url: string,
  opts: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
): Request {
  const headers = new Headers(opts.headers ?? {});
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  if (opts.cookie) headers.set("cookie", opts.cookie);
  return new Request(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}
