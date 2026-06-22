"use client";

import { useCallback, useRef, useState } from "react";
import {
  CopilotSidebar,
  useAgentContext,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { Plus, UploadCloud, FileText, X } from "lucide-react";
import { z } from "zod";
import {
  calculateMonthlyRateFromSollzins,
  calculateNettodarlehensbetragBank,
  calculateRestschuldFromSollzins,
} from "~/lib/calculations";
import { getNextScenarioColor } from "~/lib/scenario_colors";
import { evaluateScenario } from "~/lib/scenario_evaluation";
import { simulateLiquidity } from "~/lib/liquidity";
import { useAppState } from "~/state/app_state";
import { type ScenarioValues } from "~/state/scenario_values_atom";

type UploadedBankOffer = {
  filename: string;
  markdown: string;
  truncated: boolean;
  warnings: string[];
};

function isUploadedBankOffer(value: unknown): value is UploadedBankOffer {
  return (
    typeof value === "object" &&
    value !== null &&
    "filename" in value &&
    "markdown" in value &&
    typeof value.filename === "string" &&
    typeof value.markdown === "string"
  );
}

const scenarioChangesSchema = z
  .object({
    kaufpreis: z.number().min(0).max(10_000_000).optional(),
    modernisierungskosten: z.number().min(0).max(5_000_000).optional(),
    eigenkapital: z.number().min(0).max(10_000_000).optional(),
    sollzins: z.number().min(0).max(20).optional(),
    effzins: z.number().min(0).max(20).optional(),
    tilgungssatz: z.number().min(0).max(20).optional(),
    zinsbindung: z.number().int().min(1).max(40).optional(),
  })
  .strict();

function createScenarioId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `copilot-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function buildUniqueName(name: string, takenNames: Set<string>) {
  const trimmed = name.trim().slice(0, 80);
  const baseName = trimmed || "Copilot Szenario";
  if (!takenNames.has(baseName.toLowerCase())) return baseName;

  let i = 2;
  while (takenNames.has(`${baseName} ${i}`.toLowerCase())) {
    i += 1;
  }
  return `${baseName} ${i}`;
}

function applyScenarioChanges(
  source: ScenarioValues,
  changes: z.infer<typeof scenarioChangesSchema>,
): ScenarioValues {
  const next = {
    ...source,
    ...changes,
    credits: structuredClone(source.credits),
  };

  if (changes.sollzins !== undefined && changes.effzins === undefined) {
    next.effzins = changes.sollzins;
  }
  if (changes.effzins !== undefined && changes.sollzins === undefined) {
    next.sollzins = changes.effzins;
  }

  return next;
}

export function FinanceCopilot({ children }: { children: React.ReactNode }) {
  const app = useAppState();
  const [uploadedBankOffer, setUploadedBankOffer] =
    useState<UploadedBankOffer | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeCredits = Object.values(app.activeScenarioValues.credits ?? {});
  const bankPrincipal = calculateNettodarlehensbetragBank({
    kaufpreis: app.activeScenarioValues.kaufpreis,
    modernisierungskosten: app.activeScenarioValues.modernisierungskosten,
    kaufnebenkosten: app.activeScenarioValues.kaufpreis * 0.1207,
    eigenkapital: app.activeScenarioValues.eigenkapital,
    credits: activeCredits,
  });
  const bankMonthlyRate = calculateMonthlyRateFromSollzins({
    darlehensbetrag: bankPrincipal,
    sollzins: app.activeScenarioValues.sollzins,
    tilgungssatz: app.activeScenarioValues.tilgungssatz,
  });
  const bankResidualDebtAtBinding = calculateRestschuldFromSollzins({
    nettodarlehensbetrag: bankPrincipal,
    monthlyRate: bankMonthlyRate,
    sollzins: app.activeScenarioValues.sollzins,
    years: app.activeScenarioValues.zinsbindung,
  });
  const activeEvaluation = evaluateScenario(app.activeScenarioValues, {
    includeRefinancing: app.includeRefinancing,
    analysisHorizonYears: app.analysisHorizonYears,
    opportunityRate: app.opportunityRate,
  });
  const liquidityRows = simulateLiquidity(
    app.activeLiquidityScenarioValues,
    app.scenarioValues[app.activeLiquidityScenarioValues.creditScenarioId] ??
      null,
    {
      includeRefinancing: app.includeRefinancing,
      analysisHorizonYears: app.analysisHorizonYears,
      opportunityRate: app.opportunityRate,
    },
  );
  const lastLiquidityRow = liquidityRows.at(-1) ?? null;

  useAgentContext({
    description:
      "Aktueller Rechenkontext der Finanzierungs- und Liquiditaets-App. Keine Backend-Daten, keine Secrets, keine Convex-Funktionen.",
    value: {
      appPurpose:
        "Immobilienfinanzierung und Liquiditaetsplanung fuer Szenariovergleiche",
      formulas: [
        "Kaufnebenkosten werden hier pauschal als Kaufpreis * 12,07% gerechnet.",
        "Bank-Nettodarlehen = Kaufpreis + Modernisierungskosten + Kaufnebenkosten - Eigenkapital - Summe Zusatzkredite.",
        "Monatsrate Bankdarlehen = Darlehensbetrag * (Sollzins / 100 / 12 + Tilgungssatz / 100 / 12).",
        "Restschuld wird monatlich mit nominalem Sollzins fortgeschrieben und um die Monatsrate reduziert.",
        "Szenarioauswertung diskontiert Raten und Restschulden ueber Analysehorizont und Opportunitaetszins.",
        "Liquiditaet je Monat = Einnahmen - Ausgaben - Kreditrate - implizite Kreditkosten + Kapitalzins.",
      ],
      activeScenario: {
        id: app.activeScenario.id,
        name: app.activeScenario.name,
        values: app.activeScenarioValues,
        computed: {
          kaufnebenkosten: app.activeScenarioValues.kaufpreis * 0.1207,
          bankPrincipal,
          bankMonthlyRate,
          bankResidualDebtAtBinding,
          evaluation: activeEvaluation,
        },
      },
      scenarios: app.scenarioList.map((scenario) => ({
        id: scenario.id,
        name: scenario.name,
        values: app.scenarioValues[scenario.id] ?? null,
      })),
      analysisSettings: {
        includeRefinancing: app.includeRefinancing,
        analysisHorizonYears: app.analysisHorizonYears,
        opportunityRate: app.opportunityRate,
      },
      uploadedBankOffer: uploadedBankOffer
        ? {
            filename: uploadedBankOffer.filename,
            markdown: uploadedBankOffer.markdown,
            truncated: uploadedBankOffer.truncated,
            warnings: uploadedBankOffer.warnings,
            instructions:
              "Extrahiere Finanzierungswerte nur aus diesem Dokument, wenn sie eindeutig genannt sind. Frage nach, wenn Sollzins, Effektivzins, Tilgung, Zinsbindung oder Darlehensbetrag unklar sind. Erstelle ein Szenario erst nach ausdruecklicher Nutzerbestaetigung.",
          }
        : null,
      activeLiquidityScenario: {
        id: app.activeLiquidityScenario.id,
        name: app.activeLiquidityScenario.name,
        values: app.activeLiquidityScenarioValues,
        computed: {
          firstMonth: liquidityRows[0] ?? null,
          lastMonth: lastLiquidityRow,
          minimumCapitalEnd: liquidityRows.reduce(
            (min, row) => Math.min(min, row.capitalEnd),
            liquidityRows[0]?.capitalEnd ??
              app.activeLiquidityScenarioValues.startCapital,
          ),
        },
      },
    },
  });

  const clearUploadedBankOffer = useCallback(() => {
    setUploadedBankOffer(null);
    setUploadStatus(null);
  }, []);

  const handleBankOfferUpload = useCallback(async (file: File | null) => {
    if (!file) return;

    setUploadStatus("Dokument wird gelesen...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/documents/extract", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as unknown;

      if (!response.ok || !isUploadedBankOffer(result)) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Dokument konnte nicht gelesen werden.";
        throw new Error(message);
      }

      setUploadedBankOffer(result);
      setUploadStatus(
        result.truncated
          ? "Dokument wurde gelesen und wegen Laenge gekuerzt."
          : "Dokument wurde gelesen.",
      );
    } catch (error) {
      setUploadedBankOffer(null);
      setUploadStatus(
        error instanceof Error
          ? error.message
          : "Dokument konnte nicht gelesen werden.",
      );
    }
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      void handleBankOfferUpload(file);
    },
    [handleBankOfferUpload],
  );

  useFrontendTool(
    {
      name: "createFinancingScenario",
      description:
        "Erstellt ein neues Finanzierungsszenario aus einem bestehenden Szenario. Erlaubt sind nur sichere, nicht-destruktive Aenderungen an Kaufpreis, Modernisierung, Eigenkapital, Sollzins, Effektivzins, Tilgungssatz und Zinsbindung.",
      parameters: z.object({
        name: z.string().min(1).max(80).describe("Name fuer das neue Szenario"),
        sourceScenarioId: z
          .string()
          .optional()
          .describe(
            "Optional: ID des Quell-Szenarios. Ohne Angabe wird das aktive Szenario genutzt.",
          ),
        changes: scenarioChangesSchema.describe(
          "Whitelist der anzuwendenden Zahlen-Aenderungen",
        ),
      }),
      handler: async ({ name, sourceScenarioId, changes }) => {
        const sourceId = sourceScenarioId ?? app.activeScenarioId;
        const sourceScenario = app.scenarios[sourceId];
        const sourceValues = app.scenarioValues[sourceId];

        if (!sourceScenario || !sourceValues) {
          return `Das Quell-Szenario ${sourceId} existiert nicht. Es wurde nichts erstellt.`;
        }

        const safeName = buildUniqueName(
          name,
          new Set(
            app.scenarioList.map((scenario) => scenario.name.toLowerCase()),
          ),
        );
        const values = applyScenarioChanges(sourceValues, changes);
        const id = createScenarioId();

        await app.createScenarioWithValues({
          id,
          name: safeName,
          createdAt: Date.now(),
          color: getNextScenarioColor(
            app.scenarioList.map((scenario) => scenario.color),
          ),
          values,
        });

        return `Szenario "${safeName}" wurde aus "${sourceScenario.name}" erstellt und aktiviert.`;
      },
    },
    [app],
  );

  useFrontendTool(
    {
      name: "switchFinancingScenario",
      description:
        "Aktiviert ein vorhandenes Finanzierungsszenario anhand seiner ID. Veraendert keine Rechenwerte.",
      parameters: z.object({
        scenarioId: z.string().describe("ID des zu aktivierenden Szenarios"),
      }),
      handler: async ({ scenarioId }) => {
        const scenario = app.scenarios[scenarioId];
        if (!scenario) {
          return `Das Szenario ${scenarioId} existiert nicht. Es wurde nichts geaendert.`;
        }
        await app.setActiveScenarioId(scenarioId);
        return `Szenario "${scenario.name}" wurde aktiviert.`;
      },
    },
    [app],
  );

  useFrontendTool(
    {
      name: "createFinancingScenarioFromBankOffer",
      description:
        "Erstellt nach ausdruecklicher Nutzerbestaetigung ein neues Finanzierungsszenario aus eindeutig aus dem hochgeladenen Bankangebot extrahierten Werten. Nutze dieses Tool nur, wenn die relevanten Werte vorher genannt und bestaetigt wurden.",
      parameters: z.object({
        name: z.string().min(1).max(80).describe("Name fuer das neue Szenario"),
        sourceScenarioId: z
          .string()
          .optional()
          .describe(
            "Optional: ID des Quell-Szenarios. Ohne Angabe wird das aktive Szenario genutzt.",
          ),
        offerSummary: z
          .string()
          .min(1)
          .max(2_000)
          .describe("Kurze Zusammenfassung der erkannten Angebotswerte."),
        changes: scenarioChangesSchema.describe(
          "Eindeutig erkannte und vom Nutzer bestaetigte Angebotswerte.",
        ),
      }),
      handler: async ({ name, sourceScenarioId, offerSummary, changes }) => {
        if (!uploadedBankOffer) {
          return "Es ist kein Bankangebot hochgeladen. Bitte lade zuerst ein Dokument hoch.";
        }

        const changedKeys = Object.keys(changes);
        if (changedKeys.length === 0) {
          return "Im Bankangebot wurden keine uebernehmbaren Werte angegeben. Bitte frage nach den fehlenden Konditionen.";
        }

        const sourceId = sourceScenarioId ?? app.activeScenarioId;
        const sourceScenario = app.scenarios[sourceId];
        const sourceValues = app.scenarioValues[sourceId];

        if (!sourceScenario || !sourceValues) {
          return `Das Quell-Szenario ${sourceId} existiert nicht. Es wurde nichts erstellt.`;
        }

        const safeName = buildUniqueName(
          name,
          new Set(
            app.scenarioList.map((scenario) => scenario.name.toLowerCase()),
          ),
        );
        const values = applyScenarioChanges(sourceValues, changes);
        const id = createScenarioId();

        await app.createScenarioWithValues({
          id,
          name: safeName,
          createdAt: Date.now(),
          color: getNextScenarioColor(
            app.scenarioList.map((scenario) => scenario.color),
          ),
          values,
        });

        return `Szenario "${safeName}" wurde aus dem Bankangebot "${uploadedBankOffer.filename}" erstellt und aktiviert. Grundlage: ${offerSummary}`;
      },
    },
    [app, uploadedBankOffer],
  );

  return (
    <>
      {children}
      <section
        className="fixed right-4 bottom-4 z-[2147483000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 text-sm shadow-lg backdrop-blur"
        data-testid="copilot-document-upload"
        aria-label="Bankangebot hochladen"
      >
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept=".pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp,.rtf,.csv,.txt,.md,.html"
          onChange={(event) => {
            void handleBankOfferUpload(event.currentTarget.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
        {uploadedBankOffer ? (
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-2">
            <FileText className="mt-0.5 size-4 shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">
                {uploadedBankOffer.filename}
              </p>
              <p className="text-xs text-slate-600">
                Als Kontext verfuegbar
              </p>
              {uploadStatus ? (
                <p className="mt-0.5 text-xs text-slate-500">{uploadStatus}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={clearUploadedBankOffer}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label="Dokument entfernen"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={openFilePicker}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={[
            "flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 text-xs font-medium transition-colors",
            isDragging
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-slate-300 bg-slate-50 text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700",
          ].join(" ")}
          aria-label="Datei per Drag-and-Drop ablegen oder auswaehlen"
        >
          <UploadCloud className="size-4" />
          <span>
            {isDragging
              ? "Datei hier ablegen"
              : "Datei hierher ziehen oder klicken zum Auswaehlen"}
          </span>
          <Plus className="ml-1 size-4 rounded-full bg-blue-600 p-0.5 text-white" />
        </button>
        {!uploadedBankOffer ? (
          <p className="px-1 text-xs text-slate-500">
            PDF, Word, Excel, PowerPoint oder Textdatei bis 10 MB
          </p>
        ) : null}
        {uploadStatus && !uploadedBankOffer ? (
          <p className="px-1 text-xs text-slate-500">{uploadStatus}</p>
        ) : null}
      </section>
      <CopilotSidebar
        defaultOpen={false}
        width={420}
        labels={{
          modalHeaderTitle: "Finanz-Copilot",
          welcomeMessageText:
            "Frag mich zu den Berechnungen oder lass ein neues Szenario erstellen.",
        }}
      />
    </>
  );
}
