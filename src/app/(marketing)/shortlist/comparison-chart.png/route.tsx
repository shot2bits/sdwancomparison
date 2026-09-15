import { ImageResponse } from "next/og";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import { buildShortlistMarketView, parseShortlistMarketView, SHORTLIST_VIEWS } from "@/lib/shortlist-market-views";

export async function GET(request: Request) {
  const view = parseShortlistMarketView(new URL(request.url).searchParams.get("view"));
  const live = await getLiveShortlistDataset();
  const ranked = buildShortlistMarketView(live.vendors, view).slice(0, 10);
  return new ImageResponse(<div style={{ width: "1200px", height: "675px", padding: "54px", display: "flex", flexDirection: "column", background: "#0d0d0f", color: "white", fontFamily: "Arial" }}>
    <div style={{ color: "#f5a400", fontSize: 20, letterSpacing: 3, textTransform: "uppercase" }}>Netify provider research</div>
    <div style={{ fontSize: 40, fontWeight: 700, marginTop: 14 }}>{SHORTLIST_VIEWS[view].title}</div>
    <div style={{ fontSize: 18, color: "#b8b8c0", marginTop: 8 }}>Alphabetical evidence directory; computed fit unlocks after publication</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 28 }}>
      {ranked.map((provider) => <div key={provider.slug} style={{ display: "flex", alignItems: "center", fontSize: 17 }}>
        <div style={{ width: 235, display: "flex" }}>{provider.name}</div>
        <div style={{ display: "flex", fontSize: 15 }}>{provider.category}</div>
      </div>)}
    </div>
  </div>, { width: 1200, height: 675, headers: { "cache-control": "no-store" } });
}
