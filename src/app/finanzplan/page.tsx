"use client";

import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "~/components/top_nav";
import { Card, CardContent } from "~/components/ui/card";
import { type ChartConfig } from "~/components/ui/chart";
import {
  DetailRestschuldStackChart,
  ScenarioMonthlyRateChart,
} from "~/components/finanzplan_charts";
import {
  calculateFullPaymentTime,
  calculateMonthlyRate,
  calculateRestschuld,
  calculateTilgungszuschussBetrag,
} from "~/lib/calculations";
import { formatNumber } from "~/lib/number_fromat";
import {
  activeScenarioIdAtom,
  comparedScenarioIdsAtom,
  defaultScenarioId,
  scenariosAtom,
} from "~/state/scenarios_atom";
import {
  defaultScenarioValues,
  scenarioValuesAtom,
  type ScenarioValues,
} from "~/state/scenario_values_atom";
import { getCreditSeriesColorByIndex } from "~/lib/scenario_colors";
import {
  analysisHorizonYears,
  includeRefinancingAtom,
} from "~/state/analysis_settings_atom";

type FinanzplanRow = {
  stichtag: number;
  bisherBezahltGesamt: number;
  getilgtGesamt: number;
  restschuldGesamt: number;
  zinsenGesamt: number;
  durchschnittMonatlicheZinsen: number;
};

type KreditRow = {
  name: string;
  stichtag: number;
  bisherBezahlt: number;
  restschuld: number;
  darlehen: number;
  getilgt: number;
  zinsen: number;
  durchschnittMonatlicheZinsen: number;
};

type CalculationOptions = {
  includeRefinancing: boolean;
  analysisHorizonYears: number;
};

type MaturityEvent = {
  name: string;
  dueYear: number;
  dueAmount: number;
};

function getRefinancingSegment({
  principal,
  startYear,
  effzins,
  tilgungssatz,
  horizonYears,
}: {
  principal: number;
  startYear: number;
  effzins: number;
  tilgungssatz: number;
  horizonYears: number;
}) {
  if (principal <= 0 || startYear >= horizonYears) return null;
  const monthlyRate = calculateMonthlyRate({
    darlehensbetrag: principal,
    effzins,
    tilgungssatz,
  });
  const payoff = calculateFullPaymentTime({
    darlehensbetrag: principal,
    monthlyRate,
    effzins,
  });
  const maxEndYear = horizonYears;
  if (!payoff.canBePaidOff) {
    return {
      monthlyRate,
      endYear: maxEndYear,
    };
  }
  return {
    monthlyRate,
    endYear: Math.min(maxEndYear, startYear + payoff.yearsAufgerundet),
  };
}

function slugifyKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function calculateScenarioFinanzplan(
  values: ScenarioValues,
  options: CalculationOptions,
): {
  kreditRows: KreditRow[];
  finanzplanRows: FinanzplanRow[];
  maturityEvents: MaturityEvent[];
} {
  const credits = Object.values(values.credits ?? {});
  const nettoDarlehensbetragBank =
    values.kaufpreis +
    values.modernisierungskosten +
    values.kaufpreis * 0.1207 -
    values.eigenkapital -
    credits.reduce((acc, credit) => acc + credit.summeDarlehen, 0);

  const bankMonatsrate = calculateMonthlyRate({
    darlehensbetrag: nettoDarlehensbetragBank,
    effzins: values.effzins,
    tilgungssatz: values.tilgungssatz,
  });

  const bankRateSegments = [
    {
      startYear: 0,
      endYear: values.zinsbindung,
      rate: bankMonatsrate,
    },
  ];

  function paidFromSegments(
    segments: Array<{ startYear: number; endYear: number; rate: number }>,
    years: number,
  ) {
    return segments.reduce((sum, segment) => {
      const endYearInRange = Math.min(segment.endYear, years);
      if (endYearInRange <= segment.startYear) return sum;
      return sum + segment.rate * (endYearInRange - segment.startYear) * 12;
    }, 0);
  }

  function calculateProgressAtYear({
    principal,
    effzins,
    tilgungssatz,
    zinsbindung,
    targetYear,
    paidSegments,
    tilgungsfreieZeit,
    rückzahlungsfreieZeit,
  }: {
    principal: number;
    effzins: number;
    tilgungssatz: number;
    zinsbindung: number;
    targetYear: number;
    paidSegments: Array<{ startYear: number; endYear: number; rate: number }>;
    tilgungsfreieZeit?: number;
    rückzahlungsfreieZeit?: number;
  }) {
    const baseMonthlyRate = calculateMonthlyRate({
      darlehensbetrag: principal,
      effzins,
      tilgungssatz,
      rückzahlungsfreieZeit,
    });
    const baseYears = Math.min(targetYear, zinsbindung);
    const baseRestschuld = calculateRestschuld({
      nettodarlehensbetrag: principal,
      monthlyRate: baseMonthlyRate,
      effZins: effzins,
      years: baseYears,
      tilgungsfreieZeit,
      rückzahlungsfreieZeit,
    });
    const basePaid = paidFromSegments(paidSegments, baseYears);

    if (!options.includeRefinancing || targetYear <= zinsbindung) {
      return {
        bisherBezahlt: basePaid,
        restschuld: baseRestschuld,
      };
    }

    const restschuldAtBinding = calculateRestschuld({
      nettodarlehensbetrag: principal,
      monthlyRate: baseMonthlyRate,
      effZins: effzins,
      years: zinsbindung,
      tilgungsfreieZeit,
      rückzahlungsfreieZeit,
    });

    const refinancing = getRefinancingSegment({
      principal: restschuldAtBinding,
      startYear: zinsbindung,
      effzins: values.effzins,
      tilgungssatz: values.tilgungssatz,
      horizonYears: options.analysisHorizonYears,
    });

    if (!refinancing) {
      return {
        bisherBezahlt: basePaid,
        restschuld: baseRestschuld,
      };
    }

    const refinancingYears =
      Math.min(targetYear, refinancing.endYear) - zinsbindung;
    if (refinancingYears <= 0) {
      return {
        bisherBezahlt: paidFromSegments(paidSegments, zinsbindung),
        restschuld: restschuldAtBinding,
      };
    }

    const restschuld = calculateRestschuld({
      nettodarlehensbetrag: restschuldAtBinding,
      monthlyRate: refinancing.monthlyRate,
      effZins: values.effzins,
      years: refinancingYears,
    });

    return {
      bisherBezahlt:
        paidFromSegments(paidSegments, zinsbindung) +
        refinancing.monthlyRate * refinancingYears * 12,
      restschuld,
    };
  }

  const maturityEvents: MaturityEvent[] = [];

  const bankRestschuldAtBinding = calculateRestschuld({
    nettodarlehensbetrag: nettoDarlehensbetragBank,
    monthlyRate: bankMonatsrate,
    effZins: values.effzins,
    years: values.zinsbindung,
  });
  if (bankRestschuldAtBinding > 0) {
    maturityEvents.push({
      name: "Bankkredit",
      dueYear: values.zinsbindung,
      dueAmount: bankRestschuldAtBinding,
    });
  }

  const kreditRows = [
    (() => {
      const refinancing = options.includeRefinancing
        ? getRefinancingSegment({
            principal: bankRestschuldAtBinding,
            startYear: values.zinsbindung,
            effzins: values.effzins,
            tilgungssatz: values.tilgungssatz,
            horizonYears: options.analysisHorizonYears,
          })
        : null;
      const rowYear = refinancing?.endYear ?? values.zinsbindung;
      const progress = calculateProgressAtYear({
        principal: nettoDarlehensbetragBank,
        effzins: values.effzins,
        tilgungssatz: values.tilgungssatz,
        zinsbindung: values.zinsbindung,
        targetYear: rowYear,
        paidSegments: bankRateSegments,
      });
      return {
        name: "Bankkredit",
        stichtag: rowYear,
        bisherBezahlt: progress.bisherBezahlt,
        restschuld: progress.restschuld,
        darlehen: nettoDarlehensbetragBank,
      };
    })(),
    ...credits.map((credit) => {
      const tilgungszuschuss = calculateTilgungszuschussBetrag({
        darlehensbetrag: credit.summeDarlehen,
        foerderfaehigerAnteilProzent: credit.foerderfaehigerAnteilProzent ?? 0,
        tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
      });
      const rueckzahlungsRelevanterBetrag = Math.max(
        0,
        credit.summeDarlehen - tilgungszuschuss,
      );
      const monthlyRate = calculateMonthlyRate({
        darlehensbetrag: rueckzahlungsRelevanterBetrag,
        effzins: credit.effektiverZinssatz,
        tilgungssatz: credit.tilgungssatz,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });
      const restschuldAtBinding = calculateRestschuld({
        nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
        monthlyRate,
        effZins: credit.effektiverZinssatz,
        years: credit.zinsbindung,
        tilgungsfreieZeit: credit.tilgungsFreieZeit,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });
      if (restschuldAtBinding > 0) {
        maturityEvents.push({
          name: credit.name,
          dueYear: credit.zinsbindung,
          dueAmount: restschuldAtBinding,
        });
      }

      const refinancing = options.includeRefinancing
        ? getRefinancingSegment({
            principal: restschuldAtBinding,
            startYear: credit.zinsbindung,
            effzins: values.effzins,
            tilgungssatz: values.tilgungssatz,
            horizonYears: options.analysisHorizonYears,
          })
        : null;
      const rowYear = refinancing?.endYear ?? credit.zinsbindung;

      const progress = calculateProgressAtYear({
        principal: rueckzahlungsRelevanterBetrag,
        effzins: credit.effektiverZinssatz,
        tilgungssatz: credit.tilgungssatz,
        zinsbindung: credit.zinsbindung,
        targetYear: rowYear,
        paidSegments: credit.rates.map((rate) => ({
          startYear: rate.startYear,
          endYear: Math.min(rate.endYear, credit.zinsbindung),
          rate: rate.rate,
        })),
        tilgungsfreieZeit: credit.tilgungsFreieZeit,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });

      return {
        name: credit.name,
        stichtag: rowYear,
        bisherBezahlt: progress.bisherBezahlt,
        restschuld: progress.restschuld,
        darlehen: rueckzahlungsRelevanterBetrag,
      };
    }),
  ].map((row) => {
    const getilgt = Math.max(0, row.darlehen - row.restschuld);
    const zinsen = Math.max(0, row.bisherBezahlt - getilgt);
    const durchschnittMonatlicheZinsen =
      row.stichtag > 0 ? zinsen / (row.stichtag * 12) : 0;

    return {
      ...row,
      getilgt,
      zinsen,
      durchschnittMonatlicheZinsen,
    };
  });

  const stichtage = Array.from(
    new Set([
      values.zinsbindung,
      ...credits.map((credit) => credit.zinsbindung),
      ...(options.includeRefinancing ? [options.analysisHorizonYears] : []),
    ]),
  )
    .filter((years) => years > 0)
    .sort((a, b) => a - b);

  const finanzplanRows = stichtage.map((stichtag) => {
    const bankProgress = calculateProgressAtYear({
      principal: nettoDarlehensbetragBank,
      effzins: values.effzins,
      tilgungssatz: values.tilgungssatz,
      zinsbindung: values.zinsbindung,
      targetYear: stichtag,
      paidSegments: bankRateSegments,
    });
    const bankBisherBezahlt = bankProgress.bisherBezahlt;
    const bankRestschuld = bankProgress.restschuld;
    const bankGetilgt = Math.max(0, nettoDarlehensbetragBank - bankRestschuld);
    const bankZinsen = Math.max(0, bankBisherBezahlt - bankGetilgt);

    const creditsTotals = credits.reduce(
      (acc, credit) => {
        const tilgungszuschuss = calculateTilgungszuschussBetrag({
          darlehensbetrag: credit.summeDarlehen,
          foerderfaehigerAnteilProzent:
            credit.foerderfaehigerAnteilProzent ?? 0,
          tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
        });
        const rueckzahlungsRelevanterBetrag = Math.max(
          0,
          credit.summeDarlehen - tilgungszuschuss,
        );
        const progress = calculateProgressAtYear({
          principal: rueckzahlungsRelevanterBetrag,
          effzins: credit.effektiverZinssatz,
          tilgungssatz: credit.tilgungssatz,
          zinsbindung: credit.zinsbindung,
          targetYear: stichtag,
          paidSegments: credit.rates.map((rate) => ({
            startYear: rate.startYear,
            endYear: Math.min(rate.endYear, credit.zinsbindung),
            rate: rate.rate,
          })),
          tilgungsfreieZeit: credit.tilgungsFreieZeit,
          rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
        });
        const restschuld = progress.restschuld;
        const bisherBezahlt = progress.bisherBezahlt;
        const getilgt = Math.max(0, rueckzahlungsRelevanterBetrag - restschuld);
        const zinsen = Math.max(0, bisherBezahlt - getilgt);

        return {
          bisherBezahlt: acc.bisherBezahlt + bisherBezahlt,
          darlehen: acc.darlehen + rueckzahlungsRelevanterBetrag,
          restschuld: acc.restschuld + restschuld,
          zinsen: acc.zinsen + zinsen,
        };
      },
      { bisherBezahlt: 0, darlehen: 0, restschuld: 0, zinsen: 0 },
    );

    const bisherBezahltGesamt = bankBisherBezahlt + creditsTotals.bisherBezahlt;
    const gesamtdarlehen = nettoDarlehensbetragBank + creditsTotals.darlehen;
    const restschuldGesamt = bankRestschuld + creditsTotals.restschuld;
    const getilgtGesamt = Math.max(0, gesamtdarlehen - restschuldGesamt);
    const zinsenGesamt = bankZinsen + creditsTotals.zinsen;
    const durchschnittMonatlicheZinsen =
      stichtag > 0 ? zinsenGesamt / (stichtag * 12) : 0;

    return {
      stichtag,
      bisherBezahltGesamt,
      getilgtGesamt,
      restschuldGesamt,
      zinsenGesamt,
      durchschnittMonatlicheZinsen,
    };
  });

  return {
    kreditRows,
    finanzplanRows,
    maturityEvents: maturityEvents.sort((a, b) => a.dueYear - b.dueYear),
  };
}

