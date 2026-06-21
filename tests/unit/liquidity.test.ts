import { describe, expect, test } from "vitest";
import {
  addMonths,
  buildMonthList,
  getMonthContributions,
  monthKeyToIndex,
  occursInMonth,
  simulateLiquidity,
} from "../../src/lib/liquidity";
import type { ScenarioValues } from "../../src/state/scenario_values_atom";
import type {
  LiquidityItem,
  LiquidityScenarioValues,
} from "../../src/state/liquidity_scenarios_atom";

function item(overrides: Partial<LiquidityItem>): LiquidityItem {
  return {
    id: "item",
    name: "Item",
    type: "income",
    defaultAmount: 100,
    labels: [],
    frequency: "monthly",
    startMonth: "2026-01",
    overrides: {},
    ...overrides,
  };
}

describe("liquidity helpers", () => {
  test("builds month keys across year boundaries", () => {
    expect(monthKeyToIndex("2026-01")).toBe(24_312);
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(buildMonthList("2026-11", 4)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  test("checks monthly, quarterly, yearly and one-time occurrences", () => {
    expect(occursInMonth(item({ frequency: "monthly" }), "2026-04")).toBe(
      true,
    );
    expect(occursInMonth(item({ frequency: "quarterly" }), "2026-04")).toBe(
      true,
    );
    expect(occursInMonth(item({ frequency: "quarterly" }), "2026-05")).toBe(
      false,
    );
    expect(occursInMonth(item({ frequency: "yearly" }), "2027-01")).toBe(true);
    expect(occursInMonth(item({ frequency: "once" }), "2026-02")).toBe(false);
    expect(
      occursInMonth(item({ frequency: "monthly", endMonth: "2026-02" }), "2026-03"),
    ).toBe(false);
  });

  test("simulates liquidity with recurring items and overrides", () => {
    const values: LiquidityScenarioValues = {
      startCapital: 1_000,
      startMonth: "2026-01",
      horizonMonths: 3,
      creditScenarioId: "basis",
      items: [
        item({ id: "salary", name: "Gehalt", defaultAmount: 3_000 }),
        item({
          id: "rent",
          name: "Miete",
          type: "expense",
          defaultAmount: 1_000,
          overrides: { "2026-02": { amount: 1_200 }, "2026-03": { disabled: true } },
        }),
      ],
    };

    expect(simulateLiquidity(values, null)).toEqual([
      {
        month: "2026-01",
        income: 3_000,
        expense: 1_000,
        creditRate: 0,
        net: 2_000,
        capitalEnd: 3_000,
      },
      {
        month: "2026-02",
        income: 3_000,
        expense: 1_200,
        creditRate: 0,
        net: 1_800,
        capitalEnd: 4_800,
      },
      {
        month: "2026-03",
        income: 3_000,
        expense: 0,
        creditRate: 0,
        net: 3_000,
        capitalEnd: 7_800,
      },
    ]);
  });

  test("includes credit rates in liquidity simulation", () => {
    const liquidityValues: LiquidityScenarioValues = {
      startCapital: 0,
      startMonth: "2026-01",
      horizonMonths: 1,
      creditScenarioId: "basis",
      items: [item({ id: "income", defaultAmount: 2_000 })],
    };
    const creditValues: ScenarioValues = {
      kaufpreis: 100_000,
      modernisierungskosten: 0,
      eigenkapital: 0,
      sollzins: 3,
      effzins: 3,
      tilgungssatz: 2,
      zinsbindung: 10,
      credits: {},
    };

    const [row] = simulateLiquidity(liquidityValues, creditValues);

    expect(row?.creditRate).toBeCloseTo(466.96, 2);
    expect(row?.net).toBeCloseTo(1_533.04, 2);
  });

  test("returns sorted month contributions with source", () => {
    const values: LiquidityScenarioValues = {
      startCapital: 0,
      startMonth: "2026-01",
      horizonMonths: 1,
      creditScenarioId: "basis",
      items: [
        item({ id: "small", name: "Small", defaultAmount: 100 }),
        item({
          id: "large",
          name: "Large",
          defaultAmount: 200,
          overrides: { "2026-01": { amount: 500 } },
        }),
      ],
    };

    expect(getMonthContributions(values, "2026-01", "income")).toEqual([
      { itemId: "large", name: "Large", amount: 500, source: "override" },
      { itemId: "small", name: "Small", amount: 100, source: "default" },
    ]);
  });
});
