// @ts-expect-error Node 24 supplies registerHooks.
import { registerHooks } from "node:module";
registerHooks({
  resolve(s: string, c: object, n: (s: string, c: object) => { url: string }) {
    return s === "server-only"
      ? { url: "data:text/javascript,export {};", shortCircuit: true }
      : n(s, c);
  },
});
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID, createHmac } from "node:crypto";
import { withFakeKv, makeRequest, FAKE_KV_URL } from "./fake-kv-harness";
await withFakeKv(async (store) => {
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_URL = "studio-test.vercel.app";
  process.env.NETIFY_PREVIEW_MAIL_CAPTURE = "1";
  process.env.AUTH_BOT_SECRET = "studio-test-secret-not-real";
  process.env.PROVIDER_MATCH_DATA_URL = "https://provider.fixture/records";
  process.env.PROVIDER_MATCH_SERVICE_TOKEN = "fixture-only";
  let failBoard = false;
  let failFeed = false;
  const before = global.fetch;
  const { getShortlistDataset } = await import("../src/lib/vendors");
  const { ProviderMatchRecordSchema } =
    await import("../src/lib/provider-matching");
  const records = getShortlistDataset().map((v) =>
    ProviderMatchRecordSchema.parse({
      provider_id: v.slug,
      slug: v.slug,
      display_name: v.name,
      provider_types: ["managed_service_provider"],
      revision_id: `fixture:${v.slug}`,
      dataset_version: "fixture:studio",
      capabilities: {},
      regions: {},
      service_models: {},
      sectors: {},
    }),
  );
  global.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://provider.fixture/records" && failFeed)
      return Response.json({ error: "Not found." }, { status: 404 });
    if (url === "https://provider.fixture/records")
      return Response.json({
        contract_version: "provider-match-records/2.0.0",
        providers: records,
      });
    if (url.startsWith("https://netify.co.uk"))
      return new Response("<title>Netify</title>", { status: 200 });
    if (url === FAKE_KV_URL) {
      const cmd = JSON.parse(String(init?.body ?? "[]"));
      if (failBoard && cmd[0] === "SET" && String(cmd[1]).startsWith("opp:"))
        throw new Error("Injected board storage failure");
      return before(input, init);
    }
    throw new Error("Network forbidden in fixture: " + url);
  };
  const projects = await import("../src/app/api/marketplace/projects/route");
  const projectRoute =
    await import("../src/app/api/marketplace/projects/[projectId]/route");
  const prepare =
    await import("../src/app/api/marketplace/projects/[projectId]/prepare-publication/route");
  const publish =
    await import("../src/app/api/marketplace/projects/[projectId]/publish/route");
  const engage =
    await import("../src/app/api/marketplace/projects/[projectId]/engagement/route");
  const publicRead = await import("../src/app/api/opportunity/[id]/route");
  const rpc = await import("../src/app/api/mcp/route");
  const kv = await import("../src/lib/rfp-store");
  const policy = await import("../src/lib/publication-policy");
  const { STUDIO_SUPPLIER_CONSENT } = await import("../src/lib/studio-project");
  const { canonicalQuestions } = await import("../src/lib/rfp-question-bank");
  const buyer = await kv.createSession({
    role: "buyer",
    email: "buyer@netify.co.uk",
    vendor_slug: null,
  });
  const supplier = await kv.createSession({
    role: "supplier",
    email: "buyer@cisco.com",
    vendor_slug: "cisco",
  });
  const other = await kv.createSession({
    role: "supplier",
    email: "buyer@fortinet.com",
    vendor_slug: "fortinet",
  });
  const stranger = await kv.createSession({
    role: "buyer",
    email: "other@netify.co.uk",
    vendor_slug: null,
  });
  await kv.requestVendorClaim("cisco", "buyer@cisco.com", "cisco.com");
  await kv.decideVendorClaim("cisco", true, "owner@netify.co.uk");
  await kv.requestVendorClaim("fortinet", "buyer@fortinet.com", "fortinet.com");
  await kv.decideVendorClaim("fortinet", true, "owner@netify.co.uk");
  let buyerCookie = `netify_session=${buyer.token}`;
  const cookie = (s: typeof buyer) =>
    s === buyer ? buyerCookie : `netify_session=${s.token}`;
  const consent = {
    consent_version: policy.MARKETPLACE_PUBLICATION_CONSENT_VERSION,
    consent_text: policy.MARKETPLACE_PUBLICATION_CONSENT_TEXT,
    supplier_consent_text: STUDIO_SUPPLIER_CONSENT,
  };
  let lastId = "";
  for (const format of ["rfi", "rfp"] as const) {
    const draft = {
      format,
      requirement:
        "Replace our legacy network and VPN with a managed service for secure remote access. PRIVATE_SENTINEL",
      scope: "SASE",
      sites: "10",
      users: "500",
      regions: ["UK & Ireland"],
      timescale: "Within 3 months",
      service: "Fully managed",
      questionIds: canonicalQuestions().map((q) => q.id),
    };
    const started = await projects.POST(
      makeRequest(
        "POST",
        "https://studio-test.vercel.app/sase/api/marketplace/projects/",
        {
          body: {
            mode: format === "rfi" ? "quick_list" : "build_rfp",
            entrance_context: {
              version: "project-entrance/1.0.0",
              source: "rfp_builder",
              captured_at: Date.now(),
              requirement_text: draft.requirement,
              raw_input: { studio_draft: draft },
              buyer_input: { organisation: "PRIVATE_COMPANY" },
            },
          },
        },
      ),
    );
    const c = await started.json();
    assert.equal(started.status, 201, JSON.stringify(c));
    lastId = c.project_reference;
    const ctx = { params: Promise.resolve({ projectId: c.project_reference }) },
      headers = { authorization: `Bearer ${c.project_session_token}` };
    const saved = await kv.getProject(c.project_reference);
    assert(saved);
    assert.equal(saved.buyer.notes, draft.requirement);
    assert.equal(saved.rfp_sections[0].included, format === "rfp");
    const denied = await publish.POST(
      makeRequest("POST", "https://studio-test.vercel.app/publish", {
        headers,
        body: {
          base_revision: 0,
          consent_version: consent.consent_version,
          consent_text: consent.consent_text,
        },
      }),
      ctx,
    );
    assert.equal(denied.status, 401);
    const missingConsent = await prepare.POST(
      makeRequest("POST", "https://studio-test.vercel.app/prepare", {
        headers,
        body: {
          base_revision: 0,
          consent_version: consent.consent_version,
          consent_text: consent.consent_text,
        },
      }),
      ctx,
    );
    assert.equal(missingConsent.status, 400);
    const ready = await prepare.POST(
      makeRequest("POST", "https://studio-test.vercel.app/prepare", {
        headers,
        body: { base_revision: 0, ...consent },
      }),
      ctx,
    );
    const readyBody = await ready.json();
    assert.equal(ready.status, 200, JSON.stringify(readyBody));
    if (format === "rfi") {
      const requestAuth = await import("../src/app/api/auth/request/route");
      const verifyAuth = await import("../src/app/api/auth/verify/route");
      const proof = () => {
        const payload = Buffer.from(
          JSON.stringify({ issued: Date.now() - 1000, nonce: randomUUID() }),
        ).toString("base64url");
        return (
          payload +
          "." +
          createHmac("sha256", "studio-test-secret-not-real")
            .update(payload)
            .digest("base64url")
        );
      };
      const authBody = {
        email: buyer.email,
        role: "buyer",
        return_to: `/sase/studio-preview/?project=${c.project_reference}`,
        project_session_token: c.project_session_token,
        bot_proof: { challenge: proof(), website: "" },
      };
      const wrongDraft = await requestAuth.POST(
        makeRequest("POST", "https://studio-test.vercel.app/auth/request", {
          body: { ...authBody, project_session_token: "wrong" },
        }),
      );
      assert.equal(wrongDraft.status, 403);
      const requested = await requestAuth.POST(
        makeRequest("POST", "https://studio-test.vercel.app/auth/request", {
          body: { ...authBody, bot_proof: { challenge: proof(), website: "" } },
        }),
      );
      const authResult = await requested.json();
      assert.equal(requested.status, 200, JSON.stringify(authResult));
      assert.equal(authResult.emailed, true);
      const code = store.peekJson<{ code: string }>(`auth:code:${buyer.email}`);
      assert(code);
      const badCode = await verifyAuth.POST(
        makeRequest("POST", "https://studio-test.vercel.app/auth/verify", {
          body: { email: buyer.email, code: "000000" },
        }),
      );
      assert.equal(badCode.status, 401);
      const verified = await verifyAuth.POST(
        makeRequest("POST", "https://studio-test.vercel.app/auth/verify", {
          body: { email: buyer.email, code: code.code },
        }),
      );
      assert.equal(verified.status, 200);
      assert.equal((await verified.json()).role, "buyer");
      buyerCookie = verified.headers.get("set-cookie")!.split(";")[0];
      assert.equal(
        (await kv.getProject(c.project_reference))!.status,
        "draft",
        "Email verification must not auto-publish Studio",
      );
      const reused = await verifyAuth.POST(
        makeRequest("POST", "https://studio-test.vercel.app/auth/verify", {
          body: { email: buyer.email, code: code.code },
        }),
      );
      assert.equal(reused.status, 401);
      console.log(
        "PASS ordinary buyer one-time code sign-in, private-draft proof, wrong/reused code denial, no admin role and no automatic publication",
      );
    }
    const pub = () =>
      publish.POST(
        makeRequest("POST", "https://studio-test.vercel.app/publish", {
          cookie: cookie(buyer),
          headers,
          body: {
            base_revision: readyBody.revision,
            consent_version: consent.consent_version,
            consent_text: consent.consent_text,
          },
        }),
        ctx,
      );
    if (format === "rfi") {
      failFeed = true;
      const feedFailure = await pub();
      failFeed = false;
      assert.equal(feedFailure.status, 503);
      assert.match((await feedFailure.json()).error, /project is saved/);
      assert.equal((await kv.getProject(c.project_reference))!.status, "draft");
      failBoard = true;
      const failed = await pub();
      failBoard = false;
      assert.equal(failed.status, 409, JSON.stringify(await failed.json()));
      assert.equal((await kv.getProject(c.project_reference))!.status, "draft");
      assert.equal(
        (
          await engage.GET(
            makeRequest(
              "GET",
              "https://studio-test.vercel.app/engagement?role=supplier",
              { cookie: cookie(supplier) },
            ),
            ctx,
          )
        ).status,
        404,
      );
      console.log(
        "PASS failed board write stays unpublished and supplier access remains locked; retry follows",
      );
    }
    const result = await pub();
    const resultBody = await result.json();
    assert.equal(result.status, 200, JSON.stringify(resultBody));
    assert.equal(resultBody.ok, true);
    const alertModule = await import("../src/lib/admin-alerts");
    const publishedSnapshot = await (await import("../src/lib/published-snapshot")).getLatestPublishedSnapshot(c.project_reference);
    const alertId = alertModule.adminAlertId({kind:"project", reference:c.project_reference, revision:publishedSnapshot!.id, format:format === "rfi" ? "RFI" : "RFP"});
    const alertReceipt = store.peekJson<import("../src/lib/admin-alerts").AdminAlert>(`admin-alerts:record:${alertId}`)!;
    assert.equal(alertReceipt.status,"accepted");
    assert.equal(alertReceipt.payload!.to,"support@netify.com");
    assert.match(alertReceipt.payload!.text,new RegExp(`/admin/projects/${c.project_reference}/`));
    assert(!alertReceipt.payload!.text.includes("PRIVATE_SENTINEL"));
    assert(!alertReceipt.payload!.text.includes(c.project_session_token));
    const repeat = await pub();
    assert.equal(repeat.status, 200);
    assert.equal(
      (await repeat.json()).opportunity_id,
      resultBody.opportunity_id,
    );
    assert.equal(store.peekJson<import("../src/lib/admin-alerts").AdminAlert>(`admin-alerts:record:${alertId}`)!.attempts, 1, "Publish replay must not resend support alert");
    const snapshot = await (
      await import("../src/lib/published-snapshot")
    ).getLatestPublishedSnapshot(c.project_reference);
    assert.equal(snapshot!.frozen_content.studio_requirement!.users, "500");
    const storedBefore = await kv.getProject(c.project_reference);
    assert(storedBefore);
    await kv.saveProject({
      ...storedBefore,
      entrance_context: {
        ...storedBefore.entrance_context!,
        raw_input: {
          ...storedBefore.entrance_context!.raw_input,
          studio_users: "900",
        },
      },
    });
    const frozenRead = await engage.GET(
      makeRequest(
        "GET",
        "https://studio-test.vercel.app/engagement?role=supplier",
        { cookie: cookie(supplier) },
      ),
      ctx,
    );
    assert.equal(
      (await frozenRead.json()).requirement.users,
      "500",
      "A later record edit cannot silently alter the published supplier requirement",
    );
    const tampered = await pub();
    assert.equal(
      tampered.status,
      400,
      "Changed unreviewed content cannot be republished",
    );
    await kv.saveProject(storedBefore);
    const read = await publicRead.GET(
      makeRequest("GET", "https://studio-test.vercel.app/public"),
      { params: Promise.resolve({ id: resultBody.opportunity_id }) },
    );
    const publicBody = await read.json();
    assert(!JSON.stringify(publicBody).includes("PRIVATE_"));
    assert.equal(publicBody.sites, null);
    assert.deepEqual(publicBody.feed, []);
    const deniedSupplier = await engage.GET(
      makeRequest(
        "GET",
        "https://studio-test.vercel.app/engagement?role=supplier",
      ),
      ctx,
    );
    assert.equal(deniedSupplier.status, 401);
    const sRead = await engage.GET(
      makeRequest(
        "GET",
        "https://studio-test.vercel.app/engagement?role=supplier",
        { cookie: cookie(supplier) },
      ),
      ctx,
    );
    const sBody = await sRead.json();
    assert.equal(sRead.status, 200, JSON.stringify(sBody));
    assert.equal(sBody.requirement.requirement, draft.requirement);
    assert(!JSON.stringify(sBody).includes("PRIVATE_COMPANY"));
    assert(!JSON.stringify(sBody).includes("support@"));
    const post = (body: unknown, s = supplier) =>
      engage.POST(
        makeRequest("POST", "https://studio-test.vercel.app/engagement", {
          cookie: cookie(s),
          body,
        }),
        ctx,
      );
    const early = await post({
      action: "message",
      vendor_slug: "cisco",
      body: "Not yet allowed",
      idempotency_key: randomUUID(),
    });
    assert.equal(early.status, 403);
    const bid = await post({
      action: "request",
      reason: "We cover these regions and can propose a migration plan.",
    });
    assert.equal(bid.status, 200);
    assert.equal(
      (
        await post({
          action: "request",
          reason: "Second request must not duplicate the first.",
        })
      ).status,
      200,
    );
    const wrongOwner = await post(
      { action: "decide", vendor_slug: "cisco", decision: "approved" },
      stranger,
    );
    assert.equal(wrongOwner.status, 404);
    assert.equal(
      (
        await post(
          { action: "decide", vendor_slug: "cisco", decision: "approved" },
          buyer,
        )
      ).status,
      200,
    );
    const msg = {
      action: "message",
      vendor_slug: "cisco",
      body: "PRIVATE_PRICING Proposal £1000 with migration included.",
      idempotency_key: randomUUID(),
    };
    assert.equal((await post(msg)).status, 200);
    assert.equal((await post(msg)).status, 200);
    const buyerRead = await engage.GET(
      makeRequest("GET", "https://studio-test.vercel.app/engagement", {
        cookie: cookie(buyer),
      }),
      ctx,
    );
    const bData = await buyerRead.json();
    assert.equal(bData.requests.length, 1);
    assert.equal(bData.requests[0].messages.length, 1);
    const competitor = await engage.GET(
      makeRequest(
        "GET",
        "https://studio-test.vercel.app/engagement?role=supplier",
        { cookie: cookie(other) },
      ),
      ctx,
    );
    assert(
      !JSON.stringify(await competitor.json()).includes("PRIVATE_PRICING"),
    );
    const delegated = await post({ action: "assistant" });
    const delegatedBody = await delegated.json();
    assert(delegatedBody.token);
    const call = async (name: string, args: object) => {
      const response = await rpc.POST(
        makeRequest("POST", "https://studio-test.vercel.app/sase/api/mcp/", {
          body: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name, arguments: args },
          },
        }),
      );
      return response.json();
    };
    const mRead = await call("read_supplier_project", {
      project_id: c.project_reference,
      assistant_token: delegatedBody.token,
    });
    assert(!mRead.result?.isError, JSON.stringify(mRead));
    const mWrite = await call("message_studio_buyer", {
      project_id: c.project_reference,
      assistant_token: delegatedBody.token,
      body: "Assistant follow-up approved by supplier.",
      idempotency_key: randomUUID(),
      consent: true,
    });
    assert(!mWrite.result?.isError, JSON.stringify(mWrite));
    const noConsent = await call("message_studio_buyer", {
      project_id: c.project_reference,
      assistant_token: delegatedBody.token,
      body: "No consent",
      idempotency_key: randomUUID(),
    });
    assert(noConsent.result?.isError);
    const mismatched = await call("read_supplier_project", {
      project_id: "rfp_wrong",
      assistant_token: delegatedBody.token,
    });
    assert(mismatched.result?.isError);
    assert.equal((await post({ action: "disconnect_assistant" })).status, 200);
    const revoked = await call("read_supplier_project", {
      project_id: c.project_reference,
      assistant_token: delegatedBody.token,
    });
    assert(revoked.result?.isError);
    const evilOrigin = await engage.POST(
      makeRequest("POST", "https://studio-test.vercel.app/engagement", {
        cookie: cookie(supplier),
        headers: { origin: "https://evil.test" },
        body: {
          action: "request",
          reason: "This origin must never be accepted.",
        },
      }),
      ctx,
    );
    assert.equal(evilOrigin.status, 403);
    const unclaimed = await kv.createSession({
      role: "supplier",
      email: "x@aryaka.com",
      vendor_slug: "aryaka",
    });
    assert.equal(
      (
        await engage.GET(
          makeRequest(
            "GET",
            "https://studio-test.vercel.app/engagement?role=supplier",
            { cookie: cookie(unclaimed) },
          ),
          ctx,
        )
      ).status,
      403,
    );
    const buyerMcp = await call("read_studio_project", {
      project_id: c.project_reference,
      project_session_token: c.project_session_token,
    });
    assert(!buyerMcp.result?.isError, JSON.stringify(buyerMcp));
    assert(!JSON.stringify(buyerMcp).includes("PRIVATE_COMPANY"));
    console.log(
      "PASS",
      format,
      "real route save → prepare → publish/replay → anonymous notice → approved supplier → request/approval → private response → scoped MCP",
    );
  }
  const supplierClaimRoute =
    await import("../src/app/api/supplier/claim/route");
  const pendingSupplier = await kv.createSession({
    role: "supplier",
    email: "studio@aryaka.com",
    vendor_slug: "aryaka",
  });
  const claimRequest = await supplierClaimRoute.POST(
    makeRequest(
      "POST",
      "https://studio-test.vercel.app/sase/api/supplier/claim/",
      { cookie: cookie(pendingSupplier) },
    ),
  );
  assert.equal(claimRequest.status, 200);
  assert.equal((await claimRequest.json()).status, "pending");
  const pendingClaim = (await kv.getVendorClaim("aryaka"))!;
  const alerts = await import("../src/lib/admin-alerts");
  const supplierAlertId = alerts.adminAlertId({kind:"supplier",reference:"aryaka",requested:pendingClaim.requested});
  const supplierAlert = store.peekJson<import("../src/lib/admin-alerts").AdminAlert>(`admin-alerts:record:${supplierAlertId}`)!;
  assert.equal(supplierAlert.status,"accepted");
  assert.equal(supplierAlert.payload!.to,"support@netify.com");
  assert.match(supplierAlert.payload!.text,/#supplier-approvals/);
  assert.equal((await kv.requestVendorClaim("aryaka", "studio@aryaka.com", "aryaka.com")).requested,pendingClaim.requested);
  assert.equal(store.peekJson<import("../src/lib/admin-alerts").AdminAlert>(`admin-alerts:record:${supplierAlertId}`)!.attempts,1);
  const authRequest = await import("../src/app/api/auth/request/route");
  const authVerify = await import("../src/app/api/auth/verify/route");
  const adminRequest = await authRequest.POST(
    makeRequest(
      "POST",
      "https://studio-test.vercel.app/sase/api/auth/request/",
      {
        body: {
          email: "support@netify.com",
          role: "buyer",
          return_to: "/sase/admin/",
        },
      },
    ),
  );
  assert.equal(adminRequest.status, 200);
  const adminCode = store.peekJson<{ code: string }>(
    "auth:code:support@netify.com",
  );
  assert(adminCode);
  const adminVerified = await authVerify.POST(
    makeRequest(
      "POST",
      "https://studio-test.vercel.app/sase/api/auth/verify/",
      { body: { email: "support@netify.com", code: adminCode.code } },
    ),
  );
  assert.equal(adminVerified.status, 200);
  const adminCookie = adminVerified.headers.get("set-cookie")!.split(";")[0];
  const adminRoute = await import("../src/app/api/admin/route");
  const testMail = await adminRoute.POST(makeRequest("POST", "https://studio-test.vercel.app/sase/api/admin/", {cookie:adminCookie,body:{action:"send_test_alert"}}));
  assert.equal(testMail.status,200);assert.equal((await testMail.json()).status,"accepted");
  const forbiddenTest = await adminRoute.POST(makeRequest("POST", "https://studio-test.vercel.app/sase/api/admin/", {cookie:cookie(buyer),body:{action:"send_test_alert"}}));
  assert.equal(forbiddenTest.status,403);
  const ordinary = await adminRoute.POST(
    makeRequest("POST", "https://studio-test.vercel.app/sase/api/admin/", {
      cookie: cookie(buyer),
      body: { action: "approve_claim", slug: "aryaka" },
    }),
  );
  assert.equal(ordinary.status, 403);
  const approved = await adminRoute.POST(
    makeRequest("POST", "https://studio-test.vercel.app/sase/api/admin/", {
      cookie: adminCookie,
      body: { action: "approve_claim", slug: "aryaka" },
    }),
  );
  assert.equal(approved.status, 200, JSON.stringify(await approved.json()));
  console.log(
    "PASS supplier profile request and owner email-code approval; ordinary buyers cannot approve supplier access",
  );
  assert.equal((await adminRoute.GET(makeRequest("GET","https://studio-test.vercel.app/sase/api/admin/"))).status,401);
  assert.equal((await adminRoute.GET(makeRequest("GET","https://studio-test.vercel.app/sase/api/admin/",{cookie:cookie(buyer)}))).status,403);
  const overviewResponse=await adminRoute.GET(makeRequest("GET","https://studio-test.vercel.app/sase/api/admin/",{cookie:adminCookie}));
  assert.equal(overviewResponse.status,200);
  const overview=await overviewResponse.json();
  const adminRow=overview.rfps.find((r:{id:string})=>r.id===lastId);
  assert.equal(adminRow.responses,1,"Studio replies must appear in the admin project count");
  assert.equal(adminRow.bid_requests,1);
  assert.equal(adminRow.admin_url,`/sase/admin/projects/${lastId}/`);
  const {readAdminProject}=await import("../src/lib/admin-project");
  const {sessionFromRequest}=await import("../src/lib/auth");
  const adminSession=await sessionFromRequest(makeRequest("GET","https://studio-test.vercel.app/sase/admin/",{cookie:adminCookie}));
  const inspected=await readAdminProject(lastId,adminSession);
  assert(inspected);assert.equal(inspected.format,"RFP");
  assert.equal(inspected.requests.length,1);
  assert(inspected.requests[0].messages.some(m=>m.body.includes("PRIVATE_PRICING")));
  assert(!JSON.stringify(inspected).includes("manage_token"));
  assert(!JSON.stringify(inspected).includes("project_session_token"));
  await assert.rejects(()=>readAdminProject(lastId,null),/administrator/);
  await assert.rejects(()=>readAdminProject(lastId,buyer),/administrator/);
  assert.equal(await readAdminProject("rfp_missing",adminSession),null);
  console.log("PASS admin overview and read-only project detail: support identity sees real supplier responses; anonymous and ordinary buyers denied");

  const p = await kv.getProject(lastId);
  assert(p);
  const c = await (
    await import("../src/lib/marketplace-project-session")
  ).recoverMarketplaceSession(p);
  const ctx = { params: Promise.resolve({ projectId: lastId }) };
  const stale = await projectRoute.PATCH(
    makeRequest("PATCH", "https://studio-test.vercel.app/project", {
      headers: { authorization: `Bearer ${c.project_session_token}` },
      body: { base_revision: 99, idempotency_key: randomUUID(), raw_input: {} },
    }),
    ctx,
  );
  assert.equal(stale.status, 409);
  const mcpDraft = await projects.POST(
    makeRequest(
      "POST",
      "https://studio-test.vercel.app/sase/api/marketplace/projects/",
      {
        body: {
          mode: "quick_list",
          entrance_context: {
            version: "project-entrance/1.0.0",
            source: "rfp_builder",
            captured_at: Date.now(),
            requirement_text:
              "Initial private requirements for an estate migration.",
            raw_input: {
              studio_draft: {
                format: "rfi",
                requirement:
                  "Initial private requirements for an estate migration.",
                scope: "SD-WAN",
                sites: "",
                users: "50",
                regions: ["Europe"],
                timescale: "Not decided",
                service: "Open to advice",
                questionIds: [],
              },
            },
          },
        },
      },
    ),
  );
  const d = await mcpDraft.json();
  assert.equal(mcpDraft.status, 201);
  const { callRfpTool } = await import("../src/lib/mcp-rfp-tools");
  const status = (await callRfpTool("read_studio_project", {
    project_id: d.project_reference,
    project_session_token: d.project_session_token,
  })) as { requirement: object };
  const edit = {
    project_id: d.project_reference,
    project_session_token: d.project_session_token,
    base_revision: 0,
    idempotency_key: randomUUID(),
    studio_draft: {
      ...status.requirement,
      requirement: "Updated by the MCP assistant, with buyer approval.",
    },
    consent: true,
  };
  const updated = (await callRfpTool("save_studio_requirement", edit)) as {
    revision: number;
  };
  assert.equal(updated.revision, 1);
  assert.equal(
    (
      (await callRfpTool("save_studio_requirement", edit)) as {
        revision: number;
      }
    ).revision,
    1,
  );
  await assert.rejects(
    () =>
      callRfpTool("save_studio_requirement", {
        ...edit,
        studio_draft: {
          ...edit.studio_draft,
          requirement: "Different content with the same save reference.",
        },
      }),
    /different content/,
  );
  const tokenKey = `marketplace:project_session:${(await import("node:crypto")).createHash("sha256").update(d.project_session_token).digest("hex")}`;
  const tokenRecord = store.peekJson<Record<string, unknown>>(tokenKey)!;
  await kv.kvRaw([
    "SET",
    tokenKey,
    JSON.stringify({ ...tokenRecord, expires_at: Date.now() - 1 }),
  ]);
  await assert.rejects(
    () =>
      callRfpTool("read_studio_project", {
        project_id: d.project_reference,
        project_session_token: d.project_session_token,
      }),
    /not found/,
  );
  console.log(
    "PASS MCP edits persist in the same project; replay, content-conflict, cross-project access, revoked credentials and expired sessions are enforced",
  );
  assert.equal((await kv.listPublicOpportunities()).length, 2);
  assert.equal(
    (await kv.listConnections(lastId)).length,
    0,
    "Studio does not dispatch unsolicited invitations",
  );
  if (process.env.NETIFY_STUDIO_FIXTURE_OUT) {
    fs.writeFileSync(
      process.env.NETIFY_STUDIO_FIXTURE_OUT,
      JSON.stringify(
        {
          commands: store.fixtureCommands(),
          buyerCookie: cookie(buyer),
          supplierCookie: cookie(supplier),
          lastProject: lastId,
          credential: c,
        },
        null,
        2,
      ),
    );
  }
});
