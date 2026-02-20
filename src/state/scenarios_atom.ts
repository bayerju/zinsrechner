import { atomWithStorage } from "jotai/utils";
import {
  defaultScenarioColor,
  getNextScenarioColor,
} from "~/lib/scenario_colors";

export type Scenario = {
  id: string;
  name: string;
  createdAt: number;
  color: string;
};

export const defaultScenarioId = "basis";

const defaultScenarios: Record<string, Scenario> = {
  [defaultScenarioId]: {
    id: defaultScenarioId,
    name: "Basis",
    createdAt: 0,
    color: defaultScenarioColor,
  },
};

const scenariosStorage = {
  getItem: (key: string, initialValue: Record<string, Scenario>) => {
    if (typeof localStorage === "undefined") return initialValue;
    const raw = localStorage.getItem(key);
    if (raw === null) return initialValue;

    try {
      const parsed = JSON.parse(raw) as Record<
        string,
        Partial<Scenario> & { id?: string; name?: string; createdAt?: number }
      >;

      const sortedEntries = Object.entries(parsed).sort((a, b) => {
        const aCreated = a[1]?.createdAt ?? 0;
        const bCreated = b[1]?.createdAt ?? 0;
        return aCreated - bCreated;
      });

      const result: Record<string, Scenario> = {};
      for (const [id, scenario] of sortedEntries) {
        if (!id) continue;
        const color =
          typeof scenario.color === "string" && scenario.color.trim().length > 0
            ? scenario.color
            : getNextScenarioColor(Object.values(result).map((s) => s.color));

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

      if (Object.keys(result).length === 0) return initialValue;
      return result;
    } catch {
      return initialValue;
    }
  },
  setItem: (key: string, value: Record<string, Scenario>) => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key: string) => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  },
};

export const scenariosAtom = atomWithStorage<Record<string, Scenario>>(
  "scenarios",
  defaultScenarios,
  scenariosStorage,
);

export const activeScenarioIdAtom = atomWithStorage<string>(
  "activeScenarioId",
  defaultScenarioId,
);
