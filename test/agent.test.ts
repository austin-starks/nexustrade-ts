/** Agent-run iteration contract. Mirrored by tests/test_agent.py. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NexusTradeApiError,
  NexusTradeClient,
  type JsonObject,
  type RequestOptions,
  type Transport,
} from "../src/client.ts";

interface Call {
  method: string;
  path: string;
  body: JsonObject | undefined;
}

/** Replays a fixed sequence of /events pages and records mutations. */
class ScriptedTransport implements Transport {
  calls: Call[] = [];
  #pages: JsonObject[];
  #sticky: boolean;
  #last: JsonObject | null = null;

  constructor(pages: JsonObject[], sticky = false) {
    this.#pages = pages;
    // `sticky` keeps replaying the final page instead of ending the run — how a
    // genuinely stalled agent behaves.
    this.#sticky = sticky;
  }

  async request(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<JsonObject> {
    this.calls.push({ method, path, body: options?.body });
    if (path === "agents") {
      return { agent: { id: "agent-1", status: "initializing" } };
    }
    // The real client appends a query string, so match on the segment.
    if (path.includes("/events")) {
      if (this.#pages.length > 0) this.#last = this.#pages.shift()!;
      else if (!this.#sticky) this.#last = page([], { terminal: true });
      return this.#last ?? page([], { terminal: true });
    }
    if (path === "agents/agent-1") {
      return { agent: { id: "agent-1", status: "running" } };
    }
    return { agent: { id: "agent-1", status: "action_approved" } };
  }
}

function event(id: string, text: string, digest = "d1"): JsonObject {
  return { id, digest, role: "Assistant", text };
}

function page(
  events: JsonObject[],
  options: {
    terminal?: boolean;
    pending?: string;
    needsInput?: boolean;
  } = {},
): JsonObject {
  const built: JsonObject = {
    events,
    nextCursor: "c1",
    hasMore: false,
    supersededFirst: false,
    status: options.terminal ? "completed" : "running",
    needsInput: Boolean(options.needsInput),
    terminal: Boolean(options.terminal),
  };
  if (options.pending) built.pendingApproval = { kind: options.pending };
  return built;
}

function client(
  pages: JsonObject[],
  sticky = false,
): { nt: NexusTradeClient; transport: ScriptedTransport } {
  const transport = new ScriptedTransport(pages, sticky);
  return { nt: new NexusTradeClient({ transport }), transport };
}

/** Collapse the backoff so tests do not actually sleep seconds. */
function fast<T extends { pollIntervalSeconds: number; maxPollIntervalSeconds: number; timeoutSeconds: number }>(
  run: T,
  timeoutSeconds = 30,
): T {
  run.pollIntervalSeconds = 0;
  run.maxPollIntervalSeconds = 0;
  run.timeoutSeconds = timeoutSeconds;
  return run;
}

describe("agent run iteration", () => {
  it("yields events until terminal", async () => {
    const { nt } = client([
      page([event("a", "first")]),
      page([event("b", "second")], { terminal: true }),
    ]);
    const run = await nt.createAgent("do a thing", { idempotencyKey: "k1" });
    const texts: string[] = [];
    for await (const e of fast(run)) texts.push(e.text);

    assert.deepEqual(texts, ["first", "second"]);
    assert.equal(run.terminal, true);
    assert.equal(run.status, "completed");
    assert.equal(run.events.length, 2);
  });

  it("does not redeliver an unchanged event", async () => {
    // The server re-sends rather than risk skipping, so the same id arrives
    // twice. The caller must see it once.
    const { nt } = client([
      page([event("a", "first")]),
      page([event("a", "first"), event("b", "second")]),
      page([], { terminal: true }),
    ]);
    const run = await nt.createAgent("x", { idempotencyKey: "k" });
    const texts: string[] = [];
    for await (const e of fast(run)) texts.push(e.text);

    assert.deepEqual(texts, ["first", "second"]);
  });

  it("redelivers an edited event as superseding", async () => {
    // Same id, new digest: the message was rewritten in place and the caller
    // must see the final text.
    const { nt } = client([
      page([event("a", "partial", "d1")]),
      page([event("a", "final", "d2")]),
      page([], { terminal: true }),
    ]);
    const run = await nt.createAgent("x", { idempotencyKey: "k" });
    const seen = [];
    for await (const e of fast(run)) seen.push(e);

    assert.deepEqual(seen.map((e) => e.text), ["partial", "final"]);
    assert.equal(seen[0].supersedes, false);
    assert.equal(seen[1].supersedes, true);
  });

  it("flags a pending approval on the tail event only", async () => {
    const { nt, transport } = client([
      page([event("a", "history"), event("b", "buy 100 SPY")], {
        pending: "action",
      }),
      page([event("c", "done")], { terminal: true }),
    ]);
    const run = await nt.createAgent("x", { idempotencyKey: "k" });
    const seen: string[] = [];
    for await (const e of fast(run)) {
      seen.push(e.text);
      if (e.needsApproval) {
        assert.equal(e.approvalKind, "action");
        await run.approve();
      }
    }

    assert.deepEqual(seen, ["history", "buy 100 SPY", "done"]);
    assert.equal(run.events[0].needsApproval, false);
    assert.equal(run.events[1].needsApproval, true);
    // The approval must have been POSTed, not just observed.
    assert.ok(
      transport.calls.some(
        (c) => c.method === "POST" && c.path === "agents/agent-1/approve",
      ),
    );
  });

  it("surfaces needsInput and sends a reply", async () => {
    const { nt, transport } = client([
      page([event("a", "which sector?")], { needsInput: true }),
      page([], { terminal: true }),
    ]);
    const run = await nt.createAgent("x", { idempotencyKey: "k" });
    for await (const e of fast(run)) {
      if (e.needsInput) await run.say("semis");
    }

    const sent = transport.calls.find(
      (c) => c.path === "agents/agent-1/messages",
    );
    assert.deepEqual(sent?.body, { content: "semis" });
  });

  it("raises rather than spinning on a stalled run", async () => {
    // A caller that ignores an approval must not loop forever in silence.
    const { nt } = client(
      [page([event("a", "approve me")], { pending: "action" })],
      true,
    );
    const run = await nt.createAgent("x", { idempotencyKey: "k" });
    await assert.rejects(
      async () => {
        for await (const _ of fast(run, 0.05)) {
          // deliberately never answering
        }
      },
      (error: unknown) =>
        error instanceof NexusTradeApiError &&
        error.code === "agent_awaiting_input",
    );
  });

  it("attach resumes from a cursor", async () => {
    const { nt, transport } = client([
      page([event("z", "resumed")], { terminal: true }),
    ]);
    const run = await nt.attachAgent("agent-1", { cursor: "opaque-cursor" });
    const texts: string[] = [];
    for await (const e of fast(run)) texts.push(e.text);

    assert.deepEqual(texts, ["resumed"]);
    const call = transport.calls.find((c) => c.path.includes("/events"));
    assert.ok(call?.path.includes("cursor=opaque-cursor"));
  });
});
