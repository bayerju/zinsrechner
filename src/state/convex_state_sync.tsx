"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { defaultScenarioColor } from "~/lib/scenario_colors";
import {
  analysisHorizonYearsAtom,
  defaultAnalysisHorizonYears,
  includeRefinancingAtom,
} from "./analysis_settings_atom";
import {
  activeLiquidityScenarioIdAtom,
  defaultLiquidityScenarioId,
  defaultLiquidityScenarioValues,
  liquidityScenariosAtom,
  liquidityScenarioValuesAtom,
  type LiquidityScenario,
  type LiquidityScenarioValues,
} from "./liquidity_scenarios_atom";
import {
  activeScenarioIdAtom,
  comparedScenarioIdsAtom,
  defaultScenarioId,
  scenariosAtom,
  type Scenario,
} from "./scenarios_atom";
import {
  defaultScenarioValues,
  scenarioValuesAtom,
  type ScenarioValues,
} from "./scenario_values_atom";

const APP_STORAGE_KEYS = [
  "scenarios",
  "activeScenarioId",
  "scenarioValues",
  "comparedScenarioIds",
  "liquidityScenarios",
  "activeLiquidityScenarioId",
  "liquidityScenarioValues",
  "includeRefinancing",
  "analysisHorizonYears",
] as const;

type SyncedState = {
  version: 1;
  scenarios: Record<string, Scenario>;
  activeScenarioId: string;
  scenarioValues: Record<string, ScenarioValues>;
  comparedScenarioIds: string[];
  liquidityScenarios: Record<string, LiquidityScenario>;
  activeLiquidityScenarioId: string;
  liquidityScenarioValues: Record<string, LiquidityScenarioValues>;
  includeRefinancing: boolean;
  analysisHorizonYears: number;
};

type RemoteState = {
  userIdentifier: string;
  state: unknown;
  updatedAt: number;
  needsMigration: boolean;
};

type LocalImports = Awaited<ReturnType<typeof toLocalImports>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSyncedState(value: unknown): value is SyncedState {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    isRecord(value.scenarios) &&
    typeof value.activeScenarioId === "string" &&
    isRecord(value.scenarioValues) &&
    Array.isArray(value.comparedScenarioIds) &&
    isRecord(value.liquidityScenarios) &&
    typeof value.activeLiquidityScenarioId === "string" &&
    isRecord(value.liquidityScenarioValues) &&
    typeof value.includeRefinancing === "boolean" &&
    typeof value.analysisHorizonYears === "number"
  );
}

function hasLocalAppData() {
  return APP_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
}

function clearLocalAppData() {
  for (const key of APP_STORAGE_KEYS) localStorage.removeItem(key);
}

async function fingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function defaultSyncedState(): SyncedState {
  return {
    version: 1,
    scenarios: {
      [defaultScenarioId]: {
        id: defaultScenarioId,
        name: "Basis",
        createdAt: 0,
        color: defaultScenarioColor,
      },
    },
    activeScenarioId: defaultScenarioId,
    scenarioValues: {
      [defaultScenarioId]: structuredClone(defaultScenarioValues),
    },
    comparedScenarioIds: [],
    liquidityScenarios: {
      [defaultLiquidityScenarioId]: {
        id: defaultLiquidityScenarioId,
        name: "Basis",
        createdAt: 0,
        color: defaultScenarioColor,
      },
    },
    activeLiquidityScenarioId: defaultLiquidityScenarioId,
    liquidityScenarioValues: {
      [defaultLiquidityScenarioId]: structuredClone(
        defaultLiquidityScenarioValues,
      ),
    },
    includeRefinancing: false,
    analysisHorizonYears: defaultAnalysisHorizonYears,
  };
}

