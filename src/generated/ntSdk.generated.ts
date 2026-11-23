import { PortfolioHandle } from "../portfolio.ts";
/* eslint-disable */
// GENERATED from the NexusTrade builder spec — do not edit by hand.

export interface Asset { type: AssetType; symbol: string; name?: string }
/** Bind to the current pipeline candidate. Never spelled as an omitted field. */
export type Candidate = { readonly __candidate: true };
/**
 * Explicit empty `targetAssets: []` — portfolio-wide scope (any name in the book).
 * Correct for rebalance / DynamicRebalance cadence. Wrong for per-ticker DCA.
 */
export type PortfolioWide = { readonly __portfolioWide: true };
/** Concrete assets must be built with stockAsset() / cryptoAsset() — no bare ticker strings. */
export type AssetArg = Asset | Candidate | PortfolioWide;

/**
 * Opaque: indicators and conditions are only ever constructed through the
 * builders below. Brands use unique symbols (not string keys) so they are not
 * defeated by the `[key: string]: unknown` index signature.
 *
 * nodeKind keeps the two nominally distinct. Without it both interfaces are the
 * same structure, so a bare `IsIndustry(CANDIDATE, "technology")` inside
 * `and(...)` (or cast `as CandidateCondition`) typechecked and only failed at
 * save time. The literal values are the text the typecheck error shows.
 *
 * candidateBound lets strategy() reject candidate-bound gates while
 * filter()/eligibility still accept them.
 */
declare const nodeKind: unique symbol;
export interface Indicator {
  type: string;
  readonly [nodeKind]: "Indicator (a number, not a condition): compare it to get a condition, e.g. gt(IsIndustry(CANDIDATE, 'technology'), Value(0)) or lt(RSI(CANDIDATE, 14), Value(30))";
  [key: string]: unknown;
}
export interface Condition {
  type: string;
  readonly [nodeKind]: "Condition (true/false, not an indicator)";
  [key: string]: unknown;
}
/** Existing native Then timing: optional maximum window and trading-time wait. */
export interface ThenTiming {
  window?: { length: number; interval: Interval };
  transition: { minimumTradingMinutes: number; waiting: boolean };
}
declare const candidateBound: unique symbol;
/** Indicator bound to the pipeline candidate (Price(CANDIDATE), …). */
export type CandidateIndicator = Indicator & { readonly [candidateBound]: true };
/** Condition that transitively contains a CandidateIndicator. */
export type CandidateCondition = Condition & { readonly [candidateBound]: true };
/**
 * Book-level condition for strategy(when) / sessionFlatten.
 * CandidateCondition is not assignable here (symbol brand vs never).
 */
export type StrategyCondition = Condition & { readonly [candidateBound]?: never };

export type PipelineStage =
  | { type: "Filter"; condition: Condition | CandidateCondition }
  | { type: "SelectTop"; metric: Indicator | CandidateIndicator; limit: number; direction: SelectDirection }
  | { type: "SelectPercentile"; metric: Indicator | CandidateIndicator; percentile: number; direction: SelectDirection };

/**
 * Discriminated like UniverseConfig: SPECIFIC_ASSETS REQUIRES assets, and the
 * broad sources take none. A flat `{source, assets?}` would let a model author
 * SPECIFIC_ASSETS with an empty universe (a silent zero-trade book) or attach
 * assets to CRYPTO, both of which the real type forbids.
 */
export type Universe =
  | { source: "ALL_US_STOCKS" | "SP500" | "NASDAQ100" | "DJIA" | "CRYPTO" }
  | { source: "SPECIFIC_ASSETS"; assets: Asset[] }
  | { source: "WATCHLIST"; watchlistKey: string };

export interface Allocation { type: AllocationType; amount: number }
export interface OptionAllocation { type: OptionAllocationType; amount: number }
/** DynamicRebalance per-name cap: contracts and buying-power percent are rejected. */
export interface PerNameAllocation { type: "percent of portfolio" | "dollars"; amount: number }
/** Author budget values as indicators, including Value for a constant. */
export interface DeploymentBudget { type: DeploymentBudgetType; amount: Indicator }

export interface ExpirationSelector {
  minDaysToExpiration: number;
  maxDaysToExpiration: number;
  preference: ExpirationPreference;
}
/** Calls: positive distance = OTM (higher strike). Puts: positive = OTM (lower strike). 0 = ATM. Delta = absolute target delta. */
export interface StrikeSelector { distanceType: StrikeDistanceType; distance: number }
/** Search window when the primary strike is unaffordable / missing. */
export interface StrikeRange {
  startDistance: number;
  endDistance: number;
  iteration: StrikeRangeIteration;
}
/** Search window when the primary expiration is unaffordable / missing. */
export interface ExpirationRange {
  minDte: number;
  maxDte: number;
  iteration: ExpirationRangeIteration;
}
/** Optional Greek bounds applied during contract resolution. */
export interface GreekFilter {
  minIv?: number; maxIv?: number;
  minDelta?: number; maxDelta?: number;
  minGamma?: number; maxGamma?: number;
  minTheta?: number; maxTheta?: number;
  minVega?: number; maxVega?: number;
  minRho?: number; maxRho?: number;
}
/** Bid/ask constraints applied with `greekFilter` during resolution; a candidate must pass both. */
export interface LiquidityFilter {
  /** Max (ask-bid)/mid. Preferred: $0.50 is 50% of a $1.00 contract, 1.7% of a $30.00 one. */
  maxSpreadPct?: number;
  /** Max ask-bid in dollars. When both bounds are set, both must pass. */
  maxSpreadAbsolute?: number;
  /** Minimum bid — excludes contracts you cannot sell into. */
  minBid?: number;
}
export interface OptionsBuilderLeg {
  optionType: OptionType;
  direction: OptionDirection;
  expirationSelector: ExpirationSelector;
  strikeSelector: StrikeSelector;
  /** Non-delta fallback when strikeSelector.distanceType is "delta". */
  fallbackStrikeSelector?: StrikeSelector;
  strikeRange?: StrikeRange;
  expirationRange?: ExpirationRange;
  ratio?: number;
  greekFilter?: GreekFilter;
  liquidityFilter?: LiquidityFilter;
}
/** Shared fields for `leg(...)` (discriminated on distanceType). */
export type LegConfigBase = {
  optionType: OptionType;
  direction: OptionDirection;
  minDaysToExpiration: number;
  maxDaysToExpiration: number;
  preference?: ExpirationPreference;
  strikeRange?: StrikeRange;
  expirationRange?: ExpirationRange;
  ratio?: number;
  greekFilter?: GreekFilter;
  liquidityFilter?: LiquidityFilter;
};
/** Percent/dollars strike — fallback optional. */
export type LegConfigPercentOrDollars = LegConfigBase & {
  distance: number;
  distanceType?: "percent" | "dollars";
  fallbackDistance?: number;
  fallbackDistanceType?: "percent" | "dollars";
  fallbackStrikeSelector?: StrikeSelector;
};
/** Delta targeting REQUIRES a non-delta fallback (same contract as YAML). */
export type LegConfigDelta = LegConfigBase & {
  distance: number;
  distanceType: "delta";
} & (
  | { fallbackDistance: number; fallbackDistanceType: "percent" | "dollars"; fallbackStrikeSelector?: never }
  | { fallbackStrikeSelector: StrikeSelector; fallbackDistance?: never; fallbackDistanceType?: never }
);
export type LegConfig = LegConfigPercentOrDollars | LegConfigDelta;
export interface DynamicUnderlying {
  universe: Universe;
  pipeline?: PipelineStage[];
  limit?: number;
}
/**
 * Minimum realised strike width, checked AFTER contracts resolve. Each leg snaps
 * independently to the nearest listed strike, so the authored offsets and the
 * realised width differ by up to a full grid step in either direction.
 * minWidthPercent is a whole-number percent of spot (4 = 4%). Below the floor
 * the structure is rejected and the next template in the ladder is tried.
 */
export interface SpreadWidthConstraint {
  minWidthPercent?: number;
  minWidthDollars?: number;
}
export interface OptionsBuilder {
  legs: OptionsBuilderLeg[];
  underlyingSymbol?: string;
  dynamicUnderlying?: DynamicUnderlying;
  spreadType?: OptionSpreadType;
  widthConstraint?: SpreadWidthConstraint;
}
export interface OptionStructureTemplate {
  legs: OptionsBuilderLeg[];
  name?: string;
  /** May be candidate-bound (evaluated per underlying). */
  eligibility?: Condition | CandidateCondition;
  spreadType?: OptionSpreadType;
  widthConstraint?: SpreadWidthConstraint;
}
/** Sleeves share the action-level totalBudget and cannot define their own. */
export interface RebalanceOptionSleeve {
  name: string;
  universe?: Universe;
  pipeline?: PipelineStage[];
  weightIndicator?: Indicator | CandidateIndicator;
  limit?: number;
  perNameAllocation?: OptionAllocation;
  structureTemplates?: OptionStructureTemplate[];
}
export type CloseOptionTrigger =
  | { type: "pnl"; minPnlPercent?: number; maxPnlPercent?: number }
  | { type: "dte"; minDte?: number; maxDte?: number }
  | { type: "daysHeld"; minDaysHeld?: number; maxDaysHeld?: number }
  | {
      type: "greeks";
      minSpreadDelta?: number; maxSpreadDelta?: number;
      minIv?: number; maxIv?: number;
      minSpreadTheta?: number; maxSpreadTheta?: number;
    };

export type ExecutionPriority = number;
export interface PurchaseFunding {
  executionPriority?: number;
  condition: Condition; rankBy: Indicator; direction: SelectDirection; amount: Allocation;
}
export interface BuyOrSellAction { type: "Buy" | "Sell" | "Short" | "Cover"; targetAsset: Asset; amount: Allocation;
  executionPriority?:ExecutionPriority; funding?:PurchaseFunding; holdingCondition?:Condition;
}
export interface AlertAction { type: "Alert"; message: string }
/**
 * Keep a portfolio-scoped list set to currently public source membership.
 * Refreshes every tick, places no orders, and
 * takes no condition. A DynamicRebalance reads it with watchlistUniverse(key).
 * Backtests use run-local membership; live and paper wait for durable publication.
 */
export type DisclosureWatchlistSource = {
  type: "PoliticalRemainingPurchases"; memberId: string; instrument?: "Equity" | "Option" | "All";
  amountBasis?: "LowerBound" | "Midpoint" | "UpperBound"; chamber?: "All" | "House" | "Senate";
} | { type: "InstitutionalHoldings"; managerCik: string; windowDays?: number }
  | { type: "InsiderPurchases"; windowDays: number; role?: "Any" | "Officer" | "Director" | "TenPercentOwner" | "OfficerOrDirector" | "Ceo"; ownerCik?: string; issuerCik?: string; includeAwards?: boolean };
export type ScreenMetric = { type: "ObservedPrice" | "BarVolume" | "BarDollarVolume" }
  | { type: "Disclosure"; source: DisclosureWatchlistSource };
export type ScreenRule = { type: "Compare"; field: string; op: "Gt" | "Gte" | "Lt" | "Lte" | "Eq" | "Ne"; value: number }
  | { type: "All" | "Any"; rules: ScreenRule[] };
export type ScreenSelection = { type: "Top"; field: string; direction: "Ascending" | "Descending"; limit: number }
  | { type: "Percentile"; field: string; direction: "Ascending" | "Descending"; percentile: number };
export interface ScreenerSource {
  type: "Screener"; columns: { key: string; metric: ScreenMetric }[]; filter: ScreenRule;
  selection?: ScreenSelection; refreshMinutes: number;
}
export interface UpdateWatchlistAction {
  type: "UpdateWatchlist";
  watchlistKey: string;
  output?: {
    name?: string;
    purpose?: string;
    alertSettings?: { onChange: boolean; inApp: boolean; email: boolean; briefCadence: "inherit" | "daily" | "weekly" | "never" };
  };
  source: DisclosureWatchlistSource | ScreenerSource;
}
export interface LaunchAgentAction {
  type: "LaunchAgent";
  watchlistId?: string;
  planningModel: string;
  executionModel: string;
  initialMessage: string;
  maxIterations: number;
  includeMarketData: boolean;
  continueExisting: boolean;
  skipPlanning: boolean;
  cooldownMinutes?: number;
}
export interface MeanVarianceAllocationPolicy {
  type: "MeanVariance";
  lookbackPeriods: number;
  minimumObservations: number;
  riskAversion: number;
  expectedReturnShrinkage: number;
  covarianceShrinkage: number;
  turnoverPenalty: number;
  estimatedTransactionCostBps: number;
}
export interface RiskParityAllocationPolicy {
  type: "RiskParity";
  lookbackPeriods: number;
  minimumObservations: number;
  covarianceShrinkage: number;
  turnoverPenalty: number;
  estimatedTransactionCostBps: number;
}
export interface MaximumDiversificationAllocationPolicy {
  type: "MaximumDiversification";
  lookbackPeriods: number;
  minimumObservations: number;
  covarianceShrinkage: number;
  turnoverPenalty: number;
  estimatedTransactionCostBps: number;
}
export type AllocationPolicy = MeanVarianceAllocationPolicy | RiskParityAllocationPolicy | MaximumDiversificationAllocationPolicy;
export interface VolatilityTargetExposurePolicy {
  type: "VolatilityTarget";
  lookbackPeriods: number;
  minimumObservations: number;
  covarianceShrinkage: number;
  targetAnnualizedVolatilityPercent: number;
  estimatedTransactionCostBps: number;
}
export type ExposurePolicy = VolatilityTargetExposurePolicy;
/** Book-level sizing is deploymentPercent. totalBudget is RebalanceOption-only and absent by design. */
export interface DynamicRebalanceAction {
  type: "DynamicRebalance";
  universe: Universe;
  pipeline: PipelineStage[];
  weightIndicator: Indicator | CandidateIndicator;
  limit?: number;
  deploymentPercent?: Indicator;
  reserveOptionBudget?: DeploymentBudget;
  perNameAllocation?: PerNameAllocation;
  /**
   * Candidate-bound gate on NON-TARGET FULL EXITS only. Omitted = always sell
   * (legacy behavior). Trims of still-selected names are not gated. Unavailable
   * indicator values fail closed (retain). deploymentPercent: 0 overrides.
   */
  canSell?: Condition | CandidateCondition;
  /**
   * Permits negative rebalance targets (equity short legs, whole shares).
   * Backtests and paper assume shares were available to short each morning
   * and accrue a modeled borrow fee. Live deploy needs a brokerage that can
   * short stock (Alpaca, Tradier, TradeStation, Public; margin account);
   * elsewhere deploy is rejected. For a fixed-size short of one stock use
   * short() / cover() instead.
   */
  allowShorts?: boolean;
  allocationPolicy?: AllocationPolicy;
  exposurePolicy?: ExposurePolicy;
}
/** Book-level sizing is totalBudget. deploymentPercent is DynamicRebalance-only and absent by design. */
export interface RebalanceOptionAction {
  type: "RebalanceOption";
  universe: Universe;
  pipeline: PipelineStage[];
  weightIndicator: Indicator | CandidateIndicator;
  structureTemplates: OptionStructureTemplate[];
  limit?: number;
  totalBudget?: DeploymentBudget;
  perNameAllocation?: OptionAllocation;
  sizingMode?: "fixedPerName" | "proportionalToWeight" | "proportionalToWeightWholeContracts";
  positionScope?: RebalanceOptionPositionScope;
  sleeves?: RebalanceOptionSleeve[];
  allocationPolicy?: AllocationPolicy;
  exposurePolicy?: ExposurePolicy;
  /** Disclosure maintenance only: requires a NewPoliticalDisclosure Option condition with exactly one memberId; integer 1..90. Not a generic DTE roll. */
  renewBeforeDays?: number;
  /** Disclosure maintenance only: revisit continuing public option targets when another option filing arrives. Same condition restriction as renewBeforeDays. */
  revisitDisclosedTargets?: boolean;
}
export type OptionParentSelectionSort = "oldest" | "highestPnl" | "nearestExpiry";
export type ParentStrikeOffset =
  | { type: "amount"; value: number }
  | { type: "percent"; value: number };
/** Parent-position selector for writing a short against an existing long (covered write). */
export interface OptionPositionSelector {
  underlyings?: string[];
  optionType: OptionType;
  direction: OptionDirection;
  minParentPnlPercent?: number;
  maxParentPnlPercent?: number;
  selection?: { sort: OptionParentSelectionSort; limit?: number };
  coverageRatio?: number;
  requireShortStrikeAboveParentStrike?: boolean;
  strikeOffsetFromParent?: ParentStrikeOffset;
}
export interface OpenOptionAction {
  type: "OpenOption";
  builder: OptionsBuilder;
  allocation?: OptionAllocation;
  against?: OptionPositionSelector;
}
export type CloseQuantity =
  | { type: "all" }
  | { type: "contracts"; count: number }
  | { type: "percent"; percent: number };
/** Position selectors AND together; triggers[] OR together. */
export interface CloseOptionAction {
  type: "CloseOption";
  underlyings?: string[];
  optionType?: OptionType;
  direction?: OptionDirection;
  spreadType?: OptionSpreadType;
  closeScope?: CloseScope;
  triggers?: CloseOptionTrigger[];
  quantity?: CloseQuantity;
}
export type Action =
  | BuyOrSellAction
  | AlertAction
  | LaunchAgentAction
  | DynamicRebalanceAction
  | RebalanceOptionAction
  | OpenOptionAction
  | CloseOptionAction
  | UpdateWatchlistAction;

export type StrategyLimitWorkingTime =
  | { type: "Day" }
  | { type: "Minutes"; minutes: number };
export type StrategyLimitPricePolicy =
  | { type: "QuoteRelative"; reference: "Current" }
  | { type: "UnitPrice"; amount: number }
  | { type: "MaximumNetDebit"; amount: number | Indicator }
  | { type: "MinimumNetCredit"; amount: number | Indicator };
export type StrategyOrderExecutionPolicy =
  | { type: "Market" }
  | {
      type: "Limit";
      price: StrategyLimitPricePolicy;
      workingTime?: StrategyLimitWorkingTime;
    };

/**
 * `automaticOrderApproval` is deliberately absent. It is system-managed and always
 * false for agent-created strategies, and placing it on an action fails validation —
 * so exposing it would only let a model author something the server rejects.
 */
export interface Strategy {
  name: string; condition: StrategyCondition; action: Action;
  active?: boolean;
  /** Omitted means Market. Limit always requires an explicit price policy. */
  orderExecution?: StrategyOrderExecutionPolicy;
  /** Backtest-only exit priority. CancelConflictingBuys cannot deploy to paper/live trading. */
  pendingOrderPolicy?: "Wait" | "WaitForTarget" | "CancelConflictingBuys";
}
export interface AuthoredIndustryFilter {
  mode: "ALL" | "INCLUDE_ONLY"; match: "ANY" | "ALL"; industries: readonly string[];
}
/**
 * Which stocks the portfolio's dynamic universes may select. Omitted fields keep
 * the default: minimumMarketCapUsd 1_000_000_000, no maximum, every industry,
 * missing caps EXCLUDE, one share class per company.
 */
export interface AuthoredStockEligibility {
  minimumMarketCapUsd?: number;
  maximumMarketCapUsd?: number | null;
  industryFilter?: AuthoredIndustryFilter;
  /** INCLUDE keeps names with no known market cap (most ETFs). */
  missingMarketCapBehavior?: "EXCLUDE" | "INCLUDE";
  /** ALL_CLASSES lets a pairs book hold both GOOG and GOOGL. */
  shareClassBehavior?: "ONE_PER_COMPANY" | "ALL_CLASSES";
}
/** Automated trading is never authored: only the owner enables it, in the NexusTrade UI. */
export interface AuthoredPortfolioPolicy {
  stockEligibility: AuthoredStockEligibility;
}
export interface AuthoredDeploymentTiming {
  frequency: "Constant" | "OpenClose";
  openDelayMinutes?: number; closeLeadMinutes?: number; intervalSeconds?: number;
}
export interface Portfolio {
  name: string; initialValue?: number; cash?: number; buyingPower?: number;
  strategies: Strategy[];
  main?: boolean; supportsFractionalShares?: boolean; supportsCrypto?: boolean;
  alertsEnabled?: boolean;
  /** "cash" (default when omitted) or "reinvest" into the paying stock. */
  dividendPolicy?: DividendPolicy;
    /** Cash-only T+1 proceeds. Missing live cash-cap evidence blocks purchases. */
    cashSettlement?: "T1" | null;
  policy?: AuthoredPortfolioPolicy;
  deployment?: AuthoredDeploymentTiming;
}
export type DividendPolicy = "cash" | "reinvest";

