import { describe, expect, test } from "vitest";
import {
  calculateFullPaymentTimeFromSollzins,
  calculateMonthlyRateFromSollzins,
  calculateNettodarlehensbetragBank,
  calculateRestschuldFromSollzins,
  calculateTilgungszuschussBetrag,
  calculateTotalRatesByTimeframe,
} from "../../src/lib/calculations";

describe("loan calculations", () => {
  test("calculates bank net loan after equity and additional credits", () => {
    expect(
      calculateNettodarlehensbetragBank({
        kaufpreis: 330_000,
        modernisierungskosten: 100_000,
        kaufnebenkosten: 39_831,
        eigenkapital: 100_000,
        credits: [
          {
            name: "KfW",
            kreditart: "standard",
            summeDarlehen: 50_000,
            effektiverZinssatz: 3,
            sollzinssatz: 3,
            tilgungssatz: 2,
            useKreditDauer: false,
            kreditdauer: 10,
            zinsbindung: 10,
            tilgungszuschussProzent: 0,
            foerderfaehigerAnteilProzent: 0,
            rates: [],
            restSchuld: 0,
          },
        ],
      }),
    ).toBe(319_831);
  });

  test("calculates monthly annuity rate from nominal interest", () => {
    expect(
      calculateMonthlyRateFromSollzins({
        darlehensbetrag: 300_000,
        sollzins: 3.6,
        tilgungssatz: 2,
      }),
    ).toBeCloseTo(1_400, 2);
  });

  test("calculates remaining debt after fixed interest period", () => {
    const monthlyRate = calculateMonthlyRateFromSollzins({
      darlehensbetrag: 300_000,
      sollzins: 3.6,
      tilgungssatz: 2,
    });

    expect(
      calculateRestschuldFromSollzins({
        nettodarlehensbetrag: 300_000,
        monthlyRate,
        sollzins: 3.6,
        years: 10,
      }),
    ).toBeCloseTo(227_907.14, 1);
  });

  test("calculates payoff horizon and rounded years", () => {
    const monthlyRate = calculateMonthlyRateFromSollzins({
      darlehensbetrag: 300_000,
      sollzins: 3.6,
      tilgungssatz: 2,
    });

    expect(
      calculateFullPaymentTimeFromSollzins({
        darlehensbetrag: 300_000,
        monthlyRate,
        sollzins: 3.6,
      }),
    ).toEqual({
      canBePaidOff: true,
      years: 28,
      months: 8,
      yearsAufgerundet: 29,
    });
  });

  test("caps tilgungszuschuss inputs to valid percentages", () => {
    expect(
      calculateTilgungszuschussBetrag({
        darlehensbetrag: 100_000,
        foerderfaehigerAnteilProzent: 150,
        tilgungszuschussProzent: 20,
      }),
    ).toBe(20_000);
  });

  test("combines overlapping rate periods into total timeframes", () => {
    expect(
      calculateTotalRatesByTimeframe([
        { startYear: 0, endYear: 10, rate: 1_000, key: "bank" },
        { startYear: 2, endYear: 5, rate: 200, key: "credit" },
      ]),
    ).toEqual([
      { startYear: 0, endYear: 2, rate: 1_000, key: "totalRate_0_2" },
      { startYear: 2, endYear: 5, rate: 1_200, key: "totalRate_2_5" },
      { startYear: 5, endYear: 10, rate: 1_000, key: "totalRate_5_10" },
    ]);
  });
});
