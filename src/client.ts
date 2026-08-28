/**
 * Typed NexusTrade JSON API client.
 *
 * Method names and behavior match the Python SDK. Transport-generic: callers
 * pass an API key/base URL, or set NEXUSTRADE_API_KEY / NEXUSTRADE_API_BASE_URL.
 */

import { AgentRun } from "./agent.ts";
import { LazyDotenv, environmentValue } from "./env.ts";
import type { JobRequest, Portfolio } from "./generated/ntSdk.generated.js";
import {
  PortfolioHandle,
  type DeployResult,
  type PortfolioListResult,
  portfolioHandleFromWire,
} from "./portfolio.ts";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/**
 * What a request body may be: the output of a generated builder, or a
 * hand-written JSON literal.
 *
 * The builder types are `interface`s, and TypeScript does not give an interface
 * the implicit index signature `JsonObject` requires — so a parameter typed
 * `JsonObject` rejects `portfolio(...)` and `backtest(...)`, which is every
 * documented entry point into this SDK. Naming both sides here keeps the
 * signature self-describing instead of widening to bare `object`.
 */
export type PortfolioInput = Portfolio | JsonObject;
export type JobInput = JobRequest | JsonObject;

/** Boundary adapter: builder output is JSON by construction. */
function asJsonObject(value: PortfolioInput | JobInput): JsonObject {
  // PortfolioHandle.toJSON() omits `id`; a bare cast would leak it.
  if (value && typeof value === "object" && "toJSON" in value) {
    const candidate = value as { toJSON?: unknown };
    if (typeof candidate.toJSON === "function") {
      return (candidate.toJSON as () => JsonObject)();
    }
  }
  return value as JsonObject;
}

export interface ListPortfoliosOptions {
  portfolioIds?: string[];
  includeInactive?: boolean;
  includePaper?: boolean;
  includeLive?: boolean;
  includeChatPortfolios?: boolean;
  includePositions?: boolean;
  search?: string;
  limit?: number;
  page?: number;
}

function encodeQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_ERROR_BYTES = 64 * 1024;
// Keep in lockstep with _MAX_REDIRECTS in sdk/python/nexustrade/client.py —
// checkSdkClientParity.ts asserts the two numbers match.
const MAX_REDIRECTS = 5;
// `status` for errors no HTTP status describes: the request never reached the
// API, or it returned 2xx with an envelope the client could not use. Reporting
// a literal 200 there would misattribute a 201 response.
export const NO_HTTP_STATUS = 0;

// Polling defaults. Every NexusTrade job — backtest, optimization,
// walk-forward, and any future operation kind — reports through the same
// envelope, so one poller serves all of them. Kept in lockstep with the Python
// SDK by checkSdkClientParity.ts; the backoff is deterministic (no jitter) so
// both languages issue the identical request sequence.
export const DEFAULT_POLL_TIMEOUT_SECONDS = 900;
export const DEFAULT_POLL_INTERVAL_SECONDS = 2;
export const MAX_POLL_INTERVAL_SECONDS = 15;
export const POLL_BACKOFF_FACTOR = 1.5;
const TERMINAL_STATUSES = ["cancelled", "completed", "failed"];

// Connecting a brokerage is a human opening a browser. Long enough for that,
// short enough that a forgotten terminal does not hang all afternoon.
export const DEFAULT_CONNECT_TIMEOUT_SECONDS = 300;
export const CONNECT_POLL_INTERVAL_SECONDS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Whether a human is plausibly watching. Never throws on odd streams. */
function stdoutIsInteractive(): boolean {
  try {
    return process.stdout.isTTY === true;
  } catch {
    return false;
  }
}

// Point batches larger than this are uploaded rather than sent inline.
const MAX_INLINE_POINT_BYTES = 512 * 1024;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
// A presigned PUT crosses the open internet with no API-side retry behind it, so
// the client owns transient recovery. Jittered (unlike the poll backoff) because
// every client retrying a storage blip on the same schedule is the blip.
// checkSdkClientParity.ts asserts these match the Python SDK.
export const MAX_UPLOAD_PUT_ATTEMPTS = 5;
export const UPLOAD_PUT_INITIAL_BACKOFF_SECONDS = 0.5;
export const UPLOAD_PUT_MAX_BACKOFF_SECONDS = 8.0;
export const UPLOAD_PUT_JITTER_SECONDS = 0.25;
const POINT_FIELDS: Record<string, string> = {
  timestamp: "timestamp",
  value: "value",
  ticker: "ticker",
  assetType: "assetType",
  asset_type: "assetType",
  availableAt: "availableAt",
  available_at: "availableAt",
};

export class NexusTradeApiError extends Error {
  readonly status: number;
  readonly code: string;
  /**
   * Set for operation errors (timeout / failure). A timed-out job is still
   * running, so the caller needs the id to resume waiting without resubmitting
   * — reading it out of the message is not an interface.
   */
  readonly operationId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    operationId?: string
  ) {
    super(`${code}: ${message}`);
    this.name = "NexusTradeApiError";
    this.status = status;
    this.code = code;
    this.operationId = operationId;
  }
}

function isRetryableUploadHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Only a transport fault or a storage-side transient earns another PUT. */
function isRetryableUploadError(error: unknown): boolean {
  if (!(error instanceof NexusTradeApiError)) {
    return false;
  }
  if (error.code === "transport_error") {
    return true;
  }
  if (error.code === "upload_failed" && error.status !== NO_HTTP_STATUS) {
    return isRetryableUploadHttpStatus(error.status);
  }
  return false;
}

interface Origin {
  scheme: string;
  host: string;
  port: string;
}

function origin(url: string): Origin {
  const parsed = new URL(url);
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  return {
    scheme,
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || (scheme === "https" ? "443" : "80"),
  };
}

function sameOrigin(left: string, right: string): boolean {
  const a = origin(left);
  const b = origin(right);
  return a.scheme === b.scheme && a.host === b.host && a.port === b.port;
}

export interface RequestOptions {
  body?: JsonObject;
  idempotencyKey?: string;
}

export interface Transport {
  request(
    method: string,
    path: string,
    options?: RequestOptions
  ): Promise<JsonObject>;
}

/**
 * Transports that can also return raw bytes.
 *
 * Lake result parts are Parquet, so they do not fit `Transport`, which is a
 * JSON contract. Declaring the capability keeps custom and test transports able
 * to implement downloads through a typed interface instead of a duck-typed
 * check.
 */
export interface BinaryTransport extends Transport {
  requestBytes(
    method: string,
    path: string,
    options?: { byteRange?: [number, number]; maxBytes?: number }
  ): Promise<Uint8Array>;
}

function supportsBinary(transport: Transport): transport is BinaryTransport {
  return typeof (transport as BinaryTransport).requestBytes === "function";
}

/**
 * Transports that can PUT bytes to a presigned storage URL.
 *
 * The URL is absolute and the call carries no credential.
 */
export interface UploadTransport extends Transport {
  putBytes(
    url: string,
    data: Uint8Array<ArrayBuffer>,
    options: { contentType: string }
  ): Promise<void>;
}

function supportsUpload(transport: Transport): transport is UploadTransport {
  return typeof (transport as UploadTransport).putBytes === "function";
}

export interface HttpTransportOptions {
  apiKey: string;
  baseUrl: string;
  timeoutSeconds?: number;
}

function assertValidApiKey(apiKey: string): void {
  const invalid =
    typeof apiKey !== "string" ||
    apiKey.length === 0 ||
    [...apiKey].some(
      (character) =>
        /\s/.test(character) || (character.codePointAt(0) ?? 0) < 32
    );
  if (invalid) {
    throw new Error("NexusTrade apiKey must be a non-empty token.");
  }
}

