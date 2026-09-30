# Assistant integration — review draft, not submitted

The web form and MCP `prepare_sourcing_plan` now invoke the same existing evidence engine. Pasted text is retained for desk assessment; no hidden language-model suitability inference is claimed. The six essentials alone do not validate technical fit.

`request_comparable_proposals` validates recipients, actions, an explicitly approved anonymous brief and consent. It sends the buyer a request-bound link; it cannot send a supplier introduction. Clicking the link reads the request; a separate confirmation queues desk review. Tokens expire after one hour and are stored as hashes. No account is created. Supplier dispatch is manual and requires an additional desk check against the approved request and acknowledged supplier terms.

`get_sourcing_request_status` requires the private request token and returns status only. The expiring-token renewal/long-term status journey still needs implementation before release. Never paste tokens into a public prompt or URL query.

All recognised MCP calls emit a server log with tool name, completion/failure, duration and environment. No brief, email, token, IP, or tool arguments are logged by this audit statement. Log retention/export remains an operational analytics gate. Tool completion is not evidence of a completed introduction.

`app/plugin.json` and `app/mcp.json` are draft submission metadata using the current portable package format. The endpoint is the intended production endpoint; the new tools are only on the preview today. Do not submit until deployed, tested, privacy/support pages reviewed, authorised brand assets and reviewer materials attached, and all tools on the shared endpoint assessed. No directory approval or listing is asserted. The existing app route is `/sase/connector/`.

Source checked 30 September 2026: https://developers.openai.com/plugins/deploy/submission . Current guidance uses a plugin manifest plus MCP configuration; `.app.json` references are not currently accepted for ZIP submission.

Review cases: open research without an account; named evidence matches with limitations; bundle two suppliers and three actions; reject missing consent, modified payload, expired token and unknown recipient; no supplier email before identity and desk review; no supplier substitution after approval; replay creates no second request/project; no confidential information in logs or Market Record. Pure-function cases are covered by `test:action-first`; full storage/mail and supplier dispatch cases remain release gates.