export type AssetType = "Stock" | "Cryptocurrency" | "Option" | "Other";
export type Interval = "Day" | "Hour" | "Minute" | "TradingDay" | "TradingMinute";
export type Comparator = "lessThan" | "greaterThan" | "lessThanOrEqual" | "greaterThanOrEqual" | "equal" | "notEqual";
export type SelectDirection = "Highest" | "Lowest";
export type UniverseSource = "ALL_US_STOCKS" | "SP500" | "NASDAQ100" | "DJIA" | "CRYPTO" | "SPECIFIC_ASSETS" | "WATCHLIST";
export type AllocationType = "percent of portfolio" | "percent of buying power" | "percent of current positions" | "dollars" | "number of assets";
export type OptionAllocationType = "dollars" | "percent of portfolio" | "percent of buying power" | "contracts" | "percent of realized premium";
export type DeploymentBudgetType = "dollars" | "percent of portfolio";
export type ExpirationPreference = "nearest" | "middle" | "furthest";
export type StrikeDistanceType = "percent" | "dollars" | "delta";
export type StrikeRangeIteration = "OTMToITM" | "ITMToOTM";
export type ExpirationRangeIteration = "ShortestFirst" | "LongestFirst";
export type CloseQuantityType = "all" | "contracts" | "percent";
export type OptionType = "call" | "put";
export type OptionDirection = "long" | "short";
export type OptionSpreadType = "vertical" | "calendar" | "diagonal" | "ironCondor" | "straddle" | "strangle" | "custom";
export type CloseScope = "spread" | "leg";
export type RebalanceOptionPositionScope = "portfolio" | "strategy";
export type FundamentalMetric = "totalRevenue" | "grossProfit" | "operatingIncome" | "ebitda" | "epsActual" | "epsEstimate" | "netIncome" | "freeCashFlow" | "totalAssets" | "totalLiab" | "shortTermDebt" | "longTermDebt" | "commonStockSharesOutstanding" | "dividendYield" | "openingPrice" | "highestPrice" | "lowestPrice" | "closingPrice" | "volume" | "marketCap" | "peRatioTTM" | "psRatioTTM" | "pbRatioTTM" | "enterpriseValue";
export type Period = "Year" | "Quarter" | "Month";
export type PositionEffect = "open" | "close";
export type OrderStatus = "Pending" | "Accepted" | "Pending User Approval" | "Canceled" | "Filled" | "Partially Filled";
export type Side = "Buy" | "Sell";
export type Clock = "Calendar" | "Trading";
export type Measure = "Mean" | "Median" | "NetCount" | "ArticleCount";
export type Role = "Any" | "Officer" | "Director" | "TenPercentOwner" | "OfficerOrDirector" | "Ceo";
export type Instrument = "Equity" | "Call" | "Put";
export type Instrument2 = "Equity" | "Option";
export type MinOrMax = "min" | "max";
export type AmountBasis = "LowerBound" | "Midpoint" | "UpperBound";

export const CANDIDATE = { __candidate: true } as unknown as Candidate;
/** Portfolio-wide targetAssets: [] — rebalance cadence, not per-ticker DCA. */
export const PORTFOLIO_WIDE = { __portfolioWide: true } as unknown as PortfolioWide;

function isCandidate(a: AssetArg): boolean {
  return typeof a === "object" && a !== null && (a as { __candidate?: true }).__candidate === true;
}

function isPortfolioWide(a: unknown): a is PortfolioWide {
  return typeof a === "object" && a !== null && (a as { __portfolioWide?: true }).__portfolioWide === true;
}

/** Crypto ticker aliases for cryptoAsset() (BTC → BTC-USD). */
const CRYPTO_SYMBOL_ALIASES: Record<string, string> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
  DOGE: "DOGE-USD",
  ADA: "ADA-USD",
  XRP: "XRP-USD",
  AVAX: "AVAX-USD",
  LINK: "LINK-USD",
  DOT: "DOT-USD",
  MATIC: "MATIC-USD",
  "BTC-USD": "BTC-USD",
  "ETH-USD": "ETH-USD",
  "SOL-USD": "SOL-USD",
  "DOGE-USD": "DOGE-USD",
  "ADA-USD": "ADA-USD",
  "XRP-USD": "XRP-USD",
  "AVAX-USD": "AVAX-USD",
  "LINK-USD": "LINK-USD",
  "DOT-USD": "DOT-USD",
  "MATIC-USD": "MATIC-USD",
};

function normalizeCryptoSymbol(symbol: string): string | null {
  const key = symbol.trim().toUpperCase();
  if (CRYPTO_SYMBOL_ALIASES[key]) return CRYPTO_SYMBOL_ALIASES[key];
  return null;
}

/**
 * FormGroup.targetAssets reads `asset.name` (plural); targetAsset reads `symbol`
 * (singular). Always set both so PositionValue / DaysSinceOrder round-trip.
 * Bare ticker strings are rejected — use stockAsset() / cryptoAsset().
 */
function toAsset(a: AssetArg): Asset {
  if (typeof a === "string") {
    throw new Error(
      'Bare ticker strings are not allowed (got ' +
        JSON.stringify(a) +
        '). Use stockAsset("AAPL") or cryptoAsset("BTC").',
    );
  }
  if (isCandidate(a) || isPortfolioWide(a)) {
    throw new Error("CANDIDATE / PORTFOLIO_WIDE are not concrete assets");
  }
  const asset = a as Asset;
  const ticker = (asset.symbol || asset.name || "").trim().toUpperCase();
  if (asset.type === "Cryptocurrency") {
    const sym = normalizeCryptoSymbol(ticker) ?? (ticker.endsWith("-USD") ? ticker : ticker + "-USD");
    return { type: "Cryptocurrency", symbol: sym, name: sym };
  }
  return { type: asset.type, symbol: ticker, name: asset.name || ticker };
}

/** Equity/ETF asset — required for stock/ETF buy/sell/indicators. */
export const stockAsset = (symbol: string): Asset => {
  const sym = symbol.trim().toUpperCase();
  return { type: "Stock", symbol: sym, name: sym };
};

/** Cryptocurrency asset (BTC → BTC-USD) — required for crypto buy/sell/indicators. */
export const cryptoAsset = (symbol: string): Asset => {
  const cryptoSym = normalizeCryptoSymbol(symbol) ?? (symbol.trim().toUpperCase() + "-USD");
  return { type: "Cryptocurrency", symbol: cryptoSym, name: cryptoSym };
};

/** Attach an asset field, or omit it entirely when bound to the pipeline candidate. */
function setAsset(target: Record<string, unknown>, key: string, a: AssetArg): void {
  if (isCandidate(a) || isPortfolioWide(a)) return;
  target[key] = toAsset(a);
}

function setAssets(
  target: Record<string, unknown>,
  key: string,
  list: AssetArg | AssetArg[] | undefined,
): void {
  if (list === undefined) return;
  // Explicit portfolio-wide: empty array on the wire (YAML targetAssets: []).
  if (isPortfolioWide(list) || (Array.isArray(list) && list.length === 0)) {
    target[key] = [];
    return;
  }
  const arr = Array.isArray(list) ? list : [list];
  if (arr.some(isPortfolioWide)) {
    target[key] = [];
    return;
  }
  target[key] = arr.filter((a) => !isCandidate(a)).map(toAsset);
}

/**
 * Drop undefined keys so optional args never serialise as explicit nulls.
 * Constrained to `object`, not `Record<string, unknown>`: declared interfaces
 * have no index signature, so the stricter bound rejects any typed config
 * (e.g. againstParent(OptionPositionSelector)) that is not an object literal.
 */
function compact<T extends object>(obj: T): T {
  const source = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out as T;
}

function compare(lhs: Indicator, rhs: Indicator | number, comparison: Comparator): Condition {
  const right = typeof rhs === "number" ? Value(rhs) : rhs;
  // Wire nodes carry no brand at runtime; nodeKind exists only in the types.
  return { type: "Base", lhs, comparison, rhs: right } as unknown as Condition;
}

export const gt = (l: Indicator, r: Indicator | number): Condition => compare(l, r, "greaterThan");
export const lt = (l: Indicator, r: Indicator | number): Condition => compare(l, r, "lessThan");
export const gte = (l: Indicator, r: Indicator | number): Condition => compare(l, r, "greaterThanOrEqual");
export const lte = (l: Indicator, r: Indicator | number): Condition => compare(l, r, "lessThanOrEqual");
export const eq = (l: Indicator, r: Indicator | number): Condition => compare(l, r, "equal");
export const neq = (l: Indicator, r: Indicator | number): Condition => compare(l, r, "notEqual");

export const and = (...conditions: Condition[]): Condition => ({ type: "And", conditions } as unknown as Condition);
export const or = (...conditions: Condition[]): Condition => ({ type: "Or", conditions } as unknown as Condition);
/** Multi: true when at least `count` of `conditions` hold. */
export const atLeast = (count: number, ...conditions: Condition[]): Condition =>
  ({ type: "Multi", comparison: "greaterThanOrEqual", value: count, conditions } as unknown as Condition);
/** Multi: true when at most `count` of `conditions` hold. */
export const atMost = (count: number, ...conditions: Condition[]): Condition =>
  ({ type: "Multi", comparison: "lessThanOrEqual", value: count, conditions } as unknown as Condition);
/** Multi: true when fewer than `count` of `conditions` hold. */
export const fewerThan = (count: number, ...conditions: Condition[]): Condition =>
  ({ type: "Multi", comparison: "lessThan", value: count, conditions } as unknown as Condition);
/** Multi: true when exactly `count` of `conditions` hold. */
export const exactly = (count: number, ...conditions: Condition[]): Condition =>
  ({ type: "Multi", comparison: "equal", value: count, conditions } as unknown as Condition);
/** Multi with an explicit Comparator (same wire shape as YAML Multi). */
export const multi = (
  count: number, comparison: Comparator, ...conditions: Condition[]
): Condition => ({ type: "Multi", comparison, value: count, conditions } as unknown as Condition);
/**
 * Sequence. `andThen(30, "Minute", A, B)` is true at tick t when B is true at t
 * and A was true at some STRICTLY EARLIER tick in the preceding 30 minutes.
 *
 * Simultaneous A and B does not fire — that is `and`. The window applies per
 * transition, so with three or more steps each one must occur within the window
 * of the step before it. Nesting is legal and means something different:
 * `andThen(W, andThen(W, A, B), C)` is not `andThen(W, A, B, C)`.
 *
 * `interval` is REQUIRED and has no default. An omitted interval would fall
 * back to Day and silently kill an intraday setup.
 *
 * Named `andThen` rather than `then`: a module namespace with a callable
 * `then` export is assimilated as a thenable, so `await import("nexustrade")`
 * would call it with resolve/reject and never settle. Emits wire type "Then",
 * the same way atLeast/atMost/exactly emit "Multi".
 */
export function andThen(length: number, interval: Interval, ...conditions: Condition[]): Condition;
export function andThen(timing: ThenTiming, ...conditions: Condition[]): Condition;
export function andThen(
  timing: number | ThenTiming, first: Interval | Condition, ...rest: Condition[]
): Condition {
  return (typeof timing === "number"
    ? { type: "Then", conditions: rest, window: { length: timing, interval: first } }
    : { type: "Then", ...timing, conditions: [first, ...rest] }) as unknown as Condition;
}
/** Always-true gate for strategies whose cadence lives in the pipeline. */
export const always = (): Condition => compare(Value(1), Value(0), "greaterThan");

export const meanVarianceAllocation = (
  config: Partial<Omit<MeanVarianceAllocationPolicy, "type">> = {},
): MeanVarianceAllocationPolicy => ({
  type: "MeanVariance",
  lookbackPeriods: 252,
  minimumObservations: 60,
  riskAversion: 4,
  expectedReturnShrinkage: 0.5,
  covarianceShrinkage: 0.25,
  turnoverPenalty: 1,
  estimatedTransactionCostBps: 10,
  ...config,
});

export const riskParityAllocation = (
  config: Partial<Omit<RiskParityAllocationPolicy, "type">> = {},
): RiskParityAllocationPolicy => ({
  type: "RiskParity",
  lookbackPeriods: 252,
  minimumObservations: 60,
  covarianceShrinkage: 0.25,
  turnoverPenalty: 1,
  estimatedTransactionCostBps: 10,
  ...config,
});

export const maximumDiversificationAllocation = (
  config: Partial<Omit<MaximumDiversificationAllocationPolicy, "type">> = {},
): MaximumDiversificationAllocationPolicy => ({
  type: "MaximumDiversification",
  lookbackPeriods: 252,
  minimumObservations: 60,
  covarianceShrinkage: 0.25,
  turnoverPenalty: 1,
  estimatedTransactionCostBps: 10,
  ...config,
});

export const volatilityTarget = (
  config: Partial<Omit<VolatilityTargetExposurePolicy, "type">> = {},
): VolatilityTargetExposurePolicy => ({
  type: "VolatilityTarget",
  lookbackPeriods: 60,
  minimumObservations: 20,
  covarianceShrinkage: 0.25,
  targetAnnualizedVolatilityPercent: 12,
  estimatedTransactionCostBps: 10,
  ...config,
});

const rebalanceDecisionMetric = (
  metric: "allocationDrift" | "plannedTurnover" | "estimatedCost" | "expectedBenefit" | "netBenefit",
): Indicator => ({ type: "RebalanceDecisionMetric", metric } as unknown as Indicator);
export const RebalanceAllocationDrift = (): Indicator =>
  rebalanceDecisionMetric("allocationDrift");
export const RebalancePlannedTurnover = (): Indicator =>
  rebalanceDecisionMetric("plannedTurnover");
export const RebalanceEstimatedCost = (): Indicator =>
  rebalanceDecisionMetric("estimatedCost");
export const RebalanceExpectedBenefit = (): Indicator =>
  rebalanceDecisionMetric("expectedBenefit");
export const RebalanceNetBenefit = (): Indicator =>
  rebalanceDecisionMetric("netBenefit");


export const filter = (condition: Condition): PipelineStage => ({ type: "Filter", condition });
export const selectTop = (
  metric: Indicator, limit: number, direction: SelectDirection = "Highest",
): PipelineStage => ({ type: "SelectTop", metric, limit, direction });
export const selectPercentile = (
  metric: Indicator, percentile: number, direction: SelectDirection = "Highest",
): PipelineStage => ({ type: "SelectPercentile", metric, percentile, direction });

export function universe(source: "ALL_US_STOCKS" | "SP500" | "NASDAQ100" | "DJIA" | "CRYPTO"): Universe;
export function universe(source: "SPECIFIC_ASSETS", assets: AssetArg[]): Universe;
export function universe(source: UniverseSource, assets?: AssetArg[]): Universe {
  if (source === "SPECIFIC_ASSETS") {
    return { source, assets: (assets ?? []).map(toAsset) } as Universe;
  }
  return { source } as Universe;
}

/** The latest revision of the list an updateWatchlist producer in this portfolio maintains. */
export const watchlistUniverse = (watchlistKey: string): Universe => ({ source: "WATCHLIST", watchlistKey });

// ---- equity + cash actions ----

export const buy = (
  target: AssetArg, amount: number, type: AllocationType = "percent of portfolio",
  options: {executionPriority?:ExecutionPriority;funding?:PurchaseFunding} = {},
): BuyOrSellAction =>
  ({ type: "Buy", targetAsset: toAsset(target), amount: { type, amount },...options });
export const sell = (
  target: AssetArg, amount: number, type: AllocationType = "percent of portfolio",
  options: {executionPriority?:ExecutionPriority} = {},
): BuyOrSellAction =>
  ({ type: "Sell", targetAsset: toAsset(target), amount: { type, amount },...options });
/**
 * Sell-to-open one stock: hold a short of exactly the sized shares. Sizing is
 * "number of assets" (shares), "dollars", "percent of portfolio" or "percent of
 * buying power"; capped by Reg-T initial margin. Refused while the book is long
 * the stock. Needs a brokerage that can short stock (backtests and paper can).
 */
export const short = (
  target: AssetArg, amount: number, type: AllocationType = "number of assets",
  options: {executionPriority?:ExecutionPriority} = {},
): BuyOrSellAction =>
  ({ type: "Short", targetAsset: toAsset(target), amount: { type, amount },...options });
/**
 * Buy back an open stock short. "percent of current positions" is a percent of
 * the open short; every size is capped at the short, so Cover never goes long.
 */
export const cover = (
  target: AssetArg, amount = 100, type: AllocationType = "percent of current positions",
  options: {executionPriority?:ExecutionPriority} = {},
): BuyOrSellAction =>
  ({ type: "Cover", targetAsset: toAsset(target), amount: { type, amount },...options });
/** Sell only actual holdings that pass a candidate-bound condition. */
export const sellHoldings = (condition:Condition,amount=100,type:AllocationType="percent of current positions",
  options:{executionPriority?:ExecutionPriority}={}):BuyOrSellAction=>({type:"Sell",targetAsset:stockAsset("__PLACEHOLDER__"),
    holdingCondition:condition,amount:{type,amount},...options});
export const alert = (message: string): AlertAction => ({ type: "Alert", message });
export const launchAgent = (config: {
  planningModel: string; executionModel: string; initialMessage: string;
  maxIterations: number; includeMarketData: boolean; continueExisting: boolean;
  skipPlanning: boolean; cooldownMinutes?: number; watchlistId?: string;
}): LaunchAgentAction => compact({ type: "LaunchAgent", ...config }) as LaunchAgentAction;
export const updateWatchlist = (config: {
  watchlistKey: string; memberId: string;
  output?: UpdateWatchlistAction["output"];
  instrument?: "Equity" | "Option" | "All";
  amountBasis?: "LowerBound" | "Midpoint" | "UpperBound";
  chamber?: "All" | "House" | "Senate";
}): UpdateWatchlistAction & { source: Extract<DisclosureWatchlistSource, {type: "PoliticalRemainingPurchases"}> } => ({
  type: "UpdateWatchlist",
  watchlistKey: config.watchlistKey,
  ...(config.output ? { output: config.output } : {}),
  source: compact({
    type: "PoliticalRemainingPurchases",
    memberId: config.memberId,
    instrument: config.instrument,
    amountBasis: config.amountBasis,
    chamber: config.chamber,
  }) as Extract<DisclosureWatchlistSource, {type: "PoliticalRemainingPurchases"}>,
});

export const updateInstitutionalWatchlist = (config: {
  watchlistKey: string; managerCik: string; windowDays?: number;
  output?: UpdateWatchlistAction["output"];
}): UpdateWatchlistAction & { source: Extract<DisclosureWatchlistSource, {type: "InstitutionalHoldings"}> } => ({
  type: "UpdateWatchlist", watchlistKey: config.watchlistKey,
  ...(config.output ? { output: config.output } : {}),
  source: compact({ type: "InstitutionalHoldings", managerCik: config.managerCik, windowDays: config.windowDays }) as Extract<DisclosureWatchlistSource, {type: "InstitutionalHoldings"}>,
});
export const updateInsiderWatchlist = (config: {
  watchlistKey: string; windowDays: number;
  role?: "Any" | "Officer" | "Director" | "TenPercentOwner" | "OfficerOrDirector" | "Ceo";
  ownerCik?: string; issuerCik?: string; includeAwards?: boolean; output?: UpdateWatchlistAction["output"];
}): UpdateWatchlistAction & { source: Extract<DisclosureWatchlistSource, {type: "InsiderPurchases"}> } => ({
  type: "UpdateWatchlist", watchlistKey: config.watchlistKey,
  ...(config.output ? { output: config.output } : {}),
  source: compact({ type: "InsiderPurchases", windowDays: config.windowDays, role: config.role,
    ownerCik: config.ownerCik, issuerCik: config.issuerCik, includeAwards: config.includeAwards }) as Extract<DisclosureWatchlistSource, {type: "InsiderPurchases"}>,
});

/** Scalar PIT screen: facts are sampled only when due. Volume uses certified completed historical OHLC at the replay interval; live quote/trade volume stays unknown. */
export const updateScreenerWatchlist = (config: Omit<ScreenerSource, "type"> & {
  watchlistKey: string; output?: UpdateWatchlistAction["output"];
}): UpdateWatchlistAction & {source: ScreenerSource} => ({
  type: "UpdateWatchlist", watchlistKey: config.watchlistKey,
  ...(config.output ? {output: config.output} : {}),
  source: compact({type: "Screener", columns: config.columns, filter: config.filter,
    selection: config.selection, refreshMinutes: config.refreshMinutes}) as ScreenerSource,
});
export const screenColumn = (key: string, metric: ScreenMetric): ScreenerSource["columns"][number] => ({key, metric});
export const screenPrice = (): ScreenMetric => ({type: "ObservedPrice"});
export const screenBarVolume = (): ScreenMetric => ({type: "BarVolume"});
export const screenBarDollarVolume = (): ScreenMetric => ({type: "BarDollarVolume"});
export const screenDisclosure = (source: DisclosureWatchlistSource): ScreenMetric => ({type: "Disclosure", source});
export const screenCompare = (field: string, op: "Gt" | "Gte" | "Lt" | "Lte" | "Eq" | "Ne", value: number): ScreenRule => ({type: "Compare", field, op, value});
export const screenAll = (...rules: ScreenRule[]): ScreenRule => ({type: "All", rules});
export const screenAny = (...rules: ScreenRule[]): ScreenRule => ({type: "Any", rules});
export const screenTop = (field: string, limit: number, direction: "Ascending" | "Descending" = "Descending"): ScreenSelection => ({type: "Top", field, direction, limit});
export const screenPercentile = (field: string, percentile: number, direction: "Ascending" | "Descending" = "Descending"): ScreenSelection => ({type: "Percentile", field, direction, percentile});

