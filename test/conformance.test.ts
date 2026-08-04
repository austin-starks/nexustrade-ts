/**
 * Shared cross-language conformance suite.
 *
 * Drives every client method through a recording transport and pins the exact
 * wire traffic. The Python SDK runs the same cases from a byte-identical copy
 * of `conformance/client-cases.json`, so the two clients cannot disagree about
 * what they put on the wire.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  NexusTradeApiError,
  NexusTradeClient,
  type JsonObject,
  type JsonValue,
  type RequestOptions,
  type Transport,
} from "../src/client.ts";

interface ExpectedCall {
  method: string;
  path: string;
  body: JsonValue | null;
  idempotency_key: string | null;
}

interface ConformanceCase {
  name: string;
  method: string;
  input: JsonValue;
  /** Positional arguments that precede `input`. */
  args?: JsonValue[];
  idempotency_key?: string;
  responses: JsonObject[];
  expected_calls: ExpectedCall[];
  expected_result?: JsonValue;
  expected_error?: {
    kind: "api_error" | "value_error";
    code?: string;
    message_contains?: string;
  };
}

const CASES_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "conformance",
  "client-cases.json",
);
const NO_BODY_METHODS = new Set([
  "get_backtest",
  "get_brokerage",
  "get_custom_indicator",
  "get_optimization",
  "get_walk_forward",
  // NL screens carry no idempotency key: submit is cheap to repeat and the job
  // id is the dedupe handle, so a retry costs a poll rather than a run.
  "create_nl_screen",
  "get_nl_screen",
  "cancel_nl_screen",
]);
// Methods that take no positional argument at all; the fixture's `input` is null.
const NO_ARG_METHODS = new Set(["list_brokerages"]);
// Pollers take a wait-options bag, not an idempotency key. Zero interval so
// the fixture pins the REQUEST SEQUENCE without spending its cadence in
// wall-clock time.
const WAIT_METHODS = new Set([
  "wait_for_backtest",
  "wait_for_optimization",
  "wait_for_walk_forward",
]);

function snakeToCamel(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
}

class RecordingTransport implements Transport {
  readonly calls: ExpectedCall[] = [];
  #responses: JsonObject[];

  constructor(responses: JsonObject[]) {
    this.#responses = [...responses];
  }

  async request(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<JsonObject> {
    this.calls.push({
      method,
      path,
      // The fixture spells "no body"/"no key" as null; the TS API uses
      // undefined. Normalize so both languages compare the same shape.
      body: options.body === undefined ? null : options.body,
      idempotency_key: options.idempotencyKey ?? null,
    });
    const next = this.#responses.shift();
    if (!next) throw new Error(`no scripted response for ${method} ${path}`);
    return next;
  }
}

function invoke(
  client: NexusTradeClient,
  testCase: ConformanceCase,
): Promise<JsonValue> {
  const name = snakeToCamel(testCase.method) as keyof NexusTradeClient;
  const method = client[name] as unknown;
  assert.equal(
    typeof method,
    "function",
    `client is missing ${String(name)} (fixture case "${testCase.name}")`,
  );
  const call = method as (...args: unknown[]) => Promise<JsonValue>;
  const leading = testCase.args ?? [];
  if (NO_ARG_METHODS.has(testCase.method)) {
    return call.call(client);
  }
  if (WAIT_METHODS.has(testCase.method)) {
    return call.call(client, ...leading, testCase.input, {
      pollIntervalSeconds: 0,
    });
  }
  if (NO_BODY_METHODS.has(testCase.method)) {
    return call.call(client, ...leading, testCase.input);
  }
  return call.call(client, ...leading, testCase.input, {
    idempotencyKey: testCase.idempotency_key,
  });
}

const fixture = JSON.parse(readFileSync(CASES_PATH, "utf8")) as {
  cases: ConformanceCase[];
};

describe("client conformance (shared fixture)", () => {
  assert.ok(fixture.cases.length > 0, "fixture has no cases");

  for (const testCase of fixture.cases) {
    it(testCase.name, async () => {
      const transport = new RecordingTransport(testCase.responses);
      const client = new NexusTradeClient({ transport });
      const expectedError = testCase.expected_error;

      if (!expectedError) {
        const result = await invoke(client, testCase);
        assert.deepEqual(result, testCase.expected_result);
      } else if (expectedError.kind === "api_error") {
        await assert.rejects(
          () => invoke(client, testCase),
          (error: unknown) => {
            assert.ok(error instanceof NexusTradeApiError);
            assert.equal(error.code, expectedError.code);
            return true;
          },
        );
      } else {
        await assert.rejects(
          () => invoke(client, testCase),
          (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.ok(!(error instanceof NexusTradeApiError));
            assert.match(
              error.message,
              new RegExp(expectedError.message_contains ?? ""),
            );
            return true;
          },
        );
      }

      assert.deepEqual(transport.calls, testCase.expected_calls);
    });
  }
});
