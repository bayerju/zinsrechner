import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  defaultScenarioColor,
  getNextScenarioColor,
} from "~/lib/scenario_colors";
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

const defaultLiquidityScenarios: Record<string, LiquidityScenario> = {
  [defaultLiquidityScenarioId]: {
    id: defaultLiquidityScenarioId,
    name: "Basis",
    createdAt: 0,
    color: defaultScenarioColor,
  },
};

const liquidityScenariosStorage = {
  getItem: (key: string, initialValue: Record<string, LiquidityScenario>) => {
    if (typeof localStorage === "undefined") return initialValue;
    const raw = localStorage.getItem(key);
    if (raw === null) return initialValue;

    try {
      const parsed = JSON.parse(raw) as Record<
        string,
        Partial<LiquidityScenario>
      >;
      const sortedEntries = Object.entries(parsed).sort((a, b) => {
        const aCreated = a[1]?.createdAt ?? 0;
        const bCreated = b[1]?.createdAt ?? 0;
        return aCreated - bCreated;
      });

      const result: Record<string, LiquidityScenario> = {};
      for (const [id, scenario] of sortedEntries) {
        if (!id) continue;
        const color =
          typeof scenario.color === "string" && scenario.color.trim().length > 0
            ? scenario.color
            : getNextScenarioColor(
                Object.values(result).map((item) => item.color),
              );
        result[id] = {
          id,
          name:
            typeof scenario.name === "string" && scenario.name.trim().length > 0
              ? scenario.name
              : "Szenario",
          createdAt:
            typeof scenario.createdAt === "number" ? scenario.createdAt : 0,
          color,
        };
      }
      return Object.keys(result).length > 0 ? result : initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem: (key: string, value: Record<string, LiquidityScenario>) => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key: string) => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  },
};

export const liquidityScenariosAtom = atomWithStorage<
  Record<string, LiquidityScenario>
>("liquidityScenarios", defaultLiquidityScenarios, liquidityScenariosStorage);

export const activeLiquidityScenarioIdAtom = atomWithStorage<string>(
  "activeLiquidityScenarioId",
  defaultLiquidityScenarioId,
);

export const liquidityScenarioValuesAtom = atomWithStorage<
  Record<string, LiquidityScenarioValues>
>("liquidityScenarioValues", {
  [defaultLiquidityScenarioId]: defaultLiquidityScenarioValues,
});

function normalizeScenarioValues(
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

export const activeLiquidityScenarioValuesAtom = atom(
  (get) => {
    const id = get(activeLiquidityScenarioIdAtom);
    const values = get(liquidityScenarioValuesAtom);
    const selected = values[id] ?? defaultLiquidityScenarioValues;
    return normalizeScenarioValues(selected);
  },
  (
    get,
    set,
    update:
      | LiquidityScenarioValues
      | ((prev: LiquidityScenarioValues) => LiquidityScenarioValues),
  ) => {
    const id = get(activeLiquidityScenarioIdAtom);
    set(liquidityScenarioValuesAtom, (prev) => {
      const current = normalizeScenarioValues(
        prev[id] ?? defaultLiquidityScenarioValues,
      );
      const next = typeof update === "function" ? update(current) : update;
      return {
        ...prev,
        [id]: normalizeScenarioValues(next),
      };
    });
  },
);
