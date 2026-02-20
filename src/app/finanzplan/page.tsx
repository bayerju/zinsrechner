"use client";

import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TopNav } from "~/components/top_nav";
import { Card, CardContent } from "~/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import {
  calculateMonthlyRate,
  calculateRestschuld,
  calculateTilgungszuschussBetrag,
} from "~/lib/calculations";
import { type Credit } from "~/lib/credit";
import { formatNumber } from "~/lib/number_fromat";
import {
  activeScenarioIdAtom,
  defaultScenarioId,
  scenariosAtom,
} from "~/state/scenarios_atom";
import {
  defaultScenarioValues,
  scenarioValuesAtom,
  type ScenarioValues,
} from "~/state/scenario_values_atom";

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

function calculateScenarioFinanzplan(values: ScenarioValues): {
  kreditRows: KreditRow[];
  finanzplanRows: FinanzplanRow[];
} {
  const credits = Object.values(values.credits ?? {}) as Credit[];
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

  const kreditRows = [
    {
      name: "Bankkredit",
      stichtag: values.zinsbindung,
      bisherBezahlt: bankMonatsrate * values.zinsbindung * 12,
      restschuld: calculateRestschuld({
        nettodarlehensbetrag: nettoDarlehensbetragBank,
        monthlyRate: bankMonatsrate,
        effZins: values.effzins,
        years: values.zinsbindung,
      }),
      darlehen: nettoDarlehensbetragBank,
    },
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
      const restschuld = calculateRestschuld({
        nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
        monthlyRate,
        effZins: credit.effektiverZinssatz,
        years: credit.zinsbindung,
        tilgungsfreieZeit: credit.tilgungsFreieZeit,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });
      const bisherBezahlt = credit.rates.reduce((sum, rate) => {
        const monate = Math.max(0, rate.endYear - rate.startYear) * 12;
        return sum + rate.rate * monate;
      }, 0);

      return {
        name: credit.name,
        stichtag: credit.zinsbindung,
        bisherBezahlt,
        restschuld,
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
    ]),
  )
    .filter((years) => years > 0)
    .sort((a, b) => a - b);

  const finanzplanRows = stichtage.map((stichtag) => {
    const bankYears = Math.min(stichtag, values.zinsbindung);
    const bankBisherBezahlt = bankMonatsrate * bankYears * 12;
    const bankRestschuld = calculateRestschuld({
      nettodarlehensbetrag: nettoDarlehensbetragBank,
      monthlyRate: bankMonatsrate,
      effZins: values.effzins,
      years: bankYears,
    });
    const bankGetilgt = Math.max(0, nettoDarlehensbetragBank - bankRestschuld);
    const bankZinsen = Math.max(0, bankBisherBezahlt - bankGetilgt);

    const creditsTotals = credits.reduce(
      (acc, credit) => {
        const creditYears = Math.min(stichtag, credit.zinsbindung);
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
        const monthlyRate = calculateMonthlyRate({
          darlehensbetrag: rueckzahlungsRelevanterBetrag,
          effzins: credit.effektiverZinssatz,
          tilgungssatz: credit.tilgungssatz,
          rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
        });
        const restschuld = calculateRestschuld({
          nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
          monthlyRate,
          effZins: credit.effektiverZinssatz,
          years: creditYears,
          tilgungsfreieZeit: credit.tilgungsFreieZeit,
          rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
        });
        const bisherBezahlt = credit.rates.reduce((sum, rate) => {
          const endYearInRange = Math.min(rate.endYear, creditYears);
          if (endYearInRange <= rate.startYear) {
            return sum;
          }
          const monate = (endYearInRange - rate.startYear) * 12;
          return sum + rate.rate * monate;
        }, 0);
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
  };
}

function calculateScenarioMonthlyRateSeries(
  values: ScenarioValues,
  maxYears: number,
) {
  const credits = Object.values(values.credits ?? {}) as Credit[];
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

  credits.forEach((credit) => {
    credit.rates.forEach((rate) => {
      segments.push({
        startYear: rate.startYear,
        endYear: Math.min(rate.endYear, credit.zinsbindung),
        rate: rate.rate,
      });
    });
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

export default function FinanzplanPage() {
  const scenarios = useAtomValue(scenariosAtom);
  const scenarioValues = useAtomValue(scenarioValuesAtom);
  const [activeScenarioId] = useAtom(activeScenarioIdAtom);
  const scenarioList = useMemo(
    () => Object.values(scenarios).sort((a, b) => a.createdAt - b.createdAt),
    [scenarios],
  );
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);

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
  }, [activeScenarioId, scenarioList]);

  const activeValues =
    scenarioValues[activeScenarioId] ??
    scenarioValues[defaultScenarioId] ??
    defaultScenarioValues;
  const { kreditRows, finanzplanRows } = useMemo(
    () => calculateScenarioFinanzplan(activeValues),
    [activeValues],
  );

  const comparisonRows = useMemo(
    () =>
      selectedScenarioIds
        .map((id) => {
          const scenario = scenarios[id];
          const values = scenarioValues[id];
          if (!scenario || !values) return null;
          const result = calculateScenarioFinanzplan(values);
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
    [scenarios, scenarioValues, selectedScenarioIds],
  );

  const maxComparisonYears = useMemo(
    () => Math.max(1, ...comparisonRows.map((row) => row.stichtag)),
    [comparisonRows],
  );

  const chartConfig = useMemo(() => {
    const palette = ["#60a5fa", "#34d399", "#f59e0b", "#f472b6"];
    return comparisonRows.reduce((config, row, index) => {
      config[row.id] = {
        label: row.name,
        color: palette[index % palette.length],
      };
      return config;
    }, {} as ChartConfig);
  }, [comparisonRows]);

  const chartData = useMemo(() => {
    const perScenarioSeries = comparisonRows.map((row) => {
      const values = scenarioValues[row.id] ?? defaultScenarioValues;
      return {
        id: row.id,
        series: calculateScenarioMonthlyRateSeries(values, maxComparisonYears),
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
  }, [comparisonRows, maxComparisonYears, scenarioValues]);

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
      if (prev.length >= 4) return prev;
      return [...prev, scenarioId];
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2 md:max-w-4xl md:px-4 lg:max-w-6xl">
      <Card className="w-full">
        <CardContent className="space-y-3">
          <TopNav />
          <div className="rounded-md border border-neutral-300 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-black">
                Szenarien vergleichen
              </p>
              <span className="text-xs text-neutral-600">max. 4</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {scenarioList.map((scenario) => {
                const selected = selectedScenarioIds.includes(scenario.id);
                return (
                  <button
                    type="button"
                    key={scenario.id}
                    onClick={() => toggleScenarioForComparison(scenario.id)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-neutral-300 bg-white text-black"
                    }`}
                  >
                    {scenario.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-neutral-700 bg-neutral-800 p-3">
            <p className="mb-2 text-sm font-medium text-neutral-100">
              Monatliche Gesamt-Rate im Zeitverlauf
            </p>
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <LineChart
                data={chartData}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  label={{
                    value: "Jahr",
                    position: "insideBottom",
                    offset: -5,
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) =>
                    `${Math.round(value).toLocaleString("de-DE")} €`
                  }
                />
                <Tooltip content={<ChartTooltipContent />} />
                {comparisonRows.map((scenario) => (
                  <Line
                    key={scenario.id}
                    dataKey={scenario.id}
                    type="monotone"
                    stroke={`var(--color-${scenario.id})`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </div>

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
                    <td className="px-3 py-2 text-neutral-100">{row.name}</td>
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

          <p className="text-sm text-neutral-700">
            Detailtabellen unten zeigen das aktuell aktive Szenario.
          </p>
          <p className="text-sm text-neutral-700">
            Einzelrechnung je Kredit bis zur jeweiligen Zinsbindung.
          </p>
          <div className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-800">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-neutral-700 text-left text-neutral-300">
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
            Je Stichtag wird pro Kredit maximal bis zu seiner Zinsbindung
            gerechnet. Danach bleiben die Werte eingefroren (ohne
            Anschlussfinanzierung).
          </p>
          <div className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-neutral-700 text-left text-neutral-300">
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