function toConvexSnapshot(state: SyncedState) {
  const financingScenarios = Object.values(state.scenarios).flatMap(
    (scenario) => {
      const values = state.scenarioValues[scenario.id];
      if (!values) return [];
      return [
        {
          scenarioId: scenario.id,
          name: scenario.name,
          createdAt: scenario.createdAt,
          color: scenario.color,
          effzins: values.effzins,
          kaufpreis: values.kaufpreis,
          modernisierungskosten: values.modernisierungskosten,
          eigenkapital: values.eigenkapital,
          tilgungssatz: values.tilgungssatz,
          zinsbindung: values.zinsbindung,
        },
      ];
    },
  );
  const credits = Object.entries(state.scenarioValues).flatMap(
    ([scenarioId, values]) =>
      Object.entries(values.credits).map(([creditId, data]) => ({
        scenarioId,
        creditId,
        data,
      })),
  );
  const liquidityScenarios = Object.values(state.liquidityScenarios).flatMap(
    (scenario) => {
      const values = state.liquidityScenarioValues[scenario.id];
      if (!values) return [];
      return [
        {
          scenarioId: scenario.id,
          name: scenario.name,
          createdAt: scenario.createdAt,
          color: scenario.color,
          startCapital: values.startCapital,
          startMonth: values.startMonth,
          horizonMonths: values.horizonMonths,
          creditScenarioId: values.creditScenarioId,
        },
      ];
    },
  );
  const liquidityItems = Object.entries(state.liquidityScenarioValues).flatMap(
    ([scenarioId, values]) =>
      values.items.map((data, position) => ({
        scenarioId,
        itemId: data.id,
        position,
        data,
      })),
  );

  return {
    settings: {
      activeScenarioId: state.activeScenarioId,
      comparedScenarioIds: state.comparedScenarioIds,
      activeLiquidityScenarioId: state.activeLiquidityScenarioId,
      includeRefinancing: state.includeRefinancing,
      analysisHorizonYears: state.analysisHorizonYears,
    },
    financingScenarios,
    credits,
    liquidityScenarios,
    liquidityItems,
  };
}

async function toLocalImports(local: SyncedState, remote: SyncedState) {
  const financing = await Promise.all(
    Object.values(local.scenarios).flatMap((scenario) => {
      const values = local.scenarioValues[scenario.id];
      const isRemovedImportArtifact =
        scenario.id.startsWith("financing-local-") &&
        !remote.scenarios[scenario.id];
      if (
        scenario.id === defaultScenarioId ||
        !values ||
        isRemovedImportArtifact
      ) {
        return [];
      }
      return [
        fingerprint({ scenario, values }).then((scenarioFingerprint) => ({
          fingerprint: scenarioFingerprint,
          scenario: {
            scenarioId: scenario.id,
            name: scenario.name,
            createdAt: scenario.createdAt,
            color: scenario.color,
            effzins: values.effzins,
            kaufpreis: values.kaufpreis,
            modernisierungskosten: values.modernisierungskosten,
            eigenkapital: values.eigenkapital,
            tilgungssatz: values.tilgungssatz,
            zinsbindung: values.zinsbindung,
          },
          credits: Object.entries(values.credits).map(([creditId, data]) => ({
            creditId,
            data,
          })),
        })),
      ];
    }),
  );

  const liquidity = await Promise.all(
    Object.values(local.liquidityScenarios).flatMap((scenario) => {
      const values = local.liquidityScenarioValues[scenario.id];
      const isRemovedImportArtifact =
        scenario.id.startsWith("liquidity-local-") &&
        !remote.liquidityScenarios[scenario.id];
      if (
        scenario.id === defaultLiquidityScenarioId ||
        !values ||
        isRemovedImportArtifact
      ) {
        return [];
      }
      return [
        fingerprint({ scenario, values }).then((scenarioFingerprint) => ({
          fingerprint: scenarioFingerprint,
          scenario: {
            scenarioId: scenario.id,
            name: scenario.name,
            createdAt: scenario.createdAt,
            color: scenario.color,
            startCapital: values.startCapital,
            startMonth: values.startMonth,
            horizonMonths: values.horizonMonths,
            creditScenarioId: values.creditScenarioId,
          },
          items: values.items.map((data, position) => ({
            itemId: data.id,
            position,
            data,
          })),
        })),
      ];
    }),
  );

  return { financing, liquidity };
}

