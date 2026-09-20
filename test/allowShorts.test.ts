import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  Value,
  dynamicRebalance,
  universe,
} from "../src/generated/ntSdk.generated.ts";

describe("dynamicRebalance allowShorts (backtest-only)", () => {
  it("passes allowShorts: true into the action payload", () => {
    const action = dynamicRebalance({
      universe: universe("SP500"),
      pipeline: [],
      weightIndicator: Value(1),
      allowShorts: true,
    });

    assert.equal(action.allowShorts, true);
  });

  it("compacts an absent allowShorts (legacy long-only payloads unchanged)", () => {
    const action = dynamicRebalance({
      universe: universe("SP500"),
      pipeline: [],
      weightIndicator: Value(1),
    });

    assert.ok(!("allowShorts" in action));
  });
});
