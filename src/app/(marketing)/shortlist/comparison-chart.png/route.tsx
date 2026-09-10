import { ImageResponse } from "next/og";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import { buildShortlistMarketView, parseShortlistMarketView, SHORTLIST_VIEWS } from "@/lib/shortlist-market-views";

export async function GET(request: Request) {
  const view = parseShortlistMarketView(new URL(request.url).searchParams.get("view"));
  const live = await getLiveShortlistDataset();
  const ranked = buildShortlistMarketView(live.vendors, view).slice(0, 10);
  const maximum = Math.max(...ranked.map((provider) => provider.score), 1);
  return new ImageResponse(<div style={{ width: "1200px", height: "675px", padding: "54px", display: "flex", flexDirection: "column", background: "#0d0d0f", color: "white", fontFamily: "Arial" }}>
    <div style={{ color: "#f5a400", fontSize: 20, letterSpacing: 3, textTransform: "uppercase" }}>Netify provider research</div>
    <div style={{ fontSize: 40, fontWeight: 700, marginTop: 14 }}>{SHORTLIST_VIEWS[view].title}</div>
    <div style={{ fontSize: 18, color: "#b8b8c0", marginTop: 8 }}>Governed evidence score, reviewed 1 September 2026</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 28 }}>
      {ranked.map((provider) => <div key={provider.slug} style={{ display: "flex", alignItems: "center", fontSize: 17 }}>
        <div style={{ width: 235, display: "flex" }}>{provider.rank}. {provider.name}</div>
        <div style={{ width: 780, height: 22, display: "flex", background: "#27272a", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${Math.max(8, provider.score / maximum * 100)}%`, height: "100%", display: "flex", background: "#f5a400" }} /></div>
        <div style={{ width: 70, display: "flex", justifyContent: "flex-end" }}>{provider.score}</div>
      </div>)}
    </div>
  </div>, { width: 1200, height: 675, headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
