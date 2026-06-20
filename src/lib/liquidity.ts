import {
  calculateScenarioImplicitCosts,
  getCreditCashflowSegments,
  monthlyRateFromAnnualRate,
} from "~/lib/scenario_evaluation";
import { type ScenarioValues } from "~/state/scenario_values_atom";
import {
  type LiquidityItem,
  type LiquidityScenarioValues,
} from "~/state/liquidity_scenarios_atom";

export type LiquidityMonthResult = {
  month: string;
  income: number;
  expense: number;
  creditRate: number;
  implicitCreditCost: number;
  capitalInterest: number;
  net: number;
  capitalEnd: number;
};

export type LiquidityMonthContribution = {
  itemId: string;
  name: string;
  amount: number;
  source: "default" | "override";
};

export function monthKeyToIndex(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return 0;
  return year * 12 + (month - 1);
}

export function addMonths(monthKey: string, amount: number) {
  const parts = monthKey.split("-");
  const rawYear = Number(parts[0] ?? NaN);
  const rawMonth = Number(parts[1] ?? NaN);
  const baseYear = Number.isFinite(rawYear) ? rawYear : 2026;
  const baseMonth = (Number.isFinite(rawMonth) ? rawMonth : 1) - 1;
  const total = baseYear * 12 + baseMonth + amount;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}`;
}

export function buildMonthList(startMonth: string, horizonMonths: number) {
  return Array.from({ length: Math.max(1, horizonMonths) }, (_, index) =>
    addMonths(startMonth, index),
  );
}

export function occursInMonth(item: LiquidityItem, month: string) {
  const monthIndex = monthKeyToIndex(month);
  const startIndex = monthKeyToIndex(item.startMonth);
  if (monthIndex < startIndex) return false;

  if (item.endMonth) {
    const endIndex = monthKeyToIndex(item.endMonth);
    if (monthIndex > endIndex) return false;
  }

  const diff = monthIndex - startIndex;
  if (item.frequency === "monthly") return true;
  if (item.frequency === "quarterly") return diff % 3 === 0;
  if (item.frequency === "yearly") return diff % 12 === 0;
  return diff === 0;
}

function creditRateByMonth(
  monthIndex: number,
  segments: Array<{ startYear: number; endYear: number; rate: number }>,
) {
  return segments.reduce((sum, segment) => {
    const startMonthIndex = Math.round(segment.startYear * 12);
    const endMonthIndex = Math.round(segment.endYear * 12);
    const active = monthIndex >= startMonthIndex && monthIndex < endMonthIndex;
    return active ? sum + segment.rate : sum;
  }, 0);
}

export function simulateLiquidity(
  values: LiquidityScenarioValues,
  creditValues: ScenarioValues | null,
  options?: {
    includeRefinancing?: boolean;
    analysisHorizonYears?: number;
    opportunityRate?: number;
  },
) {
  const includeRefinancing = options?.includeRefinancing ?? false;
  const analysisHorizonYears = options?.analysisHorizonYears ?? 30;
  const opportunityRate = options?.opportunityRate ?? 0;
  const months = buildMonthList(
    values.startMonth,
    includeRefinancing
      ? Math.max(1, Math.round(analysisHorizonYears * 12))
      : values.horizonMonths,
  );
  const creditSegments = creditValues
    ? getCreditCashflowSegments(creditValues, {
        includeRefinancing,
        analysisHorizonYears: includeRefinancing
          ? analysisHorizonYears
          : months.length / 12,
        opportunityRate,
      })
    : [];
  const implicitCreditCosts = creditValues
    ? calculateScenarioImplicitCosts(creditValues)
    : 0;
  const monthlyOpportunityRate = monthlyRateFromAnnualRate(opportunityRate);
  let capital = values.startCapital;

  const rows: LiquidityMonthResult[] = months.map((month, index) => {
    const { income, expense } = values.items.reduce(
      (acc, item) => {
        const override = item.overrides[month];
        if (override?.disabled) return acc;
        if (!occursInMonth(item, month)) return acc;
        const amount = override?.amount ?? item.defaultAmount;
        if (item.type === "income") {
          return { ...acc, income: acc.income + amount };
        }
        return { ...acc, expense: acc.expense + amount };
      },
      { income: 0, expense: 0 },
    );

    const creditRate = creditRateByMonth(index, creditSegments);
    const implicitCreditCost = index === 0 ? implicitCreditCosts : 0;
    const capitalInterest = capital > 0 ? capital * monthlyOpportunityRate : 0;
    const net =
      income - expense - creditRate - implicitCreditCost + capitalInterest;
    capital += net;

    return {
      month,
      income,
      expense,
      creditRate,
      implicitCreditCost,
      capitalInterest,
      net,
      capitalEnd: capital,
    };
  });

  return rows;
}

export function getMonthContributions(
  values: LiquidityScenarioValues,
  month: string,
  type: "income" | "expense",
): LiquidityMonthContribution[] {
  return values.items
    .filter((item) => item.type === type)
    .reduce<LiquidityMonthContribution[]>((acc, item) => {
      const override = item.overrides[month];
      if (override?.disabled) return acc;
      if (!occursInMonth(item, month)) return acc;

      const isOverride = typeof override?.amount === "number";
      const amount = isOverride ? Number(override.amount) : item.defaultAmount;

      acc.push({
        itemId: item.id,
        name: item.name,
        amount,
        source: isOverride ? "override" : "default",
      });
      return acc;
    }, [])
    .sort((a, b) => b.amount - a.amount);
}
