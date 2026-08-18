import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RebalanceEstimatedCost,
  RebalanceExpectedBenefit,
  Value,
  dynamicRebalance,
  geneAllocationPolicy,
  geneExposurePolicy,
  meanVarianceAllocation,
  maximumDiversificationAllocation,
  rebalanceOption,
  riskParityAllocation,
  universe,
  volatilityTarget,
} from "../src/generated/ntSdk.generated.ts";

describe("adaptive allocation authoring", () => {
  it("shares one policy shape across equity and options actions", () => {
    const policy = meanVarianceAllocation({
      lookbackPeriods: 126,
      minimumObservations: 40,
      riskAversion: 6,
    });
    const equity = dynamicRebalance({
      universe: universe("SP500"),
      pipeline: [],
      weightIndicator: Value(1),
      allocationPolicy: policy,
    });
    const options = rebalanceOption({
      universe: universe("SP500"),
      pipeline: [],
      weightIndicator: Value(1),
      structureTemplates: [],
      allocationPolicy: policy,
    });

    assert.deepEqual(equity.allocationPolicy, policy);
    assert.deepEqual(options.allocationPolicy, policy);
    assert.deepEqual(RebalanceExpectedBenefit(), {
      type: "RebalanceDecisionMetric",
      metric: "expectedBenefit",
    });
    assert.deepEqual(RebalanceEstimatedCost(), {
      type: "RebalanceDecisionMetric",
      metric: "estimatedCost",
    });
  });

  it("authors every allocator and composes volatility targeting", () => {
    const exposure = volatilityTarget({
      targetAnnualizedVolatilityPercent: 10,
    });
    const policies = [
      meanVarianceAllocation(),
      riskParityAllocation(),
      maximumDiversificationAllocation(),
    ];
    for (const allocationPolicy of policies) {
      const action = dynamicRebalance({
        universe: universe("SP500"),
        pipeline: [],
        weightIndicator: Value(1),
        allocationPolicy,
        exposurePolicy: exposure,
      });
      assert.equal(action.allocationPolicy?.type, allocationPolicy.type);
      assert.deepEqual(action.exposurePolicy, exposure);
    }
  });

  it("authors optimizer genes from complete policy configurations", () => {
    const allocationGene = geneAllocationPolicy(0, [
      { label: "Risk parity", policy: riskParityAllocation() },
      {
        label: "Maximum diversification",
        policy: maximumDiversificationAllocation(),
      },
    ]);
    const exposureGene = geneExposurePolicy(0, [
      { label: "12% volatility", policy: volatilityTarget() },
    ]);

    assert.equal(allocationGene.field, "AllocationPolicy");
    assert.equal(exposureGene.field, "ExposurePolicy");
    assert.equal(allocationGene.values.length, 2);
    assert.equal(exposureGene.values.length, 1);
  });
});
