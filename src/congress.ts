/**
 * Congressional (STOCK Act) disclosure types for the public REST API at
 * `/api/political-disclosures`.
 *
 * `availableAt` is when a disclosure became public. It is the only date a
 * strategy may act on: `transactionDate` is when the member traded, typically
 * weeks before anyone outside Congress could know. Date filters and `sort` use
 * `firstAvailableAt`, when the first version of a disclosure became public.
 */

export type CongressChamber = "house" | "senate";
export type CongressAction = "purchase" | "sale" | "exchange" | "unmarked";
export type CongressInstrument = "equity" | "option" | "fund" | "bond" | "other";
export type CongressOwner =
  | "self"
  | "spouse"
  | "dependent_child"
  | "joint"
  | "not_indicated";
export type CongressParty = "Democrat" | "Republican" | "Independent" | "Other";
export type CongressParseMethod = "text" | "scan" | "html" | "paper";
export type CongressSort = "newest" | "oldest";

/**
 * Filters shared by the trade feed and its aggregates.
 *
 * `toDate` defaults to the day of `asOf`, which defaults to the dataset's last
 * update. With no `fromDate` the window is the 30 days ending at `toDate`.
 * `instrument` defaults to `"equity"`; pass `"all"` to include options, funds
 * and bonds.
 */
export interface CongressionalTradeFilters {
  /** Free-text search. A phrase naming exactly one member resolves to that member. */
  q?: string;
  /** Bioguide ID, for example `"P000197"`. */
  filerKey?: string;
  ticker?: string;
  chamber?: CongressChamber | "all";
  action?: CongressAction | "all";
  instrument?: CongressInstrument | "all";
  /** `YYYY-MM-DD`, compared against the day of `firstAvailableAt`. Sent as `from`. */
  fromDate?: string;
  /** `YYYY-MM-DD`, compared against the day of `firstAvailableAt`. Sent as `to`. */
  toDate?: string;
  /** ISO timestamp. Reads the record as it was publicly known at that instant. */
  asOf?: string;
}

/** The trade feed: the shared filters plus ordering and paging. */
export interface ListCongressionalTradesOptions
  extends CongressionalTradeFilters {
  /** Orders by `firstAvailableAt`. Default `"newest"`. */
  sort?: CongressSort;
  /** `nextCursor` from the previous page, sent with the same filters. */
  cursor?: string;
  /** 1 to 100. Default 25. */
  limit?: number;
}

/** The per-member lists (filers, filing latency, volume). Each has a fixed order. */
export interface CongressionalFilerListOptions
  extends CongressionalTradeFilters {
  /** 1 to 100. Default 25. */
  limit?: number;
}

/**
 * One member's record, for `getPolitician` and `getCongressionalFiler`.
 *
 * With neither date the record runs from 2012-01-01 to today. With only one,
 * the other takes the feed default. `instrument` defaults to `"all"`.
 */
export interface CongressionalMemberRecordOptions {
  ticker?: string;
  action?: CongressAction | "all";
  instrument?: CongressInstrument | "all";
  /** Orders the trades by `firstAvailableAt`. Default `"newest"`. */
  sort?: CongressSort;
  /** `YYYY-MM-DD`, compared against the day of `firstAvailableAt`. Sent as `from`. */
  fromDate?: string;
  /** `YYYY-MM-DD`, compared against the day of `firstAvailableAt`. Sent as `to`. */
  toDate?: string;
  /** ISO timestamp. Reads the record as it was publicly known at that instant. */
  asOf?: string;
  /** `recentTradesNextCursor` from the previous page, sent with the same filters. */
  cursor?: string;
  /** Trades per page, 1 to 100. Default 25. */
  limit?: number;
}

/** The filters the server applied, defaults included. */
export interface CongressionalAppliedFilters {
  q: string | null;
  filerKey: string | null;
  ticker: string | null;
  chamber: CongressChamber | "all";
  action: CongressAction | "all";
  instrument: CongressInstrument | "all";
  sort: CongressSort;
  from: string;
  to: string;
  asOf: string;
  cursor: string | null;
  limit: number;
}

export interface CongressionalCoverage {
  filings: number;
  events: number;
  failedFilings: number;
  latestAvailableAt: string | null;
  latestProcessedAt: string | null;
  byChamber: Record<
    CongressChamber,
    { filings: number | null; latestFilingDate: string | null }
  >;
}

