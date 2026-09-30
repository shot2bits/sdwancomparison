import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
const reserve = createServer();
await new Promise((r) => reserve.listen(0, "127.0.0.1", r));
const port = reserve.address().port;
await new Promise((r) => reserve.close(r));
const dir = mkdtempSync(join(tmpdir(), "netify-isolated-redis-"));
const cli = process.env.NETIFY_REDIS_CLI || "redis-cli";
const redis = spawn(
  process.env.NETIFY_REDIS_SERVER || "redis-server",
  [
    "--bind",
    "127.0.0.1",
    "--port",
    String(port),
    "--save",
    "",
    "--appendonly",
    "no",
    "--dir",
    dir,
  ],
  { stdio: "ignore" },
);
let launchError;
redis.on("error", (e) => (launchError = e));
try {
  let ready = false;
  for (let n = 0; n < 50; n++) {
    if (launchError) throw launchError;
    const ping = spawnSync(
      cli,
      ["-h", "127.0.0.1", "-p", String(port), "PING"],
      { encoding: "utf8" },
    );
    if (ping.stdout?.trim() === "PONG") {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw Error("Isolated Redis failed to start");
  const child = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/test-sourcing-routes.ts"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        NETIFY_TEST_REDIS_PORT: String(port),
        NETIFY_TEST_REDIS_CLI: cli,
      },
    },
  );
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  if (code !== 0) process.exitCode = code || 1;
} finally {
  redis.kill("SIGTERM");
  await new Promise((r) => redis.once("exit", r));
  rmSync(dir, { recursive: true, force: true });
}
