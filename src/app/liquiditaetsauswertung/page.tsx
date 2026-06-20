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
import { InfoLabel } from "~/components/info_hover";
import { LiquidityScenarioBar } from "~/components/liquidity_scenario_bar";
import { Card, CardContent } from "~/components/ui/card";
import { PercentInput } from "~/components/ui/percent_input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
  useDismissibleChartTooltip,
} from "~/components/ui/chart";
import { formatNumber } from "~/lib/number_fromat";
import { getMonthContributions, simulateLiquidity } from "~/lib/liquidity";
import {
  analysisHorizonYearsAtom,
  includeRefinancingAtom,
  opportunityRateAtom,
} from "~/state/analysis_settings_atom";
import { scenarioValuesAtom } from "~/state/scenario_values_atom";
import { scenariosAtom } from "~/state/scenarios_atom";
import {
  activeLiquidityScenarioValuesAtom,
  type LiquidityScenarioValues,
} from "~/state/liquidity_scenarios_atom";

const OPPORTUNITY_RATE_INFO =
  "Der Opportunitaetszins ist hier ein nominaler Zinssatz p.a. Er beschreibt, welche konservative Alternativrendite freies Kapital erzielen koennte. Inflation ist nicht separat ausgewiesen, sondern nur enthalten, wenn sie in diesem nominalen Zinssatz steckt.";

