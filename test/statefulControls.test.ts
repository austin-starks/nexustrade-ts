import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as sdk from "../src/generated/ntSdk.generated.ts";
it("authors Minimum conditional capture through the generated builder", () => {
  const indicator = sdk.IndicatorAtCondition(
    sdk.Value(-7),
    sdk.always(),
    "Minimum",
    "Calendar",
    0
  );
  assert.equal(JSON.parse(JSON.stringify(indicator)).selection, "Minimum");
});
it("authors the exact second-crossing indicator exercised by the Rust golden", () => {
  const crossing = () =>
    sdk.gt(
      sdk.CrossAbove(sdk.Price(sdk.stockAsset("IWM")), sdk.Value(100)),
      sdk.Value(0)
    );
  const indicator = sdk.IndicatorAtCondition(
    sdk.Price(sdk.stockAsset("QQQ")),
    sdk.andThen(60, "Minute", crossing(), crossing()),
    "First",
    "Calendar",
    0
  );
  const golden = JSON.parse(
    readFileSync(
      new URL(
        "../../../app/src/model/indicators/testdata/conditional_capture.golden.json",
        import.meta.url
      ),
      "utf8"
    )
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(indicator)),
    golden.secondCrossing.indicator
  );
});
it("authors protection as an indicator and funding as a Buy action", () => {
  assert.equal(typeof sdk.IndicatorAtCondition, "function");
  const protection = sdk.IndicatorAtCondition(
    sdk.Value(10),
    sdk.always(),
    "Maximum",
    "Calendar",
    0
  );
  const eligible = sdk.lt(
    sdk.PositionPercentChange(sdk.CANDIDATE),
    sdk.Value(-1)
  );
  const purchase = sdk.buy(sdk.stockAsset("QQQ"), 2500, "dollars", {
    executionPriority: 4,
    funding: {
      condition: eligible,
      rankBy: sdk.PositionPercentChange(sdk.CANDIDATE),
      direction: "Lowest",
      amount: { type: "percent of current positions", amount: 100 },
    },
  });
  const book = sdk.portfolio(
    "Composed",
    [
      sdk.strategy("New entry", sdk.lt(protection, sdk.Value(1)), purchase),
      sdk.strategy(
        "Protect weak holdings",
        sdk.gt(protection, sdk.Value(0)),
        sdk.sellHoldings(eligible, 100, "percent of current positions", {
          executionPriority: 0,
        })
      ),
    ],
    {
      initialValue: 60000,
      supportsFractionalShares: false,
      cashSettlement: "T1",
    }
  );
  const saved = JSON.parse(JSON.stringify(book));
  assert.equal(saved.strategies[0].condition.lhs.type, "IndicatorAtCondition");
  assert.equal(saved.strategies[0].action.funding.direction, "Lowest");
  assert.equal(saved.strategies[1].action.executionPriority, 0);
  for (const field of [
    "gainProtection",
    "gainProtectionState",
    "cashFunding",
    "cashFundingState",
  ])
    assert.equal(field in saved, false);
});
