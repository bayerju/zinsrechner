import { normalizeCredit, type Credit } from "~/lib/credit";

export type ScenarioValues = {
  sollzins: number;
  effzins: number;
  kaufpreis: number;
  modernisierungskosten: number;
  eigenkapital: number;
  tilgungssatz: number;
  zinsbindung: number;
  credits: Record<string, Credit>;
};

export const defaultScenarioValues: ScenarioValues = {
  sollzins: 3.7,
  effzins: 3.7,
  kaufpreis: 330_000,
  modernisierungskosten: 100_000,
  eigenkapital: 100_000,
  tilgungssatz: 2,
  zinsbindung: 10,
  credits: {},
};

const ASCII_KEY_PATTERN = /^[ -~]+$/;

function createCreditId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `credit-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export function normalizeScenarioValues(
  values: ScenarioValues,
): ScenarioValues {
  return {
    ...values,
    sollzins: values.sollzins ?? values.effzins,
    credits: Object.fromEntries(
      Object.entries(values.credits ?? {}).flatMap(([key, credit]) => {
        const normalized = normalizeCredit(credit);
        if (!normalized) return [];
        const safeKey = ASCII_KEY_PATTERN.test(key) ? key : createCreditId();
        return [[safeKey, normalized]];
      }),
    ),
  };
}