export default function LiquiditaetsauswertungPage() {
  const [values, setValues] = useAtom(activeLiquidityScenarioValuesAtom);
  const creditScenarioValues = useAtomValue(scenarioValuesAtom);
  const creditScenarios = useAtomValue(scenariosAtom);
  const includeRefinancing = useAtomValue(includeRefinancingAtom);
  const analysisHorizonYears = useAtomValue(analysisHorizonYearsAtom);
  const [opportunityRate, setOpportunityRate] = useAtom(opportunityRateAtom);

  const selectedCreditScenario =
    creditScenarioValues[values.creditScenarioId] ?? null;
  const [detail, setDetail] = useState<{
    month: string;
    type: "income" | "expense";
  } | null>(null);
  const [chartMode, setChartMode] = useState<"capitalEnd" | "net">(
    "capitalEnd",
  );
  const [isMobileChart, setIsMobileChart] = useState(false);
  const { chartRef, tooltipActive, reactivateTooltip } =
    useDismissibleChartTooltip();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobileChart(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const resultRows = useMemo(
    () =>
      simulateLiquidity(values, selectedCreditScenario, {
        includeRefinancing,
        analysisHorizonYears,
        opportunityRate,
      }),
    [
      analysisHorizonYears,
      includeRefinancing,
      opportunityRate,
      values,
      selectedCreditScenario,
    ],
  );

  const endCapital =
    resultRows[resultRows.length - 1]?.capitalEnd ?? values.startCapital;
  const minCapital = Math.min(
    values.startCapital,
    ...resultRows.map((row) => row.capitalEnd),
  );
  const totalImplicitCreditCosts = resultRows.reduce(
    (sum, row) => sum + row.implicitCreditCost,
    0,
  );
  const totalCapitalInterest = resultRows.reduce(
    (sum, row) => sum + row.capitalInterest,
    0,
  );

  const detailContributions = useMemo(() => {
    if (!detail) return [];
    return getMonthContributions(values, detail.month, detail.type);
  }, [detail, values]);

  const detailSum = detailContributions.reduce(
    (sum, contribution) => sum + contribution.amount,
    0,
  );

  const liquidityChartData = useMemo(
    () =>
      resultRows.map((row) => ({
        month: row.month,
        capitalEnd: row.capitalEnd,
        net: row.net,
      })),
    [resultRows],
  );

  const liquidityChartConfig: ChartConfig = {
    capitalEnd: {
      label: "Kontostand",
      color: "#3b82f6",
    },
    net: {
      label: "Netto",
      color: "#f59e0b",
    },
  };

  function updateValues(
    update:
      | LiquidityScenarioValues
      | ((prev: LiquidityScenarioValues) => LiquidityScenarioValues),
  ) {
    setValues(update);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2 md:max-w-4xl md:px-4 lg:max-w-6xl">
      <Card className="w-full">
        <CardContent className="space-y-3">
          <TopNav />
          <LiquidityScenarioBar />

          {includeRefinancing && (
            <p className="text-xs text-neutral-600">
              Globaler Betrachtungszeitraum aktiv: {analysisHorizonYears} Jahre
              (Anschlussfinanzierung).
            </p>
          )}

          <div className="rounded-md border border-neutral-300 p-3 lg:max-w-2xl">
            <label className="text-xs text-neutral-700">
              Verknuepftes Kreditszenario
              <Select
                value={values.creditScenarioId}
                onValueChange={(value) =>
                  updateValues((prev) => ({
                    ...prev,
                    creditScenarioId: value,
                  }))
                }
              >
                <SelectTrigger className="h-9 border-neutral-300 bg-white text-black">
                  <SelectValue placeholder="Kreditszenario waehlen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(creditScenarioValues).map((scenarioId) => (
                    <SelectItem key={scenarioId} value={scenarioId}>
                      {creditScenarios[scenarioId]?.name ?? scenarioId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {!selectedCreditScenario && (
              <p className="mt-2 text-xs text-red-600">
                Das gewaehlte Kreditszenario existiert nicht mehr.
              </p>
            )}
            <div className="mt-3 max-w-44">
              <PercentInput
                value={opportunityRate}
                onChange={setOpportunityRate}
                label={
                  <InfoLabel content={OPPORTUNITY_RATE_INFO}>
                    Opportunitaetszins p.a.
                  </InfoLabel>
                }
                min={0}
                className="border-neutral-300 bg-white text-black"
              />
            </div>
            <p className="mt-1 text-xs text-neutral-600">
              Verzinst positives freies Kapital und wird konsistent fuer den
              Szenariovergleich verwendet.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm lg:max-w-2xl lg:gap-3">
            <div className="rounded-md border border-neutral-300 bg-white p-2 lg:p-4 lg:shadow-sm">
              <span className="lg:block lg:text-xs lg:font-medium lg:text-neutral-500">
                Endkapital:
              </span>{" "}
              <span
                className={
                  endCapital < 0
                    ? "lg:text-xl lg:font-semibold lg:text-red-700"
                    : "lg:text-xl lg:font-semibold lg:text-green-700"
                }
              >
                {formatNumber(endCapital)} €
              </span>
            </div>
            <div className="rounded-md border border-neutral-300 bg-white p-2 lg:p-4 lg:shadow-sm">
              <span className="lg:block lg:text-xs lg:font-medium lg:text-neutral-500">
                Minimum:
              </span>{" "}
              <span
                className={
                  minCapital < 0
                    ? "lg:text-xl lg:font-semibold lg:text-red-700"
                    : "lg:text-xl lg:font-semibold lg:text-green-700"
                }
              >
                {formatNumber(minCapital)} €
              </span>
            </div>
            <div className="rounded-md border border-neutral-300 bg-white p-2 lg:p-4 lg:shadow-sm">
              <span className="lg:block lg:text-xs lg:font-medium lg:text-neutral-500">
                Kapitalertrag:
              </span>{" "}
              <span className="lg:text-xl lg:font-semibold lg:text-green-700">
                {formatNumber(totalCapitalInterest)} €
              </span>
            </div>
            <div className="rounded-md border border-neutral-300 bg-white p-2 lg:p-4 lg:shadow-sm">
              <span className="lg:block lg:text-xs lg:font-medium lg:text-neutral-500">
                Implizite Kreditkosten:
              </span>{" "}
              <span className="lg:text-xl lg:font-semibold lg:text-amber-700">
                {formatNumber(totalImplicitCreditCosts)} €
              </span>
            </div>
          </div>

          <div className="rounded-md border border-neutral-700 bg-neutral-800 p-2 sm:p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-neutral-100">
                {chartMode === "capitalEnd"
                  ? "Kontostand ueber Zeit"
                  : "Netto ueber Zeit"}
              </p>
              <div className="inline-flex items-center rounded-md border border-neutral-600 bg-neutral-900 p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded px-2 py-1 ${
                    chartMode === "capitalEnd"
                      ? "bg-neutral-100 text-black"
                      : "text-neutral-200"
                  }`}
                  onClick={() => setChartMode("capitalEnd")}
                >
                  Kontostand
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 ${
                    chartMode === "net"
                      ? "bg-neutral-100 text-black"
                      : "text-neutral-200"
                  }`}
                  onClick={() => setChartMode("net")}
                >
                  Netto
                </button>
              </div>
            </div>
            <ChartContainer
              ref={chartRef}
              config={liquidityChartConfig}
              className="h-52 w-full sm:h-72"
              onMouseMove={reactivateTooltip}
              onTouchStart={reactivateTooltip}
            >
              <LineChart
                data={liquidityChartData}
                margin={{
                  left: isMobileChart ? 0 : 8,
                  right: isMobileChart ? 2 : 8,
                  top: 8,
                  bottom: 8,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={isMobileChart ? 42 : 28}
                  tick={{ fontSize: isMobileChart ? 10 : 12 }}
                />
                <YAxis
                  width={isMobileChart ? 58 : 96}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={isMobileChart ? 4 : 8}
                  tick={{ fontSize: isMobileChart ? 10 : 12 }}
                  tickCount={isMobileChart ? 4 : 5}
                  tickFormatter={(value) => {
                    const numeric = Number(value);
                    if (isMobileChart && Math.abs(numeric) >= 1_000) {
                      return `${(numeric / 1_000).toLocaleString("de-DE", {
                        maximumFractionDigits: 0,
                      })} T€`;
                    }
                    return `${Math.round(numeric).toLocaleString("de-DE")} €`;
                  }}
                />
                <Tooltip
                  active={tooltipActive}
                  content={<ChartTooltipContent />}
                />
                <Line
                  dataKey={chartMode}
                  type="monotone"
                  stroke={`var(--color-${chartMode})`}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </div>

          <div className="max-h-[650px] overflow-auto rounded-md border border-neutral-300 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 bg-white text-left">
                  <th className="px-2 py-1">Monat</th>
                  <th className="px-2 py-1">Einnahmen</th>
                  <th className="px-2 py-1">Ausgaben</th>
                  <th className="px-2 py-1">Kreditrate</th>
                  <th className="px-2 py-1">Impl. Kosten</th>
                  <th className="px-2 py-1">Kapitalzins</th>
                  <th className="px-2 py-1">Netto</th>
                  <th className="px-2 py-1">Kontostand</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((row) => (
                  <tr key={row.month} className="border-t border-neutral-200">
                    <td className="px-2 py-1">{row.month}</td>
                    <td className="px-2 py-1 text-green-700">
                      <button
                        type="button"
                        className="underline decoration-dotted"
                        onClick={() =>
                          setDetail({ month: row.month, type: "income" })
                        }
                      >
                        {formatNumber(row.income)} €
                      </button>
                    </td>
                    <td className="px-2 py-1 text-red-700">
                      <button
                        type="button"
                        className="underline decoration-dotted"
                        onClick={() =>
                          setDetail({ month: row.month, type: "expense" })
                        }
                      >
                        {formatNumber(row.expense)} €
                      </button>
                    </td>
                    <td className="px-2 py-1">
                      {formatNumber(row.creditRate)} €
                    </td>
                    <td className="px-2 py-1 text-amber-700">
                      {formatNumber(row.implicitCreditCost)} €
                    </td>
                    <td className="px-2 py-1 text-green-700">
                      {formatNumber(row.capitalInterest)} €
                    </td>
                    <td
                      className={`px-2 py-1 ${row.net >= 0 ? "text-green-700" : "text-red-700"}`}
                    >
                      {formatNumber(row.net)} €
                    </td>
                    <td
                      className={`px-2 py-1 ${
                        row.capitalEnd >= 0
                          ? "text-neutral-900"
                          : "font-semibold text-red-700"
                      }`}
                    >
                      {formatNumber(row.capitalEnd)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Dialog
            open={detail !== null}
            onOpenChange={(open) => !open && setDetail(null)}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {detail?.type === "income" ? "Einnahmen" : "Ausgaben"} im
                  Monat {detail?.month}
                </DialogTitle>
              </DialogHeader>

              {detailContributions.length === 0 ? (
                <p className="text-sm text-neutral-600">
                  Keine Positionen in diesem Monat.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-md border border-neutral-300 bg-neutral-50 p-2 text-sm">
                    Summe: {formatNumber(detailSum)} €
                  </div>
                  <div className="max-h-80 overflow-auto rounded-md border border-neutral-300">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="sticky top-0 bg-white text-left">
                          <th className="px-2 py-1">Position</th>
                          <th className="px-2 py-1">Quelle</th>
                          <th className="px-2 py-1">Betrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailContributions.map((entry) => (
                          <tr
                            key={entry.itemId}
                            className="border-t border-neutral-200"
                          >
                            <td className="px-2 py-1">{entry.name}</td>
                            <td className="px-2 py-1">
                              {entry.source === "override"
                                ? "Monatswert"
                                : "Standard"}
                            </td>
                            <td className="px-2 py-1">
                              {formatNumber(entry.amount)} €
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </main>
  );
}
