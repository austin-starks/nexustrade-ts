/** Contract tests for PortfolioHandle. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NexusTradeClient,
  type JsonObject,
  type RequestOptions,
  type Transport,
} from "../src/client.ts";
import { PortfolioHandle } from "../src/portfolio.ts";
import { portfolio } from "../src/generated/ntSdk.generated.ts";

class FakeTransport implements Transport {
  readonly calls: Array<{
    method: string;
    path: string;
    body: JsonObject | undefined;
    idempotencyKey: string | undefined;
  }> = [];
  private readonly responses: JsonObject[];

  constructor(responses: JsonObject[]) {
    this.responses = [...responses];
  }

  async request(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<JsonObject> {
    this.calls.push({
      method,
      path,
      body: options.body,
      idempotencyKey: options.idempotencyKey,
    });
    const next = this.responses.shift();
    if (!next) throw new Error("FakeTransport ran out of responses");
    return next;
  }
}

describe("PortfolioHandle", () => {
  it("builder returns a handle that serializes without id", () => {
    const book = portfolio("Momentum", []);
    assert.ok(book instanceof PortfolioHandle);
    assert.equal(book.id, null);
    assert.equal(book.name, "Momentum");
    const encoded = JSON.parse(JSON.stringify(book)) as JsonObject;
    assert.equal(encoded.name, "Momentum");
    assert.equal(encoded.id, undefined);
  });

  it("save sets id without leaking it into the body", async () => {
    const transport = new FakeTransport([
      { portfolio: { portfolioId: "chat-1", portfolioName: "Momentum" } },
    ]);
    const book = new PortfolioHandle(
      { name: "Momentum", strategies: [{ name: "s" }] },
      { transport },
    );

    await book.save({ idempotencyKey: "mom-v1" });

    assert.equal(book.id, "chat-1");
    assert.equal(transport.calls[0]?.body?.name, "Momentum");
    assert.equal(transport.calls[0]?.body?.id, undefined);
  });

  it("backtest prefers portfolioId once saved", async () => {
    const transport = new FakeTransport([
      { operations: [{ id: "bt-1", kind: "backtest", status: "running" }] },
    ]);
    const book = new PortfolioHandle(
      { name: "Momentum", strategies: [] },
      { id: "chat-1", transport },
    );

    await book.backtest({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      idempotencyKey: "bt-v1",
    });

    const body = transport.calls[0]?.body as JsonObject;
    const backtests = body.backtests as JsonObject[];
    assert.equal(backtests[0]?.portfolioId, "chat-1");
    assert.equal(backtests[0]?.portfolio, undefined);
  });

  it("deploy returns a different id than save", async () => {
    const transport = new FakeTransport([
      {
        deployment: {
          portfolioId: "paper-9",
          chatPortfolioId: "chat-1",
          name: "Momentum",
          outcome: "minted",
        },
      },
    ]);
    const client = new NexusTradeClient({ transport });
    const result = await client.deploy("chat-1", { frequency: "Constant" });

    assert.equal(result.portfolioId, "paper-9");
    assert.equal(result.chatPortfolioId, "chat-1");
    assert.equal(transport.calls[0]?.path, "portfolios/chat-1/deploy");
  });
});

describe("PortfolioHandle hostile payloads", () => {
  /**
   * `JSON.parse` exposes `__proto__` as an own enumerable key, so a plain
   * `this[key] = value` copy loop replaces the instance prototype and the
   * handle silently loses save/deploy/toJSON — the failure only shows up later
   * as "portfolio.save is not a function".
   */
  it("keeps its prototype when the payload carries __proto__", () => {
    const payload = JSON.parse(
      '{"portfolioId":"p-1","name":"Momentum","strategies":[],' +
        '"__proto__":{"pwned":true}}',
    ) as JsonObject;

    const handle = PortfolioHandle.from(payload);

    assert.equal(Object.getPrototypeOf(handle), PortfolioHandle.prototype);
    assert.equal(typeof handle.save, "function");
    assert.equal(typeof handle.deploy, "function");
    assert.equal(typeof handle.toJSON, "function");
    assert.equal(
      (handle as unknown as { pwned?: boolean }).pwned,
      undefined,
    );
  });

  it("drops non-object entries from strategies", () => {
    // The server contract says objects; anything else would have been cast
    // straight through to Strategy[] and blown up downstream instead of here.
    const handle = PortfolioHandle.from({
      name: "Momentum",
      strategies: ["not-a-strategy", 42, null, { name: "Buy" }],
    } as unknown as JsonObject);

    assert.equal(handle.strategies.length, 1);
    assert.equal(JSON.stringify(handle.toJSON().strategies), '[{"name":"Buy"}]');
  });

  it("still omits id from toJSON after an unknown-key copy", () => {
    const handle = PortfolioHandle.from({
      portfolioId: "p-1",
      name: "Momentum",
      strategies: [],
      someFutureField: "kept",
    } as unknown as JsonObject);

    const body = handle.toJSON();
    assert.equal("id" in body, false);
    assert.equal(handle.id, "p-1");
  });
});
