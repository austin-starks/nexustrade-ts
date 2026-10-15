import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NewsSentiment, stockAsset } from "../src/generated/ntSdk.generated.ts";

describe("news sentiment public SDK contract", () => {
  it("sends Median through the native canonical window shape", () => {
    assert.deepEqual(NewsSentiment(stockAsset("NVDA"), "Median", 5, "Day"), {
      type: "NewsSentiment", targetAsset: stockAsset("NVDA"), measure: "Median", window: { length: 5, interval: "Day" },
    });
  });
  it("defaults to Mean over the latest daily snapshot", () => {
    const indicator = NewsSentiment(stockAsset("NVDA"));
    assert.equal(indicator.measure, "Mean");
    assert.deepEqual(indicator.window, { length: 1, interval: "Day" });
    assert.equal(indicator.lookbackDays, undefined);
  });
});
