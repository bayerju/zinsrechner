import { atomWithStorage } from "jotai/utils";
import { creditSchema, type Credit } from "~/lib/credit";

export const creditsAtom = atomWithStorage<Record<string, Credit>>(
  "credits",
  {},
  {
    getItem: (key, initialValue) => {
      const stored = localStorage.getItem(key);
      if (stored === null) return initialValue;
      try {
        const parsed = JSON.parse(stored) as Record<string, Credit>;
        console.log("parsed", parsed);
        const valid = Object.entries(parsed).filter(([key, credit]) => creditSchema.safeParse(credit).success);
        console.log("valid", valid);
        console.log("Object.fromEntries(valid)", Object.fromEntries(valid));
        return Object.fromEntries(valid);
      } catch { 
        return initialValue;
      }
    },
    setItem: (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
    },
  },
);
