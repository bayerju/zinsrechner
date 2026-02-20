import { atomWithStorage } from "jotai/utils";

export type Scenario = {
  id: string;
  name: string;
  createdAt: number;
};

export const defaultScenarioId = "basis";

const defaultScenarios: Record<string, Scenario> = {
  [defaultScenarioId]: {
    id: defaultScenarioId,
    name: "Basis",
    createdAt: 0,
  },
};

export const scenariosAtom = atomWithStorage<Record<string, Scenario>>(
  "scenarios",
  defaultScenarios,
);

export const activeScenarioIdAtom = atomWithStorage<string>(
  "activeScenarioId",
  defaultScenarioId,
);