/** Every disclosure read except the leaderboard and the copy bot. */
export interface CongressionalEnvelope<T> {
  data: T;
  snapshotId: string;
  asOf: string;
  dataUpdatedAt: string;
  stale: boolean;
  cache: "hit" | "miss" | "stale";
  coverage: CongressionalCoverage | null;
  filters: CongressionalAppliedFilters | null;
}

export interface CongressionalTrade {
  /** `<chamber>:<docId>:<rowIndex>`, for example `"house:20035831:0"`. */
  eventId: string;
  version: number;
  filerKey: string;
  filerName: string;
  chamber: CongressChamber;
  owner: CongressOwner;
  action: CongressAction;
  partialSale: boolean;
  instrument: CongressInstrument;
  /** When the member traded. Not public knowledge on this date. */
  transactionDate: string | null;
  filingDate: string;
  /** When the first version became public. `from`, `to` and `sort` use this. */
  firstAvailableAt: string;
  /** When this version became public. The date to trade from. */
  availableAt: string;
  supersededAt: string | null;
  ticker: string | null;
  assetDescription: string;
  assetTypeCode: string | null;
  assetTypeLabel: string | null;
  /** Disclosures report a bracket, never an amount. */
  amountBracket: string | null;
  amountLow: number | null;
  amountHigh: number | null;
  tickerResolutionStatus: string | null;
  sourceDocId: string;
  sourceRowIndex: number;
  sourceUrl: string;
  /** `"scan"` and `"paper"` rows were read from an image. */
  sourceParseMethod: CongressParseMethod | null;
}

export interface CongressMemberBadge {
  party: CongressParty | null;
  state: string | null;
  slug: string;
}

export interface CongressionalTradePage {
  trades: CongressionalTrade[];
  /** Pass as `cursor` with the same filters; null on the last page. */
  nextCursor: string | null;
  /** `filerKey` to badge, for the members on this page. */
  members?: Record<string, CongressMemberBadge>;
}

export interface CongressionalVolumeRank {
  ticker: string;
  events: number;
  amountLow: number | null;
  amountHigh: number | null;
}

export interface CongressionalTradeSummary {
  purchaseEvents: number;
  saleEvents: number;
  otherEvents: number;
  activeFilers: number;
  disclosedEvents: number;
  purchaseAmountLow: number | null;
  purchaseAmountHigh: number | null;
  purchaseMissingLow: number;
  purchaseMissingHigh: number;
  saleAmountLow: number | null;
  saleAmountHigh: number | null;
  saleMissingLow: number;
  saleMissingHigh: number;
  netAmountLow: number | null;
  netAmountHigh: number | null;
  unresolvedTickerEvents: number;
  mostPurchased: Array<{ ticker: string; events: number }>;
  mostPurchasedByVolume?: CongressionalVolumeRank[];
}

export interface CongressionalFiler {
  filerKey: string;
  displayName: string;
  chamber: CongressChamber;
  disclosureEvents: number;
  purchaseEvents: number;
  saleEvents: number;
  latestDisclosureAt: string | null;
  identityStatus: "member";
}

export interface CongressionalFilerYearActivity {
  year: number;
  purchases: number;
  sales: number;
  purchaseMidpoint: number | null;
  saleMidpoint: number | null;
}

export interface CongressionalFilerActivity {
  byYear: CongressionalFilerYearActivity[];
  firstPublicAt: string | null;
  lastPublicAt: string | null;
  filings: number;
  /** Filings carrying a trade made public more than 45 days after it. */
  lateFilings: number;
}

export interface CongressionalFilerDetail {
  filer: CongressionalFiler;
  summary: CongressionalTradeSummary;
  recentTrades: CongressionalTrade[];
  recentTradesNextCursor: string | null;
  activity: CongressionalFilerActivity;
}

/** How long one member's disclosures take to become public. */
export interface CongressionalFilingLatency {
  filerKey: string;
  displayName: string;
  transactions: number;
  filings: number;
  medianDaysToPublic: number | null;
  p95DaysToPublic: number | null;
  transactionsOverFortyFiveDays: number;
  filingsOverFortyFiveDays: number;
}

/** One member's disclosed dollars, as sums of bracket bounds. */
export interface CongressionalFilerVolume {
  filerKey: string;
  displayName: string;
  transactions: number;
  purchaseTransactions: number;
  saleTransactions: number;
  filings: number;
  volumeLow: number;
  /** Null when any bracket is open-ended. */
  volumeHigh: number | null;
  volumeMidpoint: number;
  openEndedTransactions: number;
  party?: CongressParty | null;
  state?: string | null;
  slug?: string | null;
}

