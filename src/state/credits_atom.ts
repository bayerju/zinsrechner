import { atom } from "jotai";
import { creditSchema, type Credit } from "~/lib/credit";
import { activeScenarioValuesAtom } from "./scenario_values_atom";

export const creditsAtom = atom(
  (get) => {
    const credits = get(activeScenarioValuesAtom).credits;
    return Object.fromEntries(
      Object.entries(credits).filter(
        ([, credit]) => creditSchema.safeParse(credit).success,
      ),
    ) as Record<string, Credit>;
  },
  (
    get,
    set,
    update:
      | Record<string, Credit>
      | ((prev: Record<string, Credit>) => Record<string, Credit>),
  ) => {
    const current = get(creditsAtom);
    const next = typeof update === "function" ? update(current) : update;
    set(activeScenarioValuesAtom, (prev) => ({
      ...prev,
      credits: next,
    }));
  },
);
