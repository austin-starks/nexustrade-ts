import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NewsSentiment, stockAsset } from "../src/generated/ntSdk.generated.ts";

describe("news sentiment public SDK contract", () => {
  it("sends Median with a daily trading-session lookback", () => {
    assert.deepEqual(NewsSentiment(stockAsset("NVDA"), "Median", 5), {
      type: "NewsSentiment", targetAsset: stockAsset("NVDA"), measure: "Median", lookbackDays: 5,
    });
  });
  it("defaults to Mean over the latest daily snapshot", () => {
    const indicator = NewsSentiment(stockAsset("NVDA"));
    assert.equal(indicator.measure, "Mean");
    assert.equal(indicator.lookbackDays, 1);
    assert.equal(indicator.window, undefined);
  });
});
