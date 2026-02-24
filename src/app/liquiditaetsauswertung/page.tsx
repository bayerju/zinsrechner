"use client";

import { useAtom, useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TopNav } from "~/components/top_nav";
import { LiquidityScenarioBar } from "~/components/liquidity_scenario_bar";
import { Card, CardContent } from "~/components/ui/card";
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
} from "~/components/ui/chart";
import { formatNumber } from "~/lib/number_fromat";
import { getMonthContributions, simulateLiquidity } from "~/lib/liquidity";
import {
  analysisHorizonYearsAtom,
  includeRefinancingAtom,
} from "~/state/analysis_settings_atom";
import { scenarioValuesAtom } from "~/state/scenario_values_atom";
import { scenariosAtom } from "~/state/scenarios_atom";
import {
  activeLiquidityScenarioValuesAtom,
  type LiquidityScenarioValues,
} from "~/state/liquidity_scenarios_atom";

export default function LiquiditaetsauswertungPage() {
  const [values, setValues] = useAtom(activeLiquidityScenarioValuesAtom);
  const creditScenarioValues = useAtomValue(scenarioValuesAtom);
  const creditScenarios = useAtomValue(scenariosAtom);
  const includeRefinancing = useAtomValue(includeRefinancingAtom);
  const analysisHorizonYears = useAtomValue(analysisHorizonYearsAtom);

  const selectedCreditScenario =
    creditScenarioValues[values.creditScenarioId] ?? null;
  const [detail, setDetail] = useState<{
    month: string;
    type: "income" | "expense";
  } | null>(null);
  const [chartMode, setChartMode] = useState<"capitalEnd" | "net">(
    "capitalEnd",
  );

  const resultRows = useMemo(
    () =>
      simulateLiquidity(values, selectedCreditScenario, {
        includeRefinancing,
        analysisHorizonYears,
      }),
    [analysisHorizonYears, includeRefinancing, values, selectedCreditScenario],
  );

  const endCapital =
    resultRows[resultRows.length - 1]?.capitalEnd ?? values.startCapital;
  const minCapital = Math.min(
    values.startCapital,
    ...resultRows.map((row) => row.capitalEnd),
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

          <div className="rounded-md border border-neutral-300 p-3">
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
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-neutral-300 bg-white p-2">
              Endkapital: {formatNumber(endCapital)} €
            </div>
            <div className="rounded-md border border-neutral-300 bg-white p-2">
              Minimum: {formatNumber(minCapital)} €
            </div>
          </div>

          <div className="rounded-md border border-neutral-700 bg-neutral-800 p-3">
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
              config={liquidityChartConfig}
              className="h-72 w-full"
            >
              <LineChart
                data={liquidityChartData}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={28}
                />
                <YAxis
                  width={96}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) =>
                    `${Math.round(Number(value)).toLocaleString("de-DE")} €`
                  }
                />
                <Tooltip content={<ChartTooltipContent />} />
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
