/**
 * The mentions dataset (final architecture §4.1, implemented 23 Jul 2026):
 * one declaration joins Research to Suppliers, and every edge on both
 * surfaces derives from it. The dataset's own law: a mention exists only
 * when the article's title names the supplier or an editor declared it
 * after reading the piece; nothing is inferred from unseen body text.
 *
 * Consumers today: the supplier profile's "Research covering" block and
 * the llms.txt research map. The insights side (article → profile cards)
 * renders from the same file when the main site adopts it.
 */
import mentionsData from "@data/research-mentions.json";

export type ResearchMention = {
  url: string;
  title: string;
  suppliers: string[];
  source: "title" | "editorial";
};

const ALL: ResearchMention[] = (
  mentionsData as { mentions: ResearchMention[] }
).mentions;

/** Every research piece declaring the supplier, newest declaration first
 *  (file order is curated; no fabricated dates). */
export function getMentionsFor(slug: string): ResearchMention[] {
  return ALL.filter((m) => m.suppliers.includes(slug));
}

/** The full map for machine surfaces (llms.txt). */
export function getAllMentions(): ResearchMention[] {
  return ALL.slice();
}
