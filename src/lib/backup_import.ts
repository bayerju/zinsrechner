import { type Credit } from "~/lib/credit";

type FinancingImportCandidate = {
  fingerprint: string;
  scenario: {
    projectId?: string;
    scenarioId: string;
    name: string;
    createdAt: number;
    color: string;
    sollzins?: number;
    effzins: number;
    kaufpreis: number;
    modernisierungskosten: number;
    eigenkapital: number;
    tilgungssatz: number;
    zinsbindung: number;
  };
  credits: { creditId: string; data: Credit }[];
};

type LiquidityImportCandidate = {
  fingerprint: string;
  scenario: {
    projectId?: string;
    scenarioId: string;
    name: string;
    createdAt: number;
    color: string;
    startCapital: number;
    startMonth: string;
    horizonMonths: number;
    creditScenarioId: string;
  };
  items: { itemId: string; position: number; data: unknown }[];
};

type BackupScenario = {
  id: string;
  name: string;
  createdAt: number;
  color: string;
};

type BackupScenarioValues = {
  effzins: number;
  sollzins?: number;
  kaufpreis: number;
  modernisierungskosten: number;
  eigenkapital: number;
  tilgungssatz: number;
  zinsbindung: number;
  credits: Record<string, Credit>;
};

type BackupLiquidityScenario = {
  id: string;
  name: string;
  createdAt: number;
  color: string;
};

type BackupLiquidityScenarioValues = {
  startCapital: number;
  startMonth: string;
  horizonMonths: number;
  creditScenarioId: string;
  items: {
    id: string;
    name: string;
    type: string;
    defaultAmount: number;
    frequency: string;
    startMonth: string;
    endMonth?: string;
    overrides: Record<string, unknown>;
    labels: string[];
  }[];
};

type RawBackup = Record<string, string>;

function parseJsonField(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asRecord<T>(value: unknown): Record<string, T> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, T>;
  }
  return {};
}

export type ParsedBackup = {
  financing: FinancingImportCandidate[];
  liquidity: LiquidityImportCandidate[];
};

export function parseBackupJson(
  rawContent: string,
  targetProjectId: string,
): ParsedBackup {
  const raw = JSON.parse(rawContent) as RawBackup;

  const scenarios = asRecord<BackupScenario>(parseJsonField(raw.scenarios));
  const scenarioValues = asRecord<BackupScenarioValues>(
    parseJsonField(raw.scenarioValues),
  );
  const liquidityScenarios = asRecord<BackupLiquidityScenario>(
    parseJsonField(raw.liquidityScenarios),
  );
  const liquidityScenarioValues = asRecord<BackupLiquidityScenarioValues>(
    parseJsonField(raw.liquidityScenarioValues),
  );

  const topLevelScenarioValues: Partial<BackupScenarioValues> = {
    effzins: asNumber(raw.effzins),
    sollzins: raw.sollzins ? asNumber(raw.sollzins) : undefined,
    kaufpreis: asNumber(raw.kaufpreis),
    modernisierungskosten: asNumber(raw.modernisierungskosten),
    eigenkapital: asNumber(raw.eigenkapital),
    tilgungssatz: asNumber(raw.tilgungssatz),
    zinsbindung: asNumber(raw.zinsbindung),
  };

  const topLevelCredits = asRecord<Credit>(parseJsonField(raw.credits));
  const activeScenarioId = parseJsonField(raw.activeScenarioId);
  const activeScenarioIdStr =
    typeof activeScenarioId === "string" ? activeScenarioId : "basis";

  const financing: FinancingImportCandidate[] = [];

  for (const [scenarioId, scenario] of Object.entries(scenarios)) {
    const values = scenarioValues[scenarioId];
    const isTopLevel = scenarioId === activeScenarioIdStr;

    const effzins = values?.effzins ?? topLevelScenarioValues.effzins ?? 0;
    const kaufpreis =
      values?.kaufpreis ?? topLevelScenarioValues.kaufpreis ?? 0;
    const modernisierungskosten =
      values?.modernisierungskosten ??
      topLevelScenarioValues.modernisierungskosten ??
      0;
    const eigenkapital =
      values?.eigenkapital ?? topLevelScenarioValues.eigenkapital ?? 0;
    const tilgungssatz =
      values?.tilgungssatz ?? topLevelScenarioValues.tilgungssatz ?? 0;
    const zinsbindung =
      values?.zinsbindung ?? topLevelScenarioValues.zinsbindung ?? 10;
    const sollzins = values?.sollzins ?? topLevelScenarioValues.sollzins;

    const credits = isTopLevel
      ? { ...topLevelCredits, ...(values?.credits ?? {}) }
      : (values?.credits ?? {});

    const creditEntries = Object.entries(credits).map(([creditId, data]) => ({
      creditId,
      data,
    }));

    const scenarioPayload = {
      projectId: targetProjectId,
      scenarioId,
      name: scenario.name,
      createdAt: scenario.createdAt || 0,
      color: scenario.color || "#60a5fa",
      sollzins,
      effzins,
      kaufpreis,
      modernisierungskosten,
      eigenkapital,
      tilgungssatz,
      zinsbindung,
    };

    const fingerprint = JSON.stringify({
      s: scenarioPayload,
      c: creditEntries
        .map((c) => [c.creditId, c.data] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    });

    financing.push({
      fingerprint: `${scenarioId}-${fingerprint.slice(0, 60)}`,
      scenario: scenarioPayload,
      credits: creditEntries,
    });
  }

  const liquidity: LiquidityImportCandidate[] = [];

  for (const [scenarioId, scenario] of Object.entries(liquidityScenarios)) {
    const values = liquidityScenarioValues[scenarioId];
    if (!values) continue;

    const items = (values.items ?? []).map((item, index) => ({
      itemId: item.id ?? `item-${index}`,
      position: index,
      data: item,
    }));

    const scenarioPayload = {
      projectId: targetProjectId,
      scenarioId,
      name: scenario.name,
      createdAt: scenario.createdAt || 0,
      color: scenario.color || "#60a5fa",
      startCapital: values.startCapital ?? 0,
      startMonth: values.startMonth ?? "",
      horizonMonths: values.horizonMonths ?? 120,
      creditScenarioId: values.creditScenarioId ?? "basis",
    };

    const fingerprint = JSON.stringify({
      s: scenarioPayload,
      i: items.map((i) => i.data),
    });

    liquidity.push({
      fingerprint: `${scenarioId}-${fingerprint.slice(0, 60)}`,
      scenario: scenarioPayload,
      items,
    });
  }

  return { financing, liquidity };
}
