import { z } from "zod";
import {
  calculateTilgungszuschussBetrag,
  calculateFullPaymentTime,
  calculateMonthlyRate,
  calculateRestschuld,
  calculateTilgungssatz,
} from "./calculations";

export const ratesByTimeSchema = z.array(
  z.object({
    startYear: z.number(),
    endYear: z.number(),
    rate: z.number(),
    key: z.string(),
  }),
);

export type RatesByTime = z.infer<typeof ratesByTimeSchema>;

export const creditSchema = z.object({
  name: z.string(),
  summeDarlehen: z.number(),
  effektiverZinssatz: z.number(),
  tilgungssatz: z.number(),
  useKreditDauer: z.boolean(),
  kreditdauer: z.number(),
  tilgungsFreieZeit: z.number().optional(),
  rückzahlungsfreieZeit: z.number().optional(),
  tilgungszuschussProzent: z.number().min(0).max(100).optional().default(0),
  foerderfaehigerAnteilProzent: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(0),
  zinsbindung: z.number(),
  rates: ratesByTimeSchema,
  restSchuld: z.number(),
});

export type Credit = z.infer<typeof creditSchema>;

export type CreditCreate = Pick<
  Credit,
  | "summeDarlehen"
  | "effektiverZinssatz"
  | "tilgungssatz"
  | "name"
  | "kreditdauer"
  | "zinsbindung"
  | "tilgungszuschussProzent"
  | "foerderfaehigerAnteilProzent"
> &
  Partial<Credit>;

export function createCredit(overrides: CreditCreate): Credit {
  const tilgungszuschussBetrag = calculateTilgungszuschussBetrag({
    darlehensbetrag: overrides.summeDarlehen,
    foerderfaehigerAnteilProzent: overrides.foerderfaehigerAnteilProzent,
    tilgungszuschussProzent: overrides.tilgungszuschussProzent,
  });
  const rueckzahlungsRelevanterBetrag = Math.max(
    0,
    overrides.summeDarlehen - tilgungszuschussBetrag,
  );

  return {
    tilgungsFreieZeit: 0,
    rückzahlungsfreieZeit: 0,
    ...overrides,
    tilgungszuschussProzent: overrides.tilgungszuschussProzent ?? 0,
    foerderfaehigerAnteilProzent: overrides.foerderfaehigerAnteilProzent ?? 0,
    rates: createRatesByTime(overrides),
    tilgungssatz:
      overrides.tilgungssatz ??
      calculateTilgungssatz({
        effzins: overrides.effektiverZinssatz,
        kreditdauer: overrides.kreditdauer,
        tilgungsfreieZeit: overrides.tilgungsFreieZeit,
        rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
      }),
    useKreditDauer: overrides.useKreditDauer ?? false,
    kreditdauer:
      overrides.kreditdauer ??
      calculateFullPaymentTime({
        darlehensbetrag: rueckzahlungsRelevanterBetrag,
        monthlyRate: calculateMonthlyRate({
          darlehensbetrag: rueckzahlungsRelevanterBetrag,
          effzins: overrides.effektiverZinssatz,
          tilgungssatz: overrides.tilgungssatz,
          rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
        }),
        effzins: overrides.effektiverZinssatz,
        tilgungsfreieZeit: overrides.tilgungsFreieZeit,
        rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
      }).years,
    restSchuld: calculateRestschuld({
      nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
      monthlyRate: calculateMonthlyRate({
        darlehensbetrag: rueckzahlungsRelevanterBetrag,
        effzins: overrides.effektiverZinssatz,
        tilgungssatz: overrides.tilgungssatz,
        rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
      }),
      effZins: overrides.effektiverZinssatz,
      years: overrides.zinsbindung,
    }),
  };
}

export function createRatesByTime(overrides: CreditCreate): RatesByTime {
  const tilgungszuschussBetrag = calculateTilgungszuschussBetrag({
    darlehensbetrag: overrides.summeDarlehen,
    foerderfaehigerAnteilProzent: overrides.foerderfaehigerAnteilProzent,
    tilgungszuschussProzent: overrides.tilgungszuschussProzent,
  });
  const rueckzahlungsRelevanterBetrag = Math.max(
    0,
    overrides.summeDarlehen - tilgungszuschussBetrag,
  );

  const result: RatesByTime = [];
  if (overrides.tilgungsFreieZeit) {
    result.push({
      startYear: 0,
      endYear: overrides.tilgungsFreieZeit,
      rate: calculateMonthlyRate({
        darlehensbetrag: rueckzahlungsRelevanterBetrag,
        effzins: overrides.effektiverZinssatz,
        tilgungssatz: 0,
        rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
      }),
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
  const startYearFullRate = Math.max(
    0,
    overrides.rückzahlungsfreieZeit ?? 0,
    overrides.tilgungsFreieZeit ?? 0,
  );
  const mainMonthlyRate = calculateMonthlyRate({
    darlehensbetrag: rueckzahlungsRelevanterBetrag,
    effzins: overrides.effektiverZinssatz,
    tilgungssatz: overrides.tilgungssatz,
    rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
  });
  result.push({
    startYear: startYearFullRate,
    endYear: overrides.zinsbindung,
    // endYear: calculateFullPaymentTime({
    //   darlehensbetrag: overrides.summeDarlehen,
    //   monthlyRate: mainMonthlyRate,
    //   effzins: overrides.effektiverZinssatz,
    //   tilgungsfreieZeit: overrides.tilgungsFreieZeit,
    //   rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
    // }).years,
    rate: mainMonthlyRate,
    key: "tilgung",
  });
  console.log("rates", result);
  return result;
}
