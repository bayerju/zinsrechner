import {
  calculateMonthlyRate,
  calculateNettodarlehensbetragBank,
} from "~/lib/calculations";
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
  net: number;
  capitalEnd: number;
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

function getCreditMonthlySegments(values: ScenarioValues) {
  const credits = Object.values(values.credits ?? {});
  const nettodarlehensbetrag = calculateNettodarlehensbetragBank({
    kaufpreis: values.kaufpreis,
    modernisierungskosten: values.modernisierungskosten,
    kaufnebenkosten: values.kaufpreis * 0.1207,
    eigenkapital: values.eigenkapital,
    credits,
  });

  const bankRate = calculateMonthlyRate({
    darlehensbetrag: nettodarlehensbetrag,
    effzins: values.effzins,
    tilgungssatz: values.tilgungssatz,
  });

  const result: Array<{ startYear: number; endYear: number; rate: number }> = [
    { startYear: 0, endYear: values.zinsbindung, rate: bankRate },
  ];

  credits.forEach((credit) => {
    credit.rates.forEach((rate) => {
      result.push({
        startYear: rate.startYear,
        endYear: Math.min(rate.endYear, credit.zinsbindung),
        rate: rate.rate,
      });
    });
  });

  return result;
}

function creditRateByMonth(
  monthIndex: number,
  segments: Array<{ startYear: number; endYear: number; rate: number }>,
) {
  const year = monthIndex / 12 + 1;
  return segments.reduce((sum, segment) => {
    const active = segment.startYear < year && segment.endYear >= year;
    return active ? sum + segment.rate : sum;
  }, 0);
}

export function simulateLiquidity(
  values: LiquidityScenarioValues,
  creditValues: ScenarioValues | null,
) {
  const months = buildMonthList(values.startMonth, values.horizonMonths);
  const creditSegments = creditValues
    ? getCreditMonthlySegments(creditValues)
    : [];
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
    const net = income - expense - creditRate;
    capital += net;

    return {
      month,
      income,
      expense,
      creditRate,
      net,
      capitalEnd: capital,
    };
  });

  return rows;
}