export const dynamicRebalance = (config: {
  universe: Universe; pipeline: PipelineStage[]; weightIndicator: Indicator | CandidateIndicator;
  limit?: number; deploymentPercent?: Indicator; reserveOptionBudget?: DeploymentBudget; perNameAllocation?: PerNameAllocation;
  canSell?: Condition | CandidateCondition;
  allowShorts?: boolean;
  allocationPolicy?: AllocationPolicy;
  exposurePolicy?: ExposurePolicy;
}): DynamicRebalanceAction => compact({ type: "DynamicRebalance", ...config }) as DynamicRebalanceAction;

// ---- options ----

/**
 * One leg of a spread. Distance is signed from ATM; 0 is ATM.
 * Delta targeting is a discriminated union: distanceType: "delta" requires
 * fallbackDistance+fallbackDistanceType OR fallbackStrikeSelector.
 */
export const leg = (config: LegConfig): OptionsBuilderLeg => {
  const distanceType = config.distanceType ?? "percent";
  if (distanceType === "delta") {
    const hasFallback =
      config.fallbackStrikeSelector !== undefined ||
      (config.fallbackDistance !== undefined && config.fallbackDistanceType !== undefined);
    if (!hasFallback) {
      throw new Error(
        'leg({ distanceType: "delta" }) requires fallbackDistance+fallbackDistanceType or fallbackStrikeSelector',
      );
    }
  }
  const strikeSelector: StrikeSelector = {
    distanceType,
    distance: config.distance,
  };
  const fallbackStrikeSelector: StrikeSelector | undefined =
    config.fallbackStrikeSelector ??
    (config.fallbackDistance !== undefined
      ? {
          distanceType: config.fallbackDistanceType ?? "percent",
          distance: config.fallbackDistance,
        }
      : undefined);
  return compact({
    optionType: config.optionType,
    direction: config.direction,
    expirationSelector: {
      minDaysToExpiration: config.minDaysToExpiration,
      maxDaysToExpiration: config.maxDaysToExpiration,
      preference: config.preference ?? "nearest",
    },
    strikeSelector,
    fallbackStrikeSelector,
    strikeRange: config.strikeRange,
    expirationRange: config.expirationRange,
    ratio: config.ratio,
    greekFilter: config.greekFilter,
    liquidityFilter: config.liquidityFilter,
  }) as OptionsBuilderLeg;
};

export const optionsBuilder = (config: {
  legs: OptionsBuilderLeg[];
  underlyingSymbol?: string;
  dynamicUnderlying?: DynamicUnderlying;
  spreadType?: OptionSpreadType;
}): OptionsBuilder => compact(config) as OptionsBuilder;

export const againstParent = (
  config: OptionPositionSelector,
): OptionPositionSelector => compact(config) as OptionPositionSelector;

export const openOption = (config: {
  builder: OptionsBuilder;
  allocation?: OptionAllocation;
  against?: OptionPositionSelector;
}): OpenOptionAction => compact({ type: "OpenOption", ...config }) as OpenOptionAction;

export const structureTemplate = (config: {
  legs: OptionsBuilderLeg[];
  name?: string;
  eligibility?: Condition | CandidateCondition;
  spreadType?: OptionSpreadType;
  widthConstraint?: SpreadWidthConstraint;
}): OptionStructureTemplate => compact(config) as OptionStructureTemplate;

export const sleeve = (config: {
  name: string;
  universe?: Universe;
  pipeline?: PipelineStage[];
  weightIndicator?: Indicator | CandidateIndicator;
  limit?: number;
  perNameAllocation?: OptionAllocation;
  structureTemplates?: OptionStructureTemplate[];
}): RebalanceOptionSleeve => compact(config) as RebalanceOptionSleeve;

/**
 * Rank a universe and rotate an option book. Keep take-profit / stop-loss / DTE
 * exits in separate closeOption strategies, not here.
 */
export const rebalanceOption = (config: Omit<RebalanceOptionAction, "type">): RebalanceOptionAction =>
  compact({ type: "RebalanceOption", ...config }) as RebalanceOptionAction;

export const pnlTrigger = (bounds: { minPnlPercent?: number; maxPnlPercent?: number }): CloseOptionTrigger =>
  compact({ type: "pnl", ...bounds }) as CloseOptionTrigger;
export const dteTrigger = (bounds: { minDte?: number; maxDte?: number }): CloseOptionTrigger =>
  compact({ type: "dte", ...bounds }) as CloseOptionTrigger;
export const daysHeldTrigger = (bounds: { minDaysHeld?: number; maxDaysHeld?: number }): CloseOptionTrigger =>
  compact({ type: "daysHeld", ...bounds }) as CloseOptionTrigger;
export const greeksTrigger = (bounds: {
  minSpreadDelta?: number; maxSpreadDelta?: number;
  minIv?: number; maxIv?: number;
  minSpreadTheta?: number; maxSpreadTheta?: number;
}): CloseOptionTrigger => compact({ type: "greeks", ...bounds }) as CloseOptionTrigger;

export const closeOption = (config: {
  underlyings?: string[];
  optionType?: OptionType;
  direction?: OptionDirection;
  spreadType?: OptionSpreadType;
  closeScope?: CloseScope;
  triggers?: CloseOptionTrigger[];
  quantity?: CloseQuantity;
} = {}): CloseOptionAction => compact({ type: "CloseOption", ...config }) as CloseOptionAction;

export const limitOrder = (config: {
  price: StrategyLimitPricePolicy;
  workingTime?: StrategyLimitWorkingTime;
}): StrategyOrderExecutionPolicy => compact({ type: "Limit", ...config }) as StrategyOrderExecutionPolicy;

export const currentLimit = (): StrategyLimitPricePolicy => ({
  type: "QuoteRelative",
  reference: "Current",
});

export const unitPriceLimit = (amount: number): StrategyLimitPricePolicy => ({
  type: "UnitPrice",
  amount,
});

/** Dollars per share, or an indicator evaluated when the strategy fires. */
export const maximumNetDebit = (amount: number | Indicator): StrategyLimitPricePolicy => ({
  type: "MaximumNetDebit",
  amount,
});

/** Dollars per share, or an indicator evaluated when the strategy fires. */
export const minimumNetCredit = (amount: number | Indicator): StrategyLimitPricePolicy => ({
  type: "MinimumNetCredit",
  amount,
});

export const goodForDay = (): StrategyLimitWorkingTime => ({ type: "Day" });

export const goodForMinutes = (minutes: number): StrategyLimitWorkingTime => ({
  type: "Minutes",
  minutes,
});

// ---- assembly ----

export const strategy = (
  name: string, condition: StrategyCondition, action: Action,
  options: { active?: boolean; orderExecution?: StrategyOrderExecutionPolicy; pendingOrderPolicy?: Strategy["pendingOrderPolicy"] } = {},
): Strategy => compact({
  name,
  condition,
  action,
  ...options,
  orderExecution: options.orderExecution ?? { type: "Market" },
}) as Strategy;

/**
 * Session / clock flatten — condition carries the gate (MinutesAfterOpen, Day, …).
 * Never pairs with always(); PnL/DTE/daysHeld exits use closeOption({ triggers }).
 * Book-level only — CandidateCondition is rejected (same as strategy when).
 */
export const sessionFlatten = (
  condition: StrategyCondition,
  config: {
    underlyings?: string[];
    optionType?: OptionType;
    direction?: OptionDirection;
    spreadType?: OptionSpreadType;
    closeScope?: CloseScope;
    quantity?: CloseQuantity;
  } = {},
  name = "Session flatten",
): Strategy => strategy(name, condition, closeOption({ ...config }));

export const portfolio = (
  name: string, strategies: Strategy[],
  options: {
    initialValue?: number; main?: boolean;
    supportsFractionalShares?: boolean; supportsCrypto?: boolean; alertsEnabled?: boolean;
    dividendPolicy?: DividendPolicy;
    /** Cash-only T+1 proceeds. Missing live cash-cap evidence blocks purchases. */
    cashSettlement?: "T1" | null;
    policy?: AuthoredPortfolioPolicy;
    deployment?: AuthoredDeploymentTiming;
  } = {},
): PortfolioHandle => {
  const initialValue = options.initialValue ?? 10000;
  return new PortfolioHandle(compact({
    name,
    initialValue,
    cash: initialValue,
    buyingPower: initialValue,
    ...options,
    strategies,
  }));
};

// ---- generated indicator builders ----
/**
 * The absolute value of an indicator.
 */
export function AbsoluteValue(operand: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "AbsoluteValue" };
  d.indicators = [operand];
  return d as unknown as Indicator;
}
/**
 * Running total of close-location value times volume. Unlike OBV it weights where in the range the bar closed, so weak closes on high volume distribute. Range: Unbounded (cumulative).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param interval Bar interval the line is accumulated on
 */
export function AccumulationDistribution(asset: AssetArg, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "AccumulationDistribution" };
  setAsset(d, "targetAsset", asset);
  d["interval"] = interval;
  return d as unknown as Indicator;
}
/**
 * Wilder's ADX: trend strength on 0-100, with optional +DI and -DI trend-direction lines. ADX above ~25 is conventionally a strong trend. Range: 0 to 100.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 * @param line Which ADX-system line to evaluate
 */