function assertValidBaseUrl(baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("NexusTrade baseUrl must be an absolute URL.");
  }
  if (!parsed.protocol || !parsed.hostname) {
    throw new Error("NexusTrade baseUrl must be an absolute URL.");
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  const isLoopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
    parsed.hostname.toLowerCase()
  );
  if (scheme !== "https" && !(scheme === "http" && isLoopback)) {
    throw new Error(
      "NexusTrade baseUrl must use HTTPS (HTTP is allowed only for loopback development)."
    );
  }
  if (parsed.username || parsed.password) {
    throw new Error("NexusTrade baseUrl must not contain credentials.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("NexusTrade baseUrl must not contain a query or fragment.");
  }
}

/** Reads at most `limit` bytes, so an oversized body is never fully buffered. */
async function readCapped(
  response: Response,
  limit: number
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!response.body) {
    return { bytes: new Uint8Array(0), truncated: false };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      total += value.byteLength;
      if (total > limit) {
        return { bytes: new Uint8Array(0), truncated: true };
      }
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated: false };
}

function decodeJsonObject(bytes: Uint8Array, status: number): JsonObject {
  if (bytes.byteLength === 0) return {};
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new NexusTradeApiError(
      status,
      "invalid_response",
      "NexusTrade returned invalid JSON."
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new NexusTradeApiError(
      status,
      "invalid_response",
      "NexusTrade returned invalid JSON."
    );
  }
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    Array.isArray(decoded)
  ) {
    throw new NexusTradeApiError(
      status,
      "invalid_response",
      "NexusTrade returned a non-object JSON response."
    );
  }
  return decoded as JsonObject;
}

export class HttpTransport implements Transport, UploadTransport {
  // `#` fields, not TS `private` — the credential must be unreachable at
  // runtime too, matching the Python dataclass's `repr=False`.
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeoutSeconds: number;

