/**
 * The instrument ladder (the consolidation, wave one; Robert's "get it
 * done", 23 Jul 2026 evening). One desk, three instruments: the buyer
 * never chooses a document type at the door; the position's own state
 * derives what it holds and what each formality still needs.
 *
 * THE LAW, EXECUTABLE: no derivation, no rendering. A desk with no
 * started position derives null and the rail simply does not exist.
 * Every note is a statement of fact about THIS position, never a promise
 * about the platform's roadmap.
 *
 * Wave one derives honestly small: the SoR is the earnable instrument
 * (it is what the desk builds and what publishing issues today); the RFI
 * and full RFP stand as named horizons carrying what they genuinely
 * need. Wave two (scoring priorities, the question bank folding into
 * earned depth) makes them earnable; their notes then gain states the
 * same way the RFI's open-questions flip works below.
 */

export interface InstrumentLadder {
  /** The living document the desk builds. Live by definition once derived. */
  sor: { state: "live" };
  /** Structured questions to the market. Flips its note once the
   *  position's own open questions have been answered. */
  rfi: { state: "horizon" | "questions_landed"; note: string };
  /** The formal document with weights and commercials. A horizon until
   *  scoring exists on the position (wave two). */
  rfp: { state: "horizon"; note: string };
}

export function deriveInstrumentLadder(src: {
  started: boolean;
  claims: number;
  openQuestions: number;
}): InstrumentLadder | null {
  if (!src.started || src.claims <= 0) return null;
  return {
    sor: { state: "live" },
    rfi:
      src.openQuestions === 0
        ? { state: "questions_landed", note: "your open questions have landed" }
        : { state: "horizon", note: "ready when your open questions land" },
    rfp: { state: "horizon", note: "needs scoring priorities and commercials" },
  };
}
