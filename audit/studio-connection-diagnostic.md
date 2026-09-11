# Studio Lyriks connection diagnostic — 2026-09-10

The Vector Rally code/design review is preserved in [design-code-reference.md](design-code-reference.md) and [design-code-inventory.json](design-code-inventory.json). Remote reconciliation is still outstanding.

## Observed failure

- Configured server: `studio-lyriks`, `https://studio.lyriks.io/mcp`.
- VS Code and the current extension's CLI both report OAuth credentials for this server.
- MCP initialization nevertheless fails with `Auth required`.
- After VS Code reload, the Codex transport logs at 2026-09-10 10:18:35 and 10:18:55 UTC report: `Token refresh not possible, re-authorization required. error=OAuth authorization required`.
- This establishes that the attempted connection could not renew its authorization. It does not identify the underlying reason (expiry, revocation, missing refresh support or another server/client issue). The displayed OAuth status alone is not a successful connection test.

## Recovery initiated

Used the current extension's bundled executable, version `codex-cli 0.153.4`:

```powershell
& 'C:\Users\adrie\.vscode\extensions\openai.chatgpt-26.903.71938-win32-x64\bin\windows-x86_64\codex.exe' mcp login studio-lyriks
```

The command started an OAuth authorization flow and waits for the user's browser consent. No stored credentials were read, printed or manually deleted. The transient authorization URL is intentionally not stored here. If it expires, rerun the login command to create a new flow.

After successful browser consent, verify MCP initialization and tool availability, then resume the saved Vector Rally reconciliation. A successful login or an OAuth label is not proof that the current conversation can call the tools.

## Authorization attempt and public endpoint checks

The user reports `cross-origin request blocked` after clicking the authorization button and confirms the failing page is `https://studio.lyriks.io/mcp/oauth/authorize`. The refusal therefore happens at Studio before a successful callback to Codex. The login command subsequently timed out waiting for that callback; its old authorization link should not be reused.

Public metadata at `https://studio.lyriks.io/.well-known/oauth-authorization-server` returns HTTP 200 and lists `grant_types_supported: ["authorization_code"]`; it does not advertise a refresh-token grant. This is consistent with the observed inability to renew credentials, but does not by itself prove why the previous credential became unusable.

The registered authorization link reaches a login form for an unauthenticated HTTP client. A diagnostic empty POST to `/mcp/oauth/authorize`, with Origin `https://studio.lyriks.io` and no client/consent data, returns HTTP 403 `invalid consent`, not the reported cross-origin message. No authorization was granted by that probe. Therefore a general rejection of all same-origin requests at that endpoint has not been reproduced; do not disable CSRF/CORS protection or claim a confirmed proxy-origin misconfiguration.

Additional no-client POST probes with same-origin Referer and Sec-Fetch-Site headers also returned `invalid consent`. Those probes do not exercise authenticated, valid consent and cannot establish that its origin check works. The currently available local copies of `front/lyriks-app` and `unspaghettit` do not contain this deployed OAuth route. The deployed source location has been requested to trace the actual origin comparison before proposing a fix. No CSRF protection, stored credential or deployed code has been changed.

## Clean logout/login reproduction

At the user's explicit request, `codex mcp logout studio-lyriks` successfully removed its OAuth credentials. A new `mcp login studio-lyriks` created a fresh authorization flow. The user supplied a screenshot of Studio's `Connect Codex?` consent page, with `Allow access`, `Cancel` and the new localhost callback, and reports the same `cross-origin request blocked` after allowing access. This reproduces the failure after a clean OAuth login attempt; repeatedly reloading VS Code is not a demonstrated remedy.

The next source-level check is the Origin comparison on the authenticated consent POST and the public URL reconstructed behind the deployment proxy. If the deployed server uses SvelteKit adapter-node, verify its effective `ORIGIN` (normally `https://studio.lyriks.io`) or trusted proxy protocol/host configuration. SvelteKit documents incorrect deployment-origin reconstruction as a cause of rejected form submissions: https://svelte.dev/docs/kit/adapter-node#Environment-variables-ORIGIN-PROTOCOL_HEADER-HOST_HEADER-and-PORT_HEADER . This is a diagnostic hypothesis, not a verified root cause or permission to disable CSRF checking.

Official CLI login documentation: https://developers.openai.com/codex/mcp/

## After the Studio update

The user reports having updated Studio. A fresh `mcp login studio-lyriks` successfully registered a client and produced an authorization link. Clicking `Allow access` now returns `invalid consent`; the Codex process remains waiting for the callback at the time of the check. This does not establish which consent validation failed or prove that every origin issue has been fixed.

Re-reading the public OAuth metadata now returns `grant_types_supported: ["authorization_code", "refresh_token"]`, confirming that updated metadata is deployed. The next required evidence is the deployed POST handler for `/mcp/oauth/authorize`, its consent-form generation and the corresponding server log for the rejection. Inspect the exact branch returning `invalid consent` before changing cookie, token, signature, expiration or origin handling. No further blind logout/login loop is justified by the current evidence.

## Separate historical observation

Earlier logs also report that the `wire_element` tool schema could not be exposed (`invalid type: map, expected a string`). That is distinct from the current authentication failure. Recheck available tool schemas after restoring access; do not infer that every Lyriks tool is unusable from this historical warning.


## Resolved connection — 2026-09-10

A fresh Codex MCP authorization completed successfully. The CLI reported successful login and authenticated Studio reads and writes then succeeded throughout the Vector Rally reconciliation. The exact cause of the earlier consent/origin failures was not established.

The local Codex callback displays “Authentication complete. You may close this window.” Claude owns and renders its separate local callback page; updating Studio does not customize Codex’s callback. No callback authorization code or state is reproduced here. The remaining project blockers concern Experience rendering/projection and historical traceability, not authentication. See [the reconciliation report](design-code-reconciliation.md).
