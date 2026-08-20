# NexusTrade MCP ecosystem distribution

## Decision

Distribute NexusTrade as a hosted remote MCP server, not as a second copy of the private monorepo server bundled into npm or PyPI.

The production endpoint already provides the simpler installation contract:

- Streamable HTTP at `https://nexustrade.io/api/mcp`
- OAuth Protected Resource Metadata discovery
- OAuth Authorization Server Metadata discovery
- PKCE and dynamic client registration
- more than 120 discoverable tools

Modern clients connect to the URL directly. Stdio-only clients use the established `mcp-remote` npm bridge through one `npx` command. Publishing a NexusTrade wrapper around that bridge would add another dependency and release surface without adding capability.

## Public repository boundary

The private NexusTrade monorepo remains private. The existing public TypeScript SDK repository is the transparent source for client code, installation documentation, and registry metadata:

- `server.json` for the official MCP Registry
- `glama.json` for Glama ownership
- client configuration examples
- representative capability and safety guidance
- a GitHub OIDC workflow for registry publication

No server source, API keys, OAuth tokens, customer data, or internal deployment details are copied here.

## Registry strategy

1. Publish `io.github.austin-starks/nexustrade-mcp` to the official MCP Registry.
2. Publish the existing remote URL to Smithery under the NexusTrade namespace.
3. Submit this public repository to Glama and directory sites that crawl GitHub metadata.
4. Submit only to curated lists that currently accept submissions and satisfy their contribution rules.
5. Treat acceptance and indexing as asynchronous. Do not promise ecosystem-wide propagation or a fixed 24–48 hour window.

## Claims boundary

Discovery copy may describe quantitative research, portfolio construction, backtesting, parameter sweeps, walk-forward studies, managed compute, creator discovery, monetized strategy subscription handoffs, editable strategy forks, continuous copy trading, paper trading, and authenticated trading operations because these capabilities exist in the live MCP tool surface.

Do not claim guaranteed returns, universal broker support, automatic execution without controls, or that a backtest proves live readiness. Live-impact tools remain subject to NexusTrade account permissions and approval controls.

Keep the marketplace actions distinct: `subscribe_portfolio` only validates the listing and returns a credential-free checkout preview, `fork_shared_portfolio` makes a one-time editable copy, and `copy_trade_shared` creates the continuous mirroring relationship. The MCP server never receives payment credentials or completes a subscription charge.

## Verification

- Unauthenticated MCP initialization must return `401` with a `WWW-Authenticate` header pointing to Protected Resource Metadata.
- Protected Resource Metadata must identify the MCP endpoint and the NexusTrade authorization server.
- Authorization Server Metadata must advertise authorization, token, dynamic registration, PKCE, and MCP scope support.
- `server.json` must validate against the pinned official schema and the current `mcp-publisher` binary before publication.
- Public repository and registry URLs must be re-read after submission; a submitted form or workflow run is not the same as an accepted listing.
