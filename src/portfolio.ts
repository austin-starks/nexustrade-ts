/**
 * PortfolioHandle — one object you author, save, deploy, fetch, and backtest.
 *
 * Keeps the generated `Portfolio` interface as the shape; this class adds
 * lifecycle methods. `toJSON()` omits `id` so request bodies never leak
 * `"id": null`.
 *
 * Holds a `Transport` (same pattern as `AgentRun`) so the generated builder can
 * import this module without a cycle through `client.ts`.
 */

import {
  NexusTradeApiError,
  NO_HTTP_STATUS,
  type JsonObject,
  type Transport,
} from "./client.ts";
import type {
  Portfolio,
  Strategy,
} from "./generated/ntSdk.generated.js";

export type PortfolioType = "paper" | "live" | "chat";

export type DeployOutcome =
  | "minted"
  | "reactivated"
  | "already_active"
  | "seed_recovered";

export interface DeployResult {
  /** Real paper/live id — different from the draft id set by `save()`. */
  portfolioId: string;
  chatPortfolioId?: string;
  name: string;
  outcome: DeployOutcome | string;
  deploymentType?: string;
}

export interface PortfolioListResult {
  portfolios: PortfolioHandle[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  scopes?: JsonObject;
}

export interface PortfolioHandleOptions {
  id?: string | null;
  transport?: Transport;
}

export interface ReadonlyPortfolioPolicy {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly stockEligibility: {
    readonly minimumMarketCapUsd: number;
    readonly maximumMarketCapUsd: number | null;
    readonly industryFilter: {
      readonly mode: "ALL" | "INCLUDE_ONLY";
      readonly match: "ANY" | "ALL";
      readonly industries: readonly string[];
    };
    readonly missingMarketCapBehavior: "EXCLUDE";
    readonly missingIndustryBehavior: "EXCLUDE_WHEN_FILTER_SET";
    readonly appliesTo: "DYNAMIC_STOCK_UNIVERSES";
  };
  readonly automatedApproval: {
    readonly enabled: boolean;
    readonly maxAutomatedTradesPerDay: number;
    readonly countingUnit: "TRADE_ACTION";
    readonly dailyWindow: "AMERICA_NEW_YORK_CALENDAR_DAY";
  };
  readonly updatedAt?: string;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isReadonlyPortfolioPolicy(
  value: unknown,
): value is ReadonlyPortfolioPolicy {
  if (!isJsonObject(value) || value.schemaVersion !== 2) return false;
  const stock = value.stockEligibility;
  const automation = value.automatedApproval;
  if (!isJsonObject(stock) || !isJsonObject(automation)) return false;
  const industry = stock.industryFilter;
  return (
    typeof value.revision === "number" &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0 &&
    typeof stock.minimumMarketCapUsd === "number" &&
    Number.isSafeInteger(stock.minimumMarketCapUsd) &&
    stock.minimumMarketCapUsd >= 0 &&
    (stock.maximumMarketCapUsd === null ||
      (typeof stock.maximumMarketCapUsd === "number" &&
        Number.isSafeInteger(stock.maximumMarketCapUsd) &&
        stock.maximumMarketCapUsd >= stock.minimumMarketCapUsd)) &&
    isJsonObject(industry) &&
    (industry.mode === "ALL" || industry.mode === "INCLUDE_ONLY") &&
    (industry.match === "ANY" || industry.match === "ALL") &&
    isStringArray(industry.industries) &&
    stock.missingMarketCapBehavior === "EXCLUDE" &&
    stock.missingIndustryBehavior === "EXCLUDE_WHEN_FILTER_SET" &&
    stock.appliesTo === "DYNAMIC_STOCK_UNIVERSES" &&
    typeof automation.enabled === "boolean" &&
    typeof automation.maxAutomatedTradesPerDay === "number" &&
    Number.isSafeInteger(automation.maxAutomatedTradesPerDay) &&
    automation.maxAutomatedTradesPerDay >= 1 &&
    automation.maxAutomatedTradesPerDay <= 25 &&
    automation.countingUnit === "TRADE_ACTION" &&
    automation.dailyWindow === "AMERICA_NEW_YORK_CALENDAR_DAY" &&
    (value.updatedAt === undefined || typeof value.updatedAt === "string")
  );
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

/** Runtime portfolio object. Implements the generated `Portfolio` shape. */
export class PortfolioHandle implements Portfolio {
  name: string;
  initialValue?: number;
  strategies: Strategy[];
  main?: boolean;
  supportsFractionalShares?: boolean;
  supportsCrypto?: boolean;
  alertsEnabled?: boolean;

  /** Chat draft id after `save()`, or fetched portfolio id. Not serialized. */
  id: string | null = null;

  /** Present on list/get summaries: paper | live | chat. */
  type?: PortfolioType;
  isActive?: boolean;
  strategyNames?: string[];
  createdAt?: string;
  updatedAt?: string;
  brokerage?: string;
  /** Server-owned snapshot. It is intentionally omitted from authoring payloads. */
  #policy?: ReadonlyPortfolioPolicy;

  get policy(): ReadonlyPortfolioPolicy | undefined {
    return this.#policy;
  }

  #transport: Transport | null;

  constructor(
    data: Portfolio | JsonObject,
    options: PortfolioHandleOptions = {},
  ) {
    const record = { ...(data as JsonObject) };
    const wireId =
      options.id ??
      (typeof record.portfolioId === "string" ? record.portfolioId : null) ??
      (typeof record.id === "string" ? record.id : null);
    delete record.portfolioId;
    delete record.id;

    this.name = String(record.name ?? "");
    if (typeof record.initialValue === "number") {
      this.initialValue = record.initialValue;
    }
    this.strategies = Array.isArray(record.strategies)
      ? (record.strategies.filter(
          (s): s is JsonObject =>
            typeof s === "object" && s !== null && !Array.isArray(s),
        ) as unknown as Strategy[])
      : [];
    if (typeof record.main === "boolean") this.main = record.main;
    if (typeof record.supportsFractionalShares === "boolean") {
      this.supportsFractionalShares = record.supportsFractionalShares;
    }
    if (typeof record.supportsCrypto === "boolean") {
      this.supportsCrypto = record.supportsCrypto;
    }
    if (typeof record.alertsEnabled === "boolean") {
      this.alertsEnabled = record.alertsEnabled;
    }
    if (
      record.type === "paper" ||
      record.type === "live" ||
      record.type === "chat"
    ) {
      this.type = record.type;
    }
    if (typeof record.isActive === "boolean") this.isActive = record.isActive;
    if (Array.isArray(record.strategyNames)) {
      this.strategyNames = record.strategyNames.map(String);
    }
    if (typeof record.createdAt === "string") this.createdAt = record.createdAt;
    if (typeof record.updatedAt === "string") this.updatedAt = record.updatedAt;
    if (typeof record.brokerage === "string") this.brokerage = record.brokerage;
    if (isReadonlyPortfolioPolicy(record.policy)) {
      this.#policy = record.policy;
    }

    for (const [key, value] of Object.entries(record)) {
      if (
        key === "name" ||
        key === "initialValue" ||
        key === "strategies" ||
        key === "main" ||
        key === "supportsFractionalShares" ||
        key === "supportsCrypto" ||
        key === "alertsEnabled" ||
        key === "type" ||
        key === "isActive" ||
        key === "strategyNames" ||
        key === "createdAt" ||
        key === "updatedAt" ||
        key === "brokerage" ||
        key === "policy"
      ) {
        continue;
      }
      // `__proto__`/`constructor` arrive as own enumerable keys from
      // JSON.parse; assigning them replaces the instance prototype and the
      // handle silently loses save/deploy/toJSON.
      if (key === "__proto__" || key === "constructor") continue;
      Object.defineProperty(this, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    this.id = wireId;
    this.#transport = options.transport ?? null;
  }

  static from(
    data: Portfolio | JsonObject,
    options: PortfolioHandleOptions = {},
  ): PortfolioHandle {
    return new PortfolioHandle(data, options);
  }

  /** Omit `id` — class fields would otherwise serialize as `"id": null`. */
  toJSON(): JsonObject {
    const body: JsonObject = {
      name: this.name,
      strategies: this.strategies as unknown as JsonObject[],
    };
    if (this.initialValue !== undefined) body.initialValue = this.initialValue;
    if (this.main !== undefined) body.main = this.main;
    if (this.supportsFractionalShares !== undefined) {
      body.supportsFractionalShares = this.supportsFractionalShares;
    }
    if (this.supportsCrypto !== undefined) {
      body.supportsCrypto = this.supportsCrypto;
    }
    if (this.alertsEnabled !== undefined) {
      body.alertsEnabled = this.alertsEnabled;
    }
    if (this.type !== undefined) body.type = this.type;
    if (this.isActive !== undefined) body.isActive = this.isActive;
    if (this.strategyNames !== undefined) {
      body.strategyNames = this.strategyNames;
    }
    if (this.createdAt !== undefined) body.createdAt = this.createdAt;
    if (this.updatedAt !== undefined) body.updatedAt = this.updatedAt;
    if (this.brokerage !== undefined) body.brokerage = this.brokerage;
    return body;
  }

  async #resolveTransport(transport?: Transport): Promise<Transport> {
    if (transport) return transport;
    if (this.#transport) return this.#transport;
    // Lazy: avoids importing NexusTradeClient at module load (cycle with client).
    const { NexusTradeClient, clientTransport } = await import("./client.js");
    this.#transport = clientTransport(NexusTradeClient.fromEnvironment());
    return this.#transport;
  }

  /** Persist as a chat draft. Sets `.id` to the ChatPortfolio id. */
  async save(options: {
    idempotencyKey: string;
    transport?: Transport;
  }): Promise<PortfolioHandle> {
    const transport = await this.#resolveTransport(options.transport);
    const response = await transport.request("POST", "portfolios", {
      body: this.toJSON(),
      idempotencyKey: options.idempotencyKey,
    });
    const result = response.portfolio;
    if (!isJsonObject(result) || typeof result.portfolioId !== "string") {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Portfolio save response is missing portfolioId.",
      );
    }
    this.id = result.portfolioId;
    this.#transport = transport;
    return this;
  }

  /**
   * Mint/activate the real paper portfolio.
   * Returns a *different* id than `save()` — see `DeployResult.portfolioId`.
   */
  async deploy(options: {
    frequency?: string;
    transport?: Transport;
  } = {}): Promise<DeployResult> {
    if (!this.id) {
      throw new Error("Portfolio must be saved before deploy().");
    }
    const transport = await this.#resolveTransport(options.transport);
    const body: JsonObject = {};
    if (options.frequency !== undefined) body.frequency = options.frequency;
    const response = await transport.request(
      "POST",
      `portfolios/${encodePathSegment(this.id)}/deploy`,
      { body },
    );
    const result = isJsonObject(response.deployment)
      ? response.deployment
      : response;
    if (!isJsonObject(result) || typeof result.portfolioId !== "string") {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Deploy response is missing portfolioId.",
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

  async undeploy(options: { transport?: Transport } = {}): Promise<JsonObject> {
    if (!this.id) {
      throw new Error("Portfolio must be saved before undeploy().");
    }
    const transport = await this.#resolveTransport(options.transport);
    const response = await transport.request(
      "POST",
      `portfolios/${encodePathSegment(this.id)}/undeploy`,
      { body: {} },
    );
    const result = isJsonObject(response.undeployment)
      ? response.undeployment
      : response;
    if (!isJsonObject(result)) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Undeploy response is missing body.",
      );
    }
    return result;
  }

  /** By id once saved; inline body before. */
  async backtest(options: {
    startDate: string;
    endDate: string;
    idempotencyKey: string;
    baseline?: string;
    interval?: string;
    initialValue?: number;
    generateEvents?: boolean;
    feeConfig?: JsonObject;
    transport?: Transport;
  }): Promise<JsonObject> {
    const transport = await this.#resolveTransport(options.transport);
    const input: JsonObject = this.id
      ? {
          portfolioId: this.id,
          startDate: options.startDate,
          endDate: options.endDate,
        }
      : {
          portfolio: this.toJSON(),
          startDate: options.startDate,
          endDate: options.endDate,
        };
    if (options.baseline !== undefined) input.baseline = options.baseline;
    if (options.interval !== undefined) input.interval = options.interval;
    if (options.initialValue !== undefined) {
      input.initialValue = options.initialValue;
    }
    if (options.generateEvents !== undefined) {
      input.generateEvents = options.generateEvents;
    }
    if (options.feeConfig !== undefined) input.feeConfig = options.feeConfig;

    const response = await transport.request("POST", "backtests/batch", {
      body: { backtests: [input] },
      idempotencyKey: options.idempotencyKey,
    });
    const operations = response.operations;
    if (
      !Array.isArray(operations) ||
      operations.length !== 1 ||
      !isJsonObject(operations[0])
    ) {
      throw new NexusTradeApiError(
        NO_HTTP_STATUS,
        "invalid_response",
        "Backtest response is missing operations.",
      );
    }
    return operations[0];
  }
}

export function portfolioHandleFromWire(
  data: unknown,
  options: PortfolioHandleOptions = {},
): PortfolioHandle {
  if (!isJsonObject(data)) {
    throw new NexusTradeApiError(
      NO_HTTP_STATUS,
      "invalid_response",
      "Portfolio response is not an object.",
    );
  }
  return PortfolioHandle.from(data, options);
}
