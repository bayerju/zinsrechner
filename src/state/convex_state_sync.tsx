"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  analysisHorizonYearsAtom,
  includeRefinancingAtom,
} from "./analysis_settings_atom";
import {
  activeLiquidityScenarioIdAtom,
  liquidityScenariosAtom,
  liquidityScenarioValuesAtom,
  type LiquidityScenario,
  type LiquidityScenarioValues,
} from "./liquidity_scenarios_atom";
import {
  activeScenarioIdAtom,
  comparedScenarioIdsAtom,
  scenariosAtom,
  type Scenario,
} from "./scenarios_atom";
import {
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

function sameFinancingScenario(
  left: SyncedState,
  right: SyncedState,
  scenarioId: string,
) {
  return (
    JSON.stringify({
      scenario: left.scenarios[scenarioId],
      values: left.scenarioValues[scenarioId],
    }) ===
    JSON.stringify({
      scenario: right.scenarios[scenarioId],
      values: right.scenarioValues[scenarioId],
    })
  );
}

function sameLiquidityScenario(
  left: SyncedState,
  right: SyncedState,
  scenarioId: string,
) {
  return (
    JSON.stringify({
      scenario: left.liquidityScenarios[scenarioId],
      values: left.liquidityScenarioValues[scenarioId],
    }) ===
    JSON.stringify({
      scenario: right.liquidityScenarios[scenarioId],
      values: right.liquidityScenarioValues[scenarioId],
    })
  );
}

async function fingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
        !values ||
        isRemovedImportArtifact ||
        sameFinancingScenario(local, remote, scenario.id)
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
        !values ||
        isRemovedImportArtifact ||
        sameLiquidityScenario(local, remote, scenario.id)
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
      void replaceState(toConvexSnapshot(localState))
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
          return null;
        }
        return await importLocalScenarios(imports);
      })
      .then((updatedAt) => {
        clearLocalAppData();
        if (updatedAt === null) {
          applyState(remoteResult.state as SyncedState);
          lastSyncedPayload.current = JSON.stringify(remoteResult.state);
          setReadyToSave(true);
        } else {
          setPendingRemoteTimestamp(updatedAt);
        }
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
    isAuthenticated,
    localState,
    pendingRemoteTimestamp,
    readyToSave,
    remoteResult,
    replaceState,
    storageHydrated,
  ]);

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

  return null;
}