function calculateScenarioMonthlyRateSeries(
  values: ScenarioValues,
  maxYears: number,
  options: CalculationOptions,
) {
  const credits = Object.values(values.credits ?? {});
  const nettoDarlehensbetragBank =
    values.kaufpreis +
    values.modernisierungskosten +
    values.kaufpreis * 0.1207 -
    values.eigenkapital -
    credits.reduce((acc, credit) => acc + credit.summeDarlehen, 0);

  const bankMonatsrate = calculateMonthlyRate({
    darlehensbetrag: nettoDarlehensbetragBank,
    effzins: values.effzins,
    tilgungssatz: values.tilgungssatz,
  });

  const segments: Array<{ startYear: number; endYear: number; rate: number }> =
    [{ startYear: 0, endYear: values.zinsbindung, rate: bankMonatsrate }];

  if (options.includeRefinancing) {
    const bankRestschuldAtBinding = calculateRestschuld({
      nettodarlehensbetrag: nettoDarlehensbetragBank,
      monthlyRate: bankMonatsrate,
      effZins: values.effzins,
      years: values.zinsbindung,
    });
    const bankRefinancing = getRefinancingSegment({
      principal: bankRestschuldAtBinding,
      startYear: values.zinsbindung,
      effzins: values.effzins,
      tilgungssatz: values.tilgungssatz,
      horizonYears: options.analysisHorizonYears,
    });
    if (bankRefinancing) {
      segments.push({
        startYear: values.zinsbindung,
        endYear: bankRefinancing.endYear,
        rate: bankRefinancing.monthlyRate,
      });
    }
  }

  credits.forEach((credit) => {
    credit.rates.forEach((rate) => {
      segments.push({
        startYear: rate.startYear,
        endYear: Math.min(rate.endYear, credit.zinsbindung),
        rate: rate.rate,
      });
    });

    if (options.includeRefinancing) {
      const tilgungszuschuss = calculateTilgungszuschussBetrag({
        darlehensbetrag: credit.summeDarlehen,
        foerderfaehigerAnteilProzent: credit.foerderfaehigerAnteilProzent ?? 0,
        tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
      });
      const principal = Math.max(0, credit.summeDarlehen - tilgungszuschuss);
      const monthlyRate = calculateMonthlyRate({
        darlehensbetrag: principal,
        effzins: credit.effektiverZinssatz,
        tilgungssatz: credit.tilgungssatz,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });
      const restschuldAtBinding = calculateRestschuld({
        nettodarlehensbetrag: principal,
        monthlyRate,
        effZins: credit.effektiverZinssatz,
        years: credit.zinsbindung,
        tilgungsfreieZeit: credit.tilgungsFreieZeit,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });
      const refinancing = getRefinancingSegment({
        principal: restschuldAtBinding,
        startYear: credit.zinsbindung,
        effzins: values.effzins,
        tilgungssatz: values.tilgungssatz,
        horizonYears: options.analysisHorizonYears,
      });
      if (refinancing) {
        segments.push({
          startYear: credit.zinsbindung,
          endYear: refinancing.endYear,
          rate: refinancing.monthlyRate,
        });
      }
    }
  });

  return Array.from({ length: maxYears }, (_, index) => {
    const year = index + 1;
    const monthlyRate = segments.reduce((sum, segment) => {
      const isActive = segment.startYear < year && segment.endYear >= year;
      return isActive ? sum + segment.rate : sum;
    }, 0);

    return {
      year,
      monthlyRate,
    };
  });
}

