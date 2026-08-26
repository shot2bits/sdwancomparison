import type { SecurityRequirementInput } from "../src/lib/security/rulebook";
import { makeRequest, withFakeKv } from "./fake-kv-harness";

process.env.CRON_SECRET = "test-only-auth-challenge-secret";
delete process.env.RESEND_API_KEY;

const requirement: SecurityRequirementInput = {
  organisation: { sector: "healthcare" },
  estate: { sites: 20, users: 200, existingSecurity: ["Microsoft Defender"] },
  drivers: ["renewal"],
  constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
};

let failures = 0;
function check(pass: boolean, label: string, detail = "") {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` -> ${detail}` : ""}`);
}

await withFakeKv(async () => {
  const { GET: challengeRoute } = await import("../src/app/api/auth/challenge/route");
  const { POST: authRoute } = await import("../src/app/api/auth/request/route");
  const { POST: createRoute } = await import("../src/app/api/security-sourcing/project/route");

  async function challenge() {
    const response = await challengeRoute(makeRequest("GET", "https://example.test/sase/api/auth/challenge"));
    const data = await response.json() as { challenge?: string };
    await new Promise((resolve) => setTimeout(resolve, 725));
    return data.challenge ?? "";
  }

  const email = "buyer@publication-bound-test.co.uk";
  const generic = await authRoute(makeRequest("POST", "https://example.test/sase/api/auth/request", {
    body: { email, role: "buyer", return_to: "/sase/account/", bot_proof: { challenge: await challenge(), website: "" } },
  }));
  const genericBody = await generic.json() as { publish_required?: boolean };
  check(generic.status === 403 && genericBody.publish_required === true, "Generic buyer sign-in cannot create an empty account", `status=${generic.status}`);

  const create = await createRoute(makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
    body: { requirement, consent: true, publish_intent: true },
  }));
  const created = await create.json() as { project?: { id?: string; pending_submit?: { list_on_board?: boolean } }; error?: string };
  const id = created.project?.id ?? "";
  check(create.status === 200 && Boolean(id) && created.project?.pending_submit?.list_on_board === true, "Publish-intent RFP carries the board boundary", `status=${create.status} id=${id} error=${created.error ?? ""}`);

  const proof = await challenge();
  const bound = await authRoute(makeRequest("POST", "https://example.test/sase/api/auth/request", {
    body: { email, role: "buyer", return_to: `/sase/rfp-builder/${id}/?welcome=submitting`, bot_proof: { challenge: proof, website: "" } },
  }));
  const boundBody = await bound.json() as { dev_link?: string; error?: string };
  check(bound.status === 200 && Boolean(boundBody.dev_link), "Publication-bound buyer receives the verification link", `status=${bound.status} error=${boundBody.error ?? ""}`);

  const replay = await authRoute(makeRequest("POST", "https://example.test/sase/api/auth/request", {
    body: { email, role: "buyer", return_to: `/sase/rfp-builder/${id}/?welcome=submitting`, bot_proof: { challenge: proof, website: "" } },
  }));
  check(replay.status === 403, "Invisible challenge cannot be replayed", `status=${replay.status}`);

  const trapped = await authRoute(makeRequest("POST", "https://example.test/sase/api/auth/request", {
    body: { email: "bot@publication-bound-test.co.uk", role: "buyer", return_to: `/sase/rfp-builder/${id}/?welcome=submitting`, bot_proof: { challenge: await challenge(), website: "https://spam.invalid" } },
  }));
  check(trapped.status === 403, "Honeypot submission is rejected", `status=${trapped.status}`);
});

if (failures) process.exit(1);
console.log("Publish-bound buyer auth validation passed.");
