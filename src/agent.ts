/**
 * Agent runs as an async iterator.
 *
 * Every other NexusTrade job is fire-and-poll: submit, wait, read a terminal
 * result. Agents are not, because three of their states —
 * `pending_plan_approval`, `pending_action_approval` and `awaiting_user_input`
 * — are ones the run cannot leave on its own. A caller that only polled would
 * start a run that stalls forever waiting for an approval nobody is present to
 * give, and bill for the wait.
 *
 * So the caller *is* the approver:
 *
 * ```ts
 * const run = await nt.createAgent("Find momentum names in the S&P 500", {
 *   idempotencyKey: "momentum-scan-v1",
 * });
 * for await (const event of run) {
 *   console.log(event.text);
 *   if (event.needsApproval) await run.approve();
 * }
 * ```
 *
 * Mirrors `agent.py`. See designs/2026-07-26-sdk-agent-runs.md.
 */

import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_POLL_TIMEOUT_SECONDS,
  MAX_POLL_INTERVAL_SECONDS,
  NO_HTTP_STATUS,
  NexusTradeApiError,
  POLL_BACKOFF_FACTOR,
  type JsonObject,
  type Transport,
} from "./client.ts";

const DEFAULT_EVENT_LIMIT = 50;

export interface AgentEvent {
  id: string;
  digest: string;
  role: string;
  text: string;
  data?: unknown;
  /** The run is blocked until `approve()` or `reject()` is called. */
  needsApproval: boolean;
  /** "plan" or "action" when `needsApproval`; otherwise null. */
  approvalKind: string | null;
  /** The run is blocked until `say(...)` is called. */
  needsInput: boolean;
  /** This event replaces an earlier one with the same `id`. */
  supersedes: boolean;
}

export interface AgentRunOptions {
  timeoutSeconds?: number;
  pollIntervalSeconds?: number;
  maxPollIntervalSeconds?: number;
  eventLimit?: number;
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/** A live agent run. Iterate it; answer it when it asks. */
export class AgentRun {
  readonly id: string;
  status: string;
  terminal = false;
  /** Every event yielded so far, in order. */
  readonly events: AgentEvent[] = [];

  /**
   * Pacing, public and mutable to mirror the Python dataclass fields. Tests
   * collapse the backoff through these; callers can widen the timeout on a run
   * they expect to sit blocked for a while.
   */
  timeoutSeconds: number;
  pollIntervalSeconds: number;
  maxPollIntervalSeconds: number;
  eventLimit: number;

  readonly #transport: Transport;
  #cursor: string | null = null;
  readonly #seen = new Map<string, string>();

  constructor(
    id: string,
    transport: Transport,
    status = "initializing",
    options: AgentRunOptions = {},
  ) {
    this.id = id;
    this.status = status;
    this.#transport = transport;
    this.timeoutSeconds =
      options.timeoutSeconds ?? DEFAULT_POLL_TIMEOUT_SECONDS;
    this.pollIntervalSeconds =
      options.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
    this.maxPollIntervalSeconds =
      options.maxPollIntervalSeconds ?? MAX_POLL_INTERVAL_SECONDS;
    this.eventLimit = options.eventLimit ?? DEFAULT_EVENT_LIMIT;
  }

  /** Resume a run already in flight from a known cursor. */
  setCursor(cursor: string | null): void {
    this.#cursor = cursor;
  }

