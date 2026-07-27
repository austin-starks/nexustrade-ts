# AGENTS.md — NexusTrade TypeScript SDK

Instructions for coding agents (Claude Code, Cursor, Codex, and friends) writing
NexusTrade strategies with this package. Humans: [README.md](README.md) is the
friendlier read.

## What this package is

A typed client plus ~170 **generated** builders for authoring trading
strategies. The builders are generated from the same indicator specification the
NexusTrade engine executes, so a book assembled from them is structurally valid
before it ever leaves the process.

```
author a portfolio  →  submit a job  →  poll until terminal  →  read result
```

## Setup

```bash
npm install nexustrade
export NEXUSTRADE_API_KEY=sk-...
export NEXUSTRADE_API_BASE_URL=https://nexustrade.io/api/v1
```

```ts
import { NexusTradeClient } from "nexustrade";
const client = new NexusTradeClient();   // reads the environment
```

Keys come from https://nexustrade.io/developers. Never hardcode one into a file
you write; read it from the environment. Node 18+.

## Rules that matter

**1. Use the builders. Never hand-write the JSON.**

```ts
// Right — validated shape, correct wire names
nt.buy(nt.stockAsset("SPY"), 100);

// Wrong — silently diverges from the engine's schema
{ type: "Buy", targetAsset: { symbol: "SPY" }, amount: 100 };
```

The client accepts both a builder result and a plain object, so a wrong literal
will typecheck. Prefer the builder.

**2. Comparisons are functions, not operators.**

TypeScript cannot overload `>`, so indicator comparisons go through helpers.
This is the single most common mistake in this SDK.

```ts
// Right
nt.filter(nt.gt(nt.Price(nt.CANDIDATE), nt.SMA(nt.CANDIDATE, 200)));

// Wrong — compares object references, always nonsense
nt.filter(nt.Price(nt.CANDIDATE) > nt.SMA(nt.CANDIDATE, 200));
```

Available: `gt` `gte` `lt` `lte` `eq` `neq`, combined with `and` / `or`.

**3. Every mutation needs an idempotency key, and it must be deterministic.**

Jobs cost money. A retry with the *same* key returns the original operation; a
retry with a new key launches a second paid job.

```ts
// Right — same logical run reuses the key across retries
await client.createBacktest(handle, { idempotencyKey: "momentum-2024-v1" });

// Wrong — every retry is a new billable job
await client.createBacktest(handle, { idempotencyKey: `run-${Date.now()}` });
```

Reusing a key with a *different* payload is a `409 idempotency_conflict`. Version
the key when the request changes: `momentum-2024-v2`.

**4. `create*` does not wait. Poll.**

```ts
const operation = await client.createBacktest(handle, { idempotencyKey: "k" });
// operation.result is ABSENT here — the job has not run yet.
const finished = await client.waitForBacktest(operation.id as string);
console.log(finished.result);
```

A timeout does not cancel the job. Call the waiter again with the same id;
do not resubmit.

**5. Batch when you have several.**

```ts
const operations = await client.createBacktests([h1, h2, h3], {
  idempotencyKey: "sweep-v1",
});
const results = await client.waitForBacktests(operations);
```

One request, one key, one rate-limit slot — instead of three of each.

**6. Percent semantics.** `buy(asset, 100)` is **100% of portfolio**, not 100
shares. Deployment and allocation parameters are percentages unless a builder
says otherwise.

**7. Credentials come from the environment, or a `.env` file.** Both
`NEXUSTRADE_API_KEY` and `NEXUSTRADE_API_BASE_URL` are read from `process.env`
first, then from a `.env` at or above the working directory — no `dotenv`
dependency and no `--env-file` needed. Never hardcode a key into a file you
write, and never log one. Exported values win over the file.

**8. Responses are `JsonObject`.** Fields come back typed as `JsonValue`, so
narrow before use (`operation.id as string`). This is deliberate: the envelope is
whatever the API returned, not a promise the SDK can statically make.

**9. Your own data belongs in ONE series.** `createCustomIndicator` mints a new
series every time it is called with a fresh idempotency key. Recurring
collection must `appendCustomIndicatorPoints` onto the id it created the first
time — a new series per run splits the history into fragments no strategy can
read. Persist the id; never re-create by name.

```ts
// Right — one series, appended forever
await client.appendCustomIndicatorPoints(seriesId, todaysPoints, {
  idempotencyKey: `mentions-${today}`,
});

// Wrong — a new, disconnected series every run
await client.createCustomIndicator(
  { name: "Mentions", points: todaysPoints },
  { idempotencyKey: `mentions-${today}` },
);
```

Point batches are unlimited in size; the SDK sends them inline or uploads them.
Do not chunk by hand.

## Recipes

<details open>
<summary><b>Buy and hold</b></summary>

```ts
import * as nt from "nexustrade";

const book = nt.portfolio("Buy and hold SPY", [
  nt.strategy("Buy", nt.always(), nt.buy(nt.stockAsset("SPY"), 100)),
]);
```
</details>

<details>
<summary><b>Condition on an indicator</b></summary>

```ts
const aapl = nt.stockAsset("AAPL");
const oversold = nt.lt(nt.RSI(aapl, 14), 30);

const book = nt.portfolio("Dip buyer", [
  nt.strategy("Buy the dip", oversold, nt.buy(aapl, 25)),
  nt.strategy(
    "Take profit",
    nt.gt(nt.PositionPercentChange(aapl), 10),
    nt.sell(aapl, 100),
  ),
]);
```

Combine with `nt.and`, `nt.or`, `nt.atLeast`, `nt.atMost`, `nt.exactly`.
</details>

<details>
<summary><b>Rank and rotate a universe</b></summary>

