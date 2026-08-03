/** Contract tests for the publishable NexusTrade JSON client. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NexusTradeApiError,
  NexusTradeClient,
  type JsonObject,
  type RequestOptions,
  type Transport,
} from "../src/client.ts";

interface RecordedCall {
  method: string;
  path: string;
  body: JsonObject | undefined;
  idempotencyKey: string | undefined;
}

class FakeTransport implements Transport {
  readonly calls: RecordedCall[] = [];
  private readonly responses: JsonObject[];

  constructor(responses: JsonObject[]) {
    this.responses = [...responses];
  }

  async request(
    method: string,
    path: string,
    options: RequestOptions = {}
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

describe("NexusTradeClient", () => {
  it("create_portfolio uses stable JSON contract", async () => {
    const transport = new FakeTransport([
      { portfolio: { portfolioId: "p-1", portfolioName: "Book" } },
    ]);
    const client = new NexusTradeClient({ transport });

    const result = await client.createPortfolio(
      { name: "Book", strategies: [{ name: "s" }] },
      { idempotencyKey: "book-v1" }
    );

    assert.equal(result.portfolioId, "p-1");
    assert.deepEqual(transport.calls, [
      {
        method: "POST",
        path: "portfolios",
        body: { name: "Book", strategies: [{ name: "s" }] },
        idempotencyKey: "book-v1",
      },
    ]);
  });

  it("backtest batch returns operation handles", async () => {
    const transport = new FakeTransport([
      { operations: [{ id: "bt-1", kind: "backtest", status: "running" }] },
    ]);
    const client = new NexusTradeClient({ transport });

    const operations = await client.createBacktests(
      [
        {
          portfolio: { name: "Book" },
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        },
      ],
      { idempotencyKey: "bt-v1" }
    );

    assert.equal(operations[0].id, "bt-1");
    assert.equal(transport.calls[0].path, "backtests/batch");
  });

  it("normalizes a generated backtest handle without raw wire JSON", async () => {
    const transport = new FakeTransport([
      { operations: [{ id: "bt-1", kind: "backtest", status: "running" }] },
    ]);
    const client = new NexusTradeClient({ transport });

    const operation = await client.createBacktest(
      {
        tool: "backtest_portfolio",
        portfolio: { name: "Book", strategies: [{ name: "s" }] },
        args: {
          start_date: "2024-01-01",
          end_date: "2024-12-31",
          baseline_symbol: "QQQ",
          initial_value: 25_000,
        },
      },
      { idempotencyKey: "bt-generated-v1" }
    );

    assert.equal(operation.id, "bt-1");
    assert.deepEqual(transport.calls[0].body, {
      backtests: [
        {
          portfolio: { name: "Book", strategies: [{ name: "s" }] },
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          baseline: "QQQ",
          initialValue: 25_000,
        },
      ],
    });
  });

  it("rejects non-backtest generated handles", async () => {
    const client = new NexusTradeClient({ transport: new FakeTransport([]) });

    await assert.rejects(
      () =>
        client.createBacktests(
          [{ tool: "optimize_portfolio", portfolio: {}, args: {} }],
          { idempotencyKey: "wrong-handle" }
        ),
      /backtest/
    );
  });

  it("job builders send portfolio and args without the internal tool name", async () => {
    const transport = new FakeTransport([
      { operation: { id: "opt-1", kind: "optimization", status: "running" } },
    ]);
    const client = new NexusTradeClient({ transport });

    const operation = await client.createOptimization(
      {
        tool: "optimize_portfolio",
        portfolio: { name: "Book" },
        args: { start_date: "2022-01-01" },
      },
      { idempotencyKey: "opt-v1" }
    );

    assert.equal(operation.id, "opt-1");
    assert.deepEqual(transport.calls[0].body, {
      portfolio: { name: "Book" },
      args: { start_date: "2022-01-01" },
    });
  });

  it("walk-forward and owner-scoped reads use public paths", async () => {
    const transport = new FakeTransport([
      { operation: { id: "wf-1", kind: "walk_forward", status: "running" } },
      {
        operation: {
          id: "wf-1",
          kind: "walk_forward",
          status: "completed",
          result: { studyId: "wf-1", status: "COMPLETE" },
        },
      },
      { operation: { id: "bt-1", kind: "backtest", status: "running" } },
    ]);
    const client = new NexusTradeClient({ transport });

    const created = await client.createWalkForward(
      {
        tool: "run_walk_forward_study",
        portfolio: { name: "Book" },
        args: { global_start_date: "2022-01-01" },
      },
      { idempotencyKey: "wf-v1" }
    );
    const completed = await client.getWalkForward("wf-1");
    const backtest = await client.getBacktest("bt-1");

    assert.equal(created.id, "wf-1");
    assert.equal(completed.status, "completed");
    assert.equal(backtest.id, "bt-1");
    assert.deepEqual(
      transport.calls.map((call) => call.path),
      ["walk-forward-studies", "walk-forward-studies/wf-1", "backtests/bt-1"]
    );
  });

  it("raises a stable error when the operation envelope is missing", async () => {
    const client = new NexusTradeClient({
      transport: new FakeTransport([{ notAnOperation: true }]),
    });

    await assert.rejects(
      () => client.getBacktest("bt-1"),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "invalid_response");
        return true;
      }
    );
  });

  it("does not reuse unrelated OpenAI credentials from the environment", () => {
    const saved = {
      key: process.env.NEXUSTRADE_API_KEY,
      url: process.env.NEXUSTRADE_API_BASE_URL,
    };
    delete process.env.NEXUSTRADE_API_KEY;
    delete process.env.NEXUSTRADE_API_BASE_URL;
    process.env.OPENAI_API_KEY = "sk-unrelated";
    try {
      assert.throws(() => NexusTradeClient.fromEnvironment());
    } finally {
      delete process.env.OPENAI_API_KEY;
      if (saved.key !== undefined) process.env.NEXUSTRADE_API_KEY = saved.key;
      if (saved.url !== undefined) {
        process.env.NEXUSTRADE_API_BASE_URL = saved.url;
      }
    }
  });
});

class AlwaysRunningTransport implements Transport {
  callCount = 0;

  async request(): Promise<JsonObject> {
    this.callCount += 1;
    return { operation: { id: "bt-1", kind: "backtest", status: "running" } };
  }
}

describe("operation waiter", () => {
  it("times out without cancelling the job", async () => {
    // A timeout is a client-side give-up: the job keeps running, so the
    // message must not imply it was cancelled or should be resubmitted.
    const transport = new AlwaysRunningTransport();
    const client = new NexusTradeClient({ transport });

    await assert.rejects(
      () =>
        client.waitForBacktest("bt-1", {
          timeoutSeconds: 0.05,
          pollIntervalSeconds: 0,
        }),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "operation_timeout");
        assert.match(error.message, /still running/);
        return true;
      }
    );
    assert.ok(transport.callCount > 0);
  });

  it("can return a failed envelope instead of rejecting", async () => {
    const transport = new FakeTransport([
      { operation: { id: "bt-1", status: "failed", error: { code: "x" } } },
    ]);
    const client = new NexusTradeClient({ transport });

    const operation = await client.waitForBacktest("bt-1", {
      pollIntervalSeconds: 0,
      raiseOnFailure: false,
    });

    assert.equal(operation.status, "failed");
  });

  it("backs off and respects the interval ceiling", async () => {
    const responses: JsonObject[] = Array.from({ length: 6 }, () => ({
      operation: { id: "bt-1", status: "running" },
    }));
    responses.push({ operation: { id: "bt-1", status: "completed" } });
    const client = new NexusTradeClient({
      transport: new FakeTransport(responses),
    });

    const started = Date.now();
    // 2 -> 3 -> 4.5 -> 6.75 -> 10.125 -> capped at 15 in real units; scaled
    // down by 1000x here so the sequence is observable without the wall clock.
    await client.waitForBacktest("bt-1", {
      pollIntervalSeconds: 0.002,
      maxPollIntervalSeconds: 0.01,
    });
    const elapsed = Date.now() - started;

    // 2+3+4.5+6.75+10+10 = ~36ms of scaled backoff; a flat interval would be 12ms.
    assert.ok(elapsed >= 25, `expected backoff growth, took ${elapsed}ms`);
  });

  it("does not swallow transport failures", async () => {
    // Reporting an outage as "still running" would hide it behind a timeout.
    const client = new NexusTradeClient({
      transport: {
        async request(): Promise<JsonObject> {
          throw new NexusTradeApiError(0, "transport_error", "dns");
        },
      },
    });

    await assert.rejects(
      () => client.waitForBacktest("bt-1", { pollIntervalSeconds: 0 }),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "transport_error");
        return true;
      }
    );
  });

  it("rejects a non-positive timeout", async () => {
    const client = new NexusTradeClient({ transport: new FakeTransport([]) });
    await assert.rejects(
      () => client.waitForBacktest("bt-1", { timeoutSeconds: 0 }),
      /timeoutSeconds must be positive/
    );
  });
});

class UploadingTransport extends FakeTransport {
  readonly uploads: {
    url: string;
    data: Uint8Array<ArrayBuffer>;
    contentType: string;
  }[] = [];

  async putBytes(
    url: string,
    data: Uint8Array<ArrayBuffer>,
    options: { contentType: string }
  ): Promise<void> {
    this.uploads.push({ url, data, contentType: options.contentType });
  }
}

function bigPoints(
  count: number
): { timestamp: string; value: number; ticker: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: `2024-04-${String((index % 28) + 1).padStart(2, "0")}`,
    value: index,
    ticker: `TCK${String(index).padStart(5, "0")}`,
  }));
}

describe("custom indicators", () => {
  it("uploads a large batch instead of inlining it", async () => {
    const points = bigPoints(20_000);
    const transport = new UploadingTransport([
      { indicator: { customIndicatorId: "ci-1", pointCount: 0 } },
      {
        ticket: {
          jobId: "job-1",
          uploadUrl: "https://storage.example/put",
          headers: { "Content-Type": "application/x-ndjson" },
        },
      },
      { operation: { id: "job-1", status: "queued" } },
      {
        operation: {
          id: "job-1",
          status: "completed",
          result: { acceptedRows: points.length },
        },
      },
      { indicator: { customIndicatorId: "ci-1", pointCount: points.length } },
    ]);
    const client = new NexusTradeClient({ transport });

    const result = await client.createCustomIndicator(
      { name: "Big", scope: "asset", points },
      { idempotencyKey: "big-v1" }
    );

    // The create request carries no points; they went to storage directly.
    assert.equal(transport.calls[0].body?.points, undefined);
    assert.deepEqual(
      transport.calls.map((call) => call.path),
      [
        "custom-indicators",
        "custom-indicators/ci-1/uploads",
        "custom-indicators/ci-1/uploads/job-1/complete",
        "custom-indicators/ci-1/uploads/job-1",
        "custom-indicators/ci-1",
      ]
    );
    assert.equal(transport.calls[1].body?.format, "jsonl");
    assert.equal(
      transport.calls[1].body?.sizeBytes,
      transport.uploads[0].data.length
    );
    // The server namespaces claims by operation, so reusing the key is safe
    // and cannot overrun its length limit.
    assert.equal(transport.calls[1].idempotencyKey, "big-v1");
    assert.equal(transport.uploads[0].url, "https://storage.example/put");
    assert.equal(transport.uploads[0].contentType, "application/x-ndjson");
    assert.equal(
      new TextDecoder().decode(transport.uploads[0].data).trimEnd().split("\n")
        .length,
      points.length
    );
    assert.equal(result.pointCount, points.length);
    assert.deepEqual(result.upload, {
      id: "job-1",
      status: "completed",
      result: { acceptedRows: points.length },
    });
  });

  it("resumes polling on a retry instead of resending the batch", async () => {
    // An upload interrupted after its PUT must be resumable. The replayed
    // ticket carries no uploadUrl because the bytes already landed; re-sending
    // them (or failing outright) would strand a caller whose only fault was a
    // poll timeout.
    const points = bigPoints(20_000);
    const transport = new UploadingTransport([
      { indicator: { customIndicatorId: "ci-1", pointCount: 0 } },
      // Replayed ticket: job known, nothing left to upload.
      { ticket: { jobId: "job-1", status: "validating" } },
      {
        operation: {
          id: "job-1",
          status: "completed",
          result: { acceptedRows: points.length },
        },
      },
      { indicator: { customIndicatorId: "ci-1", pointCount: points.length } },
    ]);
    const client = new NexusTradeClient({ transport });

    const result = await client.createCustomIndicator(
      { name: "Big", scope: "asset", points },
      { idempotencyKey: "big-v1" }
    );

    assert.deepEqual(transport.uploads, []);
    assert.deepEqual(
      transport.calls.map((call) => call.path),
      [
        "custom-indicators",
        "custom-indicators/ci-1/uploads",
        // No /complete — the first attempt already started validation.
        "custom-indicators/ci-1/uploads/job-1",
        "custom-indicators/ci-1",
      ]
    );
    assert.equal(result.pointCount, points.length);
  });

  it("raises rather than reporting success on a failed upload", async () => {
    const transport = new UploadingTransport([
      { indicator: { customIndicatorId: "ci-1" } },
      {
        ticket: {
          jobId: "job-1",
          uploadUrl: "https://storage.example/put",
          headers: { "Content-Type": "application/x-ndjson" },
        },
      },
      { operation: { id: "job-1", status: "queued" } },
      {
        operation: {
          id: "job-1",
          status: "failed",
          error: {
            code: "custom_indicator_upload_failed",
            message: "row 4: Invalid datetime",
          },
        },
      },
    ]);
    const client = new NexusTradeClient({ transport });

    await assert.rejects(
      () =>
        client.createCustomIndicator(
          { name: "Big", scope: "asset", points: bigPoints(20_000) },
          { idempotencyKey: "big-v1" }
        ),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "custom_indicator_upload_failed");
        return true;
      }
    );
  });

  it("needs an upload-capable transport for a large batch", async () => {
    const transport = new FakeTransport([
      { indicator: { customIndicatorId: "ci-1" } },
    ]);
    const client = new NexusTradeClient({ transport });

    await assert.rejects(
      () =>
        client.createCustomIndicator(
          { name: "Big", points: bigPoints(20_000) },
          { idempotencyKey: "big-v1" }
        ),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "unsupported_transport");
        return true;
      }
    );
  });

  it("serializes Date points as ISO strings", async () => {
    const transport = new FakeTransport([
      { indicator: { customIndicatorId: "ci-1" } },
    ]);
    const client = new NexusTradeClient({ transport });

    await client.createCustomIndicator(
      {
        name: "Dated",
        points: [{ timestamp: new Date("2024-04-01T00:00:00.000Z"), value: 3 }],
      },
      { idempotencyKey: "dated-v1" }
    );

    assert.deepEqual(transport.calls[0].body?.points, [
      { timestamp: "2024-04-01T00:00:00.000Z", value: 3 },
    ]);
  });

  it("materializes same-day observation availability", async () => {
    const transport = new FakeTransport([
      { indicator: { customIndicatorId: "ci-1" } },
    ]);
    const client = new NexusTradeClient({ transport });

    await client.createCustomIndicator(
      {
        name: "Observed",
        pointKind: "observation",
        points: [
          {
            timestamp: "2024-04-05",
            availableAt: "2024-04-05",
            value: 3,
          },
        ],
      },
      { idempotencyKey: "observed-v1" }
    );

    assert.equal(transport.calls[0].body?.pointKind, "observation");
    assert.deepEqual(transport.calls[0].body?.points, [
      {
        timestamp: "2024-04-05",
        availableAt: "2024-04-05T00:00:00.000Z",
        value: 3,
      },
    ]);
  });

  it("uses the same observation availability contract for large uploads", async () => {
    const points = Array.from({ length: 20_000 }, (_, index) => ({
      timestamp: `2024-04-${String((index % 28) + 1).padStart(2, "0")}`,
      availableAt: `2024-04-${String((index % 28) + 1).padStart(2, "0")}`,
      value: index,
      ticker: `TCK${String(index).padStart(5, "0")}`,
    }));
    const transport = new UploadingTransport([
      { indicator: { customIndicatorId: "ci-1", pointCount: 0 } },
      {
        ticket: {
          jobId: "job-1",
          uploadUrl: "https://storage.example/put",
          headers: { "Content-Type": "application/x-ndjson" },
        },
      },
      { operation: { id: "job-1", status: "queued" } },
      {
        operation: {
          id: "job-1",
          status: "completed",
          result: { acceptedRows: points.length },
        },
      },
      { indicator: { customIndicatorId: "ci-1", pointCount: points.length } },
    ]);
    const client = new NexusTradeClient({ transport });

    await client.createCustomIndicator(
      { name: "Observed big", scope: "asset", pointKind: "observation", points },
      { idempotencyKey: "observed-big-v1" }
    );

    const firstRow = JSON.parse(
      new TextDecoder().decode(transport.uploads[0].data).split("\n")[0]
    ) as Record<string, unknown>;
    assert.equal(firstRow.availableAt, "2024-04-01T00:00:00.000Z");
    assert.equal(transport.calls[0].body?.pointKind, "observation");
  });

  it("derives period availability from a full UTC timestamp", async () => {
    const transport = new FakeTransport([
      { indicator: { customIndicatorId: "ci-1" } },
    ]);
    const client = new NexusTradeClient({ transport });

    await client.createCustomIndicator(
      {
        name: "Daily close",
        pointKind: "period_aggregate",
        aggregatePeriod: "1d",
        points: [{ timestamp: "2024-04-05T00:00:00Z", value: 3 }],
      },
      { idempotencyKey: "daily-close-v1" }
    );

    const points = transport.calls[0].body?.points as Array<
      Record<string, unknown>
    >;
    assert.equal(points[0].availableAt, "2024-04-06T00:00:00.000Z");
  });

  it("passes the archive filter when listing", async () => {
    const transport = new FakeTransport([
      { indicators: [{ customIndicatorId: "ci-1" }] },
    ]);
    const client = new NexusTradeClient({ transport });

    const indicators = await client.listCustomIndicators({
      includeArchived: true,
    });

    assert.equal(
      transport.calls[0].path,
      "custom-indicators?includeArchived=true"
    );
    assert.deepEqual(indicators, [{ customIndicatorId: "ci-1" }]);
  });

  it("replaces, archives, and restores through the public lifecycle", async () => {
    const transport = new FakeTransport([
      { indicator: { customIndicatorId: "ci-1", dataVersion: 2 } },
      { archive: { customIndicatorId: "ci-1", forksPaused: 0 } },
      { indicator: { customIndicatorId: "ci-1", status: "active" } },
    ]);
    const client = new NexusTradeClient({ transport });

    await client.replaceCustomIndicatorPoints(
      "ci-1",
      [{ timestamp: "2024-04-01", value: 3 }],
      { idempotencyKey: "replace-v2", allowShrink: true }
    );
    await client.archiveCustomIndicator("ci-1", { confirm: true });
    await client.restoreCustomIndicator("ci-1");

    assert.deepEqual(transport.calls, [
      {
        method: "PUT",
        path: "custom-indicators/ci-1/points",
        body: {
          points: [{ timestamp: "2024-04-01", value: 3 }],
          allowShrink: true,
        },
        idempotencyKey: "replace-v2",
      },
      {
        method: "DELETE",
        path: "custom-indicators/ci-1",
        body: { confirm: true },
        idempotencyKey: undefined,
      },
      {
        method: "POST",
        path: "custom-indicators/ci-1/restore",
        body: {},
        idempotencyKey: undefined,
      },
    ]);
  });

  it("uses replace upload mode for a large full-series replacement", async () => {
    const points = bigPoints(20_000);
    const transport = new UploadingTransport([
      {
        ticket: {
          jobId: "job-replace",
          uploadUrl: "https://storage.example/replace",
          headers: { "Content-Type": "application/x-ndjson" },
        },
      },
      { operation: { id: "job-replace", status: "queued" } },
      { operation: { id: "job-replace", status: "completed" } },
      { indicator: { customIndicatorId: "ci-1", pointCount: points.length } },
    ]);
    const client = new NexusTradeClient({ transport });

    await client.replaceCustomIndicatorPoints("ci-1", points, {
      idempotencyKey: "replace-large-v1",
      allowShrink: true,
    });

    assert.deepEqual(transport.calls[0].body, {
      fileName: "ci-1-points.jsonl",
      format: "jsonl",
      sizeBytes: transport.uploads[0].data.length,
      mode: "replace",
      allowShrink: true,
    });
  });
});
