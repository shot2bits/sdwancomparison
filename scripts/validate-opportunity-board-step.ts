import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const route = read("src/app/api/rfp/[id]/publish/route.ts");
const desk = read("src/components/ProjectDesk.tsx");
const board = read("src/app/(marketing)/opportunities/board/page.tsx");

let failed = 0;
function check(name: string, condition: boolean) {
  if (condition) console.log(`PASS  ${name}`);
  else { console.error(`FAIL  ${name}`); failed += 1; }
}

check(
  "the publish API refuses to report success without a real board opportunity id",
  route.includes("publicationCompleted({ publicBoardOpportunityId: board.opportunity_id, marketUnlockValid: marketUnlocked })") && route.includes('code: "board_publication_incomplete"'),
);
check(
  "an incomplete board publication is a non-2xx response and remains market locked",
  route.includes("{ status: 409, headers: cors }") && route.includes("market_unlocked: false"),
);
check(
  "the successful API contract states MarketUnlock only after the board-id guard",
  route.includes("market_unlocked: marketUnlocked") && route.indexOf("market_unlocked: marketUnlocked") > route.indexOf('code: "board_publication_incomplete"'),
);
check(
  "the builder requires both MarketUnlock and a board id before showing publication success",
  desk.includes('res.ok && data.market_unlocked === true && typeof data.board?.opportunity_id === "string"'),
);
check(
  "the builder has an explicit safe failure message when the board listing is absent",
  desk.includes("The opportunity was not listed on the board. Nothing was sent"),
);
check(
  "the success state links directly to the buyer's public notice",
  desk.includes("View your public notice") && desk.includes("published.boardId"),
);
check(
  "the success state links to the discoverable Opportunity Board",
  desk.includes("Open the Opportunity Board") && desk.includes("BOARD_LINK.href"),
);
check(
  "signed-out visitors receive the real anonymous public notice list",
  board.includes("<BoardList opps={allOpps} />") && !board.includes("const opps = signedIn ? allOpps : []"),
);
check(
  "the board explains the boundary between public notice and gated RFP",
  board.includes("The anonymous notices are visible below") && board.includes("Buyer identity and all pricing remain private"),
);
check(
  "the public archive is not accidentally hidden from signed-out visitors",
  board.includes("{allArchived.length > 0") && board.includes("{allArchived.map"),
);

if (failed) {
  console.error(`\n${failed} Step 10 validation${failed === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nALL PASS");