  constructor(options: HttpTransportOptions) {
    const timeoutSeconds = options.timeoutSeconds ?? 30;
    assertValidApiKey(options.apiKey);
    assertValidBaseUrl(options.baseUrl);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      throw new Error("timeoutSeconds must be positive.");
    }
    this.#apiKey = options.apiKey;
    this.#baseUrl = options.baseUrl;
    this.#timeoutSeconds = timeoutSeconds;
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }

  /** PUT a payload to a presigned storage URL. Sends no credential. */
  async putBytes(
    url: string,
    data: Uint8Array<ArrayBuffer>,
    options: { contentType: string }
  ): Promise<void> {
    let delaySeconds = UPLOAD_PUT_INITIAL_BACKOFF_SECONDS;
    for (let attempt = 0; attempt < MAX_UPLOAD_PUT_ATTEMPTS; attempt++) {
      try {
        await this.#putBytesOnce(url, data, options);
        return;
      } catch (error) {
        if (
          attempt >= MAX_UPLOAD_PUT_ATTEMPTS - 1 ||
          !isRetryableUploadError(error)
        ) {
          throw error;
        }
      }
      delaySeconds = Math.min(delaySeconds * 2, UPLOAD_PUT_MAX_BACKOFF_SECONDS);
      await sleep(
        (delaySeconds + Math.random() * UPLOAD_PUT_JITTER_SECONDS) * 1000
      );
    }
  }

  async #putBytesOnce(
    url: string,
    data: Uint8Array<ArrayBuffer>,
    options: { contentType: string }
  ): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "unsafe_upload_url",
        "NexusTrade refused a malformed upload URL."
      );
    }
    if (parsed.protocol.toLowerCase() !== "https:") {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "unsafe_upload_url",
        "NexusTrade refused a non-HTTPS upload URL."
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.#timeoutSeconds * 1000
    );
    try {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": options.contentType },
          body: new Blob([data], { type: options.contentType }),
          redirect: "manual",
          signal: controller.signal,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new NexusTradeApiError(NO_HTTP_STATUS, "transport_error", reason);
      }
      if (!response.ok) {
        throw new NexusTradeApiError(
          response.status,
          "upload_failed",
          `Storage rejected the upload: ${
            response.statusText || `HTTP ${response.status}`
          }.`
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async request(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<JsonObject> {
    const url = `${this.#baseUrl.replace(/\/+$/, "")}/nexustrade/${path.replace(
      /^\/+/,
      ""
    )}`;
    const payload =
      options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#apiKey}`,
      Accept: "application/json",
    };
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    if (options.idempotencyKey !== undefined) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.#timeoutSeconds * 1000
    );
    try {
      let currentUrl = url;
      for (let hop = 0; ; hop += 1) {
        let response: Response;
        try {
          response = await fetch(currentUrl, {
            method,
            headers,
            body: payload,
            redirect: "manual",
            signal: controller.signal,
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new NexusTradeApiError(
            NO_HTTP_STATUS,
            "transport_error",
            reason
          );
        }

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) {
            throw new NexusTradeApiError(
              response.status,
              "invalid_response",
              "NexusTrade returned a redirect without a location."
            );
          }
          const next = new URL(location, currentUrl).toString();
          if (!sameOrigin(currentUrl, next)) {
            throw new NexusTradeApiError(
              response.status,
              "unsafe_redirect",
              "NexusTrade refused a cross-origin API redirect."
            );
          }
          // Never replay a mutation. Re-sending the body would double-submit a
          // paid job; dropping it (what urllib does) would send a meaningless
          // bodyless GET to a POST route. Both SDKs refuse instead.
          if (method.toUpperCase() !== "GET") {
            throw new NexusTradeApiError(
              response.status,
              "unsafe_redirect",
              `NexusTrade refused to follow a redirect on a ${method} request.`
            );
          }
          if (hop >= MAX_REDIRECTS) {
            throw new NexusTradeApiError(
              response.status,
              "transport_error",
              "NexusTrade exceeded the SDK redirect limit."
            );
          }
          currentUrl = next;
          continue;
        }

        if (!response.ok) {
          const { bytes } = await readCapped(response, MAX_ERROR_BYTES);
          let code = "api_error";
          let message = response.statusText || `HTTP ${response.status}`;
          try {
            const decoded = decodeJsonObject(bytes, response.status);
            const errorBody = decoded.error;
            if (
              typeof errorBody === "object" &&
              errorBody !== null &&
              !Array.isArray(errorBody)
            ) {
              const body = errorBody as JsonObject;
              if (body.code) code = String(body.code);
              if (body.message) message = String(body.message);
            }
          } catch {
            // Non-JSON error bodies keep the transport-level code/message.
          }
          throw new NexusTradeApiError(response.status, code, message);
        }

        const { bytes, truncated } = await readCapped(
          response,
          MAX_RESPONSE_BYTES
        );
        if (truncated) {
          throw new NexusTradeApiError(
            response.status,
            "response_too_large",
            "NexusTrade response exceeded the SDK size limit."
          );
        }
        return decodeJsonObject(bytes, response.status);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface NexusTradeClientOptions {
  apiKey?: string;
  baseUrl?: string;
  transport?: Transport;
}

const BACKTEST_ARG_NAMES: ReadonlyArray<readonly [string, string]> = [
  ["start_date", "startDate"],
  ["end_date", "endDate"],
  ["baseline_symbol", "baseline"],
  ["interval", "interval"],
  ["initial_value", "initialValue"],
  ["generate_events", "generateEvents"],
  ["fee_config", "feeConfig"],
];

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Match Python's `urllib.parse.quote(value, safe="")`, which escapes `!'()*`
 * where `encodeURIComponent` leaves them literal. Both decode identically, but
 * the two SDKs must put the same bytes on the wire — see the shared
 * conformance fixture.
 */
function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
  );
}

export interface WaitOptions {
  timeoutSeconds?: number;
  pollIntervalSeconds?: number;
  maxPollIntervalSeconds?: number;
  raiseOnFailure?: boolean;
}

function operationFailure(
  operation: JsonObject,
  operationId: string,
  status: string
): NexusTradeApiError {
  let code =
    status === "cancelled" ? "operation_cancelled" : "operation_failed";
  let message = `Operation ${operationId} ${status}.`;
  const error = operation.error;
  if (isJsonObject(error)) {
    if (error.code) code = String(error.code);
    if (error.message) message = String(error.message);
  }
  return new NexusTradeApiError(NO_HTTP_STATUS, code, message, operationId);
}

/**
 * Poll `fetch(operationId)` until the operation reaches a terminal state.
 *
 * Works for any operation kind because every NexusTrade job reports the same
 * `{id, kind, status, result?, error?}` envelope. Pass any getter with that
 * shape — `client.getBacktest`, `getOptimization`, `getWalkForward`.
 *
 * Resolves with the terminal operation. Rejects with `NexusTradeApiError` on
 * timeout, and on a failed/cancelled operation unless `raiseOnFailure` is
 * false. Transport errors from `fetch` propagate — a poller that swallowed
 * them would report an infrastructure outage as a still-running job.
 */
export interface CustomIndicatorPointInput {
  timestamp: string | Date;
  value: number;
  ticker?: string;
  assetType?: string;
  availableAt?: string | Date;
  [field: string]: unknown;
}

export interface CustomIndicatorInput {
  name: string;
  description?: string;
  scope?: "global" | "asset";
  pointKind?: "observation" | "period_aggregate" | "disclosed";
  aggregatePeriod?: "1d" | "1w" | "1mo" | "1q";
  points?: ReadonlyArray<CustomIndicatorPointInput>;
}

function pointTimestamp(value: unknown): JsonValue {
  return value instanceof Date ? value.toISOString() : (value as JsonValue);
}

/**
 * Normalize one point to its wire shape.
 *
 * Accepts snake_case or camelCase field names and Date objects. Throws on an
 * unrecognized field rather than dropping it silently.
 */
function customIndicatorPoint(point: CustomIndicatorPointInput): JsonObject {
  const normalized: JsonObject = {};
  for (const [key, value] of Object.entries(point)) {
    const target = POINT_FIELDS[key];
    if (target === undefined) {
      throw new Error(
        `Unknown custom indicator point field "${key}". Points accept ` +
          "timestamp, value, ticker, assetType, and availableAt."
      );
    }
    if (value === undefined || value === null) continue;
    normalized[target] =
      target === "timestamp" || target === "availableAt"
        ? pointTimestamp(value)
        : (value as JsonValue);
  }
  if (normalized.timestamp === undefined) {
    throw new Error("Every custom indicator point needs a timestamp.");
  }
  if (normalized.value === undefined) {
    throw new Error("Every custom indicator point needs a value.");
  }
  return normalized;
}

function customIndicatorPoints(
  points: ReadonlyArray<CustomIndicatorPointInput>
): JsonObject[] {
  if (!Array.isArray(points)) {
    throw new Error("points must be an array of point objects.");
  }
  return points.map(customIndicatorPoint);
}

type IndicatorPointKind = NonNullable<CustomIndicatorInput["pointKind"]>;
type IndicatorAggregatePeriod = NonNullable<
  CustomIndicatorInput["aggregatePeriod"]
>;

function dateOnly(value: JsonValue | undefined): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : parsed;
}

function utcMidnight(day: Date): string {
  return `${day.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function utcDateTime(value: JsonValue | undefined): Date | undefined {
  const day = dateOnly(value);
  if (day) return day;
  if (typeof value !== "string") return undefined;
  const hasExplicitZone =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(
      value
    );
  if (!hasExplicitZone) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function addUtcDays(day: Date, days: number): Date {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + days)
  );
}

function pointKindPoints(
  points: JsonObject[],
  pointKind?: IndicatorPointKind,
  aggregatePeriod?: IndicatorAggregatePeriod
): JsonObject[] {
  if (!pointKind) {
    if (aggregatePeriod) {
      throw new Error("aggregatePeriod requires pointKind period_aggregate.");
    }
    return points;
  }
  if (pointKind !== "period_aggregate" && aggregatePeriod) {
    throw new Error("aggregatePeriod is only valid for period_aggregate.");
  }
  if (pointKind === "period_aggregate" && !aggregatePeriod) {
    throw new Error("period_aggregate requires aggregatePeriod.");
  }

  return points.map((point, index) => {
    const row = { ...point };
    const eventDay = dateOnly(row.timestamp);
    const availableDay = dateOnly(row.availableAt);
    const eventTime = utcDateTime(row.timestamp);
    const availableTime = utcDateTime(row.availableAt);
    if (pointKind === "observation") {
      if (row.availableAt === undefined) {
        row.availableAt = eventDay ? utcMidnight(eventDay) : row.timestamp;
      } else if (eventDay && availableDay?.getTime() === eventDay.getTime()) {
        row.availableAt = utcMidnight(eventDay);
      } else if (availableDay) {
        row.availableAt = utcMidnight(addUtcDays(availableDay, 1));
      }
      if (
        eventTime &&
        availableTime &&
        availableTime.toISOString().slice(0, 10) >
          eventTime.toISOString().slice(0, 10)
      ) {
        throw new Error(
          `Point ${index + 1}: observation availableAt is after the event date.`
        );
      }
      return row;
    }
    if (pointKind === "disclosed") {
      if (row.availableAt === undefined) {
        throw new Error(
          `Point ${index + 1}: disclosed pointKind requires availableAt.`
        );
      }
      if (availableDay) {
        row.availableAt = utcMidnight(addUtcDays(availableDay, 1));
      }
      return row;
    }
    if (!eventTime) {
      throw new Error(
        `Point ${index + 1}: aggregate timestamp must be date-only or include an explicit UTC offset.`
      );
    }
    if (
      eventTime.getUTCHours() !== 0 ||
      eventTime.getUTCMinutes() !== 0 ||
      eventTime.getUTCSeconds() !== 0 ||
      eventTime.getUTCMilliseconds() !== 0
    ) {
      throw new Error(
        `Point ${index + 1}: aggregate timestamp must be UTC midnight.`
      );
    }

    let periodEnd: Date;
    if (aggregatePeriod === "1d") {
      periodEnd = addUtcDays(eventTime, 1);
    } else if (aggregatePeriod === "1w") {
      if (eventTime.getUTCDay() !== 1) {
        throw new Error(`Point ${index + 1}: 1w timestamp must be a Monday.`);
      }
      periodEnd = addUtcDays(eventTime, 7);
    } else if (aggregatePeriod === "1mo") {
      if (eventTime.getUTCDate() !== 1) {
        throw new Error(`Point ${index + 1}: 1mo timestamp must be month start.`);
      }
      periodEnd = new Date(
        Date.UTC(eventTime.getUTCFullYear(), eventTime.getUTCMonth() + 1, 1)
      );
    } else {
      if (
        eventTime.getUTCDate() !== 1 ||
        ![0, 3, 6, 9].includes(eventTime.getUTCMonth())
      ) {
        throw new Error(`Point ${index + 1}: 1q timestamp must be quarter start.`);
      }
      periodEnd = new Date(
        Date.UTC(eventTime.getUTCFullYear(), eventTime.getUTCMonth() + 3, 1)
      );
    }
    const derived = utcMidnight(periodEnd);
    if (row.availableAt === undefined) {
      row.availableAt = derived;
    } else if (availableDay) {
      const explicit = utcMidnight(addUtcDays(availableDay, 1));
      if (explicit < derived) {
        throw new Error(
          `Point ${index + 1}: availableAt precedes the aggregate close.`
        );
      }
      row.availableAt = explicit;
    } else if (availableTime && availableTime.getTime() < periodEnd.getTime()) {
      throw new Error(
        `Point ${index + 1}: availableAt precedes the aggregate close.`
      );
    }
    return row;
  });
}

function pointsJsonl(
  points: ReadonlyArray<JsonObject>
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    points.map((point) => `${JSON.stringify(point)}\n`).join("")
  );
}

function inlinePointBytes(points: ReadonlyArray<JsonObject>): number {
  return new TextEncoder().encode(JSON.stringify(points)).length;
}

export async function waitForOperation(
  fetch: (operationId: string) => Promise<JsonObject>,
  operationId: string,
  options: WaitOptions = {}
): Promise<JsonObject> {
  const timeoutSeconds = options.timeoutSeconds ?? DEFAULT_POLL_TIMEOUT_SECONDS;
  const pollIntervalSeconds =
    options.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
  const maxPollIntervalSeconds =
    options.maxPollIntervalSeconds ?? MAX_POLL_INTERVAL_SECONDS;
  const raiseOnFailure = options.raiseOnFailure ?? true;

  if (!(timeoutSeconds > 0)) {
    throw new Error("timeoutSeconds must be positive.");
  }
  if (pollIntervalSeconds < 0 || maxPollIntervalSeconds < 0) {
    throw new Error("poll intervals must not be negative.");
  }

  const deadline = Date.now() + timeoutSeconds * 1000;
  let interval = Math.min(pollIntervalSeconds, maxPollIntervalSeconds);
  for (;;) {
    const operation = await fetch(operationId);
    const status = String(operation.status ?? "");
    if (TERMINAL_STATUSES.includes(status)) {
      if (raiseOnFailure && status !== "completed") {
        throw operationFailure(operation, operationId, status);
      }
      return operation;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "operation_timeout",
        `Operation ${operationId} was still '${status || "unknown"}' after ` +
          `${timeoutSeconds}s. It is still running — poll again with the ` +
          "same id (error.operationId) rather than resubmitting.",
        operationId
      );
    }
    if (interval > 0) {
      const delayMs = Math.min(interval * 1000, remainingMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    interval = Math.min(interval * POLL_BACKOFF_FACTOR, maxPollIntervalSeconds);
  }
}

export class NexusTradeClient {
  private readonly transport: Transport;

  constructor(options: NexusTradeClientOptions = {}) {
    if (options.transport) {
      this.transport = options.transport;
      return;
    }
    // Lazy and memoized: the tree is walked at most once, and not at all when
    // the environment already answers — which is always true inside
    // run_compute, where the platform injects both variables.
    const dotenv = new LazyDotenv();
    const apiKey =
      options.apiKey ?? environmentValue("NEXUSTRADE_API_KEY", dotenv);
    const baseUrl =
      options.baseUrl ?? environmentValue("NEXUSTRADE_API_BASE_URL", dotenv);
    if (!apiKey || !baseUrl) {
      throw new Error(
        "NexusTradeClient requires an API key. Create one at " +
          "https://nexustrade.io/developers, then either pass apiKey/baseUrl " +
          "or set NEXUSTRADE_API_KEY and NEXUSTRADE_API_BASE_URL " +
          "(base URL is https://nexustrade.io/api/v1). " +
          "Both are also read from a .env file at or above the current " +
          "directory; the real environment takes precedence. " +
          "OAuth tokens are not accepted by this API."
      );
    }
    this.transport = new HttpTransport({ apiKey, baseUrl });
  }

  static fromEnvironment(): NexusTradeClient {
    return new NexusTradeClient();
  }

  async createPortfolio(
    portfolio: PortfolioInput,
    options: { idempotencyKey: string }
  ): Promise<JsonObject> {
    const response = await this.transport.request("POST", "portfolios", {
      body: asJsonObject(portfolio),
      idempotencyKey: options.idempotencyKey,
    });
    const result = response.portfolio;
    if (!isJsonObject(result)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Portfolio response is missing portfolio."
      );
    }
    return result;
  }

  /**
   * List portfolios with optional filters and pagination.
   * `includePositions` defaults off when `search` is set.
   */
  async listPortfolios(
    options: ListPortfoliosOptions = {}
  ): Promise<PortfolioListResult> {
    const query = encodeQuery({
      portfolioIds: options.portfolioIds?.join(","),
      includeInactive:
        options.includeInactive === undefined
          ? undefined
          : String(options.includeInactive),
      includePaper:
        options.includePaper === undefined
          ? undefined
          : String(options.includePaper),
      includeLive:
        options.includeLive === undefined
          ? undefined
          : String(options.includeLive),
      includeChatPortfolios:
        options.includeChatPortfolios === undefined
          ? undefined
          : String(options.includeChatPortfolios),
      includePositions:
        options.includePositions === undefined
          ? undefined
          : String(options.includePositions),
      search: options.search,
      limit: options.limit === undefined ? undefined : String(options.limit),
      page: options.page === undefined ? undefined : String(options.page),
    });
    const response = await this.transport.request("GET", `portfolios${query}`);
    const rows = response.portfolios;
    if (!Array.isArray(rows)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Portfolio list response is missing portfolios."
      );
    }
    return {
      portfolios: rows.map((row) =>
        portfolioHandleFromWire(row, { transport: this.transport })
      ),
      page: typeof response.page === "number" ? response.page : 1,
      limit: typeof response.limit === "number" ? response.limit : 20,
      total: typeof response.total === "number" ? response.total : rows.length,
      totalPages:
        typeof response.totalPages === "number" ? response.totalPages : 1,
      scopes: isJsonObject(response.scopes) ? response.scopes : undefined,
    };
  }

  async getPortfolio(portfolioId: string): Promise<PortfolioHandle> {
    const response = await this.transport.request(
      "GET",
      `portfolios/${encodePathSegment(portfolioId)}`
    );
    const portfolio = response.portfolio;
    if (!isJsonObject(portfolio)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Portfolio response is missing portfolio."
      );
    }
    return portfolioHandleFromWire(portfolio, {
      transport: this.transport,
    });
  }

  /** Mint/activate a paper portfolio from a chat draft (or re-activate). */
  async deploy(
    portfolioId: string,
    options: { frequency?: string } = {}
  ): Promise<DeployResult> {
    const body: JsonObject = {};
    if (options.frequency !== undefined) body.frequency = options.frequency;
    const response = await this.transport.request(
      "POST",
      `portfolios/${encodePathSegment(portfolioId)}/deploy`,
      { body }
    );
    const result = response.deployment ?? response;
    if (!isJsonObject(result) || typeof result.portfolioId !== "string") {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Deploy response is missing portfolioId."
      );
    }
    return {
      portfolioId: String(result.portfolioId),
      chatPortfolioId:
        typeof result.chatPortfolioId === "string"
          ? result.chatPortfolioId
          : undefined,
      name: typeof result.name === "string" ? result.name : "",
      outcome: typeof result.outcome === "string" ? result.outcome : "",
      deploymentType:
        typeof result.deploymentType === "string"
          ? result.deploymentType
          : undefined,
    };
  }

  async undeploy(portfolioId: string): Promise<JsonObject> {
    const response = await this.transport.request(
      "POST",
      `portfolios/${encodePathSegment(portfolioId)}/undeploy`,
      { body: {} }
    );
    const result = response.undeployment ?? response;
    if (!isJsonObject(result)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Undeploy response is missing body."
      );
    }
    return result;
  }

  /**
   * Create a custom data source and return it, including its id.
   *
   * `scope` is `"global"` (one series) or `"asset"` (one series per ticker, so
   * every point needs a `ticker`); it defaults to `"global"` and cannot be
   * changed later. `points` is optional and unlimited in size — small batches
   * are sent with the request, larger ones are uploaded, and the returned
   * indicator reflects what landed either way.
   *
   * The id it returns is what a `CustomIndicator` node binds to:
   *
   * ```ts
   * const series = await client.createCustomIndicator(
   *   {
   *     name: "WSB NVDA Mentions",
   *     scope: "asset",
   *     points: [{ timestamp: "2024-04-01", value: 152, ticker: "NVDA" }],
   *   },
   *   { idempotencyKey: "wsb-mentions-v1" },
   * );
   * CustomIndicator(stockAsset("NVDA"), String(series.customIndicatorId));
   * ```
   *
   * Retrying with the same `idempotencyKey` returns the original series rather
   * than creating a second one.
   */
  async createCustomIndicator(
    indicator: CustomIndicatorInput,
    options: { idempotencyKey: string }
  ): Promise<JsonObject> {
    const {
      name,
      description,
      scope,
      pointKind,
      aggregatePeriod,
      points,
      ...rest
    } = indicator;
    if (typeof name !== "string" || !name.trim()) {
      throw new Error("createCustomIndicator requires a name.");
    }
    const unknown = Object.keys(rest);
    if (unknown.length > 0) {
      throw new Error(
        `Unknown custom indicator field(s): ${unknown.sort().join(", ")}. ` +
          "Expected name, description, scope, pointKind, aggregatePeriod, and points."
      );
    }
    const normalized = pointKindPoints(
      points ? customIndicatorPoints(points) : [],
      pointKind,
      aggregatePeriod
    );
    const body: JsonObject = { name: name.trim() };
    if (description !== undefined) body.description = description;
    if (scope !== undefined) body.scope = scope;
    if (pointKind !== undefined) body.pointKind = pointKind;
    if (aggregatePeriod !== undefined) body.aggregatePeriod = aggregatePeriod;
    const inline =
      normalized.length > 0 &&
      inlinePointBytes(normalized) <= MAX_INLINE_POINT_BYTES;
    if (inline) body.points = normalized;
    const created = customIndicatorOf(
      await this.transport.request("POST", "custom-indicators", {
        body,
        idempotencyKey: options.idempotencyKey,
      })
    );
    if (inline || normalized.length === 0) return created;
    const customIndicatorId = String(created.customIndicatorId);
    // The same key is safe here: the server namespaces an idempotency claim
    // by operation, and deriving a suffixed key could overrun its
    // 160-character limit.
    const upload = await this.uploadCustomIndicatorPoints(
      customIndicatorId,
      normalized,
      options.idempotencyKey
    );
    return {
      ...(await this.getCustomIndicator(customIndicatorId)),
      upload,
    };
  }

  /** List the custom data sources this account owns. */
  async listCustomIndicators(
    options: { includeArchived?: boolean } = {}
  ): Promise<JsonObject[]> {
    const query = encodeQuery({
      includeArchived:
        options.includeArchived === undefined
          ? undefined
          : String(options.includeArchived),
    });
    const response = await this.transport.request(
      "GET",
      `custom-indicators${query}`
    );
    const indicators = response.indicators;
    if (!Array.isArray(indicators)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Custom indicator list response is missing indicators."
      );
    }
    return indicators.filter((row): row is JsonObject => isJsonObject(row));
  }

  /** Read one custom data source, including its current point count. */
  async getCustomIndicator(customIndicatorId: string): Promise<JsonObject> {
    return customIndicatorOf(
      await this.transport.request(
        "GET",
        `custom-indicators/${encodePathSegment(customIndicatorId)}`
      )
    );
  }

  /**
   * Add points to an existing series and return the updated indicator.
   *
   * Recurring collection must append to the same `customIndicatorId` every
   * run; creating a fresh series per run splits the history into fragments a
   * strategy cannot read. Re-sending an identical batch is safe — the
   * duplicate is not written twice.
   *
   * The batch is unlimited in size and, as with creation, is sent inline or
   * uploaded depending on how large it is.
   */
  async appendCustomIndicatorPoints(
    customIndicatorId: string,
    points: ReadonlyArray<CustomIndicatorPointInput>,
    options: {
      idempotencyKey: string;
      pointKind?: IndicatorPointKind;
      aggregatePeriod?: IndicatorAggregatePeriod;
    }
  ): Promise<JsonObject> {
    const normalized = pointKindPoints(
      customIndicatorPoints(points),
      options.pointKind,
      options.aggregatePeriod
    );
    if (normalized.length === 0) {
      throw new Error("appendCustomIndicatorPoints needs at least one point.");
    }
    if (inlinePointBytes(normalized) <= MAX_INLINE_POINT_BYTES) {
      const response = await this.transport.request(
        "POST",
        `custom-indicators/${encodePathSegment(customIndicatorId)}/points`,
        {
          body: {
            points: normalized,
            ...(options.pointKind ? { pointKind: options.pointKind } : {}),
            ...(options.aggregatePeriod
              ? { aggregatePeriod: options.aggregatePeriod }
              : {}),
          },
          idempotencyKey: options.idempotencyKey,
        }
      );
      const indicator = response.indicator;
      if (!isJsonObject(indicator)) {
        throw new NexusTradeApiError(
          NO_HTTP_STATUS,
          "invalid_response",
          "Custom indicator response is missing indicator."
        );
      }
      return indicator;
    }
    const upload = await this.uploadCustomIndicatorPoints(
      customIndicatorId,
      normalized,
      options.idempotencyKey
    );
    return {
      ...(await this.getCustomIndicator(customIndicatorId)),
      upload,
    };
  }

  /** Replace the complete series while retaining the same CustomIndicator id. */
  async replaceCustomIndicatorPoints(
    customIndicatorId: string,
    points: ReadonlyArray<CustomIndicatorPointInput>,
    options: {
      idempotencyKey: string;
      allowShrink?: boolean;
      pointKind?: IndicatorPointKind;
      aggregatePeriod?: IndicatorAggregatePeriod;
    }
  ): Promise<JsonObject> {
    const normalized = pointKindPoints(
      customIndicatorPoints(points),
      options.pointKind,
      options.aggregatePeriod
    );
    if (normalized.length === 0) {
      throw new Error("replaceCustomIndicatorPoints needs at least one point.");
    }
    if (inlinePointBytes(normalized) <= MAX_INLINE_POINT_BYTES) {
      return customIndicatorOf(
        await this.transport.request(
          "PUT",
          `custom-indicators/${encodePathSegment(customIndicatorId)}/points`,
          {
            body: {
              points: normalized,
              allowShrink: options.allowShrink === true,
              ...(options.pointKind ? { pointKind: options.pointKind } : {}),
              ...(options.aggregatePeriod
                ? { aggregatePeriod: options.aggregatePeriod }
                : {}),
            },
            idempotencyKey: options.idempotencyKey,
          }
        )
      );
    }
    const upload = await this.uploadCustomIndicatorPoints(
      customIndicatorId,
      normalized,
      options.idempotencyKey,
      { mode: "replace", allowShrink: options.allowShrink === true }
    );
    return {
      ...(await this.getCustomIndicator(customIndicatorId)),
      upload,
    };
  }

  /** Soft-archive a CustomIndicator. Pass confirm when active portfolios use it. */
  async archiveCustomIndicator(
    customIndicatorId: string,
    options: { confirm?: boolean } = {}
  ): Promise<JsonObject> {
    const response = await this.transport.request(
      "DELETE",
      `custom-indicators/${encodePathSegment(customIndicatorId)}`,
      { body: { confirm: options.confirm === true } }
    );
    if (!isJsonObject(response.archive)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Custom indicator archive response is missing archive details."
      );
    }
    return response.archive;
  }

  /** Restore a soft-archived CustomIndicator. */
  async restoreCustomIndicator(customIndicatorId: string): Promise<JsonObject> {
    return customIndicatorOf(
      await this.transport.request(
        "POST",
        `custom-indicators/${encodePathSegment(customIndicatorId)}/restore`,
        { body: {} }
      )
    );
  }

  /**
   * Open an upload slot and return a presigned `uploadUrl` to PUT to.
   *
   * Accepts `csv`, `json`, or `jsonl` up to 100 MB. PUT the bytes to the
   * returned URL, then call `completeCustomIndicatorUpload`. Most callers can
   * pass `points` to `createCustomIndicator` or
   * `appendCustomIndicatorPoints` instead and skip all three steps.
   *
   * Retrying with the same `idempotencyKey` re-signs the same job, since the
   * first URL expires in 15 minutes. Once its bytes have arrived the reply
   * carries no `uploadUrl` — there is nothing left to send, so skip the PUT
   * and wait on `jobId`.
   */
  async createCustomIndicatorUpload(
    customIndicatorId: string,
    options: {
      fileName: string;
      idempotencyKey: string;
      format?: "csv" | "json" | "jsonl";
      contentType?: string;
      sizeBytes?: number;
      mode?: "append" | "replace";
      allowShrink?: boolean;
    }
  ): Promise<JsonObject> {
    const body: JsonObject = {
      fileName: options.fileName,
      format: options.format ?? "jsonl",
    };
    if (options.contentType !== undefined)
      body.contentType = options.contentType;
    if (options.sizeBytes !== undefined) body.sizeBytes = options.sizeBytes;
    if (options.mode !== undefined) body.mode = options.mode;
    if (options.allowShrink !== undefined)
      body.allowShrink = options.allowShrink;
    const response = await this.transport.request(
      "POST",
      `custom-indicators/${encodePathSegment(customIndicatorId)}/uploads`,
      { body, idempotencyKey: options.idempotencyKey }
    );
    const ticket = response.ticket;
    if (!isJsonObject(ticket) || !ticket.jobId) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Upload response is missing ticket."
      );
    }
    return ticket;
  }

  /** Start validation of uploaded bytes and return the operation. */
  async completeCustomIndicatorUpload(
    customIndicatorId: string,
    jobId: string
  ): Promise<JsonObject> {
    return operationOf(
      await this.transport.request(
        "POST",
        `custom-indicators/${encodePathSegment(customIndicatorId)}` +
          `/uploads/${encodePathSegment(jobId)}/complete`,
        { body: {} }
      )
    );
  }

  /** Read an upload operation. `phase` distinguishes the live states. */
  async getCustomIndicatorUpload(
    customIndicatorId: string,
    jobId: string
  ): Promise<JsonObject> {
    return operationOf(
      await this.transport.request(
        "GET",
        `custom-indicators/${encodePathSegment(customIndicatorId)}` +
          `/uploads/${encodePathSegment(jobId)}`
      )
    );
  }

  /** Block until an upload is validated. See `waitForOperation`. */
  async waitForCustomIndicatorUpload(
    customIndicatorId: string,
    jobId: string,
    options: WaitOptions = {}
  ): Promise<JsonObject> {
    return waitForOperation(
      (pendingId) =>
        this.getCustomIndicatorUpload(customIndicatorId, pendingId),
      jobId,
      options
    );
  }

  private async uploadCustomIndicatorPoints(
    customIndicatorId: string,
    points: ReadonlyArray<JsonObject>,
    idempotencyKey: string,
    options: { mode?: "append" | "replace"; allowShrink?: boolean } = {}
  ): Promise<JsonObject> {
    const payload = pointsJsonl(points);
    if (payload.length > MAX_UPLOAD_BYTES) {
      throw new Error(
        `${points.length} points serialize to ` +
          `${Math.floor(payload.length / (1024 * 1024))} MB, over the 100 MB ` +
          "upload limit. Send them in several batches."
      );
    }
    if (!supportsUpload(this.transport)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "unsupported_transport",
        "Uploading a large point batch requires HttpTransport.putBytes."
      );
    }
    const ticket = await this.createCustomIndicatorUpload(customIndicatorId, {
      fileName: `${customIndicatorId}-points.jsonl`,
      format: "jsonl",
      sizeBytes: payload.length,
      idempotencyKey,
      mode: options.mode,
      allowShrink: options.allowShrink,
    });
    const jobId = String(ticket.jobId);
    // No upload URL means this batch already reached the server on an earlier
    // attempt, so resume at polling instead of re-sending it.
    if (ticket.uploadUrl) {
      const headers = ticket.headers;
      const contentType =
        isJsonObject(headers) && typeof headers["Content-Type"] === "string"
          ? headers["Content-Type"]
          : "application/x-ndjson";
      await this.transport.putBytes(String(ticket.uploadUrl), payload, {
        contentType,
      });
      await this.completeCustomIndicatorUpload(customIndicatorId, jobId);
    }
    return this.waitForCustomIndicatorUpload(customIndicatorId, jobId);
  }

  /**
   * Every connectable brokerage and whether this account has linked it.
   *
   * Reports all of them, connected or not, each with a `connectUrl` — an empty
   * result would say nothing about what to do next.
   */
  async listBrokerages(): Promise<JsonObject[]> {
    const response = await this.transport.request("GET", "brokerages");
    const brokerages = response.brokerages;
    if (!Array.isArray(brokerages)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Brokerage response is missing brokerages."
      );
    }
    return brokerages.filter((row): row is JsonObject => isJsonObject(row));
  }

  /** Whether one named brokerage is connected. */
  async getBrokerage(brokerage: string): Promise<JsonObject> {
    const response = await this.transport.request(
      "GET",
      `brokerages/${encodePathSegment(brokerage)}`
    );
    const result = response.brokerage;
    if (!isJsonObject(result)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Brokerage response is missing brokerage."
      );
    }
    return result;
  }

  /**
   * Resolve once the brokerage is connected, logging where to connect it.
   *
   * Linking a brokerage is an OAuth redirect, so an API key cannot complete it
   * — a human has to open the URL. What this does is make that unmissable and
   * then wait for it.
   *
   * `wait` defaults to whether stdout is a TTY. Interactively it logs the URL
   * and polls until the link appears. Non-interactively — CI, cron, a piped
   * script — it rejects with `brokerage_not_connected` at once rather than
   * stalling for the timeout in front of nobody. Pass `wait` to override.
   */
  async connectBrokerage(
    brokerage: string,
    options: {
      wait?: boolean;
      timeoutSeconds?: number;
      pollIntervalSeconds?: number;
    } = {}
  ): Promise<JsonObject> {
    let current = await this.getBrokerage(brokerage);
    if (current.connected === true) return current;

    const connectUrl = String(current.connectUrl ?? "");
    const message =
      `${brokerage} is not connected. Connect it at ${connectUrl} — ` +
      "linking a brokerage is a browser flow an API key cannot complete.";
    const shouldWait = options.wait ?? stdoutIsInteractive();
    if (!shouldWait) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "brokerage_not_connected",
        message
      );
    }

    const timeoutSeconds =
      options.timeoutSeconds ?? DEFAULT_CONNECT_TIMEOUT_SECONDS;
    const pollSeconds =
      options.pollIntervalSeconds ?? CONNECT_POLL_INTERVAL_SECONDS;
    console.log(message);
    console.log(`Waiting for ${brokerage} to be connected…`);
    const deadline = Date.now() + timeoutSeconds * 1000;
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new NexusTradeApiError(
          NO_HTTP_STATUS,
          "brokerage_not_connected",
          `${brokerage} was still not connected after ${timeoutSeconds}s. ${message}`
        );
      }
      await sleep(Math.min(pollSeconds * 1000, remaining));
      current = await this.getBrokerage(brokerage);
      if (current.connected === true) {
        console.log(`${brokerage} connected.`);
        return current;
      }
    }
  }

  /**
   * Stage orders against a portfolio.
   *
   * **Paper orders are accepted immediately. Live orders are staged for
   * approval and are never sent to a broker by this call.** A live response
   * carries `requiresApproval: true` and an `approvalUrl`; nothing has traded
   * until a human approves it there. No argument changes that.
   *
   * ```ts
   * const result = await client.createOrders(
   *   portfolioId,
   *   [{ asset: { name: "SPY", type: "STOCK", symbol: "SPY" },
   *      side: "BUY", quantity: 10, orderType: "MARKET" }],
   *   { idempotencyKey: "rebalance-2024-04-01" },
   * );
   * if (result.requiresApproval) console.log("approve at", result.approvalUrl);
   * ```
   */
  async createOrders(
    portfolioId: string,
    orders: ReadonlyArray<JsonObject>,
    options: { idempotencyKey: string }
  ): Promise<JsonObject> {
    if (!Array.isArray(orders) || orders.length === 0) {
      throw new Error("createOrders needs at least one order.");
    }
    return this.transport.request("POST", "orders", {
      body: { portfolioId, orders: orders.map((order) => ({ ...order })) },
      idempotencyKey: options.idempotencyKey,
    });
  }

  async createBacktests(
    backtests: ReadonlyArray<JobInput>,
    options: { idempotencyKey: string }
  ): Promise<JsonObject[]> {
    const inputs = backtests.map((item) => backtestInput(asJsonObject(item)));
    const response = await this.transport.request("POST", "backtests/batch", {
      body: { backtests: inputs },
      idempotencyKey: options.idempotencyKey,
    });
    const operations = response.operations;
    if (
      !Array.isArray(operations) ||
      !operations.every((operation) => isJsonObject(operation))
    ) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Backtest response is missing operations."
      );
    }
    return operations as JsonObject[];
  }

  /** Submit one generated `backtest(...)` handle or raw API input. */
  async createBacktest(
    backtest: JobInput,
    options: { idempotencyKey: string }
  ): Promise<JsonObject> {
    const operations = await this.createBacktests([backtest], options);
    if (operations.length !== 1) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Single backtest response returned the wrong operation count."
      );
    }
    return operations[0];
  }

  /**
   * Start an agent run and return an iterable handle.
   *
   * Unlike the other job kinds this is not fire-and-poll: iterate the run to
   * receive its events, and answer it when it asks. See `AgentRun`.
   */
  async createAgent(
    prompt: string,
    options: {
      idempotencyKey: string;
      maxIterations?: number;
      costCeilingUsd?: number;
    }
  ): Promise<AgentRun> {
    const body: JsonObject = { prompt };
    if (options.maxIterations !== undefined) {
      body.maxIterations = options.maxIterations;
    }
    if (options.costCeilingUsd !== undefined) {
      body.costCeilingUsd = options.costCeilingUsd;
    }
    const response = await this.transport.request("POST", "agents", {
      body,
      idempotencyKey: options.idempotencyKey,
    });
    const agent = response.agent;
    if (!isJsonObject(agent) || !agent.id) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Agent response is missing agent."
      );
    }
    return new AgentRun(
      String(agent.id),
      this.transport,
      typeof agent.status === "string" ? agent.status : "initializing"
    );
  }

  /**
   * Reattach to a run already in flight.
   *
   * The run lives server-side and bills whether or not anyone is listening, so
   * a dropped connection must not orphan it. Omit `cursor` to replay from the
   * beginning; events are durable, so replay is exact.
   */
  async attachAgent(
    agentId: string,
    options: { cursor?: string } = {}
  ): Promise<AgentRun> {
    const agent = await this.getAgent(agentId);
    const run = new AgentRun(
      typeof agent.id === "string" ? agent.id : agentId,
      this.transport,
      typeof agent.status === "string" ? agent.status : "initializing"
    );
    run.terminal = Boolean(agent.terminal);
    run.setCursor(options.cursor ?? null);
    return run;
  }

  async getAgent(agentId: string): Promise<JsonObject> {
    const response = await this.transport.request(
      "GET",
      `agents/${encodeURIComponent(agentId)}`
    );
    const agent = response.agent;
    if (!isJsonObject(agent)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Agent response is missing agent."
      );
    }
    return agent;
  }

  async getBacktest(backtestId: string): Promise<JsonObject> {
    const response = await this.transport.request(
      "GET",
      `backtests/${encodePathSegment(backtestId)}`
    );
    return operationOf(response);
  }

  async createOptimization(
    handle: JobInput,
    options: { idempotencyKey: string }
  ): Promise<JsonObject> {
    return this.createPortfolioJob(
      "optimizations",
      handle,
      options.idempotencyKey
    );
  }

  async getOptimization(optimizationId: string): Promise<JsonObject> {
    const response = await this.transport.request(
      "GET",
      `optimizations/${encodePathSegment(optimizationId)}`
    );
    return operationOf(response);
  }

  async createWalkForward(
    handle: JobInput,
    options: { idempotencyKey: string }
  ): Promise<JsonObject> {
    return this.createPortfolioJob(
      "walk-forward-studies",
      handle,
      options.idempotencyKey
    );
  }

  async getWalkForward(studyId: string): Promise<JsonObject> {
    const response = await this.transport.request(
      "GET",
      `walk-forward-studies/${encodePathSegment(studyId)}`
    );
    return operationOf(response);
  }

  async createLakeQuery(
    request: JsonObject,
    options: { idempotencyKey: string }
  ): Promise<JsonObject> {
    const response = await this.transport.request("POST", "lake/queries", {
      body: request,
      idempotencyKey: options.idempotencyKey,
    });
    return operationOf(response);
  }

  async getLakeQuery(queryId: string): Promise<JsonObject> {
    return operationOf(
      await this.transport.request(
        "GET",
        `lake/queries/${encodePathSegment(queryId)}`
      )
    );
  }

  async cancelLakeQuery(queryId: string): Promise<JsonObject> {
    return operationOf(
      await this.transport.request(
        "POST",
        `lake/queries/${encodePathSegment(queryId)}/cancel`
      )
    );
  }

  /**
   * Submit a natural-language stock screen. Returns immediately; poll it.
   *
   * `returnQuery` keeps the generated SQL, engine and catalog version on the
   * result. It defaults on: the SQL is the audit trail, and without it the rows
   * are a number nobody can re-derive. It is returned on failure regardless,
   * because a rejected query is the most useful thing to read.
   */
  async createNlScreen(
    question: string,
    options: { returnQuery?: boolean } = {}
  ): Promise<JsonObject> {
    return operationOf(
      await this.transport.request("POST", "nl/screens", {
        body: {
          question,
          returnQuery: options.returnQuery ?? true,
        },
      })
    );
  }

  async getNlScreen(screenId: string): Promise<JsonObject> {
    return operationOf(
      await this.transport.request(
        "GET",
        `nl/screens/${encodePathSegment(screenId)}`
      )
    );
  }

  async cancelNlScreen(screenId: string): Promise<JsonObject> {
    return operationOf(
      await this.transport.request(
        "POST",
        `nl/screens/${encodePathSegment(screenId)}/cancel`
      )
    );
  }

  /** Block until a screen is terminal. See `waitForOperation`. */
  async waitForNlScreen(
    screenId: string,
    options: WaitOptions = {}
  ): Promise<JsonObject> {
    return waitForOperation(
      (id) => this.getNlScreen(id),
      screenId,
      options
    );
  }

  /**
   * Submit a natural-language lake ask. Returns immediately; poll it.
   */
  async createLakeAsk(question: string): Promise<JsonObject> {
    return operationOf(
      await this.transport.request("POST", "lake/ask", {
        body: { question },
      })
    );
  }

  async getLakeAsk(askId: string): Promise<JsonObject> {
    return operationOf(
      await this.transport.request(
        "GET",
        `lake/ask/${encodePathSegment(askId)}`
      )
    );
  }

  async cancelLakeAsk(askId: string): Promise<JsonObject> {
    return operationOf(
      await this.transport.request(
        "POST",
        `lake/ask/${encodePathSegment(askId)}/cancel`
      )
    );
  }

  /** Block until a lake ask is terminal. See `waitForOperation`. */
  async waitForLakeAsk(
    askId: string,
    options: WaitOptions = {}
  ): Promise<JsonObject> {
    return waitForOperation(
      (id) => this.getLakeAsk(id),
      askId,
      options
    );
  }

  async getLakeQueryManifest(queryId: string): Promise<JsonObject> {
    return operationOf(
      await this.transport.request(
        "GET",
        `lake/queries/${encodePathSegment(queryId)}/manifest`
      )
    );
  }

  async getLakeCatalog(): Promise<JsonObject[]> {
    const response = await this.transport.request("GET", "lake/catalog");
    const tables = response.tables;
    if (!Array.isArray(tables) || !tables.every((t) => isJsonObject(t))) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Lake catalog response is missing tables."
      );
    }
    return tables as JsonObject[];
  }

  async describeLakeTable(table: string): Promise<JsonObject> {
    const name = table.startsWith("lake.") ? table.slice(5) : table;
    const response = await this.transport.request(
      "GET",
      `lake/catalog/lake/${encodePathSegment(name)}`
    );
    const described = response.table;
    if (!isJsonObject(described)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Lake describe response is missing table."
      );
    }
    return described;
  }

  /** Download one Parquet part, optionally a byte range of it. */
  async downloadLakeQueryPart(
    queryId: string,
    part: number,
    options: { byteRange?: [number, number]; maxBytes?: number } = {}
  ): Promise<Uint8Array> {
    if (!supportsBinary(this.transport)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "unsupported_transport",
        "Lake part download requires a transport implementing requestBytes."
      );
    }
    return this.transport.requestBytes(
      "GET",
      `lake/queries/${encodePathSegment(queryId)}/parts/${Math.trunc(part)}`,
      options
    );
  }

  /** Resolve once a lake query is terminal. See `waitForOperation`. */
  async waitForLakeQuery(
    queryId: string,
    options: WaitOptions = {}
  ): Promise<JsonObject> {
    return waitForOperation((id) => this.getLakeQuery(id), queryId, options);
  }

  /** Resolve once a backtest is terminal. See `waitForOperation`. */
  async waitForBacktest(
    backtestId: string,
    options: WaitOptions = {}
  ): Promise<JsonObject> {
    return waitForOperation((id) => this.getBacktest(id), backtestId, options);
  }

  /** Resolve once an optimization is terminal. See `waitForOperation`. */
  async waitForOptimization(
    optimizationId: string,
    options: WaitOptions = {}
  ): Promise<JsonObject> {
    return waitForOperation(
      (id) => this.getOptimization(id),
      optimizationId,
      options
    );
  }

  /** Resolve once a walk-forward study is terminal. See `waitForOperation`. */
  async waitForWalkForward(
    studyId: string,
    options: WaitOptions = {}
  ): Promise<JsonObject> {
    return waitForOperation((id) => this.getWalkForward(id), studyId, options);
  }

  /** Wait on a whole `createBacktests` batch, in submission order. */
  async waitForBacktests(
    operations: ReadonlyArray<JsonObject>,
    options: WaitOptions = {}
  ): Promise<JsonObject[]> {
    const finished: JsonObject[] = [];
    for (const operation of operations) {
      finished.push(await this.waitForBacktest(String(operation.id), options));
    }
    return finished;
  }

  private async createPortfolioJob(
    path: string,
    input: JobInput,
    idempotencyKey: string
  ): Promise<JsonObject> {
    const handle = asJsonObject(input);
    const args = handle.args;
    const response = await this.transport.request("POST", path, {
      body: {
        portfolio: handle.portfolio ?? null,
        args: isJsonObject(args) ? args : {},
      },
      idempotencyKey,
    });
    return operationOf(response);
  }
}

