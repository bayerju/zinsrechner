import { describe, expect, test } from "vitest";
import {
  calculateBridgeMonthlyInterest,
  calculateBridgePaidAtYear,
  calculateCreditRestschuldAtYear,
  createCredit,
  getCreditEndYear,
  isBridgeCredit,
} from "../../src/lib/credit";

describe("credit helpers", () => {
  test("creates bridge credit with interest-only monthly rate", () => {
    const credit = createCredit({
      name: "Zwischenfinanzierung",
      kreditart: "zwischenfinanzierung",
      summeDarlehen: 120_000,
      effektiverZinssatz: 6,
      tilgungssatz: 0,
      useKreditDauer: true,
      kreditdauer: 1,
      zinsbindung: 1,
      tilgungszuschussProzent: 0,
      foerderfaehigerAnteilProzent: 0,
      laufzeitMonate: 18,
    });

    expect(isBridgeCredit(credit)).toBe(true);
    expect(getCreditEndYear(credit)).toBe(1.5);
    expect(credit.rates).toEqual([
      {
        startYear: 0,
        endYear: 1.5,
        rate: 600,
        key: "zwischenfinanzierung_zinsen",
      },
    ]);
  });

  test("calculates bridge interest and payoff by year", () => {
    const credit = createCredit({
      name: "Bridge",
      kreditart: "zwischenfinanzierung",
      summeDarlehen: 120_000,
      effektiverZinssatz: 6,
      tilgungssatz: 0,
      useKreditDauer: true,
      kreditdauer: 1,
      zinsbindung: 1,
      tilgungszuschussProzent: 0,
      foerderfaehigerAnteilProzent: 0,
      laufzeitMonate: 18,
    });

    expect(calculateBridgeMonthlyInterest(credit)).toBe(600);
    expect(calculateBridgePaidAtYear(credit, 1)).toBe(7_200);
    expect(calculateBridgePaidAtYear(credit, 1.5)).toBe(130_800);
  });

  test("calculates standard credit remaining debt", () => {
    const credit = createCredit({
      name: "Annuitaet",
      summeDarlehen: 100_000,
      effektiverZinssatz: 3,
      sollzinssatz: 3,
      tilgungssatz: 2,
      useKreditDauer: false,
      kreditdauer: 10,
      zinsbindung: 10,
      tilgungszuschussProzent: 0,
      foerderfaehigerAnteilProzent: 0,
    });

    expect(calculateCreditRestschuldAtYear(credit, 10)).toBeCloseTo(
      credit.restSchuld,
      6,
    );
    expect(calculateCreditRestschuldAtYear(credit, 2)).toBeGreaterThan(
      calculateCreditRestschuldAtYear(credit, 10),
    );
  });
});
