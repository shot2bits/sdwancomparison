"use client";
import { useEffect, useState, useCallback } from "react";
import MarketOutcomeWorkflow from "./MarketOutcomeWorkflow";
import RfpBuilder from "./RfpBuilder";
import CircuitPricing from "./procurement/CircuitPricing";
import BidComparison from "./BidComparison";
import type { FeedItem } from "./OpportunityFeed";
import type { BidReview } from "@/lib/agent-types";
import "./procurement/circuit-pricing.css";
export default function SourcingProjectJourney({ id }: { id: string }) {
  const [connectivityOpened, setConnectivityOpened] = useState(false);
  const [view, setView] = useState("rfp"),
    [data, setData] = useState<{
      feed: FeedItem[];
      previous_feed: FeedItem[];
      reviews: BidReview[];
    } | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(`/sase/api/sourcing/projects/${id}/`, {
      cache: "no-store",
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }, [id]);
  async function refresh() {
    try {
      setData(await load());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open the project.");
    }
  }
  useEffect(() => {
    let active = true;
    load()
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Unable to open the project.",
          );
      });
    return () => {
      active = false;
    };
  }, [load]);
  if (!data)
    return (
      <div>
        <p>{error || "Opening your private sourcing project…"}</p>
        {error && <button onClick={() => void refresh()}>Retry</button>}
      </div>
    );
  return (
    <div>
      <p>
        One private project: {id}. No public listing is required for desk
        review.
      </p>
      <nav aria-label="Sourcing project">
        <button onClick={() => setView("rfp")} aria-pressed={view === "rfp"}>
          Requirements and RFP
        </button>
        {" · "}
        <button
          onClick={() => {
            setConnectivityOpened(true);
            setView("connectivity");
          }}
          aria-pressed={view === "connectivity"}
        >
          Connectivity pricing
        </button>
        {" · "}
        <button
          onClick={() => {
            setView("proposals");
            void refresh();
          }}
          aria-pressed={view === "proposals"}
        >
          Written proposals
        </button>
        {" · "}<button onClick={() => setView("outcome")} aria-pressed={view === "outcome"}>Anonymous outcome (optional)</button>
      </nav>
      {view === "outcome" && <MarketOutcomeWorkflow key={id} id={id}/>}
      {error && <p role="alert">{error}</p>}
      <div hidden={view !== "rfp"}>
        <p>
          <a href={`/sase/api/sourcing/projects/${id}/document/?format=doc`}>
            Download private RFP draft (Word)
          </a>
          {" · "}
          <a href={`/sase/api/sourcing/projects/${id}/document/`}>
            Download Markdown
          </a>
        </p>
        <p>
          Use this editor for your requirements. Your brief, connectivity pricing
          and written proposals stay together in this private project.
        </p>
        <RfpBuilder initialId={id} privateSourcing />
      </div>
      {connectivityOpened && (
        <div hidden={view !== "connectivity"}>
          <CircuitPricing projectId={id} />
        </div>
      )}{" "}
      {view === "proposals" && (
        <section>
          <h2>Written proposals on this project</h2>
          <button onClick={() => void refresh()}>Refresh responses</button>
          <BidComparison feed={data.feed} />
          {!!data.previous_feed?.length&&<details><summary>{data.previous_feed.length} earlier or unbound proposals — excluded from the current comparison</summary><p>Requirements changed or the original scope was not recorded. Ask the supplier to reconfirm before relying on these prices.</p><BidComparison feed={data.previous_feed}/></details>}
          {data.reviews.map((r) => (
            <article key={r.id}>
              <h3>{r.vendor}: evidence review</h3>
              <p>{r.goal_fit_note}</p>
              <ul>
                {r.evidence_checks.map((c) => (
                  <li key={c.key}>
                    {c.label}: {c.detail}
                  </li>
                ))}
              </ul>
              <p>{r.llm_quality_summary}</p>
            </article>
          ))}
          <p>
            Connectivity offers remain itemised by location in Connectivity
            pricing. They are not silently added to overlay prices.
          </p>
        </section>
      )}
    </div>
  );
}
