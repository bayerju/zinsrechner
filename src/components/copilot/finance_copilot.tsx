"use client";

import {
  type ButtonHTMLAttributes,
  type DragEvent,
  forwardRef,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CopilotPopup,
  CopilotSidebar,
  useAgentContext,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { FileText, Plus, X } from "lucide-react";
import { z } from "zod";
import {
  calculateMonthlyRateFromSollzins,
  calculateNettodarlehensbetragBank,
  calculateRestschuldFromSollzins,
} from "~/lib/calculations";
import { createCredit } from "~/lib/credit";
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

const standardCreditSchema = z
  .object({
    name: z.string().min(1).max(80).describe("Name des Kreditbausteins"),
    summeDarlehen: z
      .number()
      .positive()
      .max(10_000_000)
      .describe("Darlehensbetrag in Euro"),
    sollzinssatz: z
      .number()
      .min(0)
      .max(20)
      .optional()
      .describe("Nominaler Sollzins in Prozent, falls genannt"),
    effektiverZinssatz: z
      .number()
      .min(0)
      .max(20)
      .describe("Effektiver Jahreszins in Prozent"),
    tilgungssatz: z
      .number()
      .min(0)
      .max(20)
      .describe("Anfaenglicher Tilgungssatz in Prozent"),
    zinsbindung: z.number().min(0.1).max(40).describe("Zinsbindung in Jahren"),
    useKreditDauer: z.boolean().optional(),
    kreditdauer: z.number().min(0.1).max(80).optional(),
    tilgungsFreieZeit: z.number().min(0).max(40).optional(),
    rueckzahlungsfreieZeit: z.number().min(0).max(40).optional(),
    tilgungszuschussProzent: z.number().min(0).max(100).optional(),
    foerderfaehigerAnteilProzent: z.number().min(0).max(100).optional(),
  })
  .strict();

const bridgeCreditSchema = z
  .object({
    name: z.string().min(1).max(80).describe("Name der Zwischenfinanzierung"),
    summeDarlehen: z
      .number()
      .positive()
      .max(10_000_000)
      .describe("Betrag der Zwischenfinanzierung in Euro"),
    sollzinssatz: z
      .number()
      .min(0)
      .max(20)
      .optional()
      .describe("Nominaler Sollzins in Prozent, falls genannt"),
    effektiverZinssatz: z
      .number()
      .min(0)
      .max(20)
      .describe("Effektiver Jahreszins in Prozent"),
    laufzeitMonate: z
      .number()
      .int()
      .min(1)
      .max(480)
      .describe("Laufzeit der Zwischenfinanzierung in Monaten"),
  })
  .strict();

const scenarioChangesSchema = z
  .object({
    kaufpreis: z.number().min(0).max(10_000_000).optional(),
    modernisierungskosten: z.number().min(0).max(5_000_000).optional(),
    eigenkapital: z.number().min(0).max(10_000_000).optional(),
    sollzins: z.number().min(0).max(20).optional(),
    effzins: z.number().min(0).max(20).optional(),
    tilgungssatz: z.number().min(0).max(20).optional(),
    zinsbindung: z.number().int().min(1).max(40).optional(),
    standardCreditsToAdd: z
      .array(standardCreditSchema)
      .max(20)
      .optional()
      .describe(
        "Nur echte Zusatzdarlehen, KfW-/Foerderdarlehen oder weitere langfristige Kreditbausteine. Nicht fuer das Haupt-Bankdarlehen/Annuitaetendarlehen verwenden; dieses wird durch die Top-Level-Felder sollzins, effzins, tilgungssatz und zinsbindung abgebildet.",
      ),
    bridgeCreditsToAdd: z
      .array(bridgeCreditSchema)
      .max(20)
      .optional()
      .describe(
        "Zwischenfinanzierungen. Nutze dieses Feld fuer kurzfristige, endfaellige oder nur verzinste Uebergangsfinanzierungen.",
      ),
    creditsToAdd: z
      .array(
        z.discriminatedUnion("kreditart", [
          standardCreditSchema.extend({ kreditart: z.literal("standard") }),
          bridgeCreditSchema.extend({
            kreditart: z.literal("zwischenfinanzierung"),
          }),
        ]),
      )
      .max(20)
      .optional()
      .describe(
        "Legacy-Feld. Bevorzuge standardCreditsToAdd und bridgeCreditsToAdd.",
      ),
  })
  .strict();

function createScenarioId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `copilot-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function createCreditId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `copilot-credit-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
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

function createStandardCredit(credit: z.infer<typeof standardCreditSchema>) {
  return createCredit({
    ...credit,
    kreditdauer: credit.kreditdauer ?? credit.zinsbindung,
    tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
    foerderfaehigerAnteilProzent: credit.foerderfaehigerAnteilProzent ?? 0,
    rückzahlungsfreieZeit: credit.rueckzahlungsfreieZeit,
  });
}

function createBridgeCredit(credit: z.infer<typeof bridgeCreditSchema>) {
  return createCredit({
    ...credit,
    kreditart: "zwischenfinanzierung",
    tilgungssatz: 0,
    kreditdauer: credit.laufzeitMonate / 12,
    zinsbindung: credit.laufzeitMonate / 12,
    tilgungszuschussProzent: 0,
    foerderfaehigerAnteilProzent: 0,
  });
}

function creditDeduplicationKey(
  credit:
    | ReturnType<typeof createStandardCredit>
    | ReturnType<typeof createBridgeCredit>,
) {
  return [
    credit.kreditart ?? "standard",
    credit.summeDarlehen,
    credit.sollzinssatz ?? credit.effektiverZinssatz,
    credit.effektiverZinssatz,
    credit.tilgungssatz,
    credit.laufzeitMonate ?? credit.kreditdauer,
    credit.zinsbindung,
  ].join("|");
}

function applyScenarioChanges(
  source: ScenarioValues,
  changes: z.infer<typeof scenarioChangesSchema>,
): ScenarioValues {
  const {
    standardCreditsToAdd,
    bridgeCreditsToAdd,
    creditsToAdd,
    ...valueChanges
  } = changes;
  const next = {
    ...source,
    ...valueChanges,
    credits: structuredClone(source.credits),
  };
  const creditKeys = new Set(
    Object.values(next.credits).map((credit) => creditDeduplicationKey(credit)),
  );

  const addCredit = (
    credit:
      | ReturnType<typeof createStandardCredit>
      | ReturnType<typeof createBridgeCredit>,
  ) => {
    const key = creditDeduplicationKey(credit);
    if (creditKeys.has(key)) return;
    creditKeys.add(key);
    next.credits[createCreditId()] = credit;
  };

  if (changes.sollzins !== undefined && changes.effzins === undefined) {
    next.effzins = changes.sollzins;
  }
  if (changes.effzins !== undefined && changes.sollzins === undefined) {
    next.sollzins = changes.effzins;
  }

  for (const credit of standardCreditsToAdd ?? []) {
    addCredit(createStandardCredit(credit));
  }

  for (const credit of bridgeCreditsToAdd ?? []) {
    addCredit(createBridgeCredit(credit));
  }

  for (const credit of creditsToAdd ?? []) {
    const createdCredit =
      credit.kreditart === "standard"
        ? createStandardCredit(credit)
        : createBridgeCredit(credit);
    addCredit(createdCredit);
  }

  return next;
}

export function FinanceCopilot({ children }: { children: React.ReactNode }) {
  const app = useAppState();
  const [uploadedBankOffer, setUploadedBankOffer] =
    useState<UploadedBankOffer | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileChatMounted, setIsMobileChatMounted] = useState(false);
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
      dataModel:
        "Ein Finanzierungsszenario hat genau ein implizites Haupt-Bankdarlehen. Dieses Hauptdarlehen wird nicht in credits gespeichert, sondern aus kaufpreis, modernisierungskosten, eigenkapital, sollzins, effzins, tilgungssatz und zinsbindung berechnet. Das Feld credits enthaelt ausschliesslich zusaetzliche Kreditbausteine, die neben dem Haupt-Bankdarlehen existieren.",
      toolUsageRules: [
        "Wenn ein Bankangebot ein normales Annuitaetendarlehen als Hauptfinanzierung nennt, setze nur die Top-Level-Felder sollzins, effzins, tilgungssatz und zinsbindung. Lege dafuer keinen standardCreditsToAdd-Eintrag an.",
        "standardCreditsToAdd nur nutzen, wenn das Dokument einen separaten weiteren Kreditbaustein nennt, zum Beispiel KfW, Foerderdarlehen, Modernisierungsdarlehen oder ein zweites langfristiges Darlehen.",
        "bridgeCreditsToAdd nur fuer kurzfristige Zwischenfinanzierungen nutzen, zum Beispiel wenn ein spaeter Verkaufserloes oder Eigenkapitalzufluss vorfinanziert wird.",
        "Wenn derselbe Betrag, Zinssatz, Tilgungssatz und dieselbe Zinsbindung bereits als Haupt-Bankdarlehen uebernommen wurden, darf dieser Kredit nicht zusaetzlich als standardCreditsToAdd angelegt werden.",
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
              "Lies Bankangebote strukturiert: trenne das Haupt-Bankdarlehen von echten Zusatzkrediten. Das Haupt-Bankdarlehen/Annuitaetendarlehen wird nur ueber Top-Level-Felder abgebildet und darf nicht noch einmal als standardCreditsToAdd angelegt werden. Nutze bridgeCreditsToAdd fuer Zwischenfinanzierungen und standardCreditsToAdd nur fuer weitere separate Kreditbausteine. Frage nach, wenn Sollzins, Effektivzins, Tilgung, Zinsbindung, Laufzeit oder Darlehensbetrag unklar sind. Erstelle oder bearbeite ein Szenario erst nach ausdruecklicher Nutzerbestaetigung.",
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

  const uploadBankOfferFile = useCallback(
    (file: File | null) => {
      void handleBankOfferUpload(file);
    },
    [handleBankOfferUpload],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  const handleInputDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(true);
    },
    [],
  );

  const handleInputDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(true);
    },
    [],
  );

  const handleInputDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setIsDragging(false);
      }
    },
    [],
  );

  const handleInputDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      uploadBankOfferFile(event.dataTransfer.files?.[0] ?? null);
    },
    [uploadBankOfferFile],
  );

  const BankOfferTextArea = useMemo(
    () =>
      forwardRef<
        HTMLTextAreaElement,
        TextareaHTMLAttributes<HTMLTextAreaElement>
      >(function BankOfferTextArea({ className, ...props }, ref) {
        return (
          <>
            {uploadedBankOffer ? (
              <div className="mb-2 flex max-w-full items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm">
                <FileText className="size-4 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="max-w-56 truncate font-medium text-slate-900">
                    {uploadedBankOffer.filename}
                  </p>
                  <p className="text-[11px] leading-4 text-slate-500">
                    {uploadStatus ?? "Als Kontext verfuegbar"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearUploadedBankOffer}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Dokument entfernen"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
            <textarea
              ref={ref}
              {...props}
              placeholder={
                isDragging
                  ? "Datei hier ablegen"
                  : "Nachricht schreiben oder Datei hierher ziehen"
              }
              aria-label="Type a message..."
              className={[
                className,
                "min-h-9 w-full resize-none bg-transparent px-0 py-1 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-500",
              ]
                .filter(Boolean)
                .join(" ")}
            />
            {uploadStatus && !uploadedBankOffer ? (
              <p className="mt-1 text-xs text-slate-500">{uploadStatus}</p>
            ) : null}
          </>
        );
      }),
    [clearUploadedBankOffer, isDragging, uploadStatus, uploadedBankOffer],
  );

  const UploadAddMenuButton = useCallback(
    ({
      className: _className,
      disabled: _disabled,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button
        {...props}
        type="button"
        onClick={openFilePicker}
        className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        aria-label="Datei auswaehlen"
      >
        <Plus className="size-4" />
      </button>
    ),
    [openFilePicker],
  );

  useFrontendTool(
    {
      name: "createFinancingScenario",
      description:
        "Erstellt ein neues Finanzierungsszenario aus einem bestehenden Szenario. Erlaubt sind sichere, nicht-destruktive Aenderungen an Kaufpreis, Modernisierung, Eigenkapital, Bank-Zins/Tilgung/Zinsbindung sowie das Hinzufuegen von Zusatzkrediten inklusive Standarddarlehen und Zwischenfinanzierungen.",
      parameters: z.object({
        name: z.string().min(1).max(80).describe("Name fuer das neue Szenario"),
        sourceScenarioId: z
          .string()
          .optional()
          .describe(
            "Optional: ID des Quell-Szenarios. Ohne Angabe wird das aktive Szenario genutzt.",
          ),
        changes: scenarioChangesSchema.describe(
          "Whitelist der anzuwendenden Zahlen-Aenderungen. Nutze standardCreditsToAdd fuer Zusatzdarlehen, KfW-/Foerderdarlehen und weitere langfristige Bankdarlehen. Nutze bridgeCreditsToAdd fuer Zwischenfinanzierungen. Zwischenfinanzierungen brauchen Betrag, Effektivzins und Laufzeit in Monaten.",
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
      name: "updateFinancingScenario",
      description:
        "Bearbeitet ein vorhandenes Finanzierungsszenario anhand seiner ID. Nutze dieses Tool, wenn der Nutzer ein bereits erstelltes Szenario korrigieren oder um weitere Kreditbausteine ergaenzen will. Keine Szenarien loeschen.",
      parameters: z.object({
        scenarioId: z.string().describe("ID des zu bearbeitenden Szenarios"),
        changes: scenarioChangesSchema.describe(
          "Aenderungen am Szenario. Fuer Zwischenfinanzierungen bevorzugt bridgeCreditsToAdd nutzen; fuer normale Zusatzdarlehen standardCreditsToAdd nutzen.",
        ),
      }),
      handler: async ({ scenarioId, changes }) => {
        const scenario = app.scenarios[scenarioId];
        const values = app.scenarioValues[scenarioId];

        if (!scenario || !values) {
          return `Das Szenario ${scenarioId} existiert nicht. Es wurde nichts geaendert.`;
        }

        if (Object.keys(changes).length === 0) {
          return `Fuer Szenario "${scenario.name}" wurden keine Aenderungen angegeben.`;
        }

        await app.updateScenarioValues(
          scenarioId,
          applyScenarioChanges(values, changes),
        );
        await app.setActiveScenarioId(scenarioId);

        return `Szenario "${scenario.name}" wurde aktualisiert und aktiviert.`;
      },
    },
    [app],
  );

  useFrontendTool(
    {
      name: "createFinancingScenarioFromBankOffer",
      description:
        "Erstellt nach ausdruecklicher Nutzerbestaetigung ein neues Finanzierungsszenario aus eindeutig aus dem hochgeladenen Bankangebot extrahierten Werten. Nutze dieses Tool auch fuer mehrere Darlehensbausteine und Zwischenfinanzierungen, aber nur wenn die relevanten Werte vorher genannt und bestaetigt wurden.",
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
          "Eindeutig erkannte und vom Nutzer bestaetigte Angebotswerte. Nutze standardCreditsToAdd fuer Standard-/KfW-/Foerderdarlehen und bridgeCreditsToAdd fuer Zwischenfinanzierungen.",
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
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept=".pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp,.rtf,.csv,.txt,.md,.html"
        onChange={(event) => {
          uploadBankOfferFile(event.currentTarget.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
      {isMobileViewport ? (
        isMobileChatMounted ? (
          <CopilotPopup
            defaultOpen={true}
            input={{
              showDisclaimer: false,
              className: isDragging ? "copilot-document-dragging" : undefined,
              onDragEnter: handleInputDragEnter,
              onDragOver: handleInputDragOver,
              onDragLeave: handleInputDragLeave,
              onDrop: handleInputDrop,
              addMenuButton: UploadAddMenuButton,
              textArea: BankOfferTextArea,
              sendButton:
                "flex size-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400",
            }}
            labels={{
              modalHeaderTitle: "Finanz-Copilot",
              welcomeMessageText:
                "Frag mich zu den Berechnungen oder lass ein neues Szenario erstellen.",
            }}
          />
        ) : (
          <button
            type="button"
            aria-label="Open chat"
            onClick={() => setIsMobileChatMounted(true)}
            className="fixed right-4 bottom-4 z-50 flex size-12 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition hover:bg-slate-800"
          >
            AI
          </button>
        )
      ) : (
        <CopilotSidebar
          defaultOpen={false}
          width={420}
          input={{
            showDisclaimer: false,
            className: isDragging ? "copilot-document-dragging" : undefined,
            onDragEnter: handleInputDragEnter,
            onDragOver: handleInputDragOver,
            onDragLeave: handleInputDragLeave,
            onDrop: handleInputDrop,
            addMenuButton: UploadAddMenuButton,
            textArea: BankOfferTextArea,
            sendButton:
              "flex size-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400",
          }}
          labels={{
            modalHeaderTitle: "Finanz-Copilot",
            welcomeMessageText:
              "Frag mich zu den Berechnungen oder lass ein neues Szenario erstellen.",
          }}
        />
      )}
    </>
  );
}