export interface CongressCommitteeAssignment {
  id: string;
  name: string;
  title: string | null;
}

export interface Politician {
  /** Bioguide ID. */
  memberId: string;
  slug: string;
  displayName: string;
  party: CongressParty | null;
  committees: CongressCommitteeAssignment[];
  imageUrl: string | null;
  chamber: CongressChamber | null;
  state: string | null;
  district: number | null;
  firstTookOffice: string | null;
  lastServedEnd: string | null;
}

export interface PoliticianProfile {
  politician: Politician;
  profile: CongressionalFilerDetail;
}

export interface PoliticianBotStatistics {
  totalReturn: number;
  cagr: number | null;
  fiveYearEquivalent: number | null;
  spyTotalReturn: number | null;
  spyCagr: number | null;
  spyFiveYearEquivalent: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
  closedTrades: number | null;
  fees: number | null;
  medianDeployment: number | null;
  distinctNames: number | null;
}

export interface PoliticianBotCurvePoint {
  date: string;
  value: number;
  performanceValue?: number;
  spy: number | null;
}

/** A member's copy bot: a cached engine backtest of following their disclosures. */
export interface PoliticianBot {
  status: "ready" | "stale" | "computing" | "ineligible";
  memberId: string;
  displayName: string | null;
  purchaseCount: number | null;
  minPurchases: number;
  profileId: string | null;
  /** Pass to `forkPublicPortfolio` to copy the bot into your workspace. */
  sharedPortfolioId: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  refreshedAt: string | null;
  refreshRequestedAt: string | null;
  refreshPending: boolean;
  initialValue: number;
  statistics: PoliticianBotStatistics | null;
  curve: PoliticianBotCurvePoint[];
  mixed: boolean;
}

export interface CongressionalLeaderboardRow {
  memberId: string;
  displayName: string;
  slug: string | null;
  party: CongressParty | null;
  chamber: CongressChamber | null;
  state: string | null;
  windowStart: string;
  windowEnd: string;
  mixed: boolean;
  totalReturn: number;
  spyTotalReturn: number;
  /** `totalReturn` minus `spyTotalReturn`. */
  excessReturn: number;
  /** `(1 + cagr)^5 - 1`, the ranking basis. */
  fiveYearEquivalent: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  purchaseCount: number;
  imageUrl: string | null;
  lastServedEnd: string | null;
  spark: { bot: number[]; spy: Array<number | null> } | null;
}

export interface CongressionalLeaderboard {
  /** Members whose copy bot beat SPY, best first. */
  best: CongressionalLeaderboardRow[];
  featured: {
    memberId: string;
    initialValue: number;
    windowEnd: string;
    curve: PoliticianBotCurvePoint[];
  } | null;
  /** Members whose copy bot trailed SPY, worst first. */
  worst: CongressionalLeaderboardRow[];
  byParty: Array<{
    party: CongressParty | "Unknown";
    members: number;
    meanExcessReturn: number;
  }>;
  basis: {
    rankedMembers: number;
    beatSpy: number;
    meanExcessReturn: number | null;
    minPurchases: number;
    minWindowDays: number;
    benchmark: "SPY";
    /** Starting capital of every ranked book. */
    initialValue: number;
    refreshedAt: string | null;
    minPartyMembers: number;
  };
}

export interface CongressionalTradeDetail {
  current: CongressionalTrade;
  /** Every version of the disclosure public as of the read, amendments included. */
  history: CongressionalTrade[];
}

export interface CongressionalFiling {
  chamber: CongressChamber;
  docId: string;
  filerKey: string | null;
  filerName: string;
  stateDistrict: string | null;
  filingDate: string;
  availableAt: string;
  sourceUrl: string;
  extractionStatus: "ok" | "failed" | "unsupported";
  extractedRows: number;
  amendedReportDate: string | null;
  reportDate: string | null;
  trades: CongressionalTrade[];
}

/** Query pairs in one fixed order, so both SDKs put the same bytes on the wire. */
export function congressionalQueryParams(
  options: ListCongressionalTradesOptions
): Record<string, string | undefined> {
  return {
    q: options.q,
    filerKey: options.filerKey,
    ticker: options.ticker,
    chamber: options.chamber,
    action: options.action,
    instrument: options.instrument,
    sort: options.sort,
    from: options.fromDate,
    to: options.toDate,
    asOf: options.asOf,
    cursor: options.cursor,
    limit: options.limit === undefined ? undefined : String(options.limit),
  };
}
