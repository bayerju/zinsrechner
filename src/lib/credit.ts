import { z } from "zod";
import {
  calculateTilgungszuschussBetrag,
  calculateFullPaymentTimeFromSollzins,
  calculateMonthlyRateFromSollzins,
  calculateRestschuldFromSollzins,
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
  sollzinssatz: z.number().optional(),
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

export function normalizeCredit(value: unknown): Credit | null {
  const normalizedValue =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? {
          ...value,
          rückzahlungsfreieZeit:
            "rückzahlungsfreieZeit" in value
              ? (value as { rückzahlungsfreieZeit?: unknown })
                  .rückzahlungsfreieZeit
              : (value as { rueckzahlungsfreieZeit?: unknown })
                  .rueckzahlungsfreieZeit,
        }
      : value;

  const parsed = creditSchema.safeParse(normalizedValue);
  if (parsed.success) {
    return {
      ...parsed.data,
      sollzinssatz: parsed.data.sollzinssatz ?? parsed.data.effektiverZinssatz,
    };
  }

  const legacyParsed = creditSchema
    .extend({
      useKreditDauer: z.boolean().optional(),
      kreditdauer: z.number().optional(),
      zinsbindung: z.number().optional(),
      rates: ratesByTimeSchema.optional(),
      restSchuld: z.number().optional(),
    })
    .safeParse(normalizedValue);

  if (!legacyParsed.success) return null;

  const data = legacyParsed.data;
  return createCredit({
    ...data,
    sollzinssatz: data.sollzinssatz ?? data.effektiverZinssatz,
    useKreditDauer: data.useKreditDauer ?? false,
    kreditdauer: data.kreditdauer ?? data.zinsbindung ?? 10,
    zinsbindung:
      data.zinsbindung ??
      (data.kreditart === "zwischenfinanzierung"
        ? (data.laufzeitMonate ?? 12) / 12
        : 10),
    rates: data.rates ?? [],
    restSchuld: data.restSchuld ?? 0,
  });
}

export function serializeCreditForConvex(credit: Credit) {
  const { rückzahlungsfreieZeit, ...rest } = credit;
  return {
    ...rest,
    rueckzahlungsfreieZeit: rückzahlungsfreieZeit,
  };
}

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
  sollzinssatz,
  effektiverZinssatz,
}: Pick<Credit, "summeDarlehen" | "effektiverZinssatz"> &
  Partial<Pick<Credit, "sollzinssatz">>) {
  const monthlyInterest = (sollzinssatz ?? effektiverZinssatz) / 100 / 12;
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
  const sollzinssatz = credit.sollzinssatz ?? credit.effektiverZinssatz;
  const monthlyRate = calculateMonthlyRateFromSollzins({
    darlehensbetrag: principal,
    sollzins: sollzinssatz,
    tilgungssatz: credit.tilgungssatz,
    rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
  });

  return calculateRestschuldFromSollzins({
    nettodarlehensbetrag: principal,
    monthlyRate,
    sollzins: sollzinssatz,
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
      sollzinssatz: overrides.sollzinssatz ?? overrides.effektiverZinssatz,
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
  const sollzinssatz = overrides.sollzinssatz ?? overrides.effektiverZinssatz;

  return {
    kreditart: "standard",
    tilgungsFreieZeit: 0,
    rückzahlungsfreieZeit: 0,
    ...overrides,
    sollzinssatz,
    tilgungszuschussProzent: overrides.tilgungszuschussProzent ?? 0,
    foerderfaehigerAnteilProzent: overrides.foerderfaehigerAnteilProzent ?? 0,
    rates: createRatesByTime(overrides),
    tilgungssatz:
      overrides.tilgungssatz ??
      calculateTilgungssatz({
        effzins: sollzinssatz,
        kreditdauer: overrides.kreditdauer,
        tilgungsfreieZeit: overrides.tilgungsFreieZeit,
        rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
      }),
    useKreditDauer: overrides.useKreditDauer ?? false,
    kreditdauer:
      overrides.kreditdauer ??
      calculateFullPaymentTimeFromSollzins({
        darlehensbetrag: rueckzahlungsRelevanterBetrag,
        monthlyRate: calculateMonthlyRateFromSollzins({
          darlehensbetrag: rueckzahlungsRelevanterBetrag,
          sollzins: sollzinssatz,
          tilgungssatz: overrides.tilgungssatz,
          rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
        }),
        sollzins: sollzinssatz,
        tilgungsfreieZeit: overrides.tilgungsFreieZeit,
        rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
      }).years,
    restSchuld: calculateRestschuldFromSollzins({
      nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
      monthlyRate: calculateMonthlyRateFromSollzins({
        darlehensbetrag: rueckzahlungsRelevanterBetrag,
        sollzins: sollzinssatz,
        tilgungssatz: overrides.tilgungssatz,
        rückzahlungsfreieZeit: overrides.rückzahlungsfreieZeit,
      }),
      sollzins: sollzinssatz,
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
  const sollzinssatz = overrides.sollzinssatz ?? overrides.effektiverZinssatz;

  const result: RatesByTime = [];
  if (overrides.tilgungsFreieZeit) {
    result.push({
      startYear: 0,
      endYear: overrides.tilgungsFreieZeit,
      rate: calculateMonthlyRateFromSollzins({
        darlehensbetrag: rueckzahlungsRelevanterBetrag,
        sollzins: sollzinssatz,
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
  const mainMonthlyRate = calculateMonthlyRateFromSollzins({
    darlehensbetrag: rueckzahlungsRelevanterBetrag,
    sollzins: sollzinssatz,
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
  return result;
}
