import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShortlistPage from "../page";
import { parseShortlistMarketView, SHORTLIST_VIEW_KEYS, SHORTLIST_VIEWS } from "@/lib/shortlist-market-views";
import { SITE_URL } from "@/lib/structured-data";

export function generateStaticParams() {
  return SHORTLIST_VIEW_KEYS.filter((view) => view !== "all").map((view) => ({ view }));
}

export async function generateMetadata({ params }: { params: Promise<{ view: string }> }): Promise<Metadata> {
  const view = parseShortlistMarketView((await params).view);
  const title = `${SHORTLIST_VIEWS[view].title} (2026): 30-Provider Research Dataset`;
  const description = `${SHORTLIST_VIEWS[view].answer} Compare governed evidence, build a shortlist and continue to an RFP.`;
  const canonical = `${SITE_URL}/shortlist/${view}/`;
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: "website", locale: "en_GB" } };
}

export default async function ShortlistViewPage({ params, searchParams }: { params: Promise<{ view: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawView = (await params).view;
  if (rawView === "all" || !SHORTLIST_VIEW_KEYS.includes(rawView as (typeof SHORTLIST_VIEW_KEYS)[number])) notFound();
  const view = parseShortlistMarketView(rawView);
  return ShortlistPage({ searchParams: Promise.resolve({ ...(await searchParams), view }) });
}
