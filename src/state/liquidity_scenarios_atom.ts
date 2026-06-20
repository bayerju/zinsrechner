import { defaultScenarioColor } from "~/lib/scenario_colors";
import { defaultScenarioId } from "./scenarios_atom";

export type LiquidityFrequency = "monthly" | "quarterly" | "yearly" | "once";

export type LiquidityOverride = {
  amount?: number;
  disabled?: boolean;
};

export type LiquidityItem = {
  id: string;
  name: string;
  type: "income" | "expense";
  defaultAmount: number;
  labels: string[];
  frequency: LiquidityFrequency;
  startMonth: string;
  endMonth?: string;
  overrides: Record<string, LiquidityOverride>;
};

export type LiquidityScenario = {
  id: string;
  name: string;
  createdAt: number;
  color: string;
};

export type LiquidityScenarioValues = {
  startCapital: number;
  startMonth: string;
  horizonMonths: number;
  creditScenarioId: string;
  items: LiquidityItem[];
};

export const defaultLiquidityScenarioId = "liquidity-basis";

export const defaultLiquidityScenarioValues: LiquidityScenarioValues = {
  startCapital: 0,
  startMonth: "2026-01",
  horizonMonths: 120,
  creditScenarioId: defaultScenarioId,
  items: [],
};

export const defaultLiquidityScenarios: Record<string, LiquidityScenario> = {
  [defaultLiquidityScenarioId]: {
    id: defaultLiquidityScenarioId,
    name: "Basis",
    createdAt: 0,
    color: defaultScenarioColor,
  },
};

export function normalizeLiquidityScenarioValues(
  values: LiquidityScenarioValues,
): LiquidityScenarioValues {
  return {
    ...values,
    items: values.items.map((item) => ({
      ...item,
      labels: Array.isArray(item.labels) ? item.labels : [],
    })),
  };
}
