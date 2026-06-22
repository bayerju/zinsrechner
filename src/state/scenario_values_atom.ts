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

export function normalizeScenarioValues(
  values: ScenarioValues,
): ScenarioValues {
  return {
    ...values,
    sollzins: values.sollzins ?? values.effzins,
    credits: Object.fromEntries(
      Object.entries(values.credits ?? {}).flatMap(([key, credit]) => {
        const normalized = normalizeCredit(credit);
        return normalized ? [[key, normalized]] : [];
      }),
    ),
  };
}
