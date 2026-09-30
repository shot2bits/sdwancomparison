import { spawnSync } from "node:child_process";
import { FakeKvStore } from "./fake-kv-harness";
/** Only used by the local runner/CI; never reads a deployment's Redis configuration. */
export class RealRedisFixture extends FakeKvStore {
  constructor(
    private port: string,
    private cli: string,
  ) {
    super();
    if (!/^\d{4,5}$/.test(port) || Number(port) > 65535)
      throw Error("Invalid isolated Redis port");
  }
  override command(cmd: (string | number)[]): unknown {
    const p = spawnSync(
      this.cli,
      ["-h", "127.0.0.1", "-p", this.port, "--json", ...cmd.map(String)],
      { encoding: "utf8", timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
    );
    if (p.error || p.status !== 0) throw Error("Isolated Redis command failed");
    const text = p.stdout.trim();
    if (text.startsWith("error:")) throw Error(text);
    return JSON.parse(text);
  }
  override peekJson<T>(key: string): T | null {
    const raw = this.command(["GET", key]);
    return raw === null ? null : JSON.parse(String(raw));
  }
  override fixtureCommands(): (string | number)[][] {
    const result: (string | number)[][] = [];
    for (const key of this.command(["KEYS", "*"]) as string[]) {
      const type = this.command(["TYPE", key]);
      if (type === "string")
        result.push(["SET", key, String(this.command(["GET", key]))]);
      if (type === "list")
        result.push([
          "RPUSH",
          key,
          ...(this.command(["LRANGE", key, 0, -1]) as string[]),
        ]);
      if (type === "set")
        result.push([
          "SADD",
          key,
          ...(this.command(["SMEMBERS", key]) as string[]),
        ]);
    }
    return result;
  }
}
