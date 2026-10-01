import {getLiveShortlistDataset} from "@/lib/live-shortlist";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShortlistPage from "../page";
import { shortlistViewMetadata, parseShortlistMarketView, SHORTLIST_VIEW_KEYS, SHORTLIST_VIEWS } from "@/lib/shortlist-market-views";
import { SITE_URL } from "@/lib/structured-data";

export function generateStaticParams() {
  return SHORTLIST_VIEW_KEYS.filter((view) => view !== "all").map((view) => ({ view }));
}

export async function generateMetadata({ params }: { params: Promise<{ view: string }> }): Promise<Metadata> {
  const raw=(await params).view;
  if(raw==="all" || !SHORTLIST_VIEW_KEYS.includes(raw as typeof SHORTLIST_VIEW_KEYS[number])) notFound();
  const view = parseShortlistMarketView(raw);
  const {title,description}=shortlistViewMetadata((await getLiveShortlistDataset()).vendors,view);
  const canonical = `${SITE_URL}/shortlist/${view}/`;
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: "website", locale: "en_GB" } };
}

export default async function ShortlistViewPage({ params, searchParams }: { params: Promise<{ view: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawView = (await params).view;
  if (rawView === "all" || !SHORTLIST_VIEW_KEYS.includes(rawView as (typeof SHORTLIST_VIEW_KEYS)[number])) notFound();
  const view = parseShortlistMarketView(rawView);
  return ShortlistPage({ searchParams: Promise.resolve({ ...(await searchParams), view }) });
}
