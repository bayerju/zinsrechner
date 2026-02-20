export const SCENARIO_COLOR_PALETTE = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#22d3ee",
  "#f97316",
  "#84cc16",
];

export const CREDIT_SERIES_COLOR_PALETTE = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#f97316", // orange
  "#14b8a6", // teal
  "#eab308", // yellow
  "#a855f7", // purple
];

export const defaultScenarioColor = SCENARIO_COLOR_PALETTE[0] ?? "#60a5fa";

export function getNextScenarioColor(existingColors: string[]): string {
  const used = new Set(existingColors.map((color) => color.toLowerCase()));

  for (const color of SCENARIO_COLOR_PALETTE) {
    if (!used.has(color.toLowerCase())) {
      return color;
    }
  }

  let step = existingColors.length;
  while (step < existingColors.length + 720) {
    const hue = Math.round((step * 137.508) % 360);
    const generated = `hsl(${hue} 70% 55%)`;
    if (!used.has(generated.toLowerCase())) {
      return generated;
    }
    step += 1;
  }

  return defaultScenarioColor;
}

export function getCreditSeriesColorByIndex(index: number): string {
  if (index < CREDIT_SERIES_COLOR_PALETTE.length) {
    return CREDIT_SERIES_COLOR_PALETTE[index] ?? "#3b82f6";
  }

  const hue = Math.round((index * 137.508) % 360);
  const lightness = index % 2 === 0 ? 52 : 62;
  return `hsl(${hue} 78% ${lightness}%)`;
}
