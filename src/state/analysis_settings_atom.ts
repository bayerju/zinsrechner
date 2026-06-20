import { atomWithStorage } from "jotai/utils";

export const defaultAnalysisHorizonYears = 30;
export const defaultOpportunityRate = 2.5;

export const analysisHorizonYearsAtom = atomWithStorage<number>(
  "analysisHorizonYears",
  defaultAnalysisHorizonYears,
);

export const includeRefinancingAtom = atomWithStorage<boolean>(
  "includeRefinancing",
  false,
);

export const opportunityRateAtom = atomWithStorage<number>(
  "opportunityRate",
  defaultOpportunityRate,
);
