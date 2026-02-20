"use client";

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
} from "~/components/ui/chart";

type YearRow = Record<string, number> & { year: number };

export function ScenarioMonthlyRateChart({
  chartConfig,
  chartData,
  scenarioIds,
}: {
  chartConfig: ChartConfig;
  chartData: YearRow[];
  scenarioIds: string[];
}) {
  return (
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
            label={{ value: "Jahr", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            width={96}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) =>
              `${Math.round(value).toLocaleString("de-DE")} €`
            }
          />
          <Tooltip content={<ChartTooltipContent />} />
          {scenarioIds.map((scenarioId) => (
            <Line
              key={scenarioId}
              dataKey={scenarioId}
              type="monotone"
              stroke={`var(--color-${scenarioId})`}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function RestschuldStackTooltip({
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
  chartConfig,
  chartData,
  seriesKeys,
  accentColor,
}: {
  chartConfig: ChartConfig;
  chartData: YearRow[];
  seriesKeys: string[];
  accentColor: string;
}) {
  return (
    <div
      className="rounded-md border border-neutral-700 bg-neutral-800 p-3"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <p className="mb-2 text-sm font-medium" style={{ color: accentColor }}>
        Restschuld ueber Zeit (aufgeteilt nach Krediten)
      </p>
      <ChartContainer config={chartConfig} className="h-72 w-full">
        <AreaChart
          data={chartData}
          margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            label={{ value: "Jahr", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            width={96}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) =>
              `${Math.round(value).toLocaleString("de-DE")} €`
            }
          />
          <Tooltip
            content={<RestschuldStackTooltip chartConfig={chartConfig} />}
          />
          {seriesKeys.map((key) => (
            <Area
              key={key}
              dataKey={key}
              type="monotone"
              stackId="restschuld"
              stroke={`var(--color-${key})`}
              fill={`var(--color-${key})`}
              fillOpacity={0.25}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
