/**
 * The client must accept the output of the generated builders.
 *
 * This is a TYPE regression test as much as a runtime one. Every other suite
 * hands the client hand-written object literals, which satisfy `JsonObject` —
 * so nothing caught that `portfolio(...)` and `backtest(...)` return
 * `interface` types, which TypeScript never gives the implicit index signature
 * `JsonObject` requires. Every documented entry point failed to compile while
 * the whole suite stayed green.
 *
 * `npm run typecheck` covers test/, so this file failing to compile is the
 * alarm. The runtime assertions below just confirm the payload survives intact.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NexusTradeClient,
  type JsonObject,
  type RequestOptions,
  type Transport,
} from "../src/client.ts";
import {
  always,
  backtest,
  buy,
  optimization,
  portfolio,
  stockAsset,
  strategy,
  walkForward,
} from "../src/generated/ntSdk.generated.ts";

class CapturingTransport implements Transport {
  bodies: Array<JsonObject | undefined> = [];

  async request(
    _method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<JsonObject> {
    this.bodies.push(options?.body);
    if (path === "portfolios") return { portfolio: { id: "p-1" } };
    if (path === "backtests/batch") {
      return { operations: [{ id: "op-1", status: "queued" }] };
    }
    return { operation: { id: "op-1", status: "queued" } };
  }
}

const book = portfolio("Example", [
  strategy("Buy SPY", always(), buy(stockAsset("SPY"), 100)),
]);

describe("generated builders are accepted by the client", () => {
  it("createPortfolio takes a Portfolio and sends it verbatim", async () => {
    const transport = new CapturingTransport();
    const nt = new NexusTradeClient({ transport });

    const saved = await nt.createPortfolio(book, { idempotencyKey: "k-1" });

    assert.deepEqual(saved, { id: "p-1" });
    assert.equal((transport.bodies[0] as JsonObject).name, "Example");
  });

  it("createPortfolio still takes a hand-written literal", async () => {
    // The widened parameter must not have cost the literal path.
    const transport = new CapturingTransport();
    const nt = new NexusTradeClient({ transport });

    await nt.createPortfolio(
      { name: "Literal", strategies: [] },
      { idempotencyKey: "k-2" },
    );

    assert.equal((transport.bodies[0] as JsonObject).name, "Literal");
  });

  it("createBacktest takes a backtest() handle and normalizes its args", async () => {
    const transport = new CapturingTransport();
    const nt = new NexusTradeClient({ transport });

    await nt.createBacktest(
      backtest(book, { startDate: "2024-01-01", endDate: "2024-12-31" }),
      { idempotencyKey: "k-3" },
    );

    const body = transport.bodies[0] as JsonObject;
    const submitted = (body.backtests as JsonObject[])[0];
    assert.equal(submitted.startDate, "2024-01-01");
    assert.equal(submitted.endDate, "2024-12-31");
  });

  it("createOptimization and createWalkForward take their handles", async () => {
    const transport = new CapturingTransport();
    const nt = new NexusTradeClient({ transport });

    await nt.createOptimization(
      optimization(book, { startDate: "2024-01-01", endDate: "2024-12-31" }),
      { idempotencyKey: "k-4" },
    );
    await nt.createWalkForward(
      walkForward(book, {
        globalStartDate: "2022-01-01",
        globalEndDate: "2024-12-31",
        foldCount: 4,
      }),
      { idempotencyKey: "k-5" },
    );

    for (const body of transport.bodies) {
      assert.ok((body as JsonObject).portfolio, "portfolio must be forwarded");
      assert.ok((body as JsonObject).args, "args must be forwarded");
    }
  });
});
