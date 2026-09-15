import { MarketplaceProjectConflict, MarketplaceProjectUnauthorised } from "./marketplace-project-errors";

/** Stable recovery instructions without exposing whether a private project exists. */
export function mcpExecutionError(error: unknown) {
  if (error instanceof MarketplaceProjectUnauthorised) return {
    error: "project_authentication_required",
    auth_required: true,
    retryable: false,
    message: "The project session is missing, expired or not authorised. Ask the buyer to sign in and reopen their existing project. Do not create a replacement project or retry with the same credentials.",
    sign_in_url: "https://netify.co.uk/sase/account/",
  };
  if (error instanceof MarketplaceProjectConflict) return {
    error: "project_revision_conflict",
    retryable: false,
    message: "Read the current project with get_project_status before making another change. Reconfirm the buyer's intended change against the current revision; do not blindly retry a write.",
  };
  return {
    error: "tool_execution_failed",
    retryable: false,
    message: "The tool could not complete. For an uncertain write, read back the existing project or result before retrying. Do not create a duplicate project or repeat publication.",
  };
}
