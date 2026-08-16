/**
 * Minimal in-process stand-in for the Upstash REST KV protocol that
 * src/lib/rfp-store.ts's kv()/kvRaw() speak (POST the whole app's real
 * command array as the request body, `{"result": ...}` back). This sandbox
 * has no KV_REST_API_URL/TOKEN configured (no network to a real Upstash
 * instance), so every /api/auth/* and /api/rfp/* route 503s with
 * "Storage not configured" -- which is exactly what blocked scripting a
 * real save -> sign-in -> reload browser fixture for the sector-suggestion
 * reversal hotfix (Robert, 15 Aug 2026 hotfix spec).
 *
 * This is NOT a mock of the application: every request still goes through
 * the real Next.js route handlers, the real auth/session/rfp-store logic,
 * and the real React components. Only the Redis-compatible persistence
 * backend underneath is swapped for an equivalent in-memory one, the same
 * way a unit test fakes an external database. It implements exactly the
 * command vocabulary rfp-store.ts actually issues (checked by grepping
 * every kv([...])/kvRaw([...]) call site): GET, SET, DEL, EXPIRE, PEXPIRE,
 * SADD, SREM, SMEMBERS, SISMEMBER, HGETALL, HINCRBY, MGET, SCAN, LPUSH,
 * LRANGE, LTRIM.
 */
import { createServer } from "node:http";

export async function startFakeKv() {
  const store = new Map(); // key -> { type: "string"|"set"|"hash"|"list", value }
  const expiries = new Map(); // key -> epoch ms

  function expired(key) {
    const exp = expiries.get(key);
    if (exp !== undefined && Date.now() > exp) {
      store.delete(key);
      expiries.delete(key);
      return true;
    }
    return false;
  }
  function get(key) {
    if (expired(key)) return undefined;
    return store.get(key);
  }
  function ensure(key, type, init) {
    expired(key);
    let e = store.get(key);
    if (!e) { e = { type, value: init() }; store.set(key, e); }
    return e;
  }

  function exec([cmd, ...args]) {
    switch (String(cmd).toUpperCase()) {
      case "GET": {
        const e = get(args[0]);
        return e ? e.value : null;
      }
      case "SET": {
        store.set(args[0], { type: "string", value: String(args[1]) });
        expiries.delete(args[0]);
        return "OK";
      }
      case "DEL": {
        let n = 0;
        for (const k of args) { if (store.delete(k)) n += 1; expiries.delete(k); }
        return n;
      }
      case "EXPIRE": {
        if (!get(args[0])) return 0;
        expiries.set(args[0], Date.now() + Number(args[1]) * 1000);
        return 1;
      }
      case "PEXPIRE": {
        if (!get(args[0])) return 0;
        expiries.set(args[0], Date.now() + Number(args[1]));
        return 1;
      }
      case "SADD": {
        const e = ensure(args[0], "set", () => new Set());
        let added = 0;
        for (const m of args.slice(1)) { if (!e.value.has(m)) { e.value.add(m); added += 1; } }
        return added;
      }
      case "SREM": {
        const e = get(args[0]);
        if (!e) return 0;
        let removed = 0;
        for (const m of args.slice(1)) { if (e.value.delete(m)) removed += 1; }
        return removed;
      }
      case "SMEMBERS": {
        const e = get(args[0]);
        return e ? Array.from(e.value) : [];
      }
      case "SISMEMBER": {
        const e = get(args[0]);
        return e && e.value.has(args[1]) ? 1 : 0;
      }
      case "HGETALL": {
        const e = get(args[0]);
        if (!e) return [];
        const out = [];
        for (const [k, v] of e.value.entries()) { out.push(k, v); }
        return out;
      }
      case "HINCRBY": {
        const e = ensure(args[0], "hash", () => new Map());
        const field = args[1];
        const cur = Number(e.value.get(field) ?? 0);
        const next = cur + Number(args[2]);
        e.value.set(field, String(next));
        return next;
      }
      case "MGET": {
        return args.map((k) => { const e = get(k); return e ? e.value : null; });
      }
      case "SCAN": {
        // Simplified: single-pass, cursor always "0" (done). Supports
        // MATCH glob (only the `prefix*` shape rfp-store.ts actually uses).
        let matchIdx = args.indexOf("MATCH");
        let pattern = matchIdx >= 0 ? String(args[matchIdx + 1]) : "*";
        const re = new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
        const keys = [];
        for (const k of store.keys()) { if (!expired(k) && re.test(k)) keys.push(k); }
        return ["0", keys];
      }
      case "LPUSH": {
        const e = ensure(args[0], "list", () => []);
        for (const v of args.slice(1)) e.value.unshift(String(v));
        return e.value.length;
      }
      case "LRANGE": {
        const e = get(args[0]);
        if (!e) return [];
        let start = Number(args[1]);
        let stop = Number(args[2]);
        const len = e.value.length;
        if (start < 0) start = Math.max(len + start, 0);
        if (stop < 0) stop = len + stop;
        stop = Math.min(stop, len - 1);
        if (start > stop) return [];
        return e.value.slice(start, stop + 1);
      }
      case "LTRIM": {
        const e = get(args[0]);
        if (!e) return "OK";
        let start = Number(args[1]);
        let stop = Number(args[2]);
        const len = e.value.length;
        if (start < 0) start = Math.max(len + start, 0);
        if (stop < 0) stop = len + stop;
        stop = Math.min(stop, len - 1);
        e.value = start > stop ? [] : e.value.slice(start, stop + 1);
        return "OK";
      }
      default:
        throw new Error(`fake-kv-server: unimplemented command ${cmd}`);
    }
  }

  const server = createServer((req, res) => {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      try {
        const command = JSON.parse(body || "[]");
        const result = exec(command);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result }));
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
      }
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  let live = server;
  return {
    url,
    token: "fixture-token",
    stop: async () => { await new Promise((resolve) => live.close(resolve)); },
    /**
     * Market-unlock correction round (16 Aug 2026): simulate a genuine
     * backend-storage outage for a "board storage failure" fixture, distinct
     * from the deliberate BoardQualityGateError business-rule refusal --
     * closes the TCP listener (every in-flight and subsequent request gets a
     * real connection-refused, exactly like Upstash being unreachable), then
     * reopens a fresh listener on the EXACT SAME port once `restore()` is
     * called. The in-memory `store`/`expiries` Maps above are untouched by
     * either call (they are outer-scope closures, not owned by the listener),
     * so this is a real outage-and-recovery of the transport only -- data
     * already committed before the outage survives it, matching what a real
     * managed KV outage looks like to this app (the module-level cached
     * KV_REST_API_URL never changes, so the app keeps talking to the same
     * port throughout).
     */
    outage: async () => { await new Promise((resolve) => live.close(resolve)); },
    restore: async () => {
      // Rebuild a listener with the identical request handler as the
      // original (createServer's callback isn't introspectable after the
      // fact in a portable way, so this recreates it via the same closure
      // used above rather than trying to clone `server`).
      const relistened = createServer((req, res) => {
        if (req.method !== "POST") { res.writeHead(405).end(); return; }
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          try {
            const command = JSON.parse(body || "[]");
            const result = exec(command);
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ result }));
          } catch (e) {
            res.writeHead(500, { "content-type": "application/json" });
            res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
          }
        });
      });
      await new Promise((resolve, reject) => {
        relistened.on("error", reject);
        relistened.listen(port, "127.0.0.1", resolve);
      });
      live = relistened;
    },
  };
}