function calculateDetailRestschuldStack(
  values: ScenarioValues,
  maxYears: number,
  options: CalculationOptions,
) {
  const credits = Object.values(values.credits ?? {});
  const nettoDarlehensbetragBank =
    values.kaufpreis +
    values.modernisierungskosten +
    values.kaufpreis * 0.1207 -
    values.eigenkapital -
    credits.reduce((acc, credit) => acc + credit.summeDarlehen, 0);

  const bankMonatsrate = calculateMonthlyRate({
    darlehensbetrag: nettoDarlehensbetragBank,
    effzins: values.effzins,
    tilgungssatz: values.tilgungssatz,
  });

  const creditSeries = [
    {
      key: "bank",
      label: "Bankkredit",
      color: getCreditSeriesColorByIndex(0),
      restschuldAt: (year: number) => {
        const baseYears = Math.min(year, values.zinsbindung);
        const baseRest = calculateRestschuld({
          nettodarlehensbetrag: nettoDarlehensbetragBank,
          monthlyRate: bankMonatsrate,
          effZins: values.effzins,
          years: baseYears,
        });
        if (!options.includeRefinancing || year <= values.zinsbindung) {
          return baseRest;
        }
        const restAtBinding = calculateRestschuld({
          nettodarlehensbetrag: nettoDarlehensbetragBank,
          monthlyRate: bankMonatsrate,
          effZins: values.effzins,
          years: values.zinsbindung,
        });
        const refinancing = getRefinancingSegment({
          principal: restAtBinding,
          startYear: values.zinsbindung,
          effzins: values.effzins,
          tilgungssatz: values.tilgungssatz,
          horizonYears: options.analysisHorizonYears,
        });
        if (!refinancing) return baseRest;
        const refinanceYears =
          Math.min(year, refinancing.endYear) - values.zinsbindung;
        if (refinanceYears <= 0) return restAtBinding;
        return calculateRestschuld({
          nettodarlehensbetrag: restAtBinding,
          monthlyRate: refinancing.monthlyRate,
          effZins: values.effzins,
          years: refinanceYears,
        });
      },
    },
    ...credits.map((credit, index) => {
      const tilgungszuschuss = calculateTilgungszuschussBetrag({
        darlehensbetrag: credit.summeDarlehen,
        foerderfaehigerAnteilProzent: credit.foerderfaehigerAnteilProzent ?? 0,
        tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
      });
      const rueckzahlungsRelevanterBetrag = Math.max(
        0,
        credit.summeDarlehen - tilgungszuschuss,
      );
      const monthlyRate = calculateMonthlyRate({
        darlehensbetrag: rueckzahlungsRelevanterBetrag,
        effzins: credit.effektiverZinssatz,
        tilgungssatz: credit.tilgungssatz,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });
      const key = `credit_${slugifyKey(credit.name)}`;
      return {
        key,
        label: credit.name,
        color: getCreditSeriesColorByIndex(index + 1),
        restschuldAt: (year: number) => {
          const baseYears = Math.min(year, credit.zinsbindung);
          const baseRest = calculateRestschuld({
            nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
            monthlyRate,
            effZins: credit.effektiverZinssatz,
            years: baseYears,
            tilgungsfreieZeit: credit.tilgungsFreieZeit,
            rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
          });
          if (!options.includeRefinancing || year <= credit.zinsbindung) {
            return baseRest;
          }
          const restAtBinding = calculateRestschuld({
            nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
            monthlyRate,
            effZins: credit.effektiverZinssatz,
            years: credit.zinsbindung,
            tilgungsfreieZeit: credit.tilgungsFreieZeit,
            rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
          });
          const refinancing = getRefinancingSegment({
            principal: restAtBinding,
            startYear: credit.zinsbindung,
            effzins: values.effzins,
            tilgungssatz: values.tilgungssatz,
            horizonYears: options.analysisHorizonYears,
          });
          if (!refinancing) return baseRest;
          const refinanceYears =
            Math.min(year, refinancing.endYear) - credit.zinsbindung;
          if (refinanceYears <= 0) return restAtBinding;
          return calculateRestschuld({
            nettodarlehensbetrag: restAtBinding,
            monthlyRate: refinancing.monthlyRate,
            effZins: values.effzins,
            years: refinanceYears,
          });
        },
      };
    }),
  ];

  const chartData = Array.from({ length: maxYears + 1 }, (_, index) => {
    const year = index;
    const row: Record<string, number> & { year: number } = { year };
    creditSeries.forEach((series) => {
      row[series.key] = series.restschuldAt(year);
    });
    return row;
  });

  const chartConfig = creditSeries.reduce((acc, series) => {
    acc[series.key] = {
      label: series.label,
      color: series.color,
    };
    return acc;
  }, {} as ChartConfig);

  return {
    chartData,
    chartConfig,
    creditSeries,
  };
}

