import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { normalizeCredit, type Credit } from "~/lib/credit";
import { activeScenarioIdAtom, defaultScenarioId } from "./scenarios_atom";

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

function parseLegacyNumber(key: string, fallback: number) {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readLegacyCredits(): Record<string, Credit> {
  if (typeof localStorage === "undefined") return {};
  const raw = localStorage.getItem("credits");
  if (raw === null) return {};
  try {
    return normalizeCredits(JSON.parse(raw));
  } catch {
    return {};
  }
}

function normalizeCredits(value: unknown): Record<string, Credit> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, credit]) => {
      const normalized = normalizeCredit(credit);
      return normalized ? [[key, normalized]] : [];
    }),
  );
}

const scenarioValuesStorage = {
  getItem: (key: string, initialValue: Record<string, ScenarioValues>) => {
    if (typeof localStorage === "undefined") return initialValue;

    const stored = localStorage.getItem(key);
    if (stored !== null) {
      try {
        const parsed = JSON.parse(stored) as Record<string, ScenarioValues>;
        return Object.fromEntries(
          Object.entries(parsed).map(([scenarioId, values]) => [
            scenarioId,
            {
              ...values,
              sollzins: values.sollzins ?? values.effzins,
              credits: normalizeCredits(values.credits),
            },
          ]),
        );
      } catch {
        return initialValue;
      }
    }

    return {
      [defaultScenarioId]: {
        sollzins: parseLegacyNumber("sollzins", defaultScenarioValues.sollzins),
        effzins: parseLegacyNumber("effzins", defaultScenarioValues.effzins),
        kaufpreis: parseLegacyNumber(
          "kaufpreis",
          defaultScenarioValues.kaufpreis,
        ),
        modernisierungskosten: parseLegacyNumber(
          "modernisierungskosten",
          defaultScenarioValues.modernisierungskosten,
        ),
        eigenkapital: parseLegacyNumber(
          "eigenkapital",
          defaultScenarioValues.eigenkapital,
        ),
        tilgungssatz: parseLegacyNumber(
          "tilgungssatz",
          defaultScenarioValues.tilgungssatz,
        ),
        zinsbindung: parseLegacyNumber(
          "zinsbindung",
          defaultScenarioValues.zinsbindung,
        ),
        credits: readLegacyCredits(),
      },
    };
  },
  setItem: (key: string, value: Record<string, ScenarioValues>) => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key: string) => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  },
};

export const scenarioValuesAtom = atomWithStorage<
  Record<string, ScenarioValues>
>(
  "scenarioValues",
  {
    [defaultScenarioId]: defaultScenarioValues,
  },
  scenarioValuesStorage,
);

export const activeScenarioValuesAtom = atom(
  (get) => {
    const activeScenarioId = get(activeScenarioIdAtom);
    const allValues = get(scenarioValuesAtom);
    const values = allValues[activeScenarioId] ?? defaultScenarioValues;
    return {
      ...values,
      sollzins: values.sollzins ?? values.effzins,
    };
  },
  (
    get,
    set,
    update: ScenarioValues | ((prev: ScenarioValues) => ScenarioValues),
  ) => {
    const activeScenarioId = get(activeScenarioIdAtom);
    set(scenarioValuesAtom, (prev) => {
      const current = prev[activeScenarioId] ?? defaultScenarioValues;
      const next = typeof update === "function" ? update(current) : update;
      return {
        ...prev,
        [activeScenarioId]: next,
      };
    });
  },
);

export function createScenarioFieldAtom<Key extends keyof ScenarioValues>(
  key: Key,
) {
  return atom(
    (get) => get(activeScenarioValuesAtom)[key],
    (get, set, value: ScenarioValues[Key]) => {
      set(activeScenarioValuesAtom, (prev) => ({
        ...prev,
        [key]: value,
      }));
    },
  );
}
