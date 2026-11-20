# Marketplace OAuth authorisation server

The SASE marketplace owns a single OAuth 2.1 authorisation server for assistant access. Assistants add the MCP server by URL at `https://netify.co.uk/sase/api/mcp/`. Protected-resource metadata, authorisation-server metadata and the authorise, token, register and revoke endpoints are all served under `https://netify.co.uk/sase/`.

## Issuer and endpoints

- Issuer: `https://netify.co.uk/sase`
- Authorisation: `https://netify.co.uk/sase/oauth/authorize/`
- Token: `https://netify.co.uk/sase/oauth/token/`
- Dynamic client registration: `https://netify.co.uk/sase/oauth/register/`
- Revocation: `https://netify.co.uk/sase/oauth/revoke/`
- The earlier `/sase/api/context-preview/core/oauth/` paths still work and use the same handlers.

Tokens are bound to a resource (audience). A token issued for the marketplace MCP will not be accepted by another resource, and the other way around.

## Discovery that this app can serve

These work today, with the `/sase` base path:

- `https://netify.co.uk/sase/.well-known/oauth-authorization-server/`
- `https://netify.co.uk/sase/.well-known/oauth-protected-resource/`
- `https://netify.co.uk/sase/.well-known/oauth-protected-resource/api/mcp/`
- `https://netify.co.uk/sase/api/mcp/.well-known/oauth-protected-resource` (RFC 9728, at the resource URL, so a client that adds the MCP by URL can find the metadata without waiting for a 401)
- `https://netify.co.uk/sase/.well-known/mcp.json` and `/sase/.well-known/mcp/server-card.json` (server card)

A 401 from a private tool includes `WWW-Authenticate` pointing at the protected-resource metadata.

## What needs the main site

RFC 8414 and RFC 9728 also put discovery on the site root when the issuer or resource has a path. Those URLs are owned by the main site, not this app, and must not be added here:

- `https://netify.co.uk/.well-known/oauth-authorization-server/sase`
- `https://netify.co.uk/.well-known/oauth-protected-resource/sase/api/mcp/`
- `https://netify.co.uk/.well-known/oauth-authorization-server` (only if the issuer were the apex, which it is not)
- `https://netify.co.uk/.well-known/mcp.json`

The clean follow-up on the main site is a rewrite of the first two paths to the matching `/sase/.well-known/...` documents. Until that exists, clients should use the `/sase/` URLs above, or the `WWW-Authenticate` hint.

## Client identification

Dynamic client registration (OAuth 2.0 DCR) remains available at the register endpoint, with PKCE (`S256`) and `token_endpoint_auth_method=none`.

The server also advertises Client ID Metadata Documents (`client_id_metadata_document_supported: true`). A client may use its HTTPS metadata URL as `client_id`. The server fetches that document over HTTPS, with no redirects, a 3 second timeout, a 64KB size limit, and blocks private, loopback and link-local hosts. The document must list HTTPS `redirect_uris` and a `client_name`. If it includes `client_id`, it must match the URL used.

## How the main-site MCP can reuse this issuer

The main site serves a separate MCP endpoint at `https://netify.co.uk/api/mcp/` (the 86-tool server). It should not stand up a second authorisation server.

To reuse this one, later:

1. Keep this issuer (`https://netify.co.uk/sase`) as the only authorisation server.
2. On the main site, serve protected-resource metadata for `https://netify.co.uk/api/mcp/` with `authorization_servers: ["https://netify.co.uk/sase"]` and the scopes that main-site write tools need.
3. When an assistant authorises, it sends `resource=https://netify.co.uk/api/mcp/`. This server already accepts that resource and binds the token to it. A token issued for the main-site MCP is rejected by the marketplace MCP, which only accepts `https://netify.co.uk/sase/api/mcp/`.
4. The main site validates `netify_agent_` tokens itself, checking the same store and requiring `token.resource === "https://netify.co.uk/api/mcp/"`, plus the scopes it needs. Do not accept a marketplace resource token on the main-site MCP.
5. If the main site needs scopes beyond `project:read` and `project:write`, add them here first so both catalogues stay in one place.
6. Add the apex discovery rewrites listed above, including a rewrite for `https://netify.co.uk/.well-known/oauth-protected-resource/api/mcp/`, so clients that follow RFC 9728 from the main-site resource URL can find the metadata.

Consent stays with a verified owner in the web view. Supplier approval and sending remain outside the assistant token, on both servers.
