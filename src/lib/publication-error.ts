type PublicationFailure = {
  error?: unknown;
  code?: unknown;
  message?: unknown;
  auth_required?: unknown;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

/**
 * One buyer-facing interpretation of publication refusals. The server
 * remains authoritative; this only prevents distinct, actionable refusals
 * from being collapsed into one generic client message.
 */
export function publicationFailureMessage(raw: unknown, status?: number): string {
  const failure = raw && typeof raw === "object" ? raw as PublicationFailure : {};
  const error = text(failure.error);
  const message = text(failure.message);
  const code = text(failure.code);
  const combined = `${code} ${error} ${message}`.toLowerCase();

  if (failure.auth_required === true || error === "sign_in_required" || status === 401) {
    return message || "Sign in with a verified work email, then publish again. Your draft is unchanged.";
  }
  if (combined.includes("personal address") || combined.includes("work email") || combined.includes("business email")) {
    return message || error || "Publishing requires a verified work email. Your draft is unchanged.";
  }
  if (combined.includes("owner") || combined.includes("ownership") || status === 403) {
    return message || error || "This signed-in account does not own the project. Reopen the original draft link and try again.";
  }
  if (combined.includes("consent") || combined.includes("acknowledg")) {
    return message || error || "Accept both publication acknowledgements before publishing.";
  }
  if (combined.includes("meaningful") || combined.includes("baseline") || combined.includes("still needed")) {
    return message || error || "Complete the seven essential project sections before publishing.";
  }
  if (code === "board_publication_incomplete" || combined.includes("board listing") || combined.includes("listed on the board")) {
    return message || error || "The opportunity board entry was not created. Nothing was published or sent. Review the RFP and try again.";
  }
  if (combined.includes("market-unlock") || combined.includes("marketunlock")) {
    return "Publication could not be verified, so supplier access remains locked. Nothing was sent. Try again.";
  }
  if (combined.includes("storage") || status === 503) {
    return message || error || "The project store is temporarily unavailable. Nothing was published or sent. Try again shortly.";
  }
  return message || error || "Publication did not complete. Nothing was published or sent. Review the RFP and try again.";
}
