# NexusTrade TypeScript SDK

Typed portfolio authoring, backtesting, and optimization for
[NexusTrade](https://nexustrade.io).

```bash
npm install nexustrade-sdk
```

Zero runtime dependencies. ESM and CommonJS builds ship together.

## Quickstart

```ts
import {
  NexusTradeClient,
  always,
  backtest,
  buy,
  portfolio,
  stockAsset,
  strategy,
} from "nexustrade-sdk";

const nt = new NexusTradeClient({
  apiKey: "sk-...",
  baseUrl: "https://nexustrade.io/api/v1",
});

const book = portfolio("Example", [
  strategy("Buy SPY", always(), buy(stockAsset("SPY"), 100)),
]);

const saved = await nt.createPortfolio(book, {
  idempotencyKey: "example-v1",
});

const operation = await nt.createBacktest(
  backtest(book, { startDate: "2024-01-01", endDate: "2024-12-31" }),
  { idempotencyKey: "example-backtest-v1" },
);
const result = await nt.getBacktest(operation.id as string);
```

## Jobs are asynchronous — you poll

Backtests, optimizations, and walk-forward studies run on the NexusTrade
engine, not in your process. `create*` enqueues the job and resolves
immediately; it does **not** wait for results. There are no webhooks today, so
you poll `get*` until the operation reaches a terminal state.

Both calls return the same operation envelope:

```ts
{
  id: "op_...",
  kind: "backtest",            // backtest | optimization | walk_forward
  status: "queued",            // queued | running | completed | failed | cancelled
  result?: {...},              // present only once terminal
  error?: { code, message, retryable },
}
```

`result` is absent while the job is `queued` or `running`. The client polls for
you, on a deterministic backoff, until the operation is terminal:

```ts
const finished = await nt.waitForBacktest(operation.id as string);
console.log(finished.result);
```

`waitForBacktest`, `waitForOptimization`, and `waitForWalkForward` all take the
same options:

| Option | Default | Meaning |
| --- | --- | --- |
| `timeoutSeconds` | `900` | Give up waiting (the job keeps running) |
| `pollIntervalSeconds` | `2` | First interval; backs off 1.5x |
| `maxPollIntervalSeconds` | `15` | Interval ceiling |
| `raiseOnFailure` | `true` | Reject on `failed`/`cancelled` instead of resolving |

A failed operation rejects with `NexusTradeApiError` carrying the API's own
error code; a timeout rejects with `operation_timeout` and does **not** cancel
the job — call the waiter again with the same id rather than resubmitting. Pass
`raiseOnFailure: false` to inspect the terminal envelope yourself.

For a batch, `waitForBacktests(operations)` waits on each in submission order.
And `waitForOperation(fetch, id)` is the same poller exposed directly, for any
operation kind.

`createBacktests` submits a batch in one call and returns one operation per
backtest — poll each `id` independently. Prefer it over a loop of
`createBacktest` when you have several: one request, one idempotency key, one
rate-limit slot.

**Idempotency keys make retries free.** If a `create*` call fails at the
transport layer, retrying with the *same* key returns the original operation
rather than launching a second paid job.

## What the client covers

| Method | Purpose |
| --- | --- |
| `createPortfolio` | Persist an authored portfolio |
| `createBacktest` / `createBacktests` | Submit one or many backtests |
| `getBacktest` | Read a backtest operation |
| `createOptimization` / `getOptimization` | Submit and read an optimization |
| `createWalkForward` / `getWalkForward` | Submit and read a walk-forward study |

Every builder is generated from the same indicator specification the NexusTrade
engine runs, so an authored book is valid by construction rather than by
convention. The Python SDK exposes the identical surface.

## Authentication

**Get a key at [nexustrade.io/developers](https://nexustrade.io/developers)**
(also under Profile → API Keys). Keys begin with `sk-` and are shown once at
creation, so store it immediately.

```ts
const nt = new NexusTradeClient({
  apiKey: "sk-...",
  baseUrl: "https://nexustrade.io/api/v1",
});
```

Or set `NEXUSTRADE_API_KEY` and `NEXUSTRADE_API_BASE_URL` and call
`NexusTradeClient.fromEnvironment()`.

The client sends `Authorization: Bearer sk-...` over HTTPS. Plain HTTP is
rejected except on loopback, and the client refuses to follow a cross-origin
redirect so the credential cannot be replayed to another host. It also refuses
to follow a redirect on any non-GET request, so a redirect can never re-submit
a paid job. Never ship a key
in browser code — it carries full account authority.

### Scopes

Give the key the scopes the calls need:

| Scope | Needed for |
| --- | --- |
| `read` | `getBacktest`, `getOptimization`, `getWalkForward` |
| `write` | `createPortfolio`, `createBacktest(s)`, `createOptimization`, `createWalkForward` |

A key missing the scope gets `403 insufficient_scope`.

### OAuth is not supported here

NexusTrade's OAuth flow exists for the MCP server, not for this API. The SDK
endpoints accept **only** `sk-` API keys — an OAuth bearer JWT is rejected with
`401 invalid_token`. Use an API key.

## Timeouts

`new HttpTransport({ timeoutSeconds })` (default 30) aborts the request after a
total wall-clock deadline covering redirects and body read. The Python SDK's
equivalent is a per-socket-operation timeout. Neither bounds how long a *job*
takes — that is what the polling loop above is for.

## Idempotency

Mutation calls require an idempotency key. Reusing the same key with the same
request returns the original resource instead of launching another paid job.

## Errors

Failures reject with `NexusTradeApiError`, carrying a stable `status`, `code`,
and `message` decoded from the API's error envelope:

```json
{ "error": { "code": "invalid_request", "message": "..." } }
```

```ts
import { NexusTradeApiError } from "nexustrade-sdk";

try {
  await nt.createBacktest(handle, { idempotencyKey: "run-1" });
} catch (error) {
  if (error instanceof NexusTradeApiError && error.code === "rate_limit_exceeded") {
    // back off and retry
  }
  throw error;
}
```

Codes you are most likely to see:

| Status | Code | Meaning |
| --- | --- | --- |
| 401 | `invalid_token` | Missing, malformed, or expired key (or an OAuth JWT) |
| 403 | `insufficient_scope` | Key lacks the `read`/`write` scope |
| 400 | `invalid_request`, `invalid_portfolio` | Malformed input |
| 400 | `invalid_idempotency_key` | Key must match `[A-Za-z0-9._:-]{1,160}` |
| 409 | `idempotency_conflict` | Key reused with a different payload |
| 404 | `not_found`, `operation_not_found` | Unknown or not-yours resource |
| 429 | `rate_limit_exceeded` | Back off and retry |

`status` is `0` when no HTTP status describes the failure: `transport_error`
(the request never reached the API — DNS, TLS, timeout), `unsafe_redirect`, or
an `invalid_response` envelope check on an otherwise-successful reply.

## Scope

Portfolio drafting, backtesting, optimization, and walk-forward studies. The
SDK does **not** expose the NexusTrade market-data lake, the screener, or live
trading — those have no public HTTP surface. Everything the SDK can reach is
the six routes under `/api/v1/nexustrade`.

## Requirements

Node 18+ (uses the global `fetch`).

Contributing: the test suite runs TypeScript directly via `node --test`, which
needs Node 22.6+ for type stripping. The published `dist/` is plain JavaScript
and has no such requirement.

## License

MIT
