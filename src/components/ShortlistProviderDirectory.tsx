"use client";

import { useEffect, useRef, useState } from "react";
import buyerProfiles from "@data/shortlist-buyer-profiles.json";
import btOverview from "@data/bt-harry-overview.json";
import SourcingActions, { type SourcingAction } from "./SourcingActions";

type Vendor = { slug: string; name: string; category: string };
type Props = {
  vendors: Vendor[];
  selected: Record<string, SourcingAction[]>;
  onChoose: (slug: string, action: SourcingAction) => void;
  onReview: () => void;
  reviewMessage: string;
};

/** Public service descriptions approved for this release. Research grades stay out of the buying interface. */
export default function ShortlistProviderDirectory({ vendors, selected, onChoose, onReview, reviewMessage }: Props) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const profileElements = useRef<Record<string, HTMLDetailsElement | null>>({});
  const profiles = vendors.flatMap(v => {
    const profile = buyerProfiles.profiles.find(p => p.slug === v.slug);
    return profile ? [{ ...profile, category: v.category }] : [];
  });
  useEffect(() => {
    const openLinkedProfile = (hash = window.location.hash) => {
      const slug = hash.startsWith("#provider-") ? hash.slice(10) : "";
      if (!vendors.some(v => v.slug === slug)) return;
      const profile = profileElements.current[slug];
      if (profile) profile.open = true;
      requestAnimationFrame(() => document.getElementById(`provider-${slug}`)?.scrollIntoView({ behavior: "auto", block: "start" }));
    };
    openLinkedProfile();
    const onHashChange = () => openLinkedProfile();
    const onLinkedProfile = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      const hash = anchor?.getAttribute("href");
      if (hash?.startsWith("#provider-")) openLinkedProfile(hash);
    };
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onLinkedProfile, true);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onLinkedProfile, true);
    };
  }, [vendors]);
  const filtered = profiles.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()) && (type === "all" || p.category.includes(type)));
  const shown = filtered;
  const selectedCount = vendors.filter(v => selected[v.slug]?.length).length;
  function inspect(slug: string) {
    const profile = profileElements.current[slug];
    if (profile) profile.open = true;
    requestAnimationFrame(() => {
      const target = document.getElementById(`provider-${slug}`);
      target?.scrollIntoView({ behavior: "auto", block: "start" });
      target?.focus({ preventScroll: true });
    });
  }
  return <section id="provider-research" className="buyer-directory" aria-labelledby="buyer-directory-title">
    <div className="buyer-section-heading"><h2 id="buyer-directory-title">Compare providers</h2><span>{profiles.length} researched providers</span></div>
    <div className="buyer-filters">
      <label>Find a provider<input type="search" placeholder="Provider name" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Provider type<select value={type} onChange={e => setType(e.target.value)}><option value="all">All provider types</option><option value="technology vendor">Technology vendors</option><option value="managed service provider">Managed service providers</option><option value="carrier">Carriers</option></select></label>
    </div>
    <p className="sourcing-small" role="status">Showing {shown.length} of {filtered.length} providers.</p>
    <div className="buyer-table-wrap"><table className="buyer-table"><caption className="sr-only">Provider products, management options and proposal selections</caption><thead><tr><th>Proposals</th><th>Provider</th><th>Products and platform</th><th>Delivery and management</th><th>Details</th></tr></thead><tbody>
      {shown.map(p => <tr key={p.slug} >
        <td><input type="checkbox" aria-label={`Include ${p.name} in proposals`} checked={(selected[p.slug] ?? []).includes("proposals")} onChange={() => onChoose(p.slug, "proposals")} /></td>
        <th scope="row"><button type="button" className="buyer-provider-name" onClick={() => inspect(p.slug)}>{p.name}</button><p>{p.role}</p></th>
        <td>{p.products.slice(0, 2).join(" · ")}</td><td>{p.management}</td>
        <td><button type="button" className="sourcing-text-button" onClick={() => inspect(p.slug)} aria-label={`View ${p.name} profile`}>View profile</button></td>
      </tr>)}
      {!shown.length && <tr><td colSpan={5}>No providers match these filters. Try another provider name or type.</td></tr>}
    </tbody></table></div>
    <p className="sourcing-small">Compare the products and the services around them.</p>
    <div className="buyer-section-heading" id="provider-profiles"><h2>Provider profiles</h2><span>Products, management, deployment and customer examples</span></div>
    <div className="buyer-profile-controls"><button type="button" className="sourcing-text-button" onClick={() => Object.values(profileElements.current).forEach(p => { if (p) p.open = true; })}>Expand all profiles</button><button type="button" className="sourcing-text-button" onClick={() => Object.values(profileElements.current).forEach(p => { if (p) p.open = false; })}>Collapse all profiles</button></div>
    {/* Native details keep every complete profile in the initial HTML and work without JavaScript. */}
    {profiles.map(p => <details key={p.slug} ref={element => { profileElements.current[p.slug] = element; }} id={`provider-${p.slug}`} className="buyer-profile" tabIndex={-1}>
      <summary className="buyer-profile-toggle"><h3>{p.name}</h3><span>{p.management}</span><span className="buyer-profile-toggle-label"><span className="buyer-expand-label">Expand profile</span><span className="buyer-collapse-label">Collapse profile</span></span></summary>
      <div className="buyer-profile-body">
      <div className="buyer-profile-heading"><div><p className="buyer-label">Provider profile</p><p className="sourcing-small">{p.role}</p></div><a href={p.profile}>Full technical profile ↗</a></div>
      {p.slug === btOverview.provider_slug ? <div className="buyer-original-overview" data-original-author="Harry Yelland"><h4>Overview by Harry Yelland</h4>{btOverview.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<p className="sourcing-small">200 words selected verbatim from Harry’s full profile.</p><a className="buyer-full-profile" href={btOverview.profile_url}>Read the full BT profile and research updates ↗</a></div> : <><div className="buyer-profile-summary"><div><h4>Products and platform</h4><p>{p.products.join(" · ")}</p></div><div><h4>Delivery and management</h4><p>{p.management}</p></div></div>
      <h4 className="buyer-subheading">Services and deployment</h4>
      <dl className="buyer-facts">{p.facts.map((fact, i) => <div key={`${fact.label}-${i}`}><dt>{fact.label}</dt><dd><p>{fact.value}</p>{fact.qualification && <p className="sourcing-small">{fact.qualification}</p>}<a href={fact.url} target="_blank" rel="noopener noreferrer">{fact.locator || "Service details"} ↗</a></dd></div>)}</dl>
      <div className="buyer-customers"><h4>Customer deployments</h4>{p.cases.length ? p.cases.map(c => <div key={c.name}><h5>{c.name}</h5>{c.outcome && <p>{c.outcome}</p>}<p className="sourcing-small">{c.qualification}</p>{c.source && <a href={c.source} target="_blank" rel="noopener noreferrer">Customer story ↗</a>}</div>) : <p>Explore the deployment references in the <a href={p.profile}>full provider research</a>.</p>}</div>
      <details><summary>Products and delivery models</summary><div className="buyer-table-wrap"><table><thead><tr><th>Product or service</th><th>Delivery model</th></tr></thead><tbody>{p.offers.map(o => <tr key={o.name}><td>{o.name}</td><td>{o.delivery}</td></tr>)}</tbody></table></div></details>
      <div className="buyer-proposal-scope"><h4>What to include in your proposal request</h4><ul><li>Name the product, security subscriptions and management services being quoted.</li><li>Assign responsibility for policy changes, monitoring, incidents and ISP escalation.</li><li>Include site coverage, contracting entity, response times and all recurring charges.</li></ul></div></>}
      <SourcingActions slug={p.slug} selected={selected[p.slug] ?? []} onChoose={onChoose} />
    </div></details>)}
    <div className="buyer-review"><p role="status">{selectedCount} provider{selectedCount === 1 ? "" : "s"} selected. Choose proposals, demos or pre-sales contacts in each profile.</p><button className="sourcing-primary" type="button" onClick={onReview}>Review selected providers and requests ({selectedCount})</button><p id="request-review-message" tabIndex={-1} role="status">{reviewMessage}</p></div>
  </section>;
}
