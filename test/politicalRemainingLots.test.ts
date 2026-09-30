import assert from "node:assert/strict";
import test from "node:test";
import { CANDIDATE, PoliticalPurchaseShare, PoliticalTrades } from "../src/generated/ntSdk.generated.ts";

test("remaining-lot metric and explicit budget scope preserve their wire shape", () => {
  assert.equal(PoliticalPurchaseShare("X000001", "Option").purchaseScope, "AllPurchases");
  assert.equal(PoliticalPurchaseShare("X000001", "Option", "Midpoint", "RemainingLots").purchaseScope, "RemainingLots");
  const metric = PoliticalTrades(CANDIDATE, "", "RemainingBuyAmount", 1, "Midpoint", "Option", "All", "X000001");
  assert.equal(metric.metric, "RemainingBuyAmount");
  assert.equal(metric.memberId, "X000001");
});