function calculateDetailMonthlyRateStack(
  values: ScenarioValues,
  maxYears: number,
  options: CalculationOptions,
) {
  const credits = Object.values(values.credits ?? {});
  const nettoDarlehensbetragBank =
    values.kaufpreis +
    values.modernisierungskosten +
    values.kaufpreis * 0.1207 -
    values.eigenkapital -
    credits.reduce((acc, credit) => acc + credit.summeDarlehen, 0);

  const bankRate = calculateMonthlyRate({
    darlehensbetrag: nettoDarlehensbetragBank,
    effzins: values.effzins,
    tilgungssatz: values.tilgungssatz,
  });

  const creditSeries = [
    {
      key: "bank",
      label: "Bankkredit",
      color: getCreditSeriesColorByIndex(0),
      monthlyRateAt: (year: number) => {
        if (year <= values.zinsbindung) return bankRate;
        if (!options.includeRefinancing) return 0;
        const restAtBinding = calculateRestschuld({
          nettodarlehensbetrag: nettoDarlehensbetragBank,
          monthlyRate: bankRate,
          effZins: values.effzins,
          years: values.zinsbindung,
        });
        const refinancing = getRefinancingSegment({
          principal: restAtBinding,
          startYear: values.zinsbindung,
          effzins: values.effzins,
          tilgungssatz: values.tilgungssatz,
          horizonYears: options.analysisHorizonYears,
        });
        if (!refinancing) return 0;
        return year <= refinancing.endYear ? refinancing.monthlyRate : 0;
      },
    },
    ...credits.map((credit, index) => {
      const key = `credit_${slugifyKey(credit.name)}`;
      const segments: Array<{
        startYear: number;
        endYear: number;
        monthlyRate: number;
      }> = credit.rates.map((rate) => ({
        startYear: rate.startYear,
        endYear: Math.min(rate.endYear, credit.zinsbindung),
        monthlyRate: rate.rate,
      }));

      if (options.includeRefinancing) {
        const tilgungszuschuss = calculateTilgungszuschussBetrag({
          darlehensbetrag: credit.summeDarlehen,
          foerderfaehigerAnteilProzent:
            credit.foerderfaehigerAnteilProzent ?? 0,
          tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
        });
        const principal = Math.max(0, credit.summeDarlehen - tilgungszuschuss);
        const monthlyRate = calculateMonthlyRate({
          darlehensbetrag: principal,
          effzins: credit.effektiverZinssatz,
          tilgungssatz: credit.tilgungssatz,
          rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
        });
        const restAtBinding = calculateRestschuld({
          nettodarlehensbetrag: principal,
          monthlyRate,
          effZins: credit.effektiverZinssatz,
          years: credit.zinsbindung,
          tilgungsfreieZeit: credit.tilgungsFreieZeit,
          rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
        });
        const refinancing = getRefinancingSegment({
          principal: restAtBinding,
          startYear: credit.zinsbindung,
          effzins: values.effzins,
          tilgungssatz: values.tilgungssatz,
          horizonYears: options.analysisHorizonYears,
        });
        if (refinancing) {
          segments.push({
            startYear: credit.zinsbindung,
            endYear: refinancing.endYear,
            monthlyRate: refinancing.monthlyRate,
          });
        }
      }

      return {
        key,
        label: credit.name,
        color: getCreditSeriesColorByIndex(index + 1),
        monthlyRateAt: (year: number) =>
          segments.reduce((sum, segment) => {
            const isActive =
              segment.startYear < year && segment.endYear >= year;
            return isActive ? sum + segment.monthlyRate : sum;
          }, 0),
      };
    }),
  ];

  const chartData = Array.from({ length: maxYears + 1 }, (_, index) => {
    const year = index;
    const row: Record<string, number> & { year: number } = { year };
    creditSeries.forEach((series) => {
      row[series.key] = series.monthlyRateAt(year);
    });
    return row;
  });

  const chartConfig = creditSeries.reduce((acc, series) => {
    acc[series.key] = {
      label: series.label,
      color: series.color,
    };
    return acc;
  }, {} as ChartConfig);

  return {
    chartData,
    chartConfig,
    creditSeries,
  };
}

