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

  it("sends a fetched policy's stock eligibility and never its automation", () => {
    const policy = {
      schemaVersion: 2,
      revision: 4,
      stockEligibility: {
        minimumMarketCapUsd: 500_000_000,
        maximumMarketCapUsd: null,
        industryFilter: {
          mode: "INCLUDE_ONLY",
          match: "ALL",
          industries: ["artificialIntelligence", "biotechnology"],
        },
        missingMarketCapBehavior: "EXCLUDE",
        shareClassBehavior: "ONE_PER_COMPANY",
        missingIndustryBehavior: "EXCLUDE_WHEN_FILTER_SET",
        appliesTo: "DYNAMIC_STOCK_UNIVERSES",
      },
      automatedApproval: {
        enabled: false,
        maxAutomatedTradesPerDay: 2,
        countingUnit: "TRADE_ACTION",
        dailyWindow: "AMERICA_NEW_YORK_CALENDAR_DAY",
      },
    };
    const book = new PortfolioHandle({
      name: "Policy",
      strategies: [],
      policy,
    });

    assert.deepEqual(book.policy, policy);
    assert.deepEqual(book.toJSON().policy, {
      stockEligibility: {
        minimumMarketCapUsd: 500_000_000,
        maximumMarketCapUsd: null,
        industryFilter: {
          mode: "INCLUDE_ONLY",
          match: "ALL",
          industries: ["artificialIntelligence", "biotechnology"],
        },
        missingMarketCapBehavior: "EXCLUDE",
        shareClassBehavior: "ONE_PER_COMPANY",
      },
    });
  });

  it("authors a pairs book's eligibility through portfolio() and save()", async () => {
    const transport = new FakeTransport([
      { portfolio: { portfolioId: "chat-9", portfolioName: "GOOG/GOOGL pair" } },
    ]);
    const book = portfolio("GOOG/GOOGL pair", [], {
      policy: { stockEligibility: { shareClassBehavior: "ALL_CLASSES", minimumMarketCapUsd: 0 } },
    });

    await book.save({ idempotencyKey: "pair-v1", transport });

    assert.deepEqual(transport.calls[0]?.body?.policy, {
      stockEligibility: { shareClassBehavior: "ALL_CLASSES", minimumMarketCapUsd: 0 },
    });
    assert.equal(book.policy, undefined);
  });

  it("setStockEligibility replaces the authored eligibility", () => {
    const book = new PortfolioHandle({ name: "Small caps", strategies: [] });
    assert.equal(book.toJSON().policy, undefined);

    book.setStockEligibility({ minimumMarketCapUsd: 300_000_000, maximumMarketCapUsd: 2_000_000_000 });

    assert.deepEqual(book.toJSON().policy, {
      stockEligibility: { minimumMarketCapUsd: 300_000_000, maximumMarketCapUsd: 2_000_000_000 },
    });
  });

  for (const policy of [
    { automatedApproval: { enabled: true } },
    { stockEligibility: { minimumMarketCapUsd: 0 }, automatedApproval: { enabled: true } },
    { stockEligibility: { minimumMarketCapUsd: 0 }, automationAcknowledged: true },
    { stockEligibility: {}, revision: 3 },
  ]) {
    it(`refuses to author ${JSON.stringify(policy)}`, () => {
      assert.throws(
        () => new PortfolioHandle({ name: "Book", strategies: [], policy } as unknown as JsonObject),
        TypeError,
      );
    });
  }

  it("reads a policy that keeps names with no market cap", () => {
    // The politician copy bots: no floor, and ETFs and unsized filers kept.
    const policy = {
      schemaVersion: 2,
      revision: 1,
      stockEligibility: {
        minimumMarketCapUsd: 0,
        maximumMarketCapUsd: null,
        industryFilter: { mode: "ALL", match: "ANY", industries: [] },
        missingMarketCapBehavior: "INCLUDE",
        shareClassBehavior: "ONE_PER_COMPANY",
        missingIndustryBehavior: "EXCLUDE_WHEN_FILTER_SET",
        appliesTo: "DYNAMIC_STOCK_UNIVERSES",
      },
      automatedApproval: {
        enabled: false,
        maxAutomatedTradesPerDay: 2,
        countingUnit: "TRADE_ACTION",
        dailyWindow: "AMERICA_NEW_YORK_CALENDAR_DAY",
      },
    };
    const book = new PortfolioHandle({ name: "Copy Nancy Pelosi", strategies: [], policy });

    assert.deepEqual(book.policy, policy);
  });

  it("reads a pairs policy that holds every share class", () => {
    const policy = {
      schemaVersion: 2,
      revision: 3,
      stockEligibility: {
        minimumMarketCapUsd: 0,
        maximumMarketCapUsd: null,
        industryFilter: { mode: "ALL", match: "ANY", industries: [] },
        missingMarketCapBehavior: "EXCLUDE",
        shareClassBehavior: "ALL_CLASSES",
        missingIndustryBehavior: "EXCLUDE_WHEN_FILTER_SET",
        appliesTo: "DYNAMIC_STOCK_UNIVERSES",
      },
      automatedApproval: {
        enabled: false,
        maxAutomatedTradesPerDay: 2,
        countingUnit: "TRADE_ACTION",
        dailyWindow: "AMERICA_NEW_YORK_CALENDAR_DAY",
      },
    };
    const book = new PortfolioHandle({ name: "GOOG/GOOGL pair", strategies: [], policy });

    assert.deepEqual(book.policy, policy);
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