export function AverageDirectionalIndex(asset: AssetArg, length: number = 14, interval: Interval = "Day", line: "adx" | "plusDi" | "minusDi" = "adx"): Indicator {
  const d: Record<string, unknown> = { type: "AverageDirectionalIndex" };
  setAsset(d, "targetAsset", asset);
  d["line"] = line;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The average of True Range over a window. A smoothed measure of volatility used for position sizing and stop-losses. Range: >= 0.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function AverageTrueRange(asset: AssetArg, length: number = 14, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "AverageTrueRange" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Detects a bearish fair value gap (3-candle gap down) on minute bars. Returns the gap's resistance price (candle1 low) while the pattern is active; otherwise no value (condition fails). Not a 0/1 flag — never compare to 1. Range: price when present.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function BearishFairValueGap(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "BearishFairValueGap" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * One Bollinger band, returned as a single number: the simple moving average of price plus the given number of standard deviations of price over the same window. A positive number gives the upper band, a negative number the lower band, and 0 the moving average itself. Range: Same scale as price.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 * @param numStandardDeviations How many standard deviations from the mean
 */
export function BollingerBand(asset: AssetArg, length: number = 30, interval: Interval = "Day", numStandardDeviations: number = 1): Indicator {
  const d: Record<string, unknown> = { type: "BollingerBand" };
  setAsset(d, "targetAsset", asset);
  d["numStandardDeviations"] = numStandardDeviations;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
export const BBand = BollingerBand;
/**
 * Detects a bullish fair value gap (3-candle gap up) on minute bars. Returns the gap's support price (candle1 high) while the pattern is active; otherwise no value (condition fails). Not a 0/1 flag — never compare to 1 (that is for CrossAbove/CrossBelow). Range: price when present.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function BullishFairValueGap(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "BullishFairValueGap" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The amount of cash available to make new purchases. Range: >= 0.
 */
export function BuyingPower(): Indicator {
  const d: Record<string, unknown> = { type: "BuyingPower" };
  return d as unknown as Indicator;
}
/**
 * Money flow volume over money volume across N bars, bounded in -1 to +1. Sustained readings above +0.2 show institutional accumulation. Range: -1 to +1.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function ChaikinMoneyFlow(asset: AssetArg, length: number = 20, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "ChaikinMoneyFlow" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Prices, the average close, or the end time of completed chart candles, built from contiguous minute data. Stock candles align to the regular trading session. Range: Same scale as price for open, high, low, close and sma; the endTime line returns the end time of the newest selected candle in Unix seconds.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param barMinutes Completed candles: stocks divide the 390-minute regular session from 9:30 ET. Crypto divides the 1440-minute UTC day or uses 10080 for a Monday UTC week; legacy intraday sizes remain valid. Observation cadence must be Minute even for daily/weekly candles.
 * @param line open: oldest selected candle; close: newest; high/low: range; sma: mean candle closes.
 * @param bars Number of chart candles, not elapsed minutes. SMA20 on five-minute candles: barMinutes=5, bars=20.
 * @param offsetBars Skip this many latest completed candles. 1 selects the previous window.
 * @param minutePolicy strict requires every minute. observed aggregates actual eligible-trade prints, skips empty candles, and publishes after the clock bucket closes. No synthetic prices; source coverage is a separate check.
 */
export function ChartBar(asset: AssetArg, barMinutes: number = 5, line: "open" | "high" | "low" | "close" | "sma" | "endTime" = "close", bars: number = 1, offsetBars: number = 0, minutePolicy: "strict" | "observed" = "strict"): Indicator {
  const d: Record<string, unknown> = { type: "ChartBar" };
  setAsset(d, "targetAsset", asset);
  d["barMinutes"] = barMinutes;
  d["line"] = line;
  d["bars"] = bars;
  d["offsetBars"] = offsetBars;
  d["minutePolicy"] = minutePolicy;
  return d as unknown as Indicator;
}
/**
 * Deviation of the typical price from its moving average, scaled by mean deviation. Readings above +100 are overbought, below -100 oversold. Range: Unbounded (typically -300 to +300).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 * @param constant Divisor scaling the mean deviation
 */
export function CommodityChannelIndex(asset: AssetArg, length: number = 20, interval: Interval = "Day", constant: number = 0.015): Indicator {
  const d: Record<string, unknown> = { type: "CommodityChannelIndex" };
  setAsset(d, "targetAsset", asset);
  d["constant"] = constant;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The annualized growth rate of a fundamental metric over a specified number of years. Smooths out quarterly volatility to show the long-term trend. Range: Unbounded (percentage).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param metric The fundamental metric to use
 * @param years Floating point years value
 */
export function CompoundAnnualGrowthRate(asset: AssetArg, metric: FundamentalMetric, years: number): Indicator {
  const d: Record<string, unknown> = { type: "CompoundAnnualGrowthRate" };
  setAsset(d, "targetAsset", asset);
  d["metric"] = metric;
  d["years"] = years;
  return d as unknown as Indicator;
}
/**
 * Number of consecutive completed calendar periods (America/New_York; period is Year, Quarter or Month), ending with the last completed period, whose closing value of the inner indicator was strictly higher (ConsecutiveIncrease) or strictly lower (ConsecutiveDecrease) than the previous period's closing value. A period's closing value is the inner indicator's last non-null value observed in that period. The in-progress current period never counts, equal values are not a change, and a completed period with no value breaks the streak. The count is capped at lookback (an integer from 1 to 60). Returns null when no completed period has a value. Examples: ConsecutiveIncrease(LastDividend(KO), Year, 10) >= 10 (KO raised its regular dividend per share in each of the last 10 completed years); ConsecutiveIncrease(Fundamental(AAPL, totalRevenue), Quarter, 8) (consecutive completed quarters of higher reported revenue for AAPL, up to 8).
 * @param indicator The inner indicator whose period closing values are compared. Pass CANDIDATE to its asset in a dynamic rebalance pipeline.
 * @param period Calendar period (America/New_York) whose closing values are compared.
 * @param lookback Whole number of completed periods to count, 1 to 60; the streak is capped here.
 */
export function ConsecutiveDecrease(indicator: Indicator, period: Period, lookback: number): Indicator {
  const d: Record<string, unknown> = { type: "ConsecutiveDecrease" };
  d["period"] = period;
  d["lookback"] = lookback;
  d.indicators = [indicator];
  return d as unknown as Indicator;
}
/**
 * Number of consecutive completed calendar periods (America/New_York; period is Year, Quarter or Month), ending with the last completed period, whose closing value of the inner indicator was strictly higher (ConsecutiveIncrease) or strictly lower (ConsecutiveDecrease) than the previous period's closing value. A period's closing value is the inner indicator's last non-null value observed in that period. The in-progress current period never counts, equal values are not a change, and a completed period with no value breaks the streak. The count is capped at lookback (an integer from 1 to 60). Returns null when no completed period has a value. Examples: ConsecutiveIncrease(LastDividend(KO), Year, 10) >= 10 (KO raised its regular dividend per share in each of the last 10 completed years); ConsecutiveIncrease(Fundamental(AAPL, totalRevenue), Quarter, 8) (consecutive completed quarters of higher reported revenue for AAPL, up to 8).
 * @param indicator The inner indicator whose period closing values are compared. Pass CANDIDATE to its asset in a dynamic rebalance pipeline.
 * @param period Calendar period (America/New_York) whose closing values are compared.
 * @param lookback Whole number of completed periods to count, 1 to 60; the streak is capped here.
 */
export function ConsecutiveIncrease(indicator: Indicator, period: Period, lookback: number): Indicator {
  const d: Record<string, unknown> = { type: "ConsecutiveIncrease" };
  d["period"] = period;
  d["lookback"] = lookback;
  d.indicators = [indicator];
  return d as unknown as Indicator;
}
/**
 * Report whether the ordinary condition has stayed true for the elapsed window. This is elapsed time, not a count of checks.
 * @param condition Condition evaluated over the window.
 * @param length Length of time
 * @param interval Unit of time
 */
export function ConsecutiveTrue(condition: Condition, length: number = 1, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "ConsecutiveTrue" };
  d.condition = condition;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Rolling Pearson correlation (-1 to 1) of two indicators' period-over-period returns over N paired observations. Flat or degenerate windows read no-signal instead of a fabricated number.
 * @param operands One list of exactly 2 sub-indicators.
 * @param length Length of time
 * @param interval Unit of time
 */
export function Correlation(operands: Indicator[], length: number = 60, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "Correlation" };
  d.indicators = operands;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Count matching intervals inside a time lookback. The ordinary condition owns comparisons/events. countInterval contributes at most one match per interval; omitted means one unit of the lookback interval. TradingDay skips closed exchange dates.
 * @param condition Ordinary condition whose matching intervals are counted.
 * @param length Lookback length.
 * @param interval Lookback time unit; TradingDay uses observed exchange sessions and TradingMinute (at most 1439) counts regular-session minutes across closed periods.
 * @param countInterval Count at most once per this interval. Omit for one unit of the lookback interval.
 */
export function CountTrue(condition: Condition, length: number = 1, interval: Interval = "Day", countInterval?: { length: number; interval: Interval }): Indicator {
  const d: Record<string, unknown> = { type: "CountTrue" };
  d.condition = condition;
  if (countInterval !== undefined) d["countInterval"] = countInterval;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * CrossAbove and CrossBelow are numeric Indicators, not Conditions: with available operands they return 1 when a crossing is detected and 0 otherwise; an unavailable operand produces no value. Comparing the result with Value(0), for example gt(CrossAbove(left, right), Value(0)), is valid; passing the indicator directly to and/or is not. They compare consecutive market observations, not consecutive strategy decisions or completed chart candles. Stateful operands continue observing behind time and position gates, so a crossing before a scheduled decision can be 0 by the decision. Zero at that decision does not prove the underlying series never crossed. For an ordinary daily moving-average crossover strategy without a more specific observation clock, compare the two most recently completed trading sessions and disclose that execution follows confirmation at a later scheduled decision. Define latestLeft=IndicatorWindowAgo(left,1,'TradingDay'), latestRight=IndicatorWindowAgo(right,1,'TradingDay'), priorLeft=IndicatorWindowAgo(left,2,'TradingDay'), and priorRight=IndicatorWindowAgo(right,2,'TradingDay'). An upward completed-session crossing is gt(latestLeft,latestRight) AND lte(priorLeft,priorRight); reverse the comparisons for a downward crossing. Comparing the forming/current average against lag 1 can miss a crossing that occurs at the close after the scheduled decision: by the next decision the lag-1 relationship has already changed. A bare CrossAbove/CrossBelow impulse has a similar observation-versus-decision limitation. Preserve an explicitly requested partial-session/current-versus-prior comparison or observation-level impulse, and explain its sampling limitations rather than silently changing its clock. TradingDay references a confirmed session closing value; Day is elapsed calendar time, including for the underlying average window. ChartBar already excludes the forming candle, so preserve its intended candle identity and offset instead of blindly adding another lag. For other bar/session/decision references choose operands and lag lengths from the requested observation clock. Before diagnosing a crossover mismatch, inspect saved operand windows, observation/decision cadence, current and referenced values, and retained evaluation evidence. An outer comparison audit without inner operands cannot establish why the crossing was absent. Do not propose removing a valid numeric comparison as a repair.
 */
export function CrossAbove(left: Indicator, right: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "CrossAbove" };
  d.indicators = [left, right];
  return d as unknown as Indicator;
}
/**
 * CrossAbove and CrossBelow are numeric Indicators, not Conditions: with available operands they return 1 when a crossing is detected and 0 otherwise; an unavailable operand produces no value. Comparing the result with Value(0), for example gt(CrossAbove(left, right), Value(0)), is valid; passing the indicator directly to and/or is not. They compare consecutive market observations, not consecutive strategy decisions or completed chart candles. Stateful operands continue observing behind time and position gates, so a crossing before a scheduled decision can be 0 by the decision. Zero at that decision does not prove the underlying series never crossed. For an ordinary daily moving-average crossover strategy without a more specific observation clock, compare the two most recently completed trading sessions and disclose that execution follows confirmation at a later scheduled decision. Define latestLeft=IndicatorWindowAgo(left,1,'TradingDay'), latestRight=IndicatorWindowAgo(right,1,'TradingDay'), priorLeft=IndicatorWindowAgo(left,2,'TradingDay'), and priorRight=IndicatorWindowAgo(right,2,'TradingDay'). An upward completed-session crossing is gt(latestLeft,latestRight) AND lte(priorLeft,priorRight); reverse the comparisons for a downward crossing. Comparing the forming/current average against lag 1 can miss a crossing that occurs at the close after the scheduled decision: by the next decision the lag-1 relationship has already changed. A bare CrossAbove/CrossBelow impulse has a similar observation-versus-decision limitation. Preserve an explicitly requested partial-session/current-versus-prior comparison or observation-level impulse, and explain its sampling limitations rather than silently changing its clock. TradingDay references a confirmed session closing value; Day is elapsed calendar time, including for the underlying average window. ChartBar already excludes the forming candle, so preserve its intended candle identity and offset instead of blindly adding another lag. For other bar/session/decision references choose operands and lag lengths from the requested observation clock. Before diagnosing a crossover mismatch, inspect saved operand windows, observation/decision cadence, current and referenced values, and retained evaluation evidence. An outer comparison audit without inner operands cannot establish why the crossing was absent. Do not propose removing a valid numeric comparison as a repair.
 */
export function CrossBelow(left: Indicator, right: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "CrossBelow" };
  d.indicators = [left, right];
  return d as unknown as Indicator;
}
/**
 * Hours since midnight in America/New_York time, including fractional hours. For example, 9:30 AM returns 9.5. Daylight saving time is handled automatically.
 */
export function CurrentTimeHours(): Indicator {
  const d: Record<string, unknown> = { type: "CurrentTimeHours" };
  return d as unknown as Indicator;
}
/**
 * Minutes since midnight in America/New_York time, including fractional minutes. For example, 9:30 AM returns 570. Daylight saving time is handled automatically.
 */
export function CurrentTimeMinutes(): Indicator {
  const d: Record<string, unknown> = { type: "CurrentTimeMinutes" };
  return d as unknown as Indicator;
}
/**
 * Seconds since midnight in America/New_York time, including fractions of a second. For example, 9:30 AM returns 34200. Daylight saving time is handled automatically.
 */
export function CurrentTimeSeconds(): Indicator {
  const d: Record<string, unknown> = { type: "CurrentTimeSeconds" };
  return d as unknown as Indicator;
}
/**
 * Evaluation time in Unix seconds, including fractions. Use with ChartBar endTime for ordinary freshness comparisons; backtests use their simulated clock.
 */
export function CurrentTimestamp(): Indicator {
  const d: Record<string, unknown> = { type: "CurrentTimestamp" };
  return d as unknown as Indicator;
}
/**
 * Inside a CountTrue historical condition, bind this operand at its value now while other operands use their historical observations. Elsewhere return the operand normally. Wrap a complete stateful operand, not an expression inside its recurrence.
 */
export function CurrentValue(operand: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "CurrentValue" };
  d.indicators = [operand];
  return d as unknown as Indicator;
}
/**
 * Account-owned timestamp/value data uploaded through CSV or JSON ingestion. Range: User-defined numeric value.
 * @param asset Pass CANDIDATE inside a rebalance pipeline to bind per candidate.
 * @param customIndicatorId 24-char hex ObjectId of the owned series (list_custom_indicators).
 */
export function CustomIndicator(asset: AssetArg, customIndicatorId: string): Indicator {
  const d: Record<string, unknown> = { type: "CustomIndicator" };
  setAsset(d, "targetAsset", asset);
  d["customIndicatorId"] = customIndicatorId;
  return d as unknown as Indicator;
}
/**
 * The day of the month in America/New_York, from 1 through 31. Combine with Month and Year for a specific calendar date.
 */
export function Date(): Indicator {
  const d: Record<string, unknown> = { type: "Date" };
  return d as unknown as Indicator;
}
/**
 * The weekday in America/New_York: Monday = 1 through Sunday = 7. Use Date for the day of the month.
 */
export function Day(): Indicator {
  const d: Record<string, unknown> = { type: "Day" };
  return d as unknown as Indicator;
}
/**
 * The number of days since an AI agent was launched by this strategy. Useful for rate-limiting agent launches. Range: >= 0.
 */
export function DaysSinceAgent(): Indicator {
  const d: Record<string, unknown> = { type: "DaysSinceAgent" };
  return d as unknown as Indicator;
}
/**
 * The number of days since an alert was triggered. Useful for rate-limiting alerts. Range: >= 0.
 * @param message (Optional) Message to display when the indicator is triggered
 */
export function DaysSinceAlert(message: string): Indicator {
  const d: Record<string, unknown> = { type: "DaysSinceAlert" };
  d["message"] = message;
  return d as unknown as Indicator;
}
/**
 * Calendar days since the asset's most recent earnings report. In backtests and live, this is the last actually-reported quarter at-or-before the decision time (no look-ahead). Use to time post-earnings entries (e.g. fade the gap after N days, or wait for the IV crush to settle). Range: >= 0 (0 on the report day; grows as time passes).
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function DaysSinceEarnings(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "DaysSinceEarnings" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Elapsed days since the latest Filled-matching portfolio order stamped RebalanceOption, RebalanceOptionRenewal or RebalanceOptionFunding. It uses fill time and ignores strategy ID, so these strategies share a cooldown. Unfilled or canceled orders do not reset it. Range: >= 0 (days), or a large number if no RebalanceOption-generated order exists.
 */
export function DaysSinceLastRebalanceOptionOrder(): Indicator {
  const d: Record<string, unknown> = { type: "DaysSinceLastRebalanceOptionOrder" };
  return d as unknown as Indicator;
}
/**
 * The number of days since the most recent option order matching the specified filters. Supports filtering by underlying, option type (call/put), spread type, direction (long/short), position effect (open/close), and days to expiration at order time. Range: >= 0 (days), or a large number if no matching order exists.
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 * @param positionEffect Filter by Open (entering position) or Close (exiting). Leave empty for all.
 * @param minDte Minimum days to expiration at order time. Leave empty for no minimum.
 * @param maxDte Maximum days to expiration at order time. Leave empty for no maximum.
 * @param orderStatus Matches option order events with this status
 */
export function DaysSinceOptionOrder(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType, positionEffect: PositionEffect, minDte: number, maxDte: number, orderStatus: OrderStatus = "Filled"): Indicator {
  const d: Record<string, unknown> = { type: "DaysSinceOptionOrder" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  d["positionEffect"] = positionEffect;
  d["minDte"] = minDte;
  d["maxDte"] = maxDte;
  d["orderStatus"] = orderStatus;
  return d as unknown as Indicator;
}
/**
 * The number of days since the most recent order matching the specified filters. Range: >= 0 (days), or a large number if no matching order exists.
 * @param assets Ticker(s) whose orders are counted. One string or an array.
 * @param side Buy or Sell
 */
export function DaysSinceOrder(assets: AssetArg | AssetArg[], side: Side, orderStatus: OrderStatus = "Filled"): Indicator {
  const d: Record<string, unknown> = { type: "DaysSinceOrder" };
  setAssets(d, "targetAssets", assets);
  d["side"] = side;
  d["orderStatus"] = orderStatus;
  return d as unknown as Indicator;
}
/**
 * The number of days since the current strategy last produced an execution artifact. Counts same-strategy order rows, rebalance orders, and launched agents. Range: >= 0 (days), or a large number if the strategy has never fired.
 */
export function DaysSinceStrategyFired(): Indicator {
  const d: Record<string, unknown> = { type: "DaysSinceStrategyFired" };
  return d as unknown as Indicator;
}
/**
 * Calendar days until the asset's next expected earnings report. In backtests the next date is a point-in-time cadence estimate from the last report (no look-ahead); live trading uses the real next scheduled date. Use to time entries and exits around earnings. Range: >= 0 (0 on/after the expected report day; counts down as it nears).
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function DaysUntilEarnings(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "DaysUntilEarnings" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Quotient of indicators.
 */
export function Divide(left: Indicator, right: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "Divide" };
  d.indicators = [left, right];
  return d as unknown as Indicator;
}
/**
 * Highest high and lowest low over N bars with a midline. Breaks of either edge are breakout entries; the midline is the first pullback level. Range: Price scale.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 * @param line Which Donchian line to evaluate
 */
export function DonchianChannel(asset: AssetArg, length: number = 20, interval: Interval = "Day", line: "upper" | "lower" | "middle" = "upper"): Indicator {
  const d: Record<string, unknown> = { type: "DonchianChannel" };
  setAsset(d, "targetAsset", asset);
  d["line"] = line;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Macroeconomic data not tied to a specific asset.
 * @param metric The economic indicator to use
 */
export function Economic(metric: "NonfarmPayrolls" | "UnemploymentRate" | "MoneySupply" | "TreasuryYield3Month" | "CPI"): Indicator {
  const d: Record<string, unknown> = { type: "Economic" };
  d["metric"] = metric;
  return d as unknown as Indicator;
}
/**
 * SMA/EMA window interval Day means elapsed calendar time, including closed exchange dates. TradingDay uses the exchange-session clock for exchange-traded assets and skips closed dates while preserving within-session time. For a conventional N-day stock moving average, author interval TradingDay unless the request explicitly specifies elapsed calendar days. An outer TradingDay lag does not change an inner Day average into an N-session average. Preserve an explicit calendar-day request as Day. Continuous-market daily windows use 24-hour Day intervals. A TradingDay window can still have a forming current reading: choose completed-session references separately when the signal requires confirmed closes. ChartBar periods and offsets already identify completed candles; preserve that clock instead of substituting a time-window average.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function ExponentialMovingAverage(asset: AssetArg, length: number, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "ExponentialMovingAverage" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
export const EMA = ExponentialMovingAverage;
/**
 * Raises an indicator to a specified power.
 * @param exponent The exponent to raise the value to
 */
export function Exponentiation(operand: Indicator, exponent: number = 2): Indicator {
  const d: Record<string, unknown> = { type: "Exponentiation" };
  d["exponent"] = exponent;
  d.indicators = [operand];
  return d as unknown as Indicator;
}
/**
 * A financial metric from a company's statements or derived valuation ratios.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param metric The fundamental metric to use
 */
export function Fundamental(asset: AssetArg, metric: FundamentalMetric): Indicator {
  const d: Record<string, unknown> = { type: "Fundamental" };
  setAsset(d, "targetAsset", asset);
  d["metric"] = metric;
  return d as unknown as Indicator;
}
/**
 * The gap size expressed as a percentage of the previous close. Range: Unbounded (percentage).
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function GapPercentage(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "GapPercentage" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The dollar difference between today's opening price and yesterday's closing price. Range: Unbounded.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function GapSize(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "GapSize" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Heikin-Ashi candles built from COMPLETED one-minute bars in the regular session (9:30-15:59 bar opens; pre-market and after-hours bars are skipped), identically in backtests and live trading. The first bar seeds HA open = (O+C)/2 with its own high, low and close; after that HA close = (O+H+L+C)/4, HA open = (prior HA open + prior HA close)/2, HA high = max(H, HA open, HA close), HA low = min(L, HA open, HA close). The recursion carries across sessions and advances once per new bar. The streak line is the signed length of the current same-color run, counted from the color change (+3 on the third green candle, -3 on the third red); it reads 0 on a doji and for the rest of any run in which a candle shows an opposite-direction wick (a lower wick on green, an upper wick on red). Range: Price scale; streak is a signed integer.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param line Which one-minute Heikin-Ashi value to evaluate. streak is the signed length of the current same-color run (0 once it shows an opposite-direction wick, and on a doji)
 */
export function HeikinAshi(asset: AssetArg, line: "open" | "high" | "low" | "close" | "streak" = "close"): Indicator {
  const d: Record<string, unknown> = { type: "HeikinAshi" };
  setAsset(d, "targetAsset", asset);
  d["line"] = line;
  return d as unknown as Indicator;
}
/**
 * The highest price reached during the current trading session. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function HighOfDay(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "HighOfDay" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Five-line trend system: Tenkan and Kijun midpoints, Senkou A/B cloud bands, and the Chikou lagging line. Lines are evaluated unshifted. Price above the cloud with Tenkan above Kijun is the full bullish alignment. Range: Price scale.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 * @param spanLength Senkou B lookback in bars (Kijun scales from conversion)
 * @param line Which Ichimoku line to evaluate (unshifted)
 */
export function IchimokuCloud(asset: AssetArg, length: number = 9, interval: Interval = "Day", spanLength: number = 52, line: "tenkan" | "kijun" | "senkouA" | "senkouB" | "chikou" = "tenkan"): Indicator {
  const d: Record<string, unknown> = { type: "IchimokuCloud" };
  setAsset(d, "targetAsset", asset);
  d["spanLength"] = spanLength;
  d["line"] = line;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Constant-maturity at-the-money implied volatility for the underlying, built from the options chain (near-target-DTE expirations, |delta|≈0.50 call/put average, linearly interpolated). Units are annualized decimals (0.25 = 25%). Used on each candidate of a dynamic rebalance over a broad universe (all US stocks, an index or a watchlist), it reads options chains with Greeks for every stock in that universe instead of one underlying, so the run is heavier than with a named ticker or a specific asset list. Range: > 0 (annualized decimal).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param dte Target constant-maturity tenor in calendar days (e.g. 30)
 */
export function ImpliedVolatility(asset: AssetArg, dte: number = 30): Indicator {
  const d: Record<string, unknown> = { type: "ImpliedVolatility" };
  setAsset(d, "targetAsset", asset);
  d["dte"] = dte;
  return d as unknown as Indicator;
}
/**
 * Daily level for a market index or benchmark (e.g. VIX, SPX) from hydrated index price data — not a tradable equity price. Range: Unbounded (index points).
 * @param metric Ticker key matching hydrated index price data (add more in BigQuery + rehydrate as needed)
 */
export function Index(metric: "VIX" | "SPX" | "NDX" | "DJI" | "RUT" | "SKEW" | "VVIX" | "USDBROAD" | "TNX" = "VIX"): Indicator {
  const d: Record<string, unknown> = { type: "Index" };
  d["metric"] = metric;
  return d as unknown as Indicator;
}
/**
 * Retain the operand from matching observations: First, Latest, Maximum, or Minimum. Ordinary conditions decide when to capture. An optional window expires observations; TradingDay skips closed exchange dates. Use this to freeze a qualified setup before entry or ratchet a numeric level, not IndicatorAtEntry when no fill exists yet.
 * @param condition Condition evaluated over the window.
 */
export function IndicatorAtCondition(operand: Indicator, condition: Condition, selection: "First" | "Latest" | "Maximum" | "Minimum" = "First", clock: Clock = "Calendar", initialValue?: number, length?: number, interval?: Interval): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorAtCondition" };
  d.condition = condition;
  d["selection"] = selection;
  d["clock"] = clock;
  if (initialValue !== undefined) d["initialValue"] = initialValue;
  d.indicators = [operand];
  if (length !== undefined || interval !== undefined) d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The value an indicator held at a matching fill of the asset. The entry anchor chooses the fill: LatestFill (the default) follows the most recent matching fill; HoldingEntry preserves the original holding entry when shares are added. The captured level stays fixed instead of rolling forward. In the form, a candidate-bound condition may leave the asset empty and the surrounding action supplies it; SDK code always passes the asset, using CANDIDATE inside a rebalance pipeline.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param side The side of the fill the value is anchored to
 * @param orderStatus Matches order events with this status
 */
export function IndicatorAtEntry(operand: Indicator, asset: AssetArg, side: Side, orderStatus: OrderStatus = "Filled", anchor: "LatestFill" | "HoldingEntry" = "LatestFill"): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorAtEntry" };
  setAsset(d, "targetAsset", asset);
  d["side"] = side;
  d["orderStatus"] = orderStatus;
  d["anchor"] = anchor;
  d.indicators = [operand];
  return d as unknown as Indicator;
}
/**
 * Captures the first non-null evaluated indicator value at or after the configured number of minutes after market open. The captured value is then frozen until its next daily reset. A delayed evaluation can capture after the target minute.
 * @param minutesAfterOpen The number of minutes after market open to capture the indicator value
 */
export function IndicatorAtMinutesAfterOpen(operand: Indicator, minutesAfterOpen: number = 30): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorAtMinutesAfterOpen" };
  d["minutesAfterOpen"] = minutesAfterOpen;
  d.indicators = [operand];
  return d as unknown as Indicator;
}
/**
 * Computes the Exponential Moving Average of any other indicator. TradingDay follows the input markets: crypto-only inputs use elapsed 24-hour days, including weekends, just like Day. Stock, option, mixed-market and asset-free expressions use confirmed exchange sessions. The window does not change intraday prices into daily closing prices. TradingMinute counts regular-session minutes the same way, so a 70 TradingMinute window at 9:45 reaches back to 3:06 PM on the prior session (the overnight gap is one step); crypto-only inputs use elapsed minutes. It allows at most 1439 minutes; use TradingDay for longer lookbacks. Indicators read every tick have no TradingMinute value outside regular hours, and windows over a ChartBar keep the value of its latest completed candle.
 * @param length Length of time
 * @param interval Unit of time
 */
export function IndicatorExponentialMovingAverage(operand: Indicator, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorExponentialMovingAverage" };
  d.indicators = [operand];
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Rolling maximum of one numeric operand over a time window. ChartBar observations keep their completed candle end time; repeated reads do not extend their age. Available history is used, so express full-history coverage separately.
 * @param length Length of time
 * @param interval Unit of time
 */
export function IndicatorMaximum(operand: Indicator, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorMaximum" };
  d.indicators = [operand];
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Computes the MAD of any indicator over a window. Less sensitive to outliers than standard deviation.
 * @param length Length of time
 * @param interval Unit of time
 */
export function IndicatorMeanAbsoluteDeviation(operand: Indicator, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorMeanAbsoluteDeviation" };
  d.indicators = [operand];
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Rolling minimum of one numeric operand over a time window. ChartBar observations keep their completed candle end time; repeated reads do not extend their age. Available history is used, so express full-history coverage separately.
 * @param length Length of time
 * @param interval Unit of time
 */
export function IndicatorMinimum(operand: Indicator, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorMinimum" };
  d.indicators = [operand];
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The percentage change of any indicator over a window.
 * @param length Length of time
 * @param interval Unit of time
 */
export function IndicatorRateOfChange(operand: Indicator, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorRateOfChange" };
  d.indicators = [operand];
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Computes the Simple Moving Average of any other indicator over a window. TradingDay follows the input markets: crypto-only inputs use elapsed 24-hour days, including weekends, just like Day. Stock, option, mixed-market and asset-free expressions use confirmed exchange sessions. The window does not change intraday prices into daily closing prices. TradingMinute counts regular-session minutes the same way, so a 70 TradingMinute window at 9:45 reaches back to 3:06 PM on the prior session (the overnight gap is one step); crypto-only inputs use elapsed minutes. It allows at most 1439 minutes; use TradingDay for longer lookbacks. Indicators read every tick have no TradingMinute value outside regular hours, and windows over a ChartBar keep the value of its latest completed candle.
 * @param length Length of time
 * @param interval Unit of time
 */
export function IndicatorSimpleMovingAverage(operand: Indicator, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorSimpleMovingAverage" };
  d.indicators = [operand];
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Computes the standard deviation of any indicator over a window.
 * @param length Length of time
 * @param interval Unit of time
 */
export function IndicatorStandardDeviation(operand: Indicator, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorStandardDeviation" };
  d.indicators = [operand];
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Value at an elapsed time in the past. TradingDay instead reads the confirmed closing value of the reference exchange session, including early closes. Missing session evidence returns no value; initialValue applies before enough history exists.
 * @param length Length of time
 * @param interval Unit of time
 */
export function IndicatorWindowAgo(operand: Indicator, length: number, interval: Interval, initialValue?: number): Indicator {
  const d: Record<string, unknown> = { type: "IndicatorWindowAgo" };
  if (initialValue !== undefined) d["initialValue"] = initialValue;
  d.indicators = [operand];
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * News sentiment about an industry over its last lookbackDays daily news snapshots (default 1, the latest). industry is one of the canonical industry tags (the same list IsIndustry uses). Headlines come from the GDELT global news feed, and a fine-tuned model scores every headline that mentions the industry: whether it is really about the industry, and whether it is positive, neutral or negative news for it (a headline it calls neutral scores 0; others score from -1.0 to 1.0). Each trading day has one snapshot at 09:15 New York, and a headline counts toward the first session whose 09:15 cutoff is at or after the time GDELT published it. Backtests and live trading read the same rows. lookbackDays counts trading sessions whether or not the industry had news in them; a single session is noisy, and about 20 sessions is the usual window for a sentiment rule. Only headlines the model judges to be about the industry count, and copies of one story within 7 days count once per session. measure (default Mean): Mean is the average sentiment from -1.0 to 1.0, Median is the middle score (the average of the two middle scores for an even count), NetCount is positive minus negative headlines, ArticleCount is the number of qualifying headlines. Coverage begins on 2019-09-23: a window reaching earlier is measured over the sessions since then, and the backtest warns that it held less history than configured. Every measure has no value across sessions with no published snapshot, or when the latest snapshot due has not been published. Mean and Median also have no value when the window holds no qualifying headline; the counts are then 0. The value is the same for every asset: it takes no target asset. includeMemberCompanies (default false): also count headlines about the industry's member companies. A headline the model judges to be about a company (for example "SpaceX valuation hits a record") then counts toward every industry that company belongs to with core or material exposure in NexusTrade's industry classification, including companies not yet listed, by SEC CIK. A headline counts once per industry even when it names several member companies or also names the industry, scored by its industry score when it has one and otherwise by its score for the member company it is most about (ties to the numerically lowest SEC CIK); copies of one story count once per session across both kinds. Membership is the company's classification public when the headline appeared, or its first classification for headlines before that, so older history, and the history placed for a newly listed company, uses a membership that became known later. Default false reads exactly the headlines that name the industry.
 * @param industry Canonical industry tag whose news to read, as IsIndustry lists it. Legacy aliases are separate news series and are rejected, never mapped.
 * @param measure Median: middle score from -1 to 1 (the average of the two middle scores for an even count), with no value when no qualifying headline. Mean: average sentiment from -1 to 1, with no value when the window has no qualifying headline. NetCount: positive minus negative headlines. ArticleCount: qualifying headlines. Every measure has no value across missing snapshots or when the due snapshot is unpublished. Before coverage begins on 2019-09-23 the window holds the sessions available.
 * @param lookbackDays Whole trading sessions of daily 09:15 New York news snapshots; 1 is the latest and about 20 is the usual window. The same value for every asset.
 * @param includeMemberCompanies Also count headlines about the industry's member companies, each headline once per industry. Default false reads only headlines that name the industry.
 */
export function IndustryNewsSentiment(industry: "technology" | "financialServices" | "healthcare" | "energy" | "consumerGoods" | "entertainmentAndMedia" | "manufacturing" | "transportation" | "realEstate" | "utilities" | "agriculture" | "education" | "retail" | "artificialIntelligence" | "aiInfrastructure" | "analytics" | "cloudComputing" | "dataCenter" | "database" | "cybersecurity" | "developerTools" | "software" | "saas" | "enterpriseSoftware" | "customerExperienceSoftware" | "productivityTools" | "collaborationSoftware" | "digitalSignatureAndAuthentication" | "hardware" | "consumerElectronics" | "networking" | "semiconductor" | "chipDesign" | "chipManufacturing" | "semiconductorEquipment" | "gpuAndAccelerators" | "memoryAndStorage" | "quantumComputing" | "robotics" | "industrialAutomation" | "iot" | "smartDevices" | "wearable" | "3dPrinting" | "augmentedReality" | "virtualReality" | "space" | "satellites" | "aerospace" | "defense" | "drones" | "financialInfrastructure" | "capitalMarketsTechnology" | "banking" | "assetManagement" | "brokerage" | "payments" | "fintech" | "insurance" | "autoInsurance" | "homeInsurance" | "lifeInsurance" | "healthInsurance" | "blockchain" | "cryptocurrency" | "biotechnology" | "pharmaceuticals" | "medicalDevices" | "digitalHealth" | "lifeSciencesSoftware" | "bioinformatics" | "computationalBiology" | "computationalDrugDiscovery" | "oncology" | "immunotherapy" | "vaccines" | "veterinary" | "oil" | "gas" | "oilfieldServices" | "cleanEnergy" | "renewableEnergy" | "solarEnergy" | "windEnergy" | "nuclearEnergy" | "hydrogen" | "batteryTechnology" | "miningAndNaturalResources" | "gold" | "silver" | "chemicals" | "advancedMaterials" | "waterInfrastructure" | "wasteManagementAndRecycling" | "forestry" | "construction" | "buildingMaterials" | "electricalAndGridInfrastructure" | "logisticsAndSupplyChain" | "airline" | "maritime" | "railroads" | "automotive" | "electricVehicle" | "autonomousTransportation" | "recreationalVehicle" | "cruise" | "rideShare" | "printing" | "packaging" | "householdProducts" | "ecommerce" | "digitalMarketplace" | "fashionAndApparel" | "luxuryGoods" | "jewelry" | "foodAndBeverage" | "foodDelivery" | "nutrition" | "petCare" | "outdoorAndRecreationalEquipment" | "sportsAndFitness" | "cannabis" | "hospitalityAndTravel" | "homeSecurity" | "advertising" | "gaming" | "gambling" | "sportsBetting" | "socialMedia" | "streaming" | "movies" | "musicAndAudio" | "publishing" | "telecommunications" | "edtech" | "proptech", measure: Measure = "Mean", lookbackDays: number = 1, includeMemberCompanies: boolean = false): Indicator {
  const d: Record<string, unknown> = { type: "IndustryNewsSentiment" };
  d["industry"] = industry;
  d["measure"] = measure;
  d["lookbackDays"] = lookbackDays;
  d["includeMemberCompanies"] = includeMemberCompanies;
  return d as unknown as Indicator;
}
/**
 * The starting value of the portfolio when it was created or when the backtest began. Range: > 0.
 */
export function InitialValue(): Indicator {
  const d: Record<string, unknown> = { type: "InitialValue" };
  return d as unknown as Indicator;
}
/**
 * Disclosed purchases (code P, including open-market or private transactions), sales (code S), and a separate exact-owner AwardCount for code A issuer grants or other acquisitions over a trailing publication window. AcquisitionCount combines code P and code A as distinct acquisition signals for modeled follower strategies; awards are not reclassified as purchases or sales and do not prove vested common-share ownership. Exact-owner strategies use versioned common-share, call/put, and issuer-award evidence; exercises and warrants are excluded from tradable purchase signals. A signal becomes eligible when its filing is public, never on an earlier transaction date. Range: Dollars, shares, counts or budget percent; unknown owner/amendment coverage has no value.
 * @param asset Pass CANDIDATE in a dynamic rebalance pipeline.
 * @param ownerCik Exact nonzero SEC reporting owner CIK, up to 10 digits. Omit for a whole company (with issuerCik) or aggregate activity.
 * @param issuerCik Company CIK. With ownerCik, restricts that owner to this company. Alone, every reporting owner's events at this company, a joint filing counted once.
 * @param instrument Disclosed instrument; defaults to Equity. Call/Put, award and acquisition metrics, and budget shares require ownerCik or issuerCik. AwardCount is SEC code A issuer acquisitions, not cash purchases or vested-share proof. AcquisitionValue is disclosed purchase dollars plus award shares at the target's current price. Its default Equity bucket includes unresolved restricted units. AcquisitionCount and AcquisitionSharePercent combine public code P purchases with code A issuer acquisitions. Shares use qualifying signal counts across all the owner's tickers, or all the company's tickers under issuerCik alone.
 */
export function InsiderTrades(asset: AssetArg, metric: "NetValue" | "BuyValue" | "SellValue" | "NetShares" | "BuyCount" | "SellCount" | "AwardCount" | "AcquisitionValue" | "AcquisitionCount" | "DistinctBuyers" | "PurchaseSharePercent" | "AcquisitionSharePercent", role: Role, windowDays: number, ownerCik?: string, issuerCik?: string, instrument?: Instrument): Indicator {
  const d: Record<string, unknown> = { type: "InsiderTrades" };
  setAsset(d, "targetAsset", asset);
  d["metric"] = metric;
  d["role"] = role;
  d["windowDays"] = windowDays;
  if (ownerCik !== undefined) d["ownerCik"] = ownerCik;
  if (issuerCik !== undefined) d["issuerCik"] = issuerCik;
  if (instrument !== undefined) d["instrument"] = instrument;
  return d as unknown as Indicator;
}
/**
 * Institutional positions in the asset disclosed on SEC Form 13F. Naming a manager follows one institution; an empty manager reads every manager holding the asset (SDK code passes an empty string). Level metrics read the latest quarter whose filing became public on or before the evaluation date; change metrics compare it with the quarter before. Positions are never summed across quarters, and an amended filing replaces the original only from the moment the amendment became public. Range: Counts, shares, dollars or a top-5 share of holdings; 0 when no 13F naming the asset was public within the window.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param manager Optional: a CIK such as 1067983, or part of a manager's name such as Renaissance Technologies. Leave empty for every manager. A CIK is exact; a name can match several firms
 * @param metric Managers holding, shares or value held, concentration, or the change since the previous quarter
 * @param windowDays Read a disclosed period only if its filing became public within this many trailing days
 * @param instrument Calls and puts require an exact manager CIK and its effective public book
 */
export function InstitutionalHoldings(asset: AssetArg, manager: string, metric: "HolderCount" | "TotalShares" | "TotalValue" | "BookSharePercent" | "ConcentrationTop5" | "NetShareChange" | "NetHolderChange" | "NewHolders" | "ClosedHolders" = "HolderCount", windowDays: number = 180, instrument: Instrument = "Equity"): Indicator {
  const d: Record<string, unknown> = { type: "InstitutionalHoldings" };
  setAsset(d, "targetAsset", asset);
  d["manager"] = manager;
  d["metric"] = metric;
  d["windowDays"] = windowDays;
  d["instrument"] = instrument;
  return d as unknown as Indicator;
}
/**
 * Returns 1 if the asset matches a specific symbol. Useful for including specific assets in multi-asset strategies.
 * @param matchAsset The specific asset to compare against (ex. UPRO, GLD)
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function IsAsset(matchAsset: AssetArg, asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "IsAsset" };
  setAsset(d, "matchAsset", matchAsset);
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Returns 1 if the asset matches Stock, Cryptocurrency, Option or Other, and 0 otherwise. ETFs are Stock assets; use separate stock metadata or a universe filter to select ETFs.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param assetType The asset type to check against
 */
export function IsAssetType(asset: AssetArg, assetType: AssetType = "Stock"): Indicator {
  const d: Record<string, unknown> = { type: "IsAssetType" };
  setAsset(d, "targetAsset", asset);
  d["assetType"] = assetType;
  return d as unknown as Indicator;
}
/**
 * Returns 1 if the asset is a member of a specified index, 0 otherwise.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param index The index to check membership against
 */
export function IsIndexMember(asset: AssetArg, index: "SP500" | "NASDAQ100" | "DJIA" = "SP500"): Indicator {
  const d: Record<string, unknown> = { type: "IsIndexMember" };
  setAsset(d, "targetAsset", asset);
  d["index"] = index;
  return d as unknown as Indicator;
}
/**
 * Returns 1 if the asset belongs to a specified industry, 0 otherwise. Over 100 categories supported including Artificial Intelligence, Semiconductor, Electric Vehicles, Space Exploration, Healthcare, Biotechnology, Cloud Computing, Cybersecurity, Renewable Energy, and many more.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param industry The industry to check membership against
 */
export function IsIndustry(asset: AssetArg, industry: "technology" | "financialServices" | "healthcare" | "energy" | "consumerGoods" | "entertainmentAndMedia" | "manufacturing" | "transportation" | "realEstate" | "utilities" | "agriculture" | "education" | "retail" | "artificialIntelligence" | "aiInfrastructure" | "analytics" | "cloudComputing" | "dataCenter" | "database" | "cybersecurity" | "developerTools" | "software" | "saas" | "enterpriseSoftware" | "customerExperienceSoftware" | "productivityTools" | "collaborationSoftware" | "digitalSignatureAndAuthentication" | "hardware" | "consumerElectronics" | "networking" | "semiconductor" | "chipDesign" | "chipManufacturing" | "semiconductorEquipment" | "gpuAndAccelerators" | "memoryAndStorage" | "quantumComputing" | "robotics" | "industrialAutomation" | "iot" | "smartDevices" | "wearable" | "3dPrinting" | "augmentedReality" | "virtualReality" | "space" | "satellites" | "aerospace" | "defense" | "drones" | "financialInfrastructure" | "capitalMarketsTechnology" | "banking" | "assetManagement" | "brokerage" | "payments" | "fintech" | "insurance" | "autoInsurance" | "homeInsurance" | "lifeInsurance" | "healthInsurance" | "blockchain" | "cryptocurrency" | "biotechnology" | "pharmaceuticals" | "medicalDevices" | "digitalHealth" | "lifeSciencesSoftware" | "bioinformatics" | "computationalBiology" | "computationalDrugDiscovery" | "oncology" | "immunotherapy" | "vaccines" | "veterinary" | "oil" | "gas" | "oilfieldServices" | "cleanEnergy" | "renewableEnergy" | "solarEnergy" | "windEnergy" | "nuclearEnergy" | "hydrogen" | "batteryTechnology" | "miningAndNaturalResources" | "gold" | "silver" | "chemicals" | "advancedMaterials" | "waterInfrastructure" | "wasteManagementAndRecycling" | "forestry" | "construction" | "buildingMaterials" | "electricalAndGridInfrastructure" | "logisticsAndSupplyChain" | "airline" | "maritime" | "railroads" | "automotive" | "electricVehicle" | "autonomousTransportation" | "recreationalVehicle" | "cruise" | "rideShare" | "printing" | "packaging" | "householdProducts" | "ecommerce" | "digitalMarketplace" | "fashionAndApparel" | "luxuryGoods" | "jewelry" | "foodAndBeverage" | "foodDelivery" | "nutrition" | "petCare" | "outdoorAndRecreationalEquipment" | "sportsAndFitness" | "cannabis" | "hospitalityAndTravel" | "homeSecurity" | "advertising" | "gaming" | "gambling" | "sportsBetting" | "socialMedia" | "streaming" | "movies" | "musicAndAudio" | "publishing" | "telecommunications" | "edtech" | "proptech" | "informationTechnology" | "personalAndHouseholdGoods" | "investing" | "spaceExploration" | "alternativeEnergy" | "clothesAndApparal" | "computationalChemistry" | "customerEngagement" | "dataVisualization" | "graphicsCard" | "materialScience" | "medicine" | "messaging" | "phones" | "security" | "socialNetwork" | "television" | "videoConferencing" | "videos" | "waterPurifaction" | "waterTreatment"): Indicator {
  const d: Record<string, unknown> = { type: "IsIndustry" };
  setAsset(d, "targetAsset", asset);
  d["industry"] = ({"informationTechnology":"technology","personalAndHouseholdGoods":"householdProducts","investing":"assetManagement","spaceExploration":"space","alternativeEnergy":"cleanEnergy","clothesAndApparal":"fashionAndApparel","computationalChemistry":"computationalDrugDiscovery","customerEngagement":"customerExperienceSoftware","dataVisualization":"analytics","graphicsCard":"gpuAndAccelerators","materialScience":"advancedMaterials","medicine":"pharmaceuticals","messaging":"collaborationSoftware","phones":"consumerElectronics","security":"cybersecurity","socialNetwork":"socialMedia","television":"streaming","videoConferencing":"collaborationSoftware","videos":"streaming","waterPurifaction":"waterInfrastructure","waterTreatment":"waterInfrastructure"} as Record<string, string>)[industry] ?? industry;
  return d as unknown as Indicator;
}
/**
 * Returns 1 if the asset does NOT match a specific symbol. Useful for excluding specific assets.
 * @param matchAsset The specific asset to compare against (ex. UPRO, GLD)
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function IsNotAsset(matchAsset: AssetArg, asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "IsNotAsset" };
  setAsset(d, "matchAsset", matchAsset);
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Constant-maturity ATM implied volatility divided by annualized close-to-close realized volatility (HV) over hvWindow trading days. Values > 1 mean options are pricing more vol than recently realized. Used on each candidate of a dynamic rebalance over a broad universe (all US stocks, an index or a watchlist), it reads options chains with Greeks for every stock in that universe instead of one underlying, so the run is heavier than with a named ticker or a specific asset list. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param hvWindow Trading days of log-return history for realized volatility
 */
export function IVHVRatio(asset: AssetArg, hvWindow: number = 20): Indicator {
  const d: Record<string, unknown> = { type: "IVHVRatio" };
  setAsset(d, "targetAsset", asset);
  d["hvWindow"] = hvWindow;
  return d as unknown as Indicator;
}
/**
 * Percent of sessions in the lookback window whose constant-maturity ATM IV was strictly below today's (0–100). Distinct from IV Rank. Used on each candidate of a dynamic rebalance over a broad universe (all US stocks, an index or a watchlist), it reads options chains with Greeks for every stock in that universe instead of one underlying, so the run is heavier than with a named ticker or a specific asset list. Range: 0–100.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function IVPercentile(asset: AssetArg, length: number = 252, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "IVPercentile" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Where today's constant-maturity ATM IV sits between the lookback window's high and low: (IV − IV_low) / (IV_high − IV_low) × 100. Distinct from IV Percentile. Used on each candidate of a dynamic rebalance over a broad universe (all US stocks, an index or a watchlist), it reads options chains with Greeks for every stock in that universe instead of one underlying, so the run is heavier than with a named ticker or a specific asset list. Range: 0–100.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function IVRank(asset: AssetArg, length: number = 252, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "IVRank" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * EMA midline with ATR bands above and below. Tighter than Bollinger in calm tape, so closes outside the bands mean stronger conviction moves. Range: Price scale.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 * @param multiplier How many ATRs from the EMA midline
 * @param line Which Keltner line to evaluate
 */
export function KeltnerChannel(asset: AssetArg, length: number = 20, interval: Interval = "Day", multiplier: number = 2, line: "upper" | "middle" | "lower" = "middle"): Indicator {
  const d: Record<string, unknown> = { type: "KeltnerChannel" };
  setAsset(d, "targetAsset", asset);
  d["multiplier"] = multiplier;
  d["line"] = line;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The most recent regular cash dividend per share whose ex-dividend date is on or before the evaluation date (America/New_York), split-adjusted onto today's share basis, special dividends excluded. Returns null when the asset has no regular dividend on or before that date. Each payment is one observation for TrailingSum, so TrailingSum(LastDividend(asset), 4) sums the last four payments, which is trailing-twelve-month dividends for a quarterly payer (use 12 for a monthly payer).
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function LastDividend(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "LastDividend" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The execution price of the most recent order matching the specified filters. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param side Matches order events with this side (buy or sell)
 * @param orderStatus Matches order events with this status
 */
export function LastOrderPrice(asset: AssetArg, side: Side, orderStatus: OrderStatus = "Filled"): Indicator {
  const d: Record<string, unknown> = { type: "LastOrderPrice" };
  setAsset(d, "targetAsset", asset);
  d["side"] = side;
  d["orderStatus"] = orderStatus;
  return d as unknown as Indicator;
}
/**
 * Logarithm of an indicator with a specified base.
 * @param base The base for the logarithm
 */
export function Log(operand: Indicator, base: number = 10): Indicator {
  const d: Record<string, unknown> = { type: "Log" };
  d["base"] = base;
  d.indicators = [operand];
  return d as unknown as Indicator;
}
/**
 * The lowest price reached during the current trading session. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function LowOfDay(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "LowOfDay" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The maximum value of two or more indicators. The SDK builder takes exactly two operands; nest it to compare more.
 */
export function Max(left: Indicator, right: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "Max" };
  d.indicators = [left, right];
  return d as unknown as Indicator;
}
/**
 * The largest peak-to-trough percentage decline of the asset's price inside the window, reported as a positive number: 10 means a 10% fall from a high to a later low, and 0 means the price never fell below an earlier price in the window. Measures worst-case downside risk. Range: 0 to 100 (percent, never negative).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function MaxDrawdown(asset: AssetArg, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "MaxDrawdown" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The maximum trough-to-peak percentage increase over a window. Range: >= 0 (percentage).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function MaxDrawup(asset: AssetArg, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "MaxDrawup" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The highest of the asset's observed prices over a window, including the current one. Each observation is the price at that time (a completed day contributes its close, a completed minute its closing price), not an intrabar high. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function MaximumPrice(asset: AssetArg, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "MaximumPrice" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The minimum value of two or more indicators. The SDK builder takes exactly two operands; nest it to compare more.
 */
export function Min(left: Indicator, right: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "Min" };
  d.indicators = [left, right];
  return d as unknown as Indicator;
}
/**
 * The lowest of the asset's observed prices over a window, including the current one. Each observation is the price at that time (a completed day contributes its close, a completed minute its closing price), not an intrabar low. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function MinimumPrice(asset: AssetArg, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "MinimumPrice" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Difference between indicators.
 */
export function Minus(left: Indicator, right: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "Minus" };
  d.indicators = [left, right];
  return d as unknown as Indicator;
}
/**
 * The high of the most recently COMPLETED one-minute bar. The bar that opens at 9:30 is readable from 9:31, identically in backtests and live trading; the forming bar is never used. Not the day's high (use High of Day). Pre-market and after-hours bars count. Strategies using it run on one-minute data. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function MinuteBarHigh(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "MinuteBarHigh" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The low of the most recently COMPLETED one-minute bar. The bar that opens at 9:30 is readable from 9:31, identically in backtests and live trading; the forming bar is never used. Not the day's low (use Low of Day). Pre-market and after-hours bars count. Strategies using it run on one-minute data. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function MinuteBarLow(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "MinuteBarLow" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Whole minutes since the regular US market open (9:30 AM ET), read from the Eastern clock. The value is not clamped to the session: it is negative before the open and keeps rising above 390 after the 4:00 PM close. Range: 0 to 390 during a regular session; negative before 9:30 AM ET and above 390 after the close.
 */
export function MinutesAfterOpen(): Indicator {
  const d: Record<string, unknown> = { type: "MinutesAfterOpen" };
  return d as unknown as Indicator;
}
/**
 * The number of minutes since an AI agent was launched by this strategy. Useful for fine-grained rate-limiting of agent launches within a single day. Range: >= 0.
 */
export function MinutesSinceAgent(): Indicator {
  const d: Record<string, unknown> = { type: "MinutesSinceAgent" };
  return d as unknown as Indicator;
}
/**
 * The number of minutes since an alert was triggered. Useful for fine-grained rate-limiting of alerts within a single day. Range: >= 0.
 * @param message (Optional) Message to display when the indicator is triggered
 */
export function MinutesSinceAlert(message: string): Indicator {
  const d: Record<string, unknown> = { type: "MinutesSinceAlert" };
  d["message"] = message;
  return d as unknown as Indicator;
}
/**
 * The number of minutes since the most recent option order matching the specified filters. Same filters as Days Since Option Order but measured in minutes for intraday strategies. Range: >= 0 (minutes), or a large number if no matching order exists.
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 * @param positionEffect Filter by Open (entering position) or Close (exiting). Leave empty for all.
 * @param minDte Minimum days to expiration at order time. Leave empty for no minimum.
 * @param maxDte Maximum days to expiration at order time. Leave empty for no maximum.
 * @param orderStatus Matches option order events with this status
 */
export function MinutesSinceOptionOrder(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType, positionEffect: PositionEffect, minDte: number, maxDte: number, orderStatus: OrderStatus = "Filled"): Indicator {
  const d: Record<string, unknown> = { type: "MinutesSinceOptionOrder" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  d["positionEffect"] = positionEffect;
  d["minDte"] = minDte;
  d["maxDte"] = maxDte;
  d["orderStatus"] = orderStatus;
  return d as unknown as Indicator;
}
/**
 * Same as Days Since Order but measured in minutes. Useful for intraday strategies. Range: >= 0 (minutes).
 * @param assets Ticker(s) whose orders are counted. One string or an array.
 * @param side Buy or Sell
 * @param clock Optional elapsed-time clock; omitted retains calendar minutes.
 */
export function MinutesSinceOrder(assets: AssetArg | AssetArg[], side: Side, orderStatus: OrderStatus = "Filled", clock?: Clock): Indicator {
  const d: Record<string, unknown> = { type: "MinutesSinceOrder" };
  setAssets(d, "targetAssets", assets);
  d["side"] = side;
  d["orderStatus"] = orderStatus;
  if (clock !== undefined) d["clock"] = clock;
  return d as unknown as Indicator;
}
/**
 * Whole minutes until the US equity session close, read from the Eastern clock. The close is that day's real session close, so an early-close day counts down to 1:00 PM ET instead of 4:00 PM. The value is not clamped to the session: it is negative after the close and above 390 before the 9:30 AM open. Range: 0 to 390 during a regular session (0 to 210 on a 1:00 PM early close); negative after the close and above 390 before the open.
 */
export function MinutesUntilClose(): Indicator {
  const d: Record<string, unknown> = { type: "MinutesUntilClose" };
  return d as unknown as Indicator;
}
/**
 * Volume-weighted RSI: money flow direction over N bars on a 0-100 scale. Above 80 is overbought, below 20 oversold. Requires volume data. Range: 0 to 100.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function MoneyFlowIndex(asset: AssetArg, length: number = 14, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "MoneyFlowIndex" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The current month (1–12).
 */
export function Month(): Indicator {
  const d: Record<string, unknown> = { type: "Month" };
  return d as unknown as Indicator;
}
/**
 * MACD line (fast EMA minus slow EMA), its signal EMA, or the histogram (MACD minus signal). Classic trend/momentum indicator. Range: Positive or negative for all three lines, in price units: each is a difference of moving averages, not a price level.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param fastLength Period of the fast EMA
 * @param slowLength Period of the slow EMA (must exceed the fast length)
 * @param signalLength Period of the EMA applied to the MACD line
 * @param interval Bar interval the MACD is computed on
 * @param line Which MACD line to evaluate
 */
export function MovingAverageConvergenceDivergence(asset: AssetArg, fastLength: number = 12, slowLength: number = 26, signalLength: number = 9, interval: Interval = "Day", line: "macd" | "signal" | "histogram" = "macd"): Indicator {
  const d: Record<string, unknown> = { type: "MovingAverageConvergenceDivergence" };
  setAsset(d, "targetAsset", asset);
  d["fastLength"] = fastLength;
  d["slowLength"] = slowLength;
  d["signalLength"] = signalLength;
  d["interval"] = interval;
  d["line"] = line;
  return d as unknown as Indicator;
}
/**
 * Product of indicators.
 */
export function Multiply(left: Indicator, right: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "Multiply" };
  d.indicators = [left, right];
  return d as unknown as Indicator;
}
/**
 * Negates an indicator's value.
 */
export function Negative(operand: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "Negative" };
  d.indicators = [operand];
  return d as unknown as Indicator;
}
/**
 * True when a newly public Form 4 version matches the selected owner, issuer, role, instrument and action and awaits a strategy decision. Exact-owner corrections count as new versions. A company CIK without an owner watches every reporting owner at that company, and a joint filing fires once. A handled event does not fire again on later price ticks; unverified owner coverage has no value, and a company is only as covered as its least-covered matching owner. Range: 1 while a public Form 4 version awaits a decision; otherwise 0.
 * @param ownerCik Exact SEC reporting owner CIK. Omit for a whole company (with issuerCik) or aggregate Form 4 activity.
 * @param issuerCik Company CIK. With ownerCik, restricts that owner; alone, every reporting owner at this company, a joint filing once.
 * @param role The reporting owner's role.
 * @param instrument Call and Put require ownerCik or issuerCik.
 * @param disclosureAction Which newly public Form 4 action triggers a decision. Award requires ownerCik or issuerCik.
 */
export function NewInsiderDisclosure(ownerCik?: string, issuerCik?: string, role: Role = "Any", instrument: Instrument = "Equity", disclosureAction: "Any" | "Purchase" | "Sale" | "Award" = "Any"): Indicator {
  const d: Record<string, unknown> = { type: "NewInsiderDisclosure" };
  if (ownerCik !== undefined) d["ownerCik"] = ownerCik;
  if (issuerCik !== undefined) d["issuerCik"] = issuerCik;
  d["role"] = role;
  d["instrument"] = instrument;
  d["disclosureAction"] = disclosureAction;
  return d as unknown as Indicator;
}
/**
 * True when an exact manager CIK has a newly public 13F filing or amendment this strategy has not handled. Each accession creates one decision; later price ticks do not repeat it. The current InstitutionalHoldings book still sets target positions. Range: 1 while a public filing awaits a decision; otherwise 0.
 * @param manager Exact numeric SEC manager CIK. A new 13F accession, including an amendment, triggers one decision.
 */
export function NewInstitutionalFiling(manager: string): Indicator {
  const d: Record<string, unknown> = { type: "NewInstitutionalFiling" };
  d["manager"] = manager;
  return d as unknown as Indicator;
}
/**
 * True when a selected member has a newly public equity or option trade disclosure that this strategy has not handled. Corrections count when they become public. A handled disclosure does not fire again on later price ticks. Range: 1 while a new disclosure awaits a decision; otherwise 0.
 * @param memberId Exact Bioguide member ID, such as P000197.
 * @param instrument Equity or option disclosures, never both for a public bot arm.
 * @param disclosureAction Which newly public trade sides trigger a decision.
 */
export function NewPoliticalDisclosure(memberId: string, instrument: Instrument2, disclosureAction: "Any" | "Purchase" | "Sale"): Indicator {
  const d: Record<string, unknown> = { type: "NewPoliticalDisclosure" };
  d["memberId"] = memberId;
  d["instrument"] = instrument;
  d["disclosureAction"] = disclosureAction;
  return d as unknown as Indicator;
}
/**
 * News sentiment about the asset over its last lookbackDays daily news snapshots (default 1, the latest). Headlines come from the GDELT global news feed, and a fine-tuned model scores every headline that names the company: whether it is really about the company, and whether it is positive, neutral or negative news for it (a headline it calls neutral scores 0; others score from -1.0 to 1.0). Each trading day has one snapshot at 09:15 New York, and a headline counts toward the first session whose 09:15 cutoff is at or after the time GDELT published it. Backtests and live trading read the same rows. lookbackDays counts trading sessions whether or not the asset had news in them; a single session is noisy, and about 20 sessions is the usual window for a sentiment rule. Only headlines the model judges to be about the company count, and copies of one story within 7 days count once per session. measure (default Mean): Mean is the average sentiment from -1.0 to 1.0, Median is the middle score (the average of the two middle scores for an even count), NetCount is positive minus negative headlines, ArticleCount is the number of qualifying headlines. Coverage begins on 2019-09-23: a window reaching earlier is measured over the sessions since then, and the backtest warns that it held less history than configured. Every measure has no value across sessions with no published snapshot, or when the latest snapshot due has not been published. Mean and Median also have no value when the window holds no qualifying headline; the counts are then 0. Headlines are matched to the issuer, so every listed share class reads the same news and META reads Facebook-era headlines.
 * @param asset Pass CANDIDATE in a dynamic rebalance pipeline.
 * @param measure Median: middle score from -1 to 1, with no value when no qualifying news. Mean: average sentiment from -1 to 1, with no value when the window has no qualifying news. NetCount: positive minus negative headlines. ArticleCount: qualifying headlines. Every measure has no value across missing snapshots or when the due snapshot is unpublished. Before coverage begins on 2019-09-23 the window holds the sessions available.
 * @param lookbackDays Whole trading sessions of daily 09:15 New York news snapshots; 1 is the latest. A row is visible from the snapshot the lake assigned it, the same time in backtests and live trading.
 */
export function NewsSentiment(asset: AssetArg, measure: Measure = "Mean", lookbackDays: number = 1): Indicator {
  const d: Record<string, unknown> = { type: "NewsSentiment" };
  setAsset(d, "targetAsset", asset);
  d["measure"] = measure;
  d["lookbackDays"] = lookbackDays;
  return d as unknown as Indicator;
}
/**
 * True on the first evaluated trading tick of an ISO week until the strategy makes a decision. A no-order decision still consumes that week, and live portfolios persist the decision through a restart. Use with an option disclosure trigger for modeled maintenance. Range: 1 while this week's first decision is pending; otherwise 0.
 */
export function NewTradingWeek(): Indicator {
  const d: Record<string, unknown> = { type: "NewTradingWeek" };
  return d as unknown as Indicator;
}
/**
 * Running total of signed volume: adds the bar's volume on up closes, subtracts on down closes. Rising OBV with flat price is accumulation. Range: Unbounded (cumulative).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param interval Bar interval the volume is accumulated on
 */
export function OnBalanceVolume(asset: AssetArg, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "OnBalanceVolume" };
  setAsset(d, "targetAsset", asset);
  d["interval"] = interval;
  return d as unknown as Indicator;
}
/**
 * The price of an asset at market open. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function OpeningPrice(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "OpeningPrice" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Returns the total collateral locked across option spreads matching the filter. Range: 0 to ∞ (dollars).
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 */
export function OptionCollateral(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType): Indicator {
  const d: Record<string, unknown> = { type: "OptionCollateral" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  return d as unknown as Indicator;
}
/**
 * Returns the minimum or maximum days since entry across option spreads matching the filter. Range: 0 to ∞.
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 * @param minOrMax Return minimum or maximum value across matching spreads.
 */
export function OptionDaysHeld(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType, minOrMax: MinOrMax = "min"): Indicator {
  const d: Record<string, unknown> = { type: "OptionDaysHeld" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  d["minOrMax"] = minOrMax;
  return d as unknown as Indicator;
}
/**
 * Returns the minimum or maximum days to expiration across option spreads matching the filter. Range: 0 to 365+.
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 * @param minOrMax Return minimum or maximum value across matching spreads.
 */
export function OptionDaysToExpiration(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType, minOrMax: MinOrMax = "min"): Indicator {
  const d: Record<string, unknown> = { type: "OptionDaysToExpiration" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  d["minOrMax"] = minOrMax;
  return d as unknown as Indicator;
}
/**
 * Sum of absolute option leg marks divided by portfolio value (percent). Matches gross deployment audits. Unfiltered portfolio-wide only. Range: 0% to ∞.
 */
export function OptionGrossExposurePercent(): Indicator {
  const d: Record<string, unknown> = { type: "OptionGrossExposurePercent" };
  return d as unknown as Indicator;
}
/**
 * Returns the number of open option contract positions/legs matching the filter criteria. Portfolio-wide (no underlying, option type, direction, or spread filters): open legs plus legs reserved by earlier true OpenOption signals in the same tick's strategy loop. Filtered counts (e.g. per ticker) use open legs only. Use Option Spread Count for multi-leg spread groups. Range: 0 to ∞.
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 */
export function OptionPositionCount(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType): Indicator {
  const d: Record<string, unknown> = { type: "OptionPositionCount" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  return d as unknown as Indicator;
}
/**
 * Peak-to-current drawdown of the aggregated P&L percentage across option spreads matching the filter. Stateful counterpart of the Option Position P&L% indicator (OptionPositionPercentChange): while that indicator returns the current P&L percentage, this one tracks the highest value observed and returns how far the position has fallen from that peak. Resets when no matching spreads remain so a fresh entry starts from a clean peak. Range: >= 0 (percentage points of P&L).
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 */
export function OptionPositionMaxDrawdown(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType): Indicator {
  const d: Record<string, unknown> = { type: "OptionPositionMaxDrawdown" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  return d as unknown as Indicator;
}
/**
 * Returns the weighted average P&L percentage across option spreads matching the filter. Range: -100% to ∞.
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 */
export function OptionPositionPercentChange(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType): Indicator {
  const d: Record<string, unknown> = { type: "OptionPositionPercentChange" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  return d as unknown as Indicator;
}
/**
 * Returns the total market value of option spreads matching the filter criteria. Range: 0 to ∞ (dollars).
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 */
export function OptionPositionValue(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType): Indicator {
  const d: Record<string, unknown> = { type: "OptionPositionValue" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  return d as unknown as Indicator;
}
/**
 * Returns the net realized P&L in dollars from CLOSED option positions matching the filter, long and short alike. Losing closes count as negative. Measures closes only and subtracts nothing for premium already spent. Lookback Days limits it to closes within that many days of the evaluation date; omit it for the whole life of the book. Range: -∞ to ∞ (dollars).
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 * @param lookbackDays Only count activity within this many days of the evaluation date. Leave empty for the whole life of the book.
 */
export function OptionRealizedPnL(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType, lookbackDays?: number): Indicator {
  const d: Record<string, unknown> = { type: "OptionRealizedPnL" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  if (lookbackDays !== undefined) d["lookbackDays"] = lookbackDays;
  return d as unknown as Indicator;
}
/**
 * Returns realized option premium still available to spend: net realized P&L from closed short option positions, minus premium already spent by opens sized with Percent of Realized Premium. Proceeds from closing long options are not added back. This is the balance that allocation sizes against. It goes negative when closed shorts lost money, and a negative balance funds nothing. Lookback Days limits it to activity within that many days of the evaluation date; omit it for the whole life of the book. Range: -∞ to ∞ (dollars).
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param lookbackDays Only count activity within this many days of the evaluation date. Leave empty for the whole life of the book.
 */
export function OptionRealizedPremium(underlying: string, lookbackDays?: number): Indicator {
  const d: Record<string, unknown> = { type: "OptionRealizedPremium" };
  d["underlying"] = underlying;
  if (lookbackDays !== undefined) d["lookbackDays"] = lookbackDays;
  return d as unknown as Indicator;
}
/**
 * Returns the number of distinct economic open multi-leg option spreads matching the filter criteria, deduplicating equal economic spread keys. Does not count standalone single-leg option positions. Range: 0 to ∞.
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 */
export function OptionSpreadCount(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType): Indicator {
  const d: Record<string, unknown> = { type: "OptionSpreadCount" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  return d as unknown as Indicator;
}
/**
 * Returns the net price per share paid or collected to open the option spreads matching the filter: positive for a net debit, negative for a net credit. Several matching spreads average by contracts. Has no value when no matching spread is open. Use it as an option limit amount to price one spread off another spread's fill; wrap a credit spread's price in Absolute Value first, because a limit must be positive. Range: -∞ to ∞ (dollars per share).
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 */
export function OptionSpreadEntryPrice(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType): Indicator {
  const d: Record<string, unknown> = { type: "OptionSpreadEntryPrice" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  return d as unknown as Indicator;
}
/**
 * Returns the total unrealized P&L in dollars across option spreads matching the filter. Range: -∞ to ∞ (dollars).
 * @param underlying Filter by underlying (e.g., AAPL, SPY). Leave empty for all.
 * @param optionType Filter by Call or Put. Leave empty for all.
 * @param direction Filter by Long or Short. Leave empty for all.
 * @param spreadType Filter by spread type. Leave empty for all.
 */
export function OptionUnrealizedPnL(underlying: string, optionType: OptionType, direction: OptionDirection, spreadType: OptionSpreadType): Indicator {
  const d: Record<string, unknown> = { type: "OptionUnrealizedPnL" };
  d["underlying"] = underlying;
  d["optionType"] = optionType;
  d["direction"] = direction;
  d["spreadType"] = spreadType;
  return d as unknown as Indicator;
}
/**
 * Trailing stop-and-reverse level that accelerates toward price as the trend extends. Price crossing the SAR flips the trend. Range: Price scale.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param interval Bar interval the SAR trails on
 * @param step AF increment per new extreme
 * @param maximum AF cap
 */
export function ParabolicSar(asset: AssetArg, interval: Interval = "Day", step: number = 0.02, maximum: number = 0.2): Indicator {
  const d: Record<string, unknown> = { type: "ParabolicSar" };
  setAsset(d, "targetAsset", asset);
  d["interval"] = interval;
  d["step"] = step;
  d["maximum"] = maximum;
  return d as unknown as Indicator;
}
/**
 * Sum of two or more indicators. The SDK builder takes exactly two operands; nest it to add more.
 */
export function Plus(left: Indicator, right: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "Plus" };
  d.indicators = [left, right];
  return d as unknown as Indicator;
}
/**
 * A member's publicly known equity or option purchase dollars divided by the sum of both, across all disclosed tickers. Event versions enter only when public. Unclassified instruments are excluded. purchaseScope defaults to AllPurchases for historical flow. RemainingLots sums surviving original purchase costs after reported full sales and exercises, excluding unresolved ticker buckets. Unknown partial quantities retain their estimate. Neither setting is current market value or verified holdings. Range: 0 to 100 percent; zero before a qualifying purchase.
 * @param memberId Bioguide member id, for example P000197. The share uses the member's whole public purchase record.
 * @param instrument Which side of the equity/option purchase mix to return, as a percent from 0 to 100.
 * @param amountBasis Estimate for disclosed purchase ranges. Midpoint is the default.
 * @param purchaseScope AllPurchases preserves historical purchase flow. RemainingLots uses surviving purchase costs across identifiable tickers; unknown partial quantities retain their original estimate. Neither is current market value.
 */
export function PoliticalPurchaseShare(memberId: string, instrument: Instrument2 = "Equity", amountBasis: AmountBasis = "Midpoint", purchaseScope: "AllPurchases" | "RemainingLots" = "AllPurchases"): Indicator {
  const d: Record<string, unknown> = { type: "PoliticalPurchaseShare" };
  d["memberId"] = memberId;
  d["instrument"] = instrument;
  d["amountBasis"] = amountBasis;
  d["purchaseScope"] = purchaseScope;
  return d as unknown as Indicator;
}
/**
 * Trades by members of Congress in the asset, from the unified House and Senate disclosure lake, over a trailing window. A trade counts from the moment its report became public, never its trade date, and an amended report changes a value only from the moment the amendment became public. Amount metrics can use the lower, midpoint, or upper end of every disclosed range. Equity disclosures are the default; confirmed option disclosures can be selected separately for numeric activity. Held requires Equity and reads the member's whole public record instead: 1 while their latest equity disclosure for the asset is a purchase or partial sale, 0 after a full sale. Held is a disclosure signal, not verified holdings or share quantity. RemainingBuyAmount reads the full public history and sums original purchase ranges of remaining lots after full sales and exercises. Unknown partial quantities retain their purchase amount estimate; sale proceeds are never subtracted. This is estimated remaining cost, not current market value. Printed expirations identify lots but do not implicitly end modeled renewal exposure. Range: Disclosed amount-range values or counts over the window, or 1/0 for Held; 0 when no matching trade was disclosed.
 * @param asset Pass CANDIDATE inside a rebalance pipeline to bind each stock.
 * @param filer Member full or last name. Pass an empty string for all members.
 * @param metric Amount-range aggregate, event count, distinct purchasing members, RemainingBuyAmount (surviving original purchase amounts; ignores window; unknown partial quantities retained), or Held: 1 while the member still holds the asset (latest public disclosure is a purchase or partial sale), ignoring the window.
 * @param windowDays Trailing calendar days measured from when each event became public.
 * @param amountBasis Range endpoint used by amount metrics; LowerBound is conservative.
 * @param instrument Equity excludes confirmed option disclosures; Option selects them explicitly.
 * @param chamber Optional advanced cohort filter; named-member requests should normally use All.
 * @param memberId Bioguide id such as P000197. Matches exactly and overrides filer, because names collide.
 */
export function PoliticalTrades(asset: AssetArg, filer: string, metric: "NetAmount" | "BuyAmount" | "RemainingBuyAmount" | "SellAmount" | "BuyCount" | "SellCount" | "DistinctBuyers" | "Held" = "BuyAmount", windowDays: number = 90, amountBasis: AmountBasis = "LowerBound", instrument: "Equity" | "Option" | "All" = "Equity", chamber: "All" | "House" | "Senate" = "All", memberId: string = ""): Indicator {
  const d: Record<string, unknown> = { type: "PoliticalTrades" };
  setAsset(d, "targetAsset", asset);
  d["filer"] = filer;
  d["metric"] = metric;
  d["windowDays"] = windowDays;
  d["amountBasis"] = amountBasis;
  d["instrument"] = instrument;
  d["chamber"] = chamber;
  d["memberId"] = memberId;
  return d as unknown as Indicator;
}
/**
 * The total current value of your portfolio (cash + all positions). Range: >= 0.
 */
export function PortfolioValue(): Indicator {
  const d: Record<string, unknown> = { type: "PortfolioValue" };
  return d as unknown as Indicator;
}
/**
 * Original filled entry price for the current holding. Added shares preserve this original anchor; closing the holding resets it.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function PositionEntryPrice(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "PositionEntryPrice" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The maximum percentage decline in the position's unrealized P&L from its peak. Aggregates the stock or crypto holding plus all option spreads on that underlying. Returns 0 at a new high water mark; rises as P&L falls below the peak, so it is never negative. Range: >= 0 (percentage points of P&L).
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function PositionMaxDrawdown(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "PositionMaxDrawdown" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The percentage increase of the asset's current market price from the lowest price observed by this indicator. Share purchases and sales do not change the calculation; it does not use position cost basis. Range: >= 0 (percentage).
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function PositionMaxDrawup(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "PositionMaxDrawup" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Exchange trading minutes since the current holding's last new high. Closed-market minutes do not count. Added shares preserve the holding's observation path.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function PositionMinutesSinceHigh(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "PositionMinutesSinceHigh" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Highest observed price since the current holding's original entry. Added shares preserve the peak path; closing resets it.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function PositionPeakPrice(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "PositionPeakPrice" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * How much your position has gained or lost as a percentage since you opened it. Range: Unbounded (percentage).
 * @param assets Ticker name (ex. SPY, BTC)
 */
export function PositionPercentChange(assets: AssetArg | AssetArg[]): Indicator {
  const d: Record<string, unknown> = { type: "PositionPercentChange" };
  setAssets(d, "targetAssets", assets);
  return d as unknown as Indicator;
}
/**
 * The current dollar value of your position in one or more assets. Range: >= 0.
 * @param assets Ticker name (ex. SPY, BTC)
 */
export function PositionValue(assets: AssetArg | AssetArg[]): Indicator {
  const d: Record<string, unknown> = { type: "PositionValue" };
  setAssets(d, "targetAssets", assets);
  return d as unknown as Indicator;
}
/**
 * The closing price from the previous trading session. It already has a one-session offset; wrapping it in Indicator Window Ago adds another lag rather than selecting that same previous close. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function PreviousClosingPrice(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "PreviousClosingPrice" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The current market price of any asset. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function Price(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "Price" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The dollar change in price since market open. Range: Unbounded.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function PriceChangeSinceOpen(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "PriceChangeSinceOpen" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The mean absolute deviation of an asset's price over a window. Similar to standard deviation but less sensitive to outliers. Range: >= 0.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function PriceMeanAbsoluteDeviation(asset: AssetArg, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "PriceMeanAbsoluteDeviation" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * Measures the percentage change in price between the current price and the price N periods ago. Range: Unbounded (percentage).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function PriceRateOfChange(asset: AssetArg, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "PriceRateOfChange" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The standard deviation of an asset's closing price over a window. Measures price volatility. Range: >= 0.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function PriceStandardDeviation(asset: AssetArg, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "PriceStandardDeviation" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
export const PriceStdDev = PriceStandardDeviation;
/**
 * Exposes the allocation plan that a DynamicRebalance or RebalanceOption action is about to execute, so the strategy condition can decide whether that plan is worthwhile. Range: Drift and turnover are portfolio fractions; cost and benefit metrics are dollar amounts.
 * @param metric Reads the prospective plan calculated by DynamicRebalance or RebalanceOption before the strategy condition runs.
 */
export function RebalanceDecisionMetric(metric: "allocationDrift" | "plannedTurnover" | "estimatedCost" | "expectedBenefit" | "netBenefit" = "netBenefit"): Indicator {
  const d: Record<string, unknown> = { type: "RebalanceDecisionMetric" };
  d["metric"] = metric;
  return d as unknown as Indicator;
}
/**
 * Measures the speed and magnitude of recent price changes. Oscillates between 0 and 100. Range: 0 to 100.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function RelativeStrengthIndex(asset: AssetArg, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "RelativeStrengthIndex" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
export const RSI = RelativeStrengthIndex;
/**
 * Current bar volume divided by the average volume of the trailing N completed bars. 1.0 means the bar is trading exactly its recent pace. Range: >= 0 (ratio around 1.0).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function RelativeVolume(asset: AssetArg, length: number = 14, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "RelativeVolume" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * SMA/EMA window interval Day means elapsed calendar time, including closed exchange dates. TradingDay uses the exchange-session clock for exchange-traded assets and skips closed dates while preserving within-session time. For a conventional N-day stock moving average, author interval TradingDay unless the request explicitly specifies elapsed calendar days. An outer TradingDay lag does not change an inner Day average into an N-session average. Preserve an explicit calendar-day request as Day. Continuous-market daily windows use 24-hour Day intervals. A TradingDay window can still have a forming current reading: choose completed-session references separately when the signal requires confirmed closes. ChartBar periods and offsets already identify completed candles; preserve that clock instead of substituting a time-window average.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function SimpleMovingAverage(asset: AssetArg, length: number = 30, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "SimpleMovingAverage" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
export const SMA = SimpleMovingAverage;
/**
 * Square root of an indicator.
 */
export function SquareRoot(operand: Indicator): Indicator {
  const d: Record<string, unknown> = { type: "SquareRoot" };
  d.indicators = [operand];
  return d as unknown as Indicator;
}
/**
 * Momentum oscillator comparing the close to the high-low range over N bars, with %K smoothing and a %D signal average. Readings above 80 are overbought, below 20 oversold. Range: 0 to 100.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 * @param smoothK Moving-average length applied to raw %K
 * @param smoothD Moving-average length applied to smoothed %K
 * @param line Which stochastic line to evaluate
 */
export function Stochastic(asset: AssetArg, length: number = 14, interval: Interval = "Day", smoothK: number = 3, smoothD: number = 3, line: "k" | "d" = "k"): Indicator {
  const d: Record<string, unknown> = { type: "Stochastic" };
  setAsset(d, "targetAsset", asset);
  d["smoothK"] = smoothK;
  d["smoothD"] = smoothD;
  d["line"] = line;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * AI stock report rating: a fundamental-strength score from 1 to 5, higher is stronger, synthesizing revenue growth, profitability, balance sheet health, valuation and competitive positioning. Point-in-time: a backtest reads the rating in effect on each date. Works on a named ticker and on CANDIDATE inside a rebalance filter, rank or weight, e.g. gte(StockReport(CANDIDATE), Value(3.5)) for fundamentally strong stocks.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function StockReport(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "StockReport" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The total dollar amount across all matching orders within a window. Range: >= 0.
 * @param side Matches order events with this side (buy or sell)
 * @param orderStatus Matches order events with this status
 * @param length Length of time
 * @param interval Unit of time
 * @param assets Ticker name (ex. SPY, BTC)
 */
export function SumOrderAmount(side: Side, orderStatus: OrderStatus = "Filled", length: number = 1, interval: Interval = "Day", assets?: AssetArg | AssetArg[]): Indicator {
  const d: Record<string, unknown> = { type: "SumOrderAmount" };
  d["side"] = side;
  d["orderStatus"] = orderStatus;
  setAssets(d, "targetAssets", assets);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The total number of shares across all matching orders within a window. Range: >= 0.
 * @param side Matches order events with this side (buy or sell)
 * @param orderStatus Matches order events with this status
 * @param length Length of time
 * @param interval Unit of time
 * @param assets Ticker name (ex. SPY, BTC)
 */
export function SumOrderQuantity(side: Side, orderStatus: OrderStatus = "Filled", length: number = 1, interval: Interval = "Day", assets?: AssetArg | AssetArg[]): Indicator {
  const d: Record<string, unknown> = { type: "SumOrderQuantity" };
  d["side"] = side;
  d["orderStatus"] = orderStatus;
  setAssets(d, "targetAssets", assets);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * ATR trailing band that ratchets with the trend and flips sides on a close through it. The direction line reads +1 in an uptrend, -1 in a downtrend. Range: Price scale (value); +1 / -1 (direction).
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 * @param multiplier How many ATRs from HL2
 * @param line Band value or trend direction (+1 up, -1 down)
 */
export function Supertrend(asset: AssetArg, length: number = 10, interval: Interval = "Day", multiplier: number = 3, line: "value" | "direction" = "value"): Indicator {
  const d: Record<string, unknown> = { type: "Supertrend" };
  setAsset(d, "targetAsset", asset);
  d["multiplier"] = multiplier;
  d["line"] = line;
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The sum of the last N accepted observations of the inner indicator. Generic inputs append when the value changes; source-backed inputs use their own observation identities. Length counts retained observations rather than every evaluation tick.
 * @param length Length of the rolling window
 */
export function TrailingSum(operand: Indicator, length: number = 4): Indicator {
  const d: Record<string, unknown> = { type: "TrailingSum" };
  d["length"] = length;
  d.indicators = [operand];
  return d as unknown as Indicator;
}
/**
 * The greatest of: current high minus low, |high − previous close|, or |low − previous close|. Measures single-period volatility. Range: >= 0.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function TrueRange(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "TrueRange" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * The current percentage decline of the asset's market price from the highest price observed by this indicator. Tracks the underlying price independently of position state. Range: 0 to 100 (percentage).
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function UnderlyingMaxDrawdown(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "UnderlyingMaxDrawdown" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * A fixed numeric value. Useful as one side of a comparison.
 * @param value Constant value
 */
export function Value(value: number = 0): Indicator {
  const d: Record<string, unknown> = { type: "Value" };
  d["value"] = value;
  return d as unknown as Indicator;
}
/**
 * Trading volume for the asset. It is the Fundamental indicator with its metric preset to Volume, on the same pipeline and data sources. Keep the metric at Volume: any other metric returns that fundamental metric instead of volume. Range: >= 0.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param metric The fundamental metric to use
 */
export function Volume(asset: AssetArg, metric: FundamentalMetric = "volume"): Indicator {
  const d: Record<string, unknown> = { type: "Volume" };
  setAsset(d, "targetAsset", asset);
  d["metric"] = metric;
  return d as unknown as Indicator;
}
/**
 * The average price weighted by volume throughout the trading session. A key intraday benchmark. Range: > 0.
 * @param asset Ticker name (ex. SPY, BTC)
 */
export function VWAP(asset: AssetArg): Indicator {
  const d: Record<string, unknown> = { type: "VWAP" };
  setAsset(d, "targetAsset", asset);
  return d as unknown as Indicator;
}
/**
 * Momentum oscillator placing the close within the high-low range over N bars, on a -100 to 0 scale. Above -20 is overbought, below -80 oversold. Range: -100 to 0.
 * @param asset Ticker name (ex. SPY, BTC)
 * @param length Length of time
 * @param interval Unit of time
 */
export function WilliamsR(asset: AssetArg, length: number = 14, interval: Interval = "Day"): Indicator {
  const d: Record<string, unknown> = { type: "WilliamsR" };
  setAsset(d, "targetAsset", asset);
  d.window = { length: length, interval: interval };
  return d as unknown as Indicator;
}
/**
 * The current year.
 */
export function Year(): Indicator {
  const d: Record<string, unknown> = { type: "Year" };
  return d as unknown as Indicator;
}

// ---- generated job builders ----
export type FitnessFunction = "sharpeRatio" | "sortinoRatio" | "winRate" | "profitFactor" | "calmarRatio" | "maxDrawdown" | "avgDrawdown" | "percentChange" | "dollarsSold" | "ulcerPerformanceIndex" | "participationRate" | "distinctUnderlyingsTraded" | "medianDeployment";
export interface FeeAmount { amount: number; type: "percent" | "dollars" }
/** Fee contract keyed by asset class. Omit for shared defaults (Option $0.65/contract). */
export interface FeeConfig {
  Stock?: FeeAmount;
  Cryptocurrency?: FeeAmount;
  Option?: FeeAmount;
  /** Option fill slippage: 0=quote mid, 1=ask for buys/bid for sells; absent means 0.5. Requires a current executable quote. */
  OptionSlippageFraction?: number;
}
export interface MetricConstraint {
  metric: FitnessFunction;
  comparison: "lessThan" | "greaterThan" | "lessThanOrEqual" | "greaterThanOrEqual" | "equal" | "notEqual";
  value: number;
}
/** Winner-selection floors/objectives. Never hard-fails the run. */
export type SelectionPolicy =
  | { mode: "constrainedPrimary"; primary: FitnessFunction; constraints?: MetricConstraint[]; tieBreakers?: FitnessFunction[] }
  | { mode: "pareto"; objectives: FitnessFunction[]; constraints?: MetricConstraint[]; tieBreakers?: FitnessFunction[] };
/**
 * Not on the SDK surface — genes are authored with the typed gene* builders and
 * passed as `genes: Gene[]`. Kept as a named alias only for completeness; the
 * host assembles the real SweepConfig (see models/optimization/sweep.ts).
 */
export type SweepConfig = Record<string, unknown>;
/** Adaptive walk-forward controls — see AdaptiveConfig in models/walkForward. */
export type AdaptiveConfig = Record<string, unknown>;
/** A constructed job request. The host submits it; the SDK cannot. */
export interface JobRequest {
  tool: "backtest_portfolio" | "run_walk_forward_study" | "optimize_portfolio";
  portfolio: Portfolio;
  args: Record<string, unknown>;
}
export interface BacktestConfig {
  /** Backtest start date (ISO format, e.g. 2024-01-01). For interval=Minute, default first-look is the last 90 inclusive calendar days and the selected range plus minute-indicator warmup cannot exceed 730 days of minute data. Do not use 2010-01-01 on Minute. */
  startDate: string;
  /** Backtest end date (ISO format, e.g. 2024-12-31). Minute allows up to 730 days of minute data from start_date, counting minute-indicator warmup; never split a longer span into yearly Minute jobs. */
  endDate: string;
  /** Deprecated Stock benchmark shorthand for comparisonValue. Use baseline_asset with an explicit Stock or Cryptocurrency type; never provide both fields. When both fields are omitted, the single traded stock/option underlying is inferred, otherwise SPY. For single-name options use that underlying; compare multi-name books against a deliberately chosen benchmark. */
  baselineSymbol?: string;
  /** Typed buy-and-hold benchmark for comparisonValue. Use {type:'Cryptocurrency',symbol:'BTC-USD',name:'BTC-USD'} for BTC or {type:'Stock',symbol:'SPY',name:'SPY'} for a stock/ETF. Symbol text never determines asset type. Omit baseline_symbol when using this field. */
  baselineAsset?: Record<string, unknown>;
  /** Time interval: Day or Minute (default Day). Day uses fixed OHLC decision/fill snapshots and overrides the portfolio deployment frequency, openDelayMinutes, closeLeadMinutes and intervalSeconds. Use Minute when the authored intraday schedule matters. Minute is a daytrade tape. 730 days of minute data (selected range plus warmup) is the HARD CAP; 90 days is only the DEFAULT when you name no dates. Name the dates you actually want — certifying a candidate on a full year or two is a normal second backtest, not an escalation. */
  interval?: "Day" | "Minute";
  /** Starting portfolio value (default 10000) Range 1..inf. */
  initialValue?: number;
  /** Generate detailed event data (signals, orders, audits) during backtest. Costs 5x research tokens for minute-level backtests. Events are retained for 3 days. Use query_backtest_events to explore them while retained. */
  generateEvents?: boolean;
  /** Quote the estimated research-token cost of a fresh run without launching. Small daily stock backtests are free. Larger runs are priced by strategy, assets scanned, and calendar days including warm-up. */
  previewOnly?: boolean;
  /** Create and execute a fresh backtest instead of reusing a prior identical result. Defaults to false. Requires portfolio_id. Use for an explicitly requested rerun or warm-cache timing; this reruns the simulation and incurs the normal backtest cost. */
  forceNewRun?: boolean;
  /** Optional fee contract keyed by AssetTypeEnum (Stock/Cryptocurrency/Option) with {amount, type: percent|dollars}. Omit for shared defaults (Option $0.65/contract). For replay of an optimizer/walk-forward study, pass that study's persisted feeConfig. OptionSlippageFraction is supported: 0 fills at quote mid, 1 at ask for buys/bid for sells; omitted uses the engine default 0.5. Fills require a current executable quote; this does not enable last-trade fallback pricing. */
  feeConfig?: FeeConfig;
  /** Overrides the portfolio's dividend policy for this run only. Omit to use the portfolio's own setting (cash unless it was set to reinvest). "reinvest" buys more of the paying stock on each pay date while that stock is still held. A fully exited position receives its locked dividend entitlement as cash without reopening the position. Reinvest is what a buy-and-hold comparison against the SPY total-return baseline needs. */
  dividendPolicy?: "cash" | "reinvest";
}
export interface WalkForwardConfig {
  /** Number of forward folds (2–8, required). Range 2..8. */
  foldCount: number;
  /** Global calendar start for the walk-forward study (ISO date). Optional: defaults to six years before global_end_date, or for a Minute study to the longest window ending there that fits the cap. Each Minute evaluation window cannot exceed 730 days of minute data counting minute-indicator warmup, which is the only cap. */
  globalStartDate?: string;
  /** Global calendar end for the walk-forward study (ISO date). Optional: defaults to the last complete US equity trading session. */
  globalEndDate?: string;
  /** Child optimizer engine: ga (default) or sweep. Prefer sweep for deploy certification and options rotation books; use ga for exploratory continuous mutation. */
  engineKind?: "ga" | "sweep";
  /** Anchored (default) or rolling outer window mode. */
  walkForwardMode?: "anchored" | "rolling";
  /** OOS window width in calendar days (default 252). Range 1..inf. */
  oosWidthDays?: number;
  /** Validation share inside each fold's development window (1–50). Default 20 for exploratory runs. Default 50 when certification: true (sweep or GA) — longer validation reduces fold-winner selection noise. Range 1..50. */
  validationPercent?: number;
  /** Embargo gap between training and validation (default 14). Range 0..inf. */
  embargoDays?: number;
  /** GA population size (default 6). Range 3..12. */
  populationSize?: number;
  /** GA generations (default 6). Range 1..10. */
  numGenerations?: number;
  /** Inner rolling training windows (default 3). Range 1..20. */
  numWindows?: number;
  /** Inner train/validation split percent (default 75). Range 10..95. */
  trainingPercent?: number;
  /** Inner rolling window overlap percent (default 50). Range 0..95. */
  windowOverlapPercent?: number;
  fitnessFunctions?: ("sharpeRatio" | "sortinoRatio" | "winRate" | "profitFactor" | "calmarRatio" | "maxDrawdown" | "avgDrawdown" | "percentChange" | "dollarsSold" | "ulcerPerformanceIndex" | "participationRate" | "distinctUnderlyingsTraded" | "medianDeployment")[];
  /** Winner selection policy (objectives, constraints, tieBreakers). Applies to sweep leaderboard and fold winner selection. For GA WF, also sets NSGA-II activity constraints when fold_selection_policy is omitted. */
  selectionPolicy?: SelectionPolicy;
  /** Explicit fold winner selection policy. Overrides selection_policy for fold winner pick. When set, train→validation degradation penalty defaults to 0.5 unless degradation_penalty is set. */
  foldSelectionPolicy?: SelectionPolicy;
  /** Optional fee contract keyed by AssetTypeEnum (Stock/Cryptocurrency/Option) with {amount, type: percent|dollars}. Frozen on the study and applied to all fold scoring / OOS. Omit for shared defaults matching standalone backtests (Option $0.65/contract). Unknown keys are rejected. */
  feeConfig?: FeeConfig;
  /** Train→validation degradation weight for fold winner ranking (default 0.5 when an explicit policy is set; 0.0 for legacy GA Sharpe-only studies). Range 0..1. */
  degradationPenalty?: number;
  /** Sweep leaderboard size when using gene_intents (default 25). Range 1..250. */
  leaderboardSize?: number;
  /** Sweep search mode: auto (default), exhaustive, or generational. */
  searchMode?: "auto" | "exhaustive" | "generational";
  /** When true, compile and validate the walk-forward plan without creating a study or charging tokens. Returns fold calendar, estimated token cost, and compiled sweepGenes (when engine_kind is sweep). */
  previewOnly?: boolean;
  interval?: "Day" | "Minute";
  /** Start orchestrator immediately (default true). */
  autoRun?: boolean;
  /** Optional study label. */
  name?: string;
  /** Study scoring mode: validation (per-fold independent OOS, default), adaptive (stitched re-optimized policy curve), or both. */
  mode?: "validation" | "adaptive" | "both";
  /** Validation-only OOS stride in days; when less than oos_width_days folds overlap. Ignored in adaptive/both (contiguous tiling). Range 1..inf. */
  oosStrideDays?: number;
  /** Adaptive/both only: { reoptimizeWindow: anchored|rolling, hysteresisMarginPct, maxTurnoverPerRollPct? }. */
  adaptiveConfig?: AdaptiveConfig;
  /** Per-fold inner execution: optimize (default, run GA/sweep per fold) or backtest_only (certify fixed portfolio — train/val/OOS backtests only, no inner optimizer). */
  innerMode?: "optimize" | "backtest_only";
  /** When true with inner_mode optimize, apply default certification selection policy (activity floors + percentChange≥0 + sortino≥0.5) unless explicit selection_policy is set. Also defaults validation_percent to 50. Prefer engine_kind sweep for deploy certification; GA+certification is rejected unless allow_ga_certification is true. */
  certification?: boolean;
  /** Explicit override to allow engine_kind ga with certification: true. Default false — use sweep+certification or inner_mode backtest_only for deployable studies. */
  allowGaCertification?: boolean;
  /** Alias for certification — applies DEFAULT_CERTIFICATION_SELECTION_POLICY on optimize-mode studies. */
  useCertificationSelectionPolicy?: boolean;
  /** Typed sweep genes built with the gene* builders (deterministic; no LLM compile). */
  genes?: Gene[];
}
export interface OptimizationConfig {
  /** Optimization start date (ISO format, e.g. 2024-01-01). Minute has ONE cap: 730 days of minute data, counting minute-indicator warmup. The 90-day first look is a default for callers who name no dates, not a ceiling — pass the window the question needs. */
  startDate: string;
  /** Optimization end date (ISO format, e.g. 2024-12-31). Minute selected range plus minute-indicator warmup cannot exceed 730 days of minute data. */
  endDate: string;
  /** Fitness functions: sharpeRatio, sortinoRatio, winRate, profitFactor, calmarRatio, maxDrawdown, avgDrawdown, percentChange, dollarsSold, ulcerPerformanceIndex, participationRate, distinctUnderlyingsTraded, medianDeployment */
  fitnessFunctions?: ("sharpeRatio" | "sortinoRatio" | "winRate" | "profitFactor" | "calmarRatio" | "maxDrawdown" | "avgDrawdown" | "percentChange" | "dollarsSold" | "ulcerPerformanceIndex" | "participationRate" | "distinctUnderlyingsTraded" | "medianDeployment")[];
  /** Population size for genetic algorithm (default 6, range 3-12) Range 3..12. */
  populationSize?: number;
  /** Number of generations (default 6, max 10) Range 1..10. */
  numGenerations?: number;
  /** Number of rolling training windows (default 3, max 20) Range 1..20. */
  numWindows?: number;
  /** Whole-percent share of the requested date range used for training; the remaining tail is validation (default 75). Uses app-style percent units, e.g. 75 not 0.75. Range 10..95. */
  trainingPercent?: number;
  /** Whole-percent overlap between adjacent rolling training windows (default 50). Uses app-style percent units, e.g. 50 not 0.5. Range 0..95. */
  windowOverlapPercent?: number;
  /** Time interval: Day or Minute (default Day) */
  interval?: "Day" | "Minute";
  /** Optional winner-selection policy with activity/quality/posture floors (participationRate, distinctUnderlyingsTraded, medianDeployment, percentChange, sortinoRatio, etc.). Steers GA away from thin or over-deployed validation winners during evolution and leaderboard ranking. Never hard-fails the run. */
  selectionPolicy?: SelectionPolicy;
  /** Optional fee contract keyed by AssetTypeEnum (Stock/Cryptocurrency/Option) with {amount, type: percent|dollars}. Omit for shared defaults matching standalone backtests (Option $0.65/contract). Unknown keys are rejected. */
  feeConfig?: FeeConfig;
  /** Typed sweep genes built with the gene* builders (deterministic; no LLM compile). */
  genes?: Gene[];
}

/** Submit a backtest. Returns a handle; results are read after it completes. */
export const backtest = (
  portfolio: Portfolio,
  config: BacktestConfig,
): JobRequest => ({
  tool: "backtest_portfolio",
  portfolio,
  args: compact({
    "start_date": config.startDate,
    "end_date": config.endDate,
    "baseline_symbol": config.baselineSymbol,
    "baseline_asset": config.baselineAsset,
    "interval": config.interval,
    "initial_value": config.initialValue,
    "generate_events": config.generateEvents,
    "preview_only": config.previewOnly,
    "force_new_run": config.forceNewRun,
    "fee_config": config.feeConfig,
    "dividend_policy": config.dividendPolicy,
  }),
});

/** Submit a walk-forward study (anchored or rolling folds, GA or sweep engine). */
export const walkForward = (
  portfolio: Portfolio,
  config: WalkForwardConfig,
): JobRequest => ({
  tool: "run_walk_forward_study",
  portfolio,
  args: compact({
    "fold_count": config.foldCount,
    "global_start_date": config.globalStartDate,
    "global_end_date": config.globalEndDate,
    "engine_kind": config.engineKind,
    "walk_forward_mode": config.walkForwardMode,
    "oos_width_days": config.oosWidthDays,
    "validation_percent": config.validationPercent,
    "embargo_days": config.embargoDays,
    "population_size": config.populationSize,
    "num_generations": config.numGenerations,
    "num_windows": config.numWindows,
    "training_percent": config.trainingPercent,
    "window_overlap_percent": config.windowOverlapPercent,
    "fitness_functions": config.fitnessFunctions,
    "selection_policy": config.selectionPolicy,
    "fold_selection_policy": config.foldSelectionPolicy,
    "fee_config": config.feeConfig,
    "degradation_penalty": config.degradationPenalty,
    "leaderboard_size": config.leaderboardSize,
    "search_mode": config.searchMode,
    "preview_only": config.previewOnly,
    "interval": config.interval,
    "auto_run": config.autoRun,
    "name": config.name,
    "mode": config.mode,
    "oos_stride_days": config.oosStrideDays,
    "adaptive_config": config.adaptiveConfig,
    "inner_mode": config.innerMode,
    "certification": config.certification,
    "allow_ga_certification": config.allowGaCertification,
    "use_certification_selection_policy": config.useCertificationSelectionPolicy,
    "genes": config.genes,
  }),
});

/** Submit a genetic optimization over the portfolio's tunable genes. */
export const optimization = (
  portfolio: Portfolio,
  config: OptimizationConfig,
): JobRequest => ({
  tool: "optimize_portfolio",
  portfolio,
  args: compact({
    "start_date": config.startDate,
    "end_date": config.endDate,
    "fitness_functions": config.fitnessFunctions,
    "population_size": config.populationSize,
    "num_generations": config.numGenerations,
    "num_windows": config.numWindows,
    "training_percent": config.trainingPercent,
    "window_overlap_percent": config.windowOverlapPercent,
    "interval": config.interval,
    "selection_policy": config.selectionPolicy,
    "fee_config": config.feeConfig,
    "genes": config.genes,
  }),
});

// ---- generated sweep-gene builders ----
export type SweepSortDirection = "Highest" | "Lowest";
/**
 * Which scalar inside an addressed condition node a parametric gene varies.
 * "Lhs"/"Rhs" name the two indicators of a comparison; "Node" names the node's
 * own number (a Then chain's window, a Multi's threshold).
 */
export type ConditionNodeSlot = "Lhs" | "Rhs" | "Node";
/** One authored sweep gene. Opaque to callers — built via the gene* builders. */
export interface Gene { field: string; scope: string; target: Record<string, unknown>; values: unknown[] }

/** Sweep Subject (Portfolio scope) over a value set. */
export const geneSubject = (values: AssetArg[][]): Gene => ({
  field: "Subject",
  scope: "Portfolio",
  target: { scope: "Portfolio", field: "Subject" },
  values: values as unknown[],
});

/** Sweep EntryCondition (Strategy scope) over a value set. */
export const geneEntryCondition = (strategyIndex: number, values: { label: string; condition: Condition }[]): Gene => ({
  field: "EntryCondition",
  scope: "Strategy",
  target: { scope: "Strategy", field: "EntryCondition", strategyIndex },
  values: values as unknown[],
});

/** Sweep EntryCondition (Strategy scope), replacing the seed's gate rather than adding to it. */
export const geneReplaceEntryCondition = (strategyIndex: number, values: { label: string; condition: Condition }[]): Gene => ({
  field: "EntryCondition",
  scope: "Strategy",
  target: { scope: "Strategy", field: "EntryCondition", strategyIndex, replace: true },
  values: values as unknown[],
});

/** Sweep ExitCondition (Strategy scope) over a value set. */
export const geneExitCondition = (strategyIndex: number, values: { label: string; condition: Condition }[]): Gene => ({
  field: "ExitCondition",
  scope: "Strategy",
  target: { scope: "Strategy", field: "ExitCondition", strategyIndex },
  values: values as unknown[],
});

/** Sweep ExitCondition (Strategy scope), replacing the seed's gate rather than adding to it. */
export const geneReplaceExitCondition = (strategyIndex: number, values: { label: string; condition: Condition }[]): Gene => ({
  field: "ExitCondition",
  scope: "Strategy",
  target: { scope: "Strategy", field: "ExitCondition", strategyIndex, replace: true },
  values: values as unknown[],
});

/** Sweep EntryCooldownDays (Strategy scope) over a value set. */
export const geneEntryCooldownDays = (strategyIndex: number, values: number[]): Gene => ({
  field: "EntryCooldownDays",
  scope: "Strategy",
  target: { scope: "Strategy", field: "EntryCooldownDays", strategyIndex },
  values: values as unknown[],
});

/** Sweep ConditionWindowLength (Strategy scope) over a value set. */
export const geneConditionWindowLength = (strategyIndex: number, path: number[], slot: ConditionNodeSlot, values: number[], indicatorPath?: number[]): Gene => ({
  field: "ConditionWindowLength",
  scope: "Strategy",
  target: { scope: "Strategy", field: "ConditionWindowLength", strategyIndex, path, slot, ...(indicatorPath === undefined ? {} : { indicatorPath }) },
  values: values as unknown[],
});

/** Sweep ConditionThreshold (Strategy scope) over a value set. */
export const geneConditionThreshold = (strategyIndex: number, path: number[], slot: ConditionNodeSlot, values: number[], indicatorPath?: number[], parameter?: string): Gene => ({
  field: "ConditionThreshold",
  scope: "Strategy",
  target: { scope: "Strategy", field: "ConditionThreshold", strategyIndex, path, slot, ...(indicatorPath === undefined ? {} : { indicatorPath }), ...(parameter === undefined ? {} : { parameter }) },
  values: values as unknown[],
});

/** Sweep RankSignal (Action scope) over a value set. */
export const geneRankSignal = (strategyIndex: number, values: { label: string; indicator: Indicator; direction: SweepSortDirection }[]): Gene => ({
  field: "RankSignal",
  scope: "Action",
  target: { scope: "Action", field: "RankSignal", strategyIndex },
  values: values as unknown[],
});

/** Sweep BuyingPowerPct (Action scope) over a value set. */
export const geneBuyingPowerPct = (strategyIndex: number, values: number[]): Gene => ({
  field: "BuyingPowerPct",
  scope: "Action",
  target: { scope: "Action", field: "BuyingPowerPct", strategyIndex },
  values: values as unknown[],
});

/** Sweep AllocationPct (Action scope) over a value set. */
export const geneAllocationPct = (strategyIndex: number, values: number[]): Gene => ({
  field: "AllocationPct",
  scope: "Action",
  target: { scope: "Action", field: "AllocationPct", strategyIndex },
  values: values as unknown[],
});

/** Sweep AllocationDollars (Action scope) over a value set. */
export const geneAllocationDollars = (strategyIndex: number, values: number[]): Gene => ({
  field: "AllocationDollars",
  scope: "Action",
  target: { scope: "Action", field: "AllocationDollars", strategyIndex },
  values: values as unknown[],
});

/** Sweep TotalBudgetPct (Action scope) over a value set. */
export const geneTotalBudgetPct = (strategyIndex: number, values: number[]): Gene => ({
  field: "TotalBudgetPct",
  scope: "Action",
  target: { scope: "Action", field: "TotalBudgetPct", strategyIndex },
  values: values as unknown[],
});

/** Sweep DeploymentPct (Action scope) over a value set. */
export const geneDeploymentPct = (strategyIndex: number, values: number[]): Gene => ({
  field: "DeploymentPct",
  scope: "Action",
  target: { scope: "Action", field: "DeploymentPct", strategyIndex },
  values: values as unknown[],
});

/** Sweep RollTriggerDte (Action scope) over a value set. */
export const geneRollTriggerDte = (values: number[], strategyIndex?: number): Gene => ({
  field: "RollTriggerDte",
  scope: "Action",
  target: { scope: "Action", field: "RollTriggerDte", ...(strategyIndex === undefined ? {} : { strategyIndex }) },
  values: values as unknown[],
});

/** Sweep TakeProfitPct (Action scope) over a value set. */
export const geneTakeProfitPct = (values: number[], strategyIndex?: number): Gene => ({
  field: "TakeProfitPct",
  scope: "Action",
  target: { scope: "Action", field: "TakeProfitPct", ...(strategyIndex === undefined ? {} : { strategyIndex }) },
  values: values as unknown[],
});

/** Sweep StopLossPct (Action scope) over a value set. */
export const geneStopLossPct = (values: number[], strategyIndex?: number): Gene => ({
  field: "StopLossPct",
  scope: "Action",
  target: { scope: "Action", field: "StopLossPct", ...(strategyIndex === undefined ? {} : { strategyIndex }) },
  values: values as unknown[],
});

/** Sweep StructureKind (Action scope) over a value set. */
export const geneStructureKind = (strategyIndex: number, values: string[]): Gene => ({
  field: "StructureKind",
  scope: "Action",
  target: { scope: "Action", field: "StructureKind", strategyIndex },
  values: values as unknown[],
});

/** Sweep AllocationPolicy (Action scope) over a value set. */
export const geneAllocationPolicy = (strategyIndex: number, values: { label: string; policy: AllocationPolicy }[]): Gene => ({
  field: "AllocationPolicy",
  scope: "Action",
  target: { scope: "Action", field: "AllocationPolicy", strategyIndex },
  values: values as unknown[],
});

/** Sweep ExposurePolicy (Action scope) over a value set. */
export const geneExposurePolicy = (strategyIndex: number, values: { label: string; policy: ExposurePolicy }[]): Gene => ({
  field: "ExposurePolicy",
  scope: "Action",
  target: { scope: "Action", field: "ExposurePolicy", strategyIndex },
  values: values as unknown[],
});

/** Sweep OptionDelta (OptionLeg scope) over a value set. */
export const geneOptionDelta = (strategyIndex: number, legIndex: number, values: number[]): Gene => ({
  field: "OptionDelta",
  scope: "OptionLeg",
  target: { scope: "OptionLeg", field: "OptionDelta", strategyIndex, legIndex },
  values: values as unknown[],
});

/** Sweep StrikeDistance (OptionLeg scope) over a value set. */
export const geneStrikeDistance = (strategyIndex: number, legIndex: number, values: { distanceType: StrikeDistanceType; distance: number }[]): Gene => ({
  field: "StrikeDistance",
  scope: "OptionLeg",
  target: { scope: "OptionLeg", field: "StrikeDistance", strategyIndex, legIndex },
  values: values as unknown[],
});

/** Sweep DteBracket (OptionLeg scope) over a value set. */
export const geneDteBracket = (strategyIndex: number, legIndex: number, values: [number, number][]): Gene => ({
  field: "DteBracket",
  scope: "OptionLeg",
  target: { scope: "OptionLeg", field: "DteBracket", strategyIndex, legIndex },
  values: values as unknown[],
});

/** Sweep MaxSpreadPct (OptionLeg scope) over a value set. */
export const geneMaxSpreadPct = (strategyIndex: number, legIndex: number, values: number[]): Gene => ({
  field: "MaxSpreadPct",
  scope: "OptionLeg",
  target: { scope: "OptionLeg", field: "MaxSpreadPct", strategyIndex, legIndex },
  values: values as unknown[],
});

/** Sweep SelectTopLimit (UniversePipeline scope) over a value set. */
export const geneSelectTopLimit = (strategyIndex: number, values: number[], sleeveName?: string): Gene => ({
  field: "SelectTopLimit",
  scope: "UniversePipeline",
  target: { scope: "UniversePipeline", field: "SelectTopLimit", strategyIndex, ...(sleeveName === undefined ? {} : { sleeveName }) },
  values: values as unknown[],
});

/** Sweep UniversePipelineFilter (UniversePipeline scope) over a value set. */
export const geneUniversePipelineFilter = (strategyIndex: number, stageIndex: number, values: { label: string; condition: Condition }[]): Gene => ({
  field: "UniversePipelineFilter",
  scope: "UniversePipeline",
  target: { scope: "UniversePipeline", field: "UniversePipelineFilter", strategyIndex, stageIndex },
  values: values as unknown[],
});

/** Sweep UniversePipelineFilter (UniversePipeline scope) by adding a Filter stage to a pipeline that has none to replace. The stage goes ahead of the first SelectTop/SelectPercentile, so it narrows the universe before ranking. */
export const geneAppendUniversePipelineFilter = (strategyIndex: number, values: { label: string; condition: Condition }[], sleeveName?: string): Gene => ({
  field: "UniversePipelineFilter",
  scope: "UniversePipeline",
  target: { scope: "UniversePipeline", field: "UniversePipelineFilter", strategyIndex, ...(sleeveName === undefined ? {} : { sleeveName }), append: true },
  values: values as unknown[],
});
