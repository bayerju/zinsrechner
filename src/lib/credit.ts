import { z } from "zod";
import { calculateFullPaymentTime, calculateMonthlyRate } from "./calculations";


export const ratesByTimeSchema = z.array(z.object({
  startYear: z.number(),
  endYear: z.number(),
  rate: z.number(),
  key: z.string(),
}));

export type RatesByTime = z.infer<typeof ratesByTimeSchema>;

export const creditSchema = z.object({
  name: z.string(),
  summeDarlehen: z.number(),
  effektiverZinssatz: z.number(),
  tilgungssatz: z.number(),
  tilgungsFreieZeit: z.number().optional(),
  rückzahlungsfreieZeit: z.number().optional(),
  rates: ratesByTimeSchema,
});

export type Credit = z.infer<typeof creditSchema>;

export type CreditCreate = Pick<
  Credit,
  "summeDarlehen" | "effektiverZinssatz" | "tilgungssatz" | "name"
> &
  Partial<Credit>;

export function createCredit(overrides: CreditCreate): Credit {
  return {
    tilgungsFreieZeit: 0,
    rückzahlungsfreieZeit: 0,
    ...overrides,
    rates: createRatesByTime(overrides),
  };
}

export function createRatesByTime(overrides: CreditCreate): RatesByTime {
  const result: RatesByTime = [];
  if (overrides.tilgungsFreieZeit) {
  result.push({
    startYear: 0,
    endYear: overrides.tilgungsFreieZeit,
      rate: calculateMonthlyRate(overrides.summeDarlehen, overrides.effektiverZinssatz, 0),
      key: "tilgungsfrei",
    });
  }
  if (overrides.rückzahlungsfreieZeit) {
  result.push({
    startYear: 0,
    endYear: overrides.rückzahlungsfreieZeit,
    rate: 0,
    key: "rückzahlungsfrei",
  });
  }
  const startYearFullRate =  Math.max(0, overrides.rückzahlungsfreieZeit ?? 0, overrides.tilgungsFreieZeit ?? 0);
  result.push({
    startYear: startYearFullRate,
    endYear: calculateFullPaymentTime(overrides.summeDarlehen, overrides.effektiverZinssatz, overrides.tilgungssatz).years,
    rate: calculateMonthlyRate(overrides.summeDarlehen, overrides.effektiverZinssatz, overrides.tilgungssatz),
    key: "tilgung",
  });
  return result;
}