function backtestInput(item: JsonObject): JsonObject {
  const tool = item.tool;
  if (tool === undefined || tool === null) {
    // Prefer portfolioId over an inline body when both are present.
    if (typeof item.portfolioId === "string" && item.portfolioId) {
      const { portfolio: _ignored, ...rest } = item;
      return { ...rest, portfolioId: item.portfolioId };
    }
    return { ...item };
  }
  if (tool !== "backtest_portfolio") {
    throw new Error(
      "createBacktests accepts backtest(...) handles or raw API inputs."
    );
  }
  const portfolio = item.portfolio;
  const args = item.args;
  if (!isJsonObject(portfolio) || !isJsonObject(args)) {
    throw new Error("backtest(...) handle is missing portfolio or args.");
  }
  const normalized: JsonObject = { portfolio: { ...portfolio } };
  for (const [source, target] of BACKTEST_ARG_NAMES) {
    const value = args[source];
    if (value !== undefined && value !== null) {
      normalized[target] = value;
    }
  }
  return normalized;
}

function customIndicatorOf(response: JsonObject): JsonObject {
  const indicator = response.indicator;
  if (!isJsonObject(indicator) || !indicator.customIndicatorId) {
    throw new NexusTradeApiError(
      NO_HTTP_STATUS,
      "invalid_response",
      "Custom indicator response is missing indicator."
    );
  }
  return indicator;
}