export default function FinanzplanPage() {
  const scenarios = useAtomValue(scenariosAtom);
  const scenarioValues = useAtomValue(scenarioValuesAtom);
  const includeRefinancing = useAtomValue(includeRefinancingAtom);
  const [activeScenarioId] = useAtom(activeScenarioIdAtom);
  const calculationOptions = useMemo(
    () => ({
      includeRefinancing,
      analysisHorizonYears,
    }),
    [includeRefinancing],
  );
  const scenarioList = useMemo(
    () => Object.values(scenarios).sort((a, b) => a.createdAt - b.createdAt),
    [scenarios],
  );
  const [selectedScenarioIds, setSelectedScenarioIds] = useAtom(
    comparedScenarioIdsAtom,
  );
  const [detailScenarioId, setDetailScenarioId] = useState<string>("");

  useEffect(() => {
    if (scenarioList.length === 0) return;
    const validIds = new Set(scenarioList.map((scenario) => scenario.id));
    setSelectedScenarioIds((prev) => {
      const cleaned = prev.filter((id) => validIds.has(id));
      if (cleaned.length > 0) return cleaned;
      const defaults = [activeScenarioId, defaultScenarioId].filter(
        (id, index, arr) => validIds.has(id) && arr.indexOf(id) === index,
      );
      return defaults.length > 0 ? defaults : [scenarioList[0]!.id];
    });
  }, [activeScenarioId, scenarioList, setSelectedScenarioIds]);

  useEffect(() => {
    if (scenarioList.length === 0) return;
    const validIds = new Set(scenarioList.map((scenario) => scenario.id));
    setDetailScenarioId((prev) => {
      if (prev && validIds.has(prev)) return prev;
      if (validIds.has(activeScenarioId)) return activeScenarioId;
      if (validIds.has(defaultScenarioId)) return defaultScenarioId;
      return scenarioList[0]!.id;
    });
  }, [activeScenarioId, scenarioList]);

  const detailValues =
    scenarioValues[detailScenarioId] ??
    scenarioValues[defaultScenarioId] ??
    defaultScenarioValues;
  const { kreditRows, finanzplanRows, maturityEvents } = useMemo(
    () => calculateScenarioFinanzplan(detailValues, calculationOptions),
    [calculationOptions, detailValues],
  );

  const comparisonRows = useMemo(
    () =>
      selectedScenarioIds
        .map((id) => {
          const scenario = scenarios[id];
          const values = scenarioValues[id];
          if (!scenario || !values) return null;
          const result = calculateScenarioFinanzplan(
            values,
            calculationOptions,
          );
          const summary =
            result.finanzplanRows[result.finanzplanRows.length - 1];
          if (!summary) return null;
          return {
            id,
            name: scenario.name,
            ...summary,
          };
        })
        .filter((row) => row !== null),
    [calculationOptions, scenarios, scenarioValues, selectedScenarioIds],
  );

  const maxComparisonYears = useMemo(
    () => Math.max(1, ...comparisonRows.map((row) => row.stichtag)),
    [comparisonRows],
  );

  const chartConfig = useMemo(() => {
    return comparisonRows.reduce((config, row) => {
      config[row.id] = {
        label: row.name,
        color: scenarios[row.id]?.color ?? "#a3a3a3",
      };
      return config;
    }, {} as ChartConfig);
  }, [comparisonRows, scenarios]);

  const chartData = useMemo(() => {
    const perScenarioSeries = comparisonRows.map((row) => {
      const values = scenarioValues[row.id] ?? defaultScenarioValues;
      return {
        id: row.id,
        series: calculateScenarioMonthlyRateSeries(
          values,
          maxComparisonYears,
          calculationOptions,
        ),
      };
    });

    return Array.from({ length: maxComparisonYears }, (_, index) => {
      const year = index + 1;
      const row: Record<string, number> & { year: number } = { year };
      perScenarioSeries.forEach((scenarioSeries) => {
        row[scenarioSeries.id] = scenarioSeries.series[index]?.monthlyRate ?? 0;
      });
      return row;
    });
  }, [calculationOptions, comparisonRows, maxComparisonYears, scenarioValues]);

  const comparisonBaseId = useMemo(() => {
    if (selectedScenarioIds.includes(defaultScenarioId))
      return defaultScenarioId;
    return selectedScenarioIds[0] ?? null;
  }, [selectedScenarioIds]);

  const comparisonBaseRow = useMemo(() => {
    if (!comparisonBaseId) return null;
    return comparisonRows.find((row) => row.id === comparisonBaseId) ?? null;
  }, [comparisonRows, comparisonBaseId]);

  function renderDelta(value: number, baseValue: number) {
    const delta = value - baseValue;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${formatNumber(delta)} €`;
  }

  function toggleScenarioForComparison(scenarioId: string) {
    setSelectedScenarioIds((prev) => {
      if (prev.includes(scenarioId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== scenarioId);
      }
      return [...prev, scenarioId];
    });
  }

  function getScenarioAccentColor(scenarioId: string) {
    if (!selectedScenarioIds.includes(scenarioId)) return null;
    return scenarios[scenarioId]?.color ?? "#a3a3a3";
  }

  function getStableScenarioColor(scenarioId: string) {
    return scenarios[scenarioId]?.color ?? "#a3a3a3";
  }

  const detailAccentColor = getStableScenarioColor(detailScenarioId);
  const detailMaxYears = useMemo(
    () => Math.max(1, ...finanzplanRows.map((row) => row.stichtag)),
    [finanzplanRows],
  );
  const detailRestschuldChart = useMemo(
    () =>
      calculateDetailRestschuldStack(
        detailValues,
        detailMaxYears,
        calculationOptions,
      ),
    [calculationOptions, detailValues, detailMaxYears],
  );
  const detailMonthlyRateChart = useMemo(
    () =>
      calculateDetailMonthlyRateStack(
        detailValues,
        detailMaxYears,
        calculationOptions,
      ),
    [calculationOptions, detailValues, detailMaxYears],
  );
  const maturityByYear = useMemo(() => {
    const grouped = new Map<number, number>();
    maturityEvents.forEach((event) => {
      grouped.set(
        event.dueYear,
        (grouped.get(event.dueYear) ?? 0) + event.dueAmount,
      );
    });
    return Array.from(grouped.entries())
      .map(([dueYear, dueAmount]) => ({ dueYear, dueAmount }))
      .sort((a, b) => a.dueYear - b.dueYear);
  }, [maturityEvents]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2 md:max-w-4xl md:px-4 lg:max-w-6xl">
      <Card className="w-full">
        <CardContent className="space-y-3">
          <TopNav />
          <p className="text-xs text-neutral-600">
            {includeRefinancing
              ? `Anschlussfinanzierung ist aktiv: Restschulden laufen bis zu ${analysisHorizonYears} Jahren mit Bankkonditionen weiter.`
              : "Anschlussfinanzierung ist aus: Restschulden bleiben am Ende der Zinsbindung faellig."}
          </p>
          <div className="rounded-md border border-neutral-300 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-black">
                Szenarien vergleichen
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {scenarioList.map((scenario) => {
                const selected = selectedScenarioIds.includes(scenario.id);
                const accentColor = getScenarioAccentColor(scenario.id);
                return (
                  <button
                    type="button"
                    key={scenario.id}
                    onClick={() => toggleScenarioForComparison(scenario.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                      selected
                        ? "border-2 bg-white text-black"
                        : "border-neutral-300 bg-white text-neutral-700"
                    }`}
                    style={
                      selected && accentColor
                        ? { borderColor: accentColor }
                        : undefined
                    }
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: accentColor ?? "#a3a3a3" }}
                    />
                    {scenario.name}
                  </button>
                );
              })}
            </div>
          </div>

          <ScenarioMonthlyRateChart
            chartConfig={chartConfig}
            chartData={chartData}
            scenarioIds={comparisonRows.map((scenario) => scenario.id)}
          />

          <div className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-800">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-neutral-700 text-left text-neutral-300">
                  <th className="px-3 py-2 font-medium">Szenario</th>
                  <th className="px-3 py-2 font-medium">Stichtag</th>
                  <th className="px-3 py-2 font-medium">Bisher bezahlt</th>
                  <th className="px-3 py-2 font-medium">Bisher getilgt</th>
                  <th className="px-3 py-2 font-medium">Noch offen</th>
                  <th className="px-3 py-2 font-medium">Bisher Zinsen</th>
                  <th className="px-3 py-2 font-medium">Ø Zinsen / Monat</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-700/60">
                    <td className="px-3 py-2 text-neutral-100">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              chartConfig[row.id]?.color ?? "#a3a3a3",
                          }}
                        />
                        <span
                          className="rounded-sm border px-2 py-0.5"
                          style={{
                            borderColor:
                              chartConfig[row.id]?.color ?? "#525252",
                          }}
                        >
                          {row.name}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {row.stichtag} Jahre
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      <div>{formatNumber(row.bisherBezahltGesamt)} €</div>
                      {comparisonBaseRow && row.id !== comparisonBaseRow.id && (
                        <div className="text-xs text-neutral-400">
                          Δ{" "}
                          {renderDelta(
                            row.bisherBezahltGesamt,
                            comparisonBaseRow.bisherBezahltGesamt,
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-green-300">
                      <div>{formatNumber(row.getilgtGesamt)} €</div>
                      {comparisonBaseRow && row.id !== comparisonBaseRow.id && (
                        <div className="text-xs text-neutral-400">
                          Δ{" "}
                          {renderDelta(
                            row.getilgtGesamt,
                            comparisonBaseRow.getilgtGesamt,
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      <div>{formatNumber(row.restschuldGesamt)} €</div>
                      {comparisonBaseRow && row.id !== comparisonBaseRow.id && (
                        <div className="text-xs text-neutral-400">
                          Δ{" "}
                          {renderDelta(
                            row.restschuldGesamt,
                            comparisonBaseRow.restschuldGesamt,
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-amber-300">
                      <div>{formatNumber(row.zinsenGesamt)} €</div>
                      {comparisonBaseRow && row.id !== comparisonBaseRow.id && (
                        <div className="text-xs text-neutral-400">
                          Δ{" "}
                          {renderDelta(
                            row.zinsenGesamt,
                            comparisonBaseRow.zinsenGesamt,
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      <div>
                        {formatNumber(row.durchschnittMonatlicheZinsen)} €
                      </div>
                      {comparisonBaseRow && row.id !== comparisonBaseRow.id && (
                        <div className="text-xs text-neutral-400">
                          Δ{" "}
                          {renderDelta(
                            row.durchschnittMonatlicheZinsen,
                            comparisonBaseRow.durchschnittMonatlicheZinsen,
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {comparisonBaseRow && (
            <p className="text-xs text-neutral-600">
              Delta-Basis: {comparisonBaseRow.name}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-sm text-neutral-700">
              Details fuer Szenario:
            </label>
            <div className="relative inline-flex items-center">
              <span
                className="pointer-events-none absolute left-2 z-10 inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: detailAccentColor }}
              />
              <select
                className="h-7 min-w-44 rounded-md border-2 bg-white pr-2 pl-6 text-xs font-medium text-black"
                style={{
                  borderColor: detailAccentColor,
                }}
                value={detailScenarioId}
                onChange={(e) => setDetailScenarioId(e.target.value)}
              >
                {scenarioList.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-neutral-700">
            Einzelrechnung je Kredit bis zur jeweiligen Zinsbindung.
          </p>
          <DetailRestschuldStackChart
            restschuld={{
              chartConfig: detailRestschuldChart.chartConfig,
              chartData: detailRestschuldChart.chartData,
              seriesKeys: detailRestschuldChart.creditSeries.map(
                (series) => series.key,
              ),
            }}
            monthlyRate={{
              chartConfig: detailMonthlyRateChart.chartConfig,
              chartData: detailMonthlyRateChart.chartData,
              seriesKeys: detailMonthlyRateChart.creditSeries.map(
                (series) => series.key,
              ),
            }}
            accentColor={detailAccentColor}
          />
          <div
            className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-800"
            style={{ borderLeft: `4px solid ${detailAccentColor}` }}
          >
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr
                  className="border-b border-neutral-700 text-left"
                  style={{ color: detailAccentColor }}
                >
                  <th className="px-3 py-2 font-medium">Kredit</th>
                  <th className="px-3 py-2 font-medium">Stichtag</th>
                  <th className="px-3 py-2 font-medium">Bisher bezahlt</th>
                  <th className="px-3 py-2 font-medium">Bisher getilgt</th>
                  <th className="px-3 py-2 font-medium">Noch offen</th>
                  <th className="px-3 py-2 font-medium">Bisher Zinsen</th>
                  <th className="px-3 py-2 font-medium">Ø Zinsen / Monat</th>
                </tr>
              </thead>
              <tbody>
                {kreditRows.map((row) => (
                  <tr
                    key={`${row.name}-${row.stichtag}`}
                    className="border-b border-neutral-700/60"
                  >
                    <td className="px-3 py-2 text-neutral-100">{row.name}</td>
                    <td className="px-3 py-2 text-neutral-100">
                      {row.stichtag} Jahre
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.bisherBezahlt)} €
                    </td>
                    <td className="px-3 py-2 text-green-300">
                      {formatNumber(row.getilgt)} €
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.restschuld)} €
                    </td>
                    <td className="px-3 py-2 text-amber-300">
                      {formatNumber(row.zinsen)} €
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.durchschnittMonatlicheZinsen)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-neutral-700">
            {includeRefinancing
              ? `Je Stichtag wird inklusive Anschlussfinanzierung bis zum Horizont von ${analysisHorizonYears} Jahren gerechnet.`
              : "Je Stichtag wird pro Kredit maximal bis zu seiner Zinsbindung gerechnet. Danach bleiben die Werte eingefroren."}
          </p>
          {!includeRefinancing && maturityEvents.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-800">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-700 text-left text-neutral-300">
                    <th className="px-3 py-2 font-medium">Kredit</th>
                    <th className="px-3 py-2 font-medium">Faellig in</th>
                    <th className="px-3 py-2 font-medium">
                      Faellige Restschuld
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {maturityEvents.map((event) => (
                    <tr
                      key={`${event.name}-${event.dueYear}`}
                      className="border-b border-neutral-700/60"
                    >
                      <td className="px-3 py-2 text-neutral-100">
                        {event.name}
                      </td>
                      <td className="px-3 py-2 text-neutral-100">
                        Jahr {event.dueYear}
                      </td>
                      <td className="px-3 py-2 text-neutral-100">
                        {formatNumber(event.dueAmount)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!includeRefinancing && maturityByYear.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-800">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-700 text-left text-neutral-300">
                    <th className="px-3 py-2 font-medium">Jahr</th>
                    <th className="px-3 py-2 font-medium">Summe faellig</th>
                  </tr>
                </thead>
                <tbody>
                  {maturityByYear.map((row) => (
                    <tr
                      key={row.dueYear}
                      className="border-b border-neutral-700/60"
                    >
                      <td className="px-3 py-2 text-neutral-100">
                        {row.dueYear}
                      </td>
                      <td className="px-3 py-2 text-neutral-100">
                        {formatNumber(row.dueAmount)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div
            className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-800"
            style={{ borderLeft: `4px solid ${detailAccentColor}` }}
          >
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr
                  className="border-b border-neutral-700 text-left"
                  style={{ color: detailAccentColor }}
                >
                  <th className="px-3 py-2 font-medium">Stichtag</th>
                  <th className="px-3 py-2 font-medium">Bisher bezahlt</th>
                  <th className="px-3 py-2 font-medium">Bisher getilgt</th>
                  <th className="px-3 py-2 font-medium">Noch offen</th>
                  <th className="px-3 py-2 font-medium">Bisher Zinsen</th>
                  <th className="px-3 py-2 font-medium">Ø Zinsen / Monat</th>
                </tr>
              </thead>
              <tbody>
                {finanzplanRows.map((row) => (
                  <tr
                    key={row.stichtag}
                    className="border-b border-neutral-700/60"
                  >
                    <td className="px-3 py-2 text-neutral-100">
                      {row.stichtag} Jahre
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.bisherBezahltGesamt)} €
                    </td>
                    <td className="px-3 py-2 text-green-300">
                      {formatNumber(row.getilgtGesamt)} €
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.restschuldGesamt)} €
                    </td>
                    <td className="px-3 py-2 text-amber-300">
                      {formatNumber(row.zinsenGesamt)} €
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.durchschnittMonatlicheZinsen)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
