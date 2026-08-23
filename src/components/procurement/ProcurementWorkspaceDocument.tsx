"use client";

import { useRef } from "react";
import type { LivingProcurementDocument } from "@/lib/workspace/procurement-document";
import type { OutlineRow } from "@/lib/workspace/procurement-outline";
import { outlineStateLabel } from "@/lib/workspace/procurement-outline";
import ProcurementArchitecture from "./ProcurementArchitecture";
import ProcurementClauseList from "./ProcurementClauseList";
import SupplierPackView from "./SupplierPackView";
import EvaluationView from "./EvaluationView";

export type WorkspaceDocumentView = "requirement" | "architecture" | "supplier" | "evidence" | "commercial";

const VIEW_ORDER: WorkspaceDocumentView[] = ["requirement", "architecture", "supplier", "evidence", "commercial"];

const LABELS: Record<WorkspaceDocumentView, string> = {
  requirement: "Requirement",
  architecture: "Architecture",
  supplier: "Supplier pack",
  evidence: "Evidence & scoring",
  commercial: "Commercial schedule",
};

function commercialGroups(document: LivingProcurementDocument) {
  const commercial = /commercial|pricing|price|licen[cs]|contract|cost|term|exit|indexation/i;
  return document.responseGroups.filter((group) => commercial.test(group.title));
}

export default function ProcurementWorkspaceDocument({
  document,
  activeSection,
  view,
  onViewChange,
  factsKept,
  factsStruck,
  sourceTurnCount,
}: {
  document: LivingProcurementDocument;
  activeSection: OutlineRow | null;
  view: WorkspaceDocumentView;
  onViewChange: (view: WorkspaceDocumentView) => void;
  factsKept: number;
  factsStruck: number;
  sourceTurnCount: number;
}) {
  const tabRefs = useRef<Partial<Record<WorkspaceDocumentView, HTMLButtonElement | null>>>({});
  const changedClauseIds = new Set([...document.changeSet.clauses.added, ...document.changeSet.clauses.updated]);
  const changedGateIds = new Set(document.changeSet.gates.added);
  const commercial = commercialGroups(document);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: WorkspaceDocumentView) => {
    const index = VIEW_ORDER.indexOf(current);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % VIEW_ORDER.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + VIEW_ORDER.length) % VIEW_ORDER.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = VIEW_ORDER.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = VIEW_ORDER[nextIndex];
    onViewChange(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="nf-2030-document" aria-label="Living procurement document">
      <div className="nf-2030-document-tabs" role="tablist" aria-label="Procurement views">
        {VIEW_ORDER.map((item) => (
          <button
            key={item}
            ref={(node) => { tabRefs.current[item] = node; }}
            type="button"
            role="tab"
            aria-selected={view === item}
            tabIndex={view === item ? 0 : -1}
            onClick={() => onViewChange(item)}
            onKeyDown={(event) => onKeyDown(event, item)}
          >
            {LABELS[item]}
          </button>
        ))}
      </div>

      <div className="nf-2030-paper" role="tabpanel" tabIndex={0}>
        {view === "requirement" && (
          <>
            <p className="nf-2030-kicker">
              Living RFP · Draft {document.version}
            </p>
            <h2>{document.title}</h2>
            <p className="nf-2030-summary">{document.summary}</p>

            {activeSection && (
              <section className="nf-2030-active-section" aria-label={`Active area: ${activeSection.title}`}>
                <div className="nf-2030-section-heading">
                  <span>{activeSection.title}</span>
                  <strong data-state={activeSection.state}>{outlineStateLabel(activeSection.state)}</strong>
                </div>
                <p>{activeSection.detail}</p>
                {(activeSection.missing?.length ?? 0) > 0 && (
                  <p className="nf-2030-missing">Still to decide: {activeSection.missing?.join(", ")}</p>
                )}
              </section>
            )}

            <ProcurementClauseList clauses={document.clauses} changedClauseIds={changedClauseIds} />

            <div className="nf-2030-depth-note">
              <strong>One document, continuously improving</strong>
              Prompt, upload or answer directly. Each captured fact updates the same living RFP and its supplier questions.
            </div>
          </>
        )}

        {view === "architecture" && (
          <ProcurementArchitecture architecture={document.architecture} />
        )}

        {view === "supplier" && (
          <SupplierPackView groups={document.responseGroups} />
        )}

        {view === "evidence" && (
          <EvaluationView evaluation={document.evaluation} gateChangedIds={changedGateIds} />
        )}

        {view === "commercial" && (
          commercial.length > 0 ? (
            <SupplierPackView groups={commercial} />
          ) : (
            <div className="nf-2030-empty-view">
              <h3>Commercial schedule</h3>
              <p>No commercial response fields have been compiled yet. Add pricing, contract term, indexation, implementation cost or exit requirements through the prompt.</p>
            </div>
          )
        )}

        <footer className="nf-2030-document-memory">
          <span>{factsKept} standing facts{factsStruck ? ` · ${factsStruck} withdrawn` : ""}</span>
          <span>{sourceTurnCount} recorded source turns</span>
          <span>{document.provenance.buyer} from you · {document.provenance.netify} Netify suggestions · {document.provenance.sector} sector rules</span>
        </footer>
      </div>
    </section>
  );
}
