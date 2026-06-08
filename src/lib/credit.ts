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
  kreditart: z
    .enum(["standard", "zwischenfinanzierung"])
    .optional()
    .default("standard"),
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
  laufzeitMonate: z.number().int().positive().optional(),
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

export function isBridgeCredit(
  credit: Pick<Credit, "kreditart"> | { kreditart?: string },
) {
  return credit.kreditart === "zwischenfinanzierung";
}

export function getCreditEndYear(
  credit: Pick<Credit, "kreditart" | "laufzeitMonate" | "zinsbindung">,
) {
  return isBridgeCredit(credit)
    ? (credit.laufzeitMonate ?? 0) / 12
    : credit.zinsbindung;
}

export function calculateBridgeMonthlyInterest({
  summeDarlehen,
  effektiverZinssatz,
}: Pick<Credit, "summeDarlehen" | "effektiverZinssatz">) {
  const monthlyInterest = (1 + effektiverZinssatz / 100) ** (1 / 12) - 1;
  return summeDarlehen * monthlyInterest;
}

export function calculateCreditRestschuldAtYear(
  credit: Credit,
  targetYear: number,
) {
  if (isBridgeCredit(credit)) {
    return targetYear < getCreditEndYear(credit) ? credit.summeDarlehen : 0;
  }

  const tilgungszuschussBetrag = calculateTilgungszuschussBetrag({
    darlehensbetrag: credit.summeDarlehen,
    foerderfaehigerAnteilProzent: credit.foerderfaehigerAnteilProzent,
    tilgungszuschussProzent: credit.tilgungszuschussProzent,
  });
  const principal = Math.max(0, credit.summeDarlehen - tilgungszuschussBetrag);
  const monthlyRate = calculateMonthlyRate({
    darlehensbetrag: principal,
    effzins: credit.effektiverZinssatz,
    tilgungssatz: credit.tilgungssatz,
    rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
  });

  return calculateRestschuld({
    nettodarlehensbetrag: principal,
    monthlyRate,
    effZins: credit.effektiverZinssatz,
    years: Math.min(targetYear, credit.zinsbindung),
    tilgungsfreieZeit: credit.tilgungsFreieZeit,
    rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
  });
}

export function calculateBridgePaidAtYear(credit: Credit, targetYear: number) {
  if (!isBridgeCredit(credit)) return 0;

  const durationMonths = credit.laufzeitMonate ?? 0;
  const elapsedMonths = Math.min(
    durationMonths,
    Math.max(0, Math.round(targetYear * 12)),
  );
  const interestPaid = calculateBridgeMonthlyInterest(credit) * elapsedMonths;
  const principalPaid =
    targetYear >= getCreditEndYear(credit) ? credit.summeDarlehen : 0;

  return interestPaid + principalPaid;
}

export function createCredit(overrides: CreditCreate): Credit {
  if (overrides.kreditart === "zwischenfinanzierung") {
    const laufzeitMonate = Math.max(
      1,
      Math.round(overrides.laufzeitMonate ?? 1),
    );
    const endYear = laufzeitMonate / 12;
    const monthlyInterest = calculateBridgeMonthlyInterest(overrides);

    return {
      name: overrides.name,
      kreditart: "zwischenfinanzierung",
      summeDarlehen: overrides.summeDarlehen,
      effektiverZinssatz: overrides.effektiverZinssatz,
      tilgungssatz: 0,
      useKreditDauer: true,
      kreditdauer: endYear,
      zinsbindung: endYear,
      laufzeitMonate,
      tilgungsFreieZeit: 0,
      rückzahlungsfreieZeit: 0,
      tilgungszuschussProzent: 0,
      foerderfaehigerAnteilProzent: 0,
      rates: [
        {
          startYear: 0,
          endYear,
          rate: monthlyInterest,
          key: "zwischenfinanzierung_zinsen",
        },
      ],
      restSchuld: 0,
    };
  }

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
    kreditart: "standard",
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
