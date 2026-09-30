import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const route = read("src/app/api/rfp/[id]/publish/route.ts");
const desk = read("src/components/ProjectDesk.tsx");
const publicationError = read("src/lib/publication-error.ts");
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
  desk.includes("publicationFailureMessage(data, res.status)")
    && publicationError.includes('code === "board_publication_incomplete"')
    && publicationError.includes("The opportunity board entry was not created. Nothing was published or sent."),
);
check(
  "the success state links directly to the buyer's public notice",
  desk.includes("View your public notice") && desk.includes("published.boardId"),
);
check(
  "the success state links to the discoverable Opportunity Board",
  desk.includes("Open the Opportunity Board") && desk.includes("BOARD_LINK.href"),
);
// Action-first release deliberately replaces the public notice board with the
// consented Market Record. Legacy publication and private record checks above remain.
check("public board now presents the Market Record", board.includes("Netify Market Record") && !board.includes("<BoardList"));
check("empty record does not invent completed sourcing", board.includes("No completed records have") && board.includes("been published in this release."));
check("existing private records are retained", board.includes("Records have not been deleted.") && board.includes('href="/shortlist/"'));
const recordRoute=read("src/app/(marketing)/shortlist/market-record.json/route.ts");
check("record export retains publication permission and privacy rules", recordRoute.includes("Buyer permission and redaction review required") && recordRoute.includes("Never publish private project IDs"));

if (failed) {
  console.error(`\n${failed} Step 10 validation${failed === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nALL PASS");
