import { defaultScenarioColor } from "~/lib/scenario_colors";

export type Scenario = {
  id: string;
  name: string;
  createdAt: number;
  color: string;
};

export const defaultScenarioId = "basis";

export const defaultScenarios: Record<string, Scenario> = {
  [defaultScenarioId]: {
    id: defaultScenarioId,
    name: "Basis",
    createdAt: 0,
    color: defaultScenarioColor,
  },
};