  /**
   * Yield events until the run is terminal.
   *
   * Waits between polls on the same deterministic backoff the operation waiter
   * uses. When the run reaches a state only the caller can clear, the blocking
   * event is yielded and iteration then waits for the state to move — the
   * caller is expected to answer from inside the loop body.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<AgentEvent> {
    let interval = Math.min(
      this.pollIntervalSeconds,
      this.maxPollIntervalSeconds,
    );
    let deadline = Date.now() + this.timeoutSeconds * 1000;
    let blockedStatus: string | null = null;

    for (;;) {
      const page = await this.#fetch();
      const fresh = this.#absorb(page);
      for (const event of fresh) yield event;

      if (this.terminal) return;

      if (fresh.length > 0) {
        // Progress resets both the backoff and the stall deadline: a run that is
        // still talking is not stuck, however long it runs.
        interval = Math.min(
          this.pollIntervalSeconds,
          this.maxPollIntervalSeconds,
        );
        deadline = Date.now() + this.timeoutSeconds * 1000;
      }

      const waitingOnCaller =
        Boolean(page.pendingApproval) || Boolean(page.needsInput);
      if (waitingOnCaller) {
        if (blockedStatus === null) {
          blockedStatus = this.status;
        } else if (this.status !== blockedStatus) {
          // The caller answered; resume at full speed.
          blockedStatus = null;
          interval = Math.min(
            this.pollIntervalSeconds,
            this.maxPollIntervalSeconds,
          );
          deadline = Date.now() + this.timeoutSeconds * 1000;
        }
      } else {
        blockedStatus = null;
      }

      const remaining = (deadline - Date.now()) / 1000;
      if (remaining <= 0) {
        throw new NexusTradeApiError(
          NO_HTTP_STATUS,
          waitingOnCaller ? "agent_awaiting_input" : "agent_timeout",
          `Agent ${this.id} was still '${this.status}' after ` +
            `${this.timeoutSeconds}s. It is still running — answer ` +
            "it, or attach again with the same id.",
        );
      }
      if (interval > 0) await sleep(Math.min(interval, remaining));
      interval = Math.min(
        interval * POLL_BACKOFF_FACTOR,
        this.maxPollIntervalSeconds,
      );
    }
  }

  async #fetch(): Promise<JsonObject> {
    const query = new URLSearchParams({
      limit: String(this.eventLimit),
    });
    if (this.#cursor) query.set("cursor", this.#cursor);
    return this.#transport.request(
      "GET",
      `agents/${encodeURIComponent(this.id)}/events?${query.toString()}`,
    );
  }

  /**
   * Fold a page into run state, dropping anything already delivered.
   *
   * The server re-sends rather than risk skipping, so the same id can arrive
   * twice. Deduping here is what turns that guarantee into an exactly-once
   * stream for the caller.
   */
  #absorb(page: JsonObject): AgentEvent[] {
    if (typeof page.status === "string") this.status = page.status;
    this.terminal = Boolean(page.terminal);
    if (typeof page.nextCursor === "string" && page.nextCursor) {
      this.#cursor = page.nextCursor;
    }

    const approval = page.pendingApproval;
    const approvalKind =
      approval && typeof approval === "object" && !Array.isArray(approval)
        ? String((approval as JsonObject).kind ?? "")
        : null;
    const needsInput = Boolean(page.needsInput);

    const raw = page.events;
    if (!Array.isArray(raw)) return [];

    const fresh: AgentEvent[] = [];
    raw.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      const record = item as JsonObject;
      const id = String(record.id ?? "");
      const digest = String(record.digest ?? "");
      if (!id) return;
      const previous = this.#seen.get(id);
      if (previous === digest) return; // already delivered, unchanged
      this.#seen.set(id, digest);
      const isLast = index === raw.length - 1;
      const event: AgentEvent = {
        id,
        digest,
        role: String(record.role ?? "Assistant"),
        text: String(record.text ?? ""),
        data: record.data,
        // Only the final event of a page can be the one the run is blocked on —
        // the state applies to the tail, not the history.
        needsApproval: Boolean(approvalKind) && isLast,
        approvalKind: isLast && approvalKind ? approvalKind : null,
        needsInput: needsInput && isLast,
        supersedes: previous !== undefined,
      };
      fresh.push(event);
      this.events.push(event);
    });
    return fresh;
  }

  /** Approve a pending plan or action. Needs the `trade` scope. */
  approve(): Promise<string> {
    return this.#post("approve");
  }

  /** Reject a pending plan or action. */
  reject(): Promise<string> {
    return this.#post("reject");
  }

  /** Stop the run. */
  stop(): Promise<string> {
    return this.#post("stop");
  }

  /** Append a user message — a follow-up or a course correction. */
  say(content: string): Promise<string> {
    return this.#post("messages", { content });
  }

  async #post(action: string, body: JsonObject = {}): Promise<string> {
    const response = await this.#transport.request(
      "POST",
      `agents/${encodeURIComponent(this.id)}/${action}`,
      {
        body,
        idempotencyKey: `${this.id}:${action}:${this.events.length}`,
      },
    );
    const agent = response.agent;
    if (agent && typeof agent === "object" && !Array.isArray(agent)) {
      const status = (agent as JsonObject).status;
      if (typeof status === "string") this.status = status;
    }
    return this.status;
  }
}