`CANDIDATE` is the placeholder for "each name being evaluated". Use it inside a
pipeline; use a concrete asset outside one.

```ts
const book = nt.portfolio("Momentum", [
  nt.strategy("Rotate", nt.always(), nt.dynamicRebalance({
    universe: nt.universe("SP500"),
    pipeline: [
      nt.filter(nt.gt(nt.Price(nt.CANDIDATE), nt.SMA(nt.CANDIDATE, 200))),
      nt.selectTop(nt.RSI(nt.CANDIDATE, 14), 10),
    ],
    weightIndicator: nt.RSI(nt.CANDIDATE, 14),
    limit: 10,
    deploymentPercent: 80,
  })),
], { initialValue: 100_000 });
```

Note the key is `universe`, not `universeConfig` (the Python SDK spells it
`universe_config`). `deploymentPercent: 80` invests 80% of the portfolio across
the selection and leaves the rest in cash — a **total** cap, not per-name.
</details>

<details>
<summary><b>Backtest, optimize, walk forward</b></summary>

```ts
const bt = nt.backtest(book, { startDate: "2024-01-01", endDate: "2024-12-31" });

const opt = nt.optimization(book, {
  startDate: "2022-01-01",
  endDate: "2024-12-31",
});

const wf = nt.walkForward(book, {
  globalStartDate: "2022-01-01",
  globalEndDate: "2024-12-31",
  foldCount: 4,
});
```

Walk-forward uses `globalStartDate` / `globalEndDate` / `foldCount`, not
`startDate` / `endDate`. Each handle goes to its matching `create*` + `waitFor*`
pair.
</details>

<details>
<summary><b>Query the data lake</b></summary>

```ts
const query = await client.createLakeQuery(
  {
    query: "SELECT ticker, date, closingPrice FROM lake.daily_ohlc WHERE ticker = ?",
    params: ["AAPL"],
    limits: { maxRows: 10_000 },
  },
  { idempotencyKey: "aapl-daily-v1" },
);
const finished = await client.waitForLakeQuery(query.id as string);
const manifest = await client.getLakeQueryManifest(finished.id as string);
```

Always parameterize with `?` rather than interpolating into the SQL string.
Stream parts with `downloadLakeQueryPart` instead of materializing large results.
</details>

<details>
<summary><b>Run an agent</b></summary>

Agents are the one job kind that is NOT fire-and-poll. Three states —
`pending_plan_approval`, `pending_action_approval`, `awaiting_user_input` — are
ones the run cannot leave on its own, so the caller is the approver.

```ts
const run = await client.createAgent("Find momentum names in the S&P 500", {
  idempotencyKey: "momentum-scan-v1",
});

for await (const event of run) {
  console.log(event.text);
  if (event.needsApproval) await run.approve();   // or run.reject()
  else if (event.needsInput) await run.say("focus on semis");
}
```

Iterating waits. If you never answer a blocked run, iteration throws
`agent_awaiting_input` rather than spinning silently — the run keeps going
server-side, so reattach with `client.attachAgent(run.id)`.

Approving can place orders, so it needs the `trade` scope; everything else
needs `write`. Agent runs are unavailable to `run_compute` sandbox code.
</details>

## Errors

All failures throw `NexusTradeApiError` with a stable `.status`, `.code`, and
`.message`. Branch on `.code`, never on message text.

| Code | What to do |
| --- | --- |
| `invalid_token` | Key missing/expired, or an OAuth JWT was used. Only `sk-` keys work here. |
| `insufficient_scope` | The key lacks `read` / `write` / `lake`. Do not retry. |
| `invalid_portfolio` | The book is malformed — fix the builders, do not retry as-is. |
| `idempotency_conflict` | Same key, different payload. Version the key. |
| `idempotency_in_progress` | Same key, first call still running. Wait and re-read; never resubmit. |
| `rate_limit_exceeded` | Back off and retry. |
| `operation_timeout` | Job still running. Re-poll the same id; never resubmit. |

`status === 0` means no HTTP status applies: the request never reached the API
(`transport_error`), or the reply failed an envelope check.

## What is and is not here

**Deploying a portfolio IS supported.** `book.save(...)` persists it and
`book.deploy(...)` starts paper trading it; `client.deploy(portfolioId)` does
the same from an id. `save` and `deploy` return *different* ids — deploying
mints a portfolio rather than converting the draft.

**`deploy` is not always paper.** A portfolio this SDK creates is always paper:
the portfolio spec has no deployment field, so there is no way to ask for a
live one. But `deploy(portfolioId)` accepts the id of a portfolio that is
*already deployed*, and then it reactivates that portfolio as whatever it
already is. Hand it the id of a paused **live** portfolio — `listPortfolios`
will return one under `includeLive: true` — and it resumes live trading against
the connected brokerage. `undeploy` is the same in reverse. Read
`deploymentType` on the response to know which one you got, and treat any id
you did not create in this session as possibly live.

Not in this SDK. Do not attempt to reach them through it:

- **Screener** — MCP only.
- **Order placement** — not exposed. No route on this API submits an order.
- **Creating a live deployment, and connecting a brokerage** — both happen in
  the web app. No route under the SDK prefix does either. This is about
  *creating* one; see above for reactivating a live portfolio that already
  exists.

The complete method list — every client and handle method, including the ones
without a worked example above — is the **Complete method reference** table in
[README.md](README.md#complete-method-reference). A test fails if any public
method is missing from it, so it is exhaustive by construction rather than by
maintenance.

## Verifying your work

```ts
// Assemble the book and inspect the JSON before spending money on a backtest.
console.log(JSON.stringify(book, null, 2));
```

If you are editing this repository rather than consuming it:

```bash
npm run typecheck && npm test
```
