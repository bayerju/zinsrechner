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
