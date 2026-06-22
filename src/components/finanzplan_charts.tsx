"use client";

import * as React from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
  useDismissibleChartTooltip,
} from "~/components/ui/chart";

type YearRow = Record<string, number> & { year: number };
type OpportunityRateRow = Record<string, number> & { opportunityRate: number };

function useMobileChart() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function formatAxisEuro(
  value: number,
  compact: boolean,
  options?: { noBreak?: boolean },
) {
  if (compact && Math.abs(value) >= 1_000) {
    const shortened = value / 1_000;
    const formatted = shortened.toLocaleString("de-DE", {
      maximumFractionDigits: shortened < 10 ? 1 : 0,
    });
    return options?.noBreak ? `${formatted}T€` : `${formatted} T€`;
  }
  return `${Math.round(value).toLocaleString("de-DE")} €`;
}

export function ScenarioMonthlyRateChart({
  chartConfig,
  chartData,
  presentValueCostData,
  scenarioIds,
  singleScenarioMonthlyRate,
}: {
  chartConfig: ChartConfig;
  chartData: YearRow[];
  presentValueCostData: OpportunityRateRow[];
  scenarioIds: string[];
  singleScenarioMonthlyRate?: {
    chartConfig: ChartConfig;
    chartData: YearRow[];
    seriesKeys: string[];
  };
}) {
  const [mode, setMode] = React.useState<"monthlyRate" | "presentValueCost">(
    "monthlyRate",
  );
  const isMobile = useMobileChart();
  const { chartRef, tooltipActive, reactivateTooltip } =
    useDismissibleChartTooltip();
  const activeData = mode === "monthlyRate" ? chartData : presentValueCostData;
  const showSingleScenarioStack =
    mode === "monthlyRate" && singleScenarioMonthlyRate !== undefined;
  const activeConfig = showSingleScenarioStack
    ? singleScenarioMonthlyRate.chartConfig
    : chartConfig;

  return (
    <div className="rounded-md border border-neutral-700 bg-neutral-800 p-2 sm:p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-neutral-100">
          {mode === "monthlyRate"
            ? "Monatliche Gesamt-Rate im Zeitverlauf"
            : "Barwertkosten nach Opportunitaetszins"}
        </p>
        <div className="inline-flex items-center rounded-md border border-neutral-600 bg-neutral-900 p-0.5 text-xs">
          <button
            type="button"
            className={`rounded px-2 py-1 ${
              mode === "monthlyRate"
                ? "bg-neutral-100 text-black"
                : "text-neutral-200"
            }`}
            onClick={() => setMode("monthlyRate")}
          >
            Monatsrate
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 ${
              mode === "presentValueCost"
                ? "bg-neutral-100 text-black"
                : "text-neutral-200"
            }`}
            onClick={() => setMode("presentValueCost")}
          >
            Barwertkosten
          </button>
        </div>
      </div>
      <ChartContainer
        ref={chartRef}
        config={activeConfig}
        className="h-52 w-full sm:h-72"
        onMouseMove={reactivateTooltip}
        onTouchStart={reactivateTooltip}
      >
        {showSingleScenarioStack ? (
          <AreaChart
            data={singleScenarioMonthlyRate.chartData}
            margin={{
              left: isMobile ? 0 : 8,
              right: isMobile ? 2 : 8,
              top: 8,
              bottom: 8,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={isMobile ? 20 : 8}
              tick={{ fontSize: isMobile ? 11 : 12 }}
              label={{ value: "Jahr", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              width={isMobile ? 54 : 96}
              tickLine={false}
              axisLine={false}
              tickMargin={isMobile ? 4 : 8}
              tick={{ fontSize: isMobile ? 11 : 12 }}
              tickCount={isMobile ? 4 : 5}
              tickFormatter={(value) => {
                const numeric =
                  typeof value === "number" ? value : Number(value);
                return formatAxisEuro(numeric, isMobile);
              }}
            />
            <Tooltip
              active={tooltipActive}
              content={
                <StackedCreditTooltip
                  chartConfig={singleScenarioMonthlyRate.chartConfig}
                />
              }
            />
            {singleScenarioMonthlyRate.seriesKeys.map((key) => (
              <Area
                key={key}
                dataKey={key}
                type="monotone"
                stackId="monthlyRate"
                stroke={`var(--color-${key})`}
                fill={`var(--color-${key})`}
                fillOpacity={0.25}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart
            data={activeData}
            margin={{
              left: isMobile ? 0 : 8,
              right: isMobile ? 2 : 8,
              top: 8,
              bottom: 8,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={mode === "monthlyRate" ? "year" : "opportunityRate"}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={isMobile ? 20 : 8}
              tick={{ fontSize: isMobile ? 11 : 12 }}
              tickFormatter={(value) =>
                mode === "monthlyRate" ? String(value) : `${value} %`
              }
              label={{
                value: mode === "monthlyRate" ? "Jahr" : "Opportunitaetszins",
                position: "insideBottom",
                offset: -5,
              }}
            />
            <YAxis
              width={isMobile ? 54 : 96}
              tickLine={false}
              axisLine={false}
              tickMargin={isMobile ? 4 : 8}
              tick={{ fontSize: isMobile ? 11 : 12 }}
              tickCount={isMobile ? 4 : 5}
              tickFormatter={(value) => {
                const numeric =
                  typeof value === "number" ? value : Number(value);
                return formatAxisEuro(numeric, isMobile);
              }}
            />
            <Tooltip active={tooltipActive} content={<ChartTooltipContent />} />
            {scenarioIds.map((scenarioId) => (
              <Line
                key={scenarioId}
                dataKey={scenarioId}
                type="monotone"
                stroke={`var(--color-${scenarioId})`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        )}
      </ChartContainer>
    </div>
  );
}

function StackedCreditTooltip({
  active,
  payload,
  label,
  chartConfig,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number;
    color?: string;
  }>;
  label?: string | number;
  chartConfig: ChartConfig;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  return (
    <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 shadow-md">
      <div className="mb-1 font-medium text-neutral-200">Jahr {label}</div>
      <div className="mb-1 border-b border-neutral-700 pb-1 font-semibold text-white">
        Gesamt: {Math.round(total).toLocaleString("de-DE")} €
      </div>
      <div className="space-y-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? "");
          const labelText = chartConfig[key]?.label ?? key;
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color ?? "#fff" }}
                />
                <span>{labelText}</span>
              </div>
              <span>
                {Math.round(Number(item.value ?? 0)).toLocaleString("de-DE")} €
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DetailRestschuldStackChart({
  restschuld,
  monthlyRate,
  accentColor,
}: {
  restschuld: {
    chartConfig: ChartConfig;
    chartData: YearRow[];
    seriesKeys: string[];
  };
  monthlyRate: {
    chartConfig: ChartConfig;
    chartData: YearRow[];
    seriesKeys: string[];
  };
  accentColor: string;
}) {
  const [mode, setMode] = React.useState<"restschuld" | "rate">("restschuld");
  const isMobile = useMobileChart();
  const { chartRef, tooltipActive, reactivateTooltip } =
    useDismissibleChartTooltip();
  const active = mode === "restschuld" ? restschuld : monthlyRate;

  return (
    <div
      className="min-w-0 overflow-hidden rounded-md border border-neutral-700 bg-neutral-800 p-2 sm:p-3"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium" style={{ color: accentColor }}>
          {mode === "restschuld"
            ? "Restschuld ueber Zeit (aufgeteilt nach Krediten)"
            : "Monatliche Rate ueber Zeit (aufgeteilt nach Krediten)"}
        </p>
        <div className="inline-flex items-center rounded-md border border-neutral-600 bg-neutral-900 p-0.5 text-xs">
          <button
            type="button"
            className={`rounded px-2 py-1 ${
              mode === "restschuld"
                ? "bg-neutral-100 text-black"
                : "text-neutral-200"
            }`}
            onClick={() => setMode("restschuld")}
          >
            Restschuld
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 ${
              mode === "rate" ? "bg-neutral-100 text-black" : "text-neutral-200"
            }`}
            onClick={() => setMode("rate")}
          >
            Monatsrate
          </button>
        </div>
      </div>
      <ChartContainer
        ref={chartRef}
        config={active.chartConfig}
        className="h-52 w-full min-w-0 overflow-hidden sm:h-72"
        onMouseMove={reactivateTooltip}
        onTouchStart={reactivateTooltip}
      >
        <AreaChart
          data={active.chartData}
          margin={{
            left: isMobile ? 0 : 8,
            right: isMobile ? 0 : 8,
            top: 8,
            bottom: 8,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={isMobile ? 20 : 8}
            tick={{ fontSize: isMobile ? 11 : 12 }}
            label={{ value: "Jahr", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            width={isMobile ? 48 : 96}
            tickLine={false}
            axisLine={false}
            tickMargin={isMobile ? 2 : 8}
            tick={{ fontSize: isMobile ? 10 : 12 }}
            tickCount={isMobile ? 4 : 5}
            tickFormatter={(value) => {
              const numeric = typeof value === "number" ? value : Number(value);
              return formatAxisEuro(numeric, isMobile, { noBreak: isMobile });
            }}
          />
          <Tooltip
            active={tooltipActive}
            content={<StackedCreditTooltip chartConfig={active.chartConfig} />}
          />
          {active.seriesKeys.map((key) => (
            <Area
              key={key}
              dataKey={key}
              type="monotone"
              stackId="restschuld"
              stroke={`var(--color-${key})`}
              fill={`var(--color-${key})`}
              fillOpacity={0.25}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