export function ConvexStateSync() {
  const { isAuthenticated } = useConvexAuth();
  const remoteResult = useQuery(
    api.appState.getForCurrentUser,
    isAuthenticated ? {} : "skip",
  ) as RemoteState | null | undefined;
  const importLocalScenarios = useMutation(api.appState.importLocalScenarios);
  const replaceState = useMutation(api.appState.replaceForCurrentUser);
  const [scenarios, setScenarios] = useAtom(scenariosAtom);
  const [activeScenarioId, setActiveScenarioId] = useAtom(activeScenarioIdAtom);
  const [scenarioValues, setScenarioValues] = useAtom(scenarioValuesAtom);
  const [comparedScenarioIds, setComparedScenarioIds] = useAtom(
    comparedScenarioIdsAtom,
  );
  const [liquidityScenarios, setLiquidityScenarios] = useAtom(
    liquidityScenariosAtom,
  );
  const [activeLiquidityScenarioId, setActiveLiquidityScenarioId] = useAtom(
    activeLiquidityScenarioIdAtom,
  );
  const [liquidityScenarioValues, setLiquidityScenarioValues] = useAtom(
    liquidityScenarioValuesAtom,
  );
  const [includeRefinancing, setIncludeRefinancing] = useAtom(
    includeRefinancingAtom,
  );
  const [analysisHorizonYears, setAnalysisHorizonYears] = useAtom(
    analysisHorizonYearsAtom,
  );
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [readyToSave, setReadyToSave] = useState(false);
  const [pendingRemoteTimestamp, setPendingRemoteTimestamp] = useState<
    number | null
  >(null);
  const [importReview, setImportReview] = useState<{
    imports: LocalImports;
    remoteState: SyncedState;
    remoteWasNull: boolean;
    needsMigration: boolean;
  } | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const importPreview = useQuery(
    api.appState.previewLocalScenarios,
    importReview?.imports ?? "skip",
  );
  const initializationRunning = useRef(false);
  const lastSyncedPayload = useRef<string | null>(null);

  const localState = useMemo<SyncedState>(
    () => ({
      version: 1,
      scenarios,
      activeScenarioId,
      scenarioValues,
      comparedScenarioIds,
      liquidityScenarios,
      activeLiquidityScenarioId,
      liquidityScenarioValues,
      includeRefinancing,
      analysisHorizonYears,
    }),
    [
      activeLiquidityScenarioId,
      activeScenarioId,
      analysisHorizonYears,
      comparedScenarioIds,
      includeRefinancing,
      liquidityScenarioValues,
      liquidityScenarios,
      scenarioValues,
      scenarios,
    ],
  );
  const localPayload = useMemo(() => JSON.stringify(localState), [localState]);

  const applyState = useCallback(
    (state: SyncedState) => {
      setScenarios(state.scenarios);
      setActiveScenarioId(state.activeScenarioId);
      setScenarioValues(state.scenarioValues);
      setComparedScenarioIds(state.comparedScenarioIds);
      setLiquidityScenarios(state.liquidityScenarios);
      setActiveLiquidityScenarioId(state.activeLiquidityScenarioId);
      setLiquidityScenarioValues(state.liquidityScenarioValues);
      setIncludeRefinancing(state.includeRefinancing);
      setAnalysisHorizonYears(state.analysisHorizonYears);
    },
    [
      setActiveLiquidityScenarioId,
      setActiveScenarioId,
      setAnalysisHorizonYears,
      setComparedScenarioIds,
      setIncludeRefinancing,
      setLiquidityScenarioValues,
      setLiquidityScenarios,
      setScenarioValues,
      setScenarios,
    ],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setStorageHydrated(true), 100);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setReadyToSave(false);
      setPendingRemoteTimestamp(null);
      initializationRunning.current = false;
      lastSyncedPayload.current = null;
      return;
    }
    if (
      !storageHydrated ||
      remoteResult === undefined ||
      readyToSave ||
      importReview !== null ||
      initializationRunning.current
    ) {
      return;
    }

    if (
      pendingRemoteTimestamp !== null &&
      remoteResult !== null &&
      remoteResult.updatedAt >= pendingRemoteTimestamp &&
      isSyncedState(remoteResult.state)
    ) {
      applyState(remoteResult.state);
      lastSyncedPayload.current = JSON.stringify(remoteResult.state);
      clearLocalAppData();
      setPendingRemoteTimestamp(null);
      setReadyToSave(true);
      return;
    }
    if (pendingRemoteTimestamp !== null) return;

    initializationRunning.current = true;
    const localDataExists = hasLocalAppData();

    if (remoteResult === null) {
      const remoteState = defaultSyncedState();
      if (!localDataExists) {
        void replaceState(toConvexSnapshot(remoteState))
          .then((updatedAt) => {
            clearLocalAppData();
            setPendingRemoteTimestamp(updatedAt);
          })
          .catch((error: unknown) => {
            console.error("Failed to create Convex state", error);
          })
          .finally(() => {
            initializationRunning.current = false;
          });
        return;
      }

      void toLocalImports(localState, remoteState)
        .then(async (imports) => {
          if (
            imports.financing.length === 0 &&
            imports.liquidity.length === 0
          ) {
            const updatedAt = await replaceState(toConvexSnapshot(remoteState));
            clearLocalAppData();
            setPendingRemoteTimestamp(updatedAt);
            return;
          }
          setImportReview({
            imports,
            remoteState,
            remoteWasNull: true,
            needsMigration: false,
          });
        })
        .catch((error: unknown) => {
          console.error("Failed to prepare local import", error);
        })
        .finally(() => {
          initializationRunning.current = false;
        });
      return;
    }
    if (!isSyncedState(remoteResult.state)) {
      initializationRunning.current = false;
      console.error("Convex returned invalid calculator state");
      return;
    }

    if (!localDataExists) {
      if (remoteResult.needsMigration) {
        void replaceState(toConvexSnapshot(remoteResult.state))
          .then((updatedAt) => {
            clearLocalAppData();
            setPendingRemoteTimestamp(updatedAt);
          })
          .catch((error: unknown) => {
            console.error("Failed to migrate Convex state", error);
          })
          .finally(() => {
            initializationRunning.current = false;
          });
        return;
      }
      applyState(remoteResult.state);
      lastSyncedPayload.current = JSON.stringify(remoteResult.state);
      clearLocalAppData();
      setReadyToSave(true);
      initializationRunning.current = false;
      return;
    }

    void toLocalImports(localState, remoteResult.state)
      .then(async (imports) => {
        if (imports.financing.length === 0 && imports.liquidity.length === 0) {
          if (remoteResult.needsMigration) {
            const updatedAt = await replaceState(
              toConvexSnapshot(remoteResult.state as SyncedState),
            );
            clearLocalAppData();
            setPendingRemoteTimestamp(updatedAt);
            return;
          }
          applyState(remoteResult.state as SyncedState);
          lastSyncedPayload.current = JSON.stringify(remoteResult.state);
          clearLocalAppData();
          setReadyToSave(true);
          return;
        }
        setImportReview({
          imports,
          remoteState: remoteResult.state as SyncedState,
          remoteWasNull: false,
          needsMigration: remoteResult.needsMigration,
        });
      })
      .catch((error: unknown) => {
        console.error("Failed to import local scenarios", error);
      })
      .finally(() => {
        initializationRunning.current = false;
      });
  }, [
    applyState,
    importLocalScenarios,
    importReview,
    isAuthenticated,
    localState,
    pendingRemoteTimestamp,
    readyToSave,
    remoteResult,
    replaceState,
    storageHydrated,
  ]);

  async function finishWithoutImport() {
    if (!importReview) return;
    setReviewSubmitting(true);
    try {
      if (importReview.remoteWasNull || importReview.needsMigration) {
        const updatedAt = await replaceState(
          toConvexSnapshot(importReview.remoteState),
        );
        clearLocalAppData();
        setImportReview(null);
        setPendingRemoteTimestamp(updatedAt);
        return;
      }

      applyState(importReview.remoteState);
      lastSyncedPayload.current = JSON.stringify(importReview.remoteState);
      clearLocalAppData();
      setImportReview(null);
      setReadyToSave(true);
    } catch (error) {
      console.error("Failed to discard local scenarios", error);
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function importReviewedScenarios() {
    if (!importReview) return;
    setReviewSubmitting(true);
    try {
      if (importReview.remoteWasNull) {
        const defaultUpdatedAt = await replaceState(
          toConvexSnapshot(importReview.remoteState),
        );
        const importUpdatedAt = await importLocalScenarios(
          importReview.imports,
        );
        clearLocalAppData();
        setImportReview(null);
        setPendingRemoteTimestamp(importUpdatedAt ?? defaultUpdatedAt);
        return;
      }

      const updatedAt = await importLocalScenarios(importReview.imports);
      clearLocalAppData();
      setImportReview(null);
      if (updatedAt !== null) {
        setPendingRemoteTimestamp(updatedAt);
      } else if (importReview.needsMigration) {
        const migrationTimestamp = await replaceState(
          toConvexSnapshot(importReview.remoteState),
        );
        setPendingRemoteTimestamp(migrationTimestamp);
      } else {
        applyState(importReview.remoteState);
        lastSyncedPayload.current = JSON.stringify(importReview.remoteState);
        setReadyToSave(true);
      }
    } catch (error) {
      console.error("Failed to import local scenarios", error);
    } finally {
      setReviewSubmitting(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !readyToSave) return;
    if (localPayload === lastSyncedPayload.current) return;

    const timeout = window.setTimeout(() => {
      const snapshot = localState;
      const payload = JSON.stringify(snapshot);
      lastSyncedPayload.current = payload;
      void replaceState(toConvexSnapshot(snapshot))
        .then(() => clearLocalAppData())
        .catch((error: unknown) => {
          lastSyncedPayload.current = null;
          console.error("Failed to sync state to Convex", error);
        });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [isAuthenticated, localPayload, localState, readyToSave, replaceState]);

  useEffect(() => {
    if (
      !readyToSave ||
      remoteResult === null ||
      remoteResult === undefined ||
      !isSyncedState(remoteResult.state)
    ) {
      return;
    }
    const remotePayload = JSON.stringify(remoteResult.state);
    clearLocalAppData();
    if (remotePayload === lastSyncedPayload.current) return;

    lastSyncedPayload.current = remotePayload;
    applyState(remoteResult.state);
  }, [applyState, readyToSave, remoteResult]);

  const previewRows = importPreview
    ? [...importPreview.financing, ...importPreview.liquidity]
    : [];
  const newCount = previewRows.filter((row) => row.status === "new").length;

  return (
    <Dialog open={importReview !== null}>
      <DialogContent
        showCloseButton={false}
        className="border-neutral-300 bg-white text-black sm:max-w-xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Lokale Szenarien prüfen</DialogTitle>
          <DialogDescription>
            Im Browser wurden lokale Daten gefunden. Prüfe, welche Szenarien
            zusätzlich in Convex übernommen werden sollen.
          </DialogDescription>
        </DialogHeader>

        {importPreview === undefined ? (
          <p className="text-sm text-neutral-600">
            Szenarien werden geprüft...
          </p>
        ) : (
          <div className="space-y-4">
            <ImportSection
              title="Finanzierung"
              rows={importPreview.financing}
            />
            <ImportSection title="Liquidität" rows={importPreview.liquidity} />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={reviewSubmitting || importPreview === undefined}
            onClick={() => void finishWithoutImport()}
          >
            Lokale Daten verwerfen
          </Button>
          <Button
            type="button"
            disabled={reviewSubmitting || importPreview === undefined}
            onClick={() => void importReviewedScenarios()}
          >
            {newCount > 0
              ? `${newCount} neue importieren`
              : "Ohne Import fortfahren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportSection({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    scenarioId: string;
    name: string;
    status: "new" | "duplicate";
    matchingName: string | null;
  }>;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="divide-y rounded-md border border-neutral-200">
        {rows.map((row) => (
          <div
            key={row.scenarioId}
            className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
          >
            <span>{row.name}</span>
            {row.status === "duplicate" ? (
              <span className="text-right text-xs text-neutral-500">
                Bereits vorhanden
                {row.matchingName ? ` als „${row.matchingName}“` : ""}
              </span>
            ) : (
              <span className="text-xs font-medium text-emerald-700">Neu</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
