import { describe, expect, test } from "vitest";
import { parseBackupJson } from "../../src/lib/backup_import";

describe("backup import", () => {
  test("parses exported backups with nested storage", () => {
    const raw = JSON.stringify({
      version: 1,
      app: "zinsrechner",
      storage: {
        scenarios: JSON.stringify({
          basis: { id: "basis", name: "Basis", createdAt: 0, color: "#60a5fa" },
        }),
        activeScenarioId: JSON.stringify("basis"),
        scenarioValues: JSON.stringify({
          basis: {
            effzins: 3.8,
            kaufpreis: 235000,
            modernisierungskosten: 200000,
            eigenkapital: 0,
            tilgungssatz: 2,
            zinsbindung: 10,
            credits: {
              bank: { name: "Bank", summeDarlehen: 100000 },
            },
          },
        }),
        liquidityScenarios: JSON.stringify({
          "liquidity-basis": {
            id: "liquidity-basis",
            name: "Basis",
            createdAt: 0,
            color: "#60a5fa",
          },
        }),
        liquidityScenarioValues: JSON.stringify({
          "liquidity-basis": {
            startCapital: 30000,
            startMonth: "2026-04",
            horizonMonths: 120,
            creditScenarioId: "basis",
            items: [
              {
                id: "salary",
                name: "Gehalt",
                type: "income",
                defaultAmount: 3000,
                frequency: "monthly",
                startMonth: "2026-01",
                overrides: {},
                labels: [],
              },
            ],
          },
        }),
      },
    });

    const parsed = parseBackupJson(raw, "target-project");

    expect(parsed.financing).toHaveLength(1);
    expect(parsed.financing[0]?.scenario.projectId).toBe("target-project");
    expect(parsed.financing[0]?.credits).toHaveLength(1);
    expect(parsed.liquidity).toHaveLength(1);
    expect(parsed.liquidity[0]?.items).toHaveLength(1);
  });

  test("serializes imported credit keys for Convex", () => {
    const raw = JSON.stringify({
      storage: {
        scenarios: JSON.stringify({
          basis: { id: "basis", name: "Basis", createdAt: 0, color: "#60a5fa" },
        }),
        activeScenarioId: JSON.stringify("basis"),
        scenarioValues: JSON.stringify({
          basis: {
            effzins: 3.8,
            kaufpreis: 235000,
            modernisierungskosten: 200000,
            eigenkapital: 0,
            tilgungssatz: 2,
            zinsbindung: 10,
            credits: {
              bank: {
                name: "Bank",
                summeDarlehen: 100000,
                rückzahlungsfreieZeit: 2,
              },
            },
          },
        }),
      },
    });

    const parsed = parseBackupJson(raw, "target-project");
    const data = parsed.financing[0]?.credits[0]?.data as Record<
      string,
      unknown
    >;

    expect(data.rückzahlungsfreieZeit).toBeUndefined();
    expect(data.rueckzahlungsfreieZeit).toBe(2);
  });
});
