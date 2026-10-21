import assert from "node:assert/strict";
import { it } from "node:test";
import { always, buy, stockAsset, strategy } from "../src/generated/ntSdk.generated.ts";

it("preserves an explicit pending-order policy and omits the default", () => {
  for (const pendingOrderPolicy of ["Wait", "CancelConflictingBuys"] as const) {
    const value = strategy("Exit priority", always(), buy(stockAsset("SPY"), 100), { pendingOrderPolicy });
    assert.equal(value.pendingOrderPolicy, pendingOrderPolicy);
  }
  assert.ok(!("pendingOrderPolicy" in strategy("Default", always(), buy(stockAsset("SPY"), 100))));
});