function operationOf(response: JsonObject): JsonObject {
  const operation = response.operation;
  if (!isJsonObject(operation)) {
    throw new NexusTradeApiError(
      NO_HTTP_STATUS,
      "invalid_response",
      "Response is missing operation."
    );
  }
  return operation;
}

/** @internal PortfolioHandle lazy-client attachment. */
export function clientTransport(client: NexusTradeClient): Transport {
  return (client as unknown as { transport: Transport }).transport;
}

/** Convenience wrapper for scripts that do not need a persistent client. */
export async function createCustomIndicator(
  indicator: CustomIndicatorInput,
  options: { idempotencyKey: string; client?: NexusTradeClient }
): Promise<JsonObject> {
  const client = options.client ?? NexusTradeClient.fromEnvironment();
  return client.createCustomIndicator(indicator, {
    idempotencyKey: options.idempotencyKey,
  });
}

/** Convenience wrapper for scripts that do not need a persistent client. */
export async function createPortfolio(
  portfolio: JsonObject,
  options: { idempotencyKey: string; client?: NexusTradeClient }
): Promise<JsonObject> {
  const client = options.client ?? NexusTradeClient.fromEnvironment();
  return client.createPortfolio(portfolio, {
    idempotencyKey: options.idempotencyKey,
  });
}
