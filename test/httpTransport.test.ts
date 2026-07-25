/** Transport-level contracts: auth headers, URL shape, and failure mapping. */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { HttpTransport, NexusTradeApiError } from "../src/client.ts";

const BASE_URL = "https://gateway.example/api/v1";
const realFetch = globalThis.fetch;

interface RecordedFetch {
  url: string;
  init: RequestInit;
}

function stubFetch(
  handler: (call: RecordedFetch) => Response | Promise<Response>,
): RecordedFetch[] {
  const calls: RecordedFetch[] = [];
  globalThis.fetch = (async (
    input: string | URL | Request,
    init: RequestInit = {},
  ): Promise<Response> => {
    const call = { url: String(input), init };
    calls.push(call);
    return handler(call);
  }) as typeof globalThis.fetch;
  return calls;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("HttpTransport", () => {
  it("sends bearer and idempotency headers to the versioned path", async () => {
    const calls = stubFetch(() =>
      jsonResponse({ portfolio: { portfolioId: "p-1" } }),
    );
    const transport = new HttpTransport({
      apiKey: "sk-temp",
      baseUrl: BASE_URL,
    });

    const result = await transport.request("POST", "portfolios", {
      body: { name: "Book" },
      idempotencyKey: "book-v1",
    });

    assert.deepEqual(result.portfolio, { portfolioId: "p-1" });
    assert.equal(
      calls[0].url,
      "https://gateway.example/api/v1/nexustrade/portfolios",
    );
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer sk-temp");
    assert.equal(headers["Idempotency-Key"], "book-v1");
    assert.equal(headers["Content-Type"], "application/json");
  });

  it("rejects malformed credentials and base URLs", () => {
    for (const apiKey of ["", "sk-token\nInjected: value", "sk token"]) {
      assert.throws(
        () => new HttpTransport({ apiKey, baseUrl: BASE_URL }),
        /apiKey/,
        `expected rejection for ${JSON.stringify(apiKey)}`,
      );
    }
    for (const baseUrl of [
      "https://user:pass@gateway.example/api/v1",
      "https://gateway.example/api/v1?tenant=other",
      "https://gateway.example/api/v1#fragment",
      "not-a-url",
    ]) {
      assert.throws(
        () => new HttpTransport({ apiKey: "sk-temp", baseUrl }),
        /baseUrl/,
        `expected rejection for ${baseUrl}`,
      );
    }
  });

  it("requires HTTPS except on loopback", () => {
    assert.throws(
      () =>
        new HttpTransport({
          apiKey: "sk-temp",
          baseUrl: "http://gateway.example/api/v1",
        }),
      /HTTPS/,
    );
    assert.doesNotThrow(
      () =>
        new HttpTransport({
          apiKey: "sk-temp",
          baseUrl: "http://127.0.0.1:3000/api/v1",
        }),
    );
  });

  it("maps socket failures to a stable transport error", async () => {
    stubFetch(() => {
      throw new Error("timed out");
    });

    await assert.rejects(
      () =>
        new HttpTransport({ apiKey: "sk-temp", baseUrl: BASE_URL }).request(
          "GET",
          "backtests/bt-1",
        ),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.status, 0);
        assert.equal(error.code, "transport_error");
        return true;
      },
    );
  });

  it("maps HTTP errors to a stable API error", async () => {
    stubFetch(() =>
      jsonResponse(
        { error: { code: "insufficient_scope", message: "write required" } },
        403,
      ),
    );

    await assert.rejects(
      () =>
        new HttpTransport({ apiKey: "sk-temp", baseUrl: BASE_URL }).request(
          "GET",
          "backtests/bt-1",
        ),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.status, 403);
        assert.equal(error.code, "insufficient_scope");
        assert.match(error.message, /write required/);
        return true;
      },
    );
  });

  it("rejects invalid success JSON", async () => {
    stubFetch(() => new Response("not-json", { status: 200 }));

    await assert.rejects(
      () =>
        new HttpTransport({ apiKey: "sk-temp", baseUrl: BASE_URL }).request(
          "GET",
          "backtests/bt-1",
        ),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "invalid_response");
        return true;
      },
    );
  });

  it("rejects a non-object JSON response", async () => {
    stubFetch(() => jsonResponse([1, 2, 3]));

    await assert.rejects(
      () =>
        new HttpTransport({ apiKey: "sk-temp", baseUrl: BASE_URL }).request(
          "GET",
          "backtests/bt-1",
        ),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "invalid_response");
        return true;
      },
    );
  });

  it("refuses cross-origin redirects and follows same-origin ones", async () => {
    stubFetch(() =>
      new Response(null, {
        status: 302,
        headers: { location: "https://attacker.example/collect" },
      }),
    );
    await assert.rejects(
      () =>
        new HttpTransport({ apiKey: "sk-temp", baseUrl: BASE_URL }).request(
          "GET",
          "portfolios",
        ),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "unsafe_redirect");
        return true;
      },
    );

    let hop = 0;
    const calls = stubFetch(() => {
      hop += 1;
      if (hop === 1) {
        return new Response(null, {
          status: 307,
          headers: { location: "https://gateway.example/api/v1/moved" },
        });
      }
      return jsonResponse({ operation: { id: "bt-1" } });
    });
    const result = await new HttpTransport({
      apiKey: "sk-temp",
      baseUrl: BASE_URL,
    }).request("GET", "backtests/bt-1");
    assert.deepEqual(result.operation, { id: "bt-1" });
    assert.equal(calls.length, 2);
  });

  it("refuses to follow a same-origin redirect on a mutation", async () => {
    // Re-POSTing would double-submit a paid job; Python's urllib would instead
    // downgrade it to a bodyless GET. Neither SDK follows it.
    const calls = stubFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://gateway.example/api/v1/moved" },
        }),
    );

    await assert.rejects(
      () =>
        new HttpTransport({ apiKey: "sk-temp", baseUrl: BASE_URL }).request(
          "POST",
          "backtests/batch",
          { body: { backtests: [] }, idempotencyKey: "run-1" },
        ),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "unsafe_redirect");
        assert.match(error.message, /POST/);
        return true;
      },
    );
    assert.equal(calls.length, 1);
  });

  it("refuses a response larger than the SDK size limit", async () => {
    stubFetch(
      () => new Response("x".repeat(16 * 1024 * 1024 + 1), { status: 200 }),
    );

    await assert.rejects(
      () =>
        new HttpTransport({ apiKey: "sk-temp", baseUrl: BASE_URL }).request(
          "GET",
          "backtests/bt-1",
        ),
      (error: unknown) => {
        assert.ok(error instanceof NexusTradeApiError);
        assert.equal(error.code, "response_too_large");
        return true;
      },
    );
  });

  it("does not leak the API key when the transport is stringified", () => {
    const transport = new HttpTransport({
      apiKey: "sk-temp",
      baseUrl: BASE_URL,
    });
    assert.ok(!JSON.stringify(transport).includes("sk-temp"));
  });
});
