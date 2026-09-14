/**
 * Realized option premium: the generated surface the TypeScript SDK must expose.
 *
 * DEPENDS ON REGENERATION. Every assertion reads builders and types that
 * `make generate-nt-sdk` emits from the server's OptionRealizedPnL and
 * OptionRealizedPremium factories. Until those land and the SDK is regenerated,
 * `npm run typecheck` fails on this file and `node --test` cannot link its
 * imports. That failure is the alarm, as in builderInput.test.ts. The Python
 * twin is sdk/python/tests/test_realized_premium.py.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OptionRealizedPnL,
  OptionRealizedPremium,
  OptionUnrealizedPnL,
  leg,
  openOption,
  optionsBuilder,
  type OptionAllocation,
  type OptionDirection,
  type OptionSpreadType,
  type OptionType,
} from "../src/generated/ntSdk.generated.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

// The balance is filtered by underlying only: a balance narrowed to puts would
// drop the call debits it funds and overstate what is spendable.
const premiumTakesUnderlyingAndLookback: Equal<
  Parameters<typeof OptionRealizedPremium>,
  [underlying: string, lookbackDays?: number]
> = true;

const pnlTakesTheFullFilterAndLookback: Equal<
  Parameters<typeof OptionRealizedPnL>,
  [
    underlying: string,
    optionType: OptionType,
    direction: OptionDirection,
    spreadType: OptionSpreadType,
    lookbackDays?: number,
  ]
> = true;

describe("realized option premium builders", () => {
  it("expose the contract's parameters", () => {
    assert.equal(premiumTakesUnderlyingAndLookback, true);
    assert.equal(pnlTakesTheFullFilterAndLookback, true);
  });

  it("OptionRealizedPremium leaves lookbackDays off the wire when omitted", () => {
    // Omitted means the whole life of the book, which is not the same as 0.
    assert.deepEqual(OptionRealizedPremium("IBIT"), {
      type: "OptionRealizedPremium",
      underlying: "IBIT",
    });
  });

  it("OptionRealizedPremium sends lookbackDays when given", () => {
    assert.deepEqual(OptionRealizedPremium("IBIT", 30), {
      type: "OptionRealizedPremium",
      underlying: "IBIT",
      lookbackDays: 30,
    });
  });

  it("OptionRealizedPnL carries the OptionUnrealizedPnL filter plus lookbackDays", () => {
    const filter = ["IBIT", "put", "short", "custom"] as const;
    assert.deepEqual(OptionRealizedPnL(...filter), {
      ...OptionUnrealizedPnL(...filter),
      type: "OptionRealizedPnL",
    });
    assert.deepEqual(OptionRealizedPnL(...filter, 30), {
      ...OptionUnrealizedPnL(...filter),
      type: "OptionRealizedPnL",
      lookbackDays: 30,
    });
  });
});

describe("percent of realized premium allocation", () => {
  it("is an OptionAllocationType an OpenOption carries to the wire", () => {
    const allocation: OptionAllocation = {
      type: "percent of realized premium",
      amount: 50,
    };
    const action = openOption({
      builder: optionsBuilder({
        underlyingSymbol: "IBIT",
        spreadType: "custom",
        legs: [
          leg({
            optionType: "call",
            direction: "long",
            minDaysToExpiration: 30,
            maxDaysToExpiration: 60,
            distance: 5,
            preference: "middle",
          }),
        ],
      }),
      allocation,
    });
    assert.deepEqual(action.allocation, allocation);
  });
});
