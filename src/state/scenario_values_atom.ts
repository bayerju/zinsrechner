import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { type Credit } from "~/lib/credit";
import { activeScenarioIdAtom, defaultScenarioId } from "./scenarios_atom";

export type ScenarioValues = {
  effzins: number;
  kaufpreis: number;
  modernisierungskosten: number;
  eigenkapital: number;
  tilgungssatz: number;
  zinsbindung: number;
  credits: Record<string, Credit>;
};

export const defaultScenarioValues: ScenarioValues = {
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
    return JSON.parse(raw) as Record<string, Credit>;
  } catch {
    return {};
  }
}

const scenarioValuesStorage = {
  getItem: (key: string, initialValue: Record<string, ScenarioValues>) => {
    if (typeof localStorage === "undefined") return initialValue;

    const stored = localStorage.getItem(key);
    if (stored !== null) {
      try {
        return JSON.parse(stored) as Record<string, ScenarioValues>;
      } catch {
        return initialValue;
      }
    }

    return {
      [defaultScenarioId]: {
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
    return allValues[activeScenarioId] ?? defaultScenarioValues;
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
