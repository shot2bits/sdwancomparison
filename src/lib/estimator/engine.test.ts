import assert from "node:assert";
import { estimate, EstimateInputT } from "./engine";

const base: EstimateInputT = {
  users: 1000,
  sites: 20,
  regions: ["uk-europe", "north-america"],
  securityDepth: "full-sase",
  deliveryModel: "co-managed",
  termYears: 3,
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}

const gbp = (n: number) => "£" + n.toLocaleString("en-GB");

test("deterministic: identical input, identical output", () => {
  assert.deepStrictEqual(estimate(base), estimate(base));
});

test("every band is low <= high and non-negative", () => {
  const r = estimate(base);
  const all = [r.monthlyBandGBP, r.threeYearTcoBandGBP, r.oneOffImplementationBandGBP, ...Object.values(r.byDriver)];
  for (const [lo, hi] of all) {
    assert.ok(lo >= 0 && hi >= lo, `band violated: [${lo}, ${hi}]`);
  }
});

test("driver bands sum to the monthly band (attribution is complete)", () => {
  const r = estimate(base);
  const sumLo = Object.values(r.byDriver).reduce((s, b) => s + b[0], 0);
  const sumHi = Object.values(r.byDriver).reduce((s, b) => s + b[1], 0);
  // rounding tolerance: 7 drivers x nearest-50 rounding
  assert.ok(Math.abs(sumLo - r.monthlyBandGBP[0]) <= 400, `low ${sumLo} vs ${r.monthlyBandGBP[0]}`);
  assert.ok(Math.abs(sumHi - r.monthlyBandGBP[1]) <= 400, `high ${sumHi} vs ${r.monthlyBandGBP[1]}`);
});

test("monotonic in users", () => {
  const a = estimate(base);
  const b = estimate({ ...base, users: 5000 });
  assert.ok(b.monthlyBandGBP[0] > a.monthlyBandGBP[0]);
});

test("monotonic in security depth", () => {
  const sse = estimate({ ...base, securityDepth: "sse-only" });
  const adv = estimate({ ...base, securityDepth: "full-sase-plus-advanced" });
  assert.ok(adv.monthlyBandGBP[0] > sse.monthlyBandGBP[0]);
  assert.ok(adv.monthlyBandGBP[1] > sse.monthlyBandGBP[1]);
});

test("delivery ordering on external spend: managed >= co-managed >= diy", () => {
  const m = estimate({ ...base, deliveryModel: "managed" });
  const c = estimate({ ...base, deliveryModel: "co-managed" });
  const d = estimate({ ...base, deliveryModel: "diy" });
  assert.ok(m.monthlyBandGBP[1] >= c.monthlyBandGBP[1] && c.monthlyBandGBP[1] >= d.monthlyBandGBP[1]);
});

test("diy result carries the internal-staffing note", () => {
  const d = estimate({ ...base, deliveryModel: "diy" });
  assert.ok(d.notes.some((n) => n.toLowerCase().includes("internal staffing")));
});

test("longer term never costs more per month", () => {
  const y1 = estimate({ ...base, termYears: 1 });
  const y5 = estimate({ ...base, termYears: 5 });
  assert.ok(y5.monthlyBandGBP[0] <= y1.monthlyBandGBP[0]);
});

test("region loading increases cost but is capped", () => {
  const one = estimate({ ...base, regions: ["uk-europe"] });
  const five = estimate({ ...base, regions: ["uk-europe", "north-america", "apac", "middle-east-africa", "latam"] });
  assert.ok(five.monthlyBandGBP[0] > one.monthlyBandGBP[0]);
  assert.ok(five.monthlyBandGBP[1] < one.monthlyBandGBP[1] * 1.3, "cap keeps loading sane");
});

test("band width stays honest but useful (high/low ratio between 1.5 and 5)", () => {
  for (const input of [base, { ...base, users: 15000, sites: 300 }, { ...base, users: 60, sites: 2, deliveryModel: "diy" as const }]) {
    const r = estimate(input);
    const ratio = r.monthlyBandGBP[1] / r.monthlyBandGBP[0];
    assert.ok(ratio > 1.5 && ratio < 5, `ratio ${ratio.toFixed(2)} out of range for ${JSON.stringify(input)}`);
  }
});

test("TCO is coherent with monthly scale", () => {
  const r = estimate(base);
  assert.ok(r.threeYearTcoBandGBP[0] > r.monthlyBandGBP[0] * 24);
  assert.ok(r.threeYearTcoBandGBP[1] < r.monthlyBandGBP[1] * 48);
});

test("rejects invalid input", () => {
  assert.throws(() => estimate({ ...base, users: 10 }));
  assert.throws(() => estimate({ ...base, regions: [] }));
  assert.throws(() => estimate({ ...base, regions: ["uk-europe", "uk-europe"] }));
  assert.throws(() => estimate({ ...base, termYears: 2 }));
  assert.throws(() => estimate({ ...base, deliveryModel: "outsourced" }));
});

console.log(`\nAll ${passed} tests passed.\n`);

// --- Persona snapshots for Robert and Harry to sanity-check the calibration ---
const personas: Array<[string, EstimateInputT]> = [
  ["Sarah: 2,500 users, 40 sites, UK+NA+APAC, full SASE, managed, 3yr", { users: 2500, sites: 40, regions: ["uk-europe", "north-america", "apac"], securityDepth: "full-sase", deliveryModel: "managed", termYears: 3 }],
  ["Mid-market: 600 users, 8 sites, UK, SSE-only, co-managed, 3yr", { users: 600, sites: 8, regions: ["uk-europe"], securityDepth: "sse-only", deliveryModel: "co-managed", termYears: 3 }],
  ["Large global: 30,000 users, 400 sites, 4 regions, advanced, managed, 5yr", { users: 30000, sites: 400, regions: ["uk-europe", "north-america", "apac", "middle-east-africa"], securityDepth: "full-sase-plus-advanced", deliveryModel: "managed", termYears: 5 }],
  ["DIY engineering-led: 1,200 users, 15 sites, UK+NA, full SASE, DIY, 1yr", { users: 1200, sites: 15, regions: ["uk-europe", "north-america"], securityDepth: "full-sase", deliveryModel: "diy", termYears: 1 }],
];
console.log("CALIBRATION SNAPSHOTS (for human review, not publication):");
for (const [label, input] of personas) {
  const r = estimate(input);
  console.log(`\n${label}`);
  console.log(`  monthly ${gbp(r.monthlyBandGBP[0])} to ${gbp(r.monthlyBandGBP[1])} | 3yr TCO ${gbp(r.threeYearTcoBandGBP[0])} to ${gbp(r.threeYearTcoBandGBP[1])}`);
  const top = Object.entries(r.byDriver).sort((a, b) => b[1][1] - a[1][1]).slice(0, 3)
    .map(([k, v]) => `${k} ${gbp(v[0])}-${gbp(v[1])}`).join(" | ");
  console.log(`  top drivers: ${top}`);
}
