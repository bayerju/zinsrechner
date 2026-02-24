import { atomWithStorage } from "jotai/utils";

export const analysisHorizonYears = 30;

export const includeRefinancingAtom = atomWithStorage<boolean>(
  "includeRefinancing",
  false,
);
