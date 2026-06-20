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
  defaultOpportunityRate,
  detailScenarioIdAtom,
  includeRefinancingAtom,
  opportunityRateAtom,
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
import { authClient } from "~/lib/auth-client";
import { normalizeCredit, serializeCreditForConvex } from "~/lib/credit";

const APP_STORAGE_KEYS = [
  "scenarios",
  "activeScenarioId",
  "scenarioValues",
  "comparedScenarioIds",
  "detailScenarioId",
  "liquidityScenarios",
  "activeLiquidityScenarioId",
  "liquidityScenarioValues",
  "includeRefinancing",
  "analysisHorizonYears",
  "opportunityRate",
] as const;

type SyncedState = {
  version: 1;
  scenarios: Record<string, Scenario>;
  activeScenarioId: string;
  scenarioValues: Record<string, ScenarioValues>;
  comparedScenarioIds: string[];
  detailScenarioId: string;
  liquidityScenarios: Record<string, LiquidityScenario>;
  activeLiquidityScenarioId: string;
  liquidityScenarioValues: Record<string, LiquidityScenarioValues>;
  includeRefinancing: boolean;
  analysisHorizonYears: number;
  opportunityRate: number;
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
    (value.detailScenarioId === undefined ||
      typeof value.detailScenarioId === "string") &&
    isRecord(value.liquidityScenarios) &&
    typeof value.activeLiquidityScenarioId === "string" &&
    isRecord(value.liquidityScenarioValues) &&
    typeof value.includeRefinancing === "boolean" &&
    typeof value.analysisHorizonYears === "number" &&
    (value.opportunityRate === undefined ||
      typeof value.opportunityRate === "number")
  );
}

function normalizeScenarioValues(
  values: Record<string, ScenarioValues>,
): Record<string, ScenarioValues> {
  return Object.fromEntries(
    Object.entries(values).map(([scenarioId, scenarioValues]) => [
      scenarioId,
      {
        ...scenarioValues,
        sollzins: scenarioValues.sollzins ?? scenarioValues.effzins,
        credits: Object.fromEntries(
          Object.entries(scenarioValues.credits ?? {}).flatMap(
            ([creditId, credit]) => {
              const normalized = normalizeCredit(credit);
              return normalized ? [[creditId, normalized]] : [];
            },
          ),
        ),
      },
    ]),
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
    detailScenarioId: "",
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
    opportunityRate: defaultOpportunityRate,
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
          sollzins: values.sollzins ?? values.effzins,
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
      Object.entries(values.credits).flatMap(([creditId, data]) => {
        const normalized = normalizeCredit(data);
        return normalized
          ? [
              {
                scenarioId,
                creditId,
                data: serializeCreditForConvex(normalized),
              },
            ]
          : [];
      }),
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
      detailScenarioId: state.detailScenarioId,
      activeLiquidityScenarioId: state.activeLiquidityScenarioId,
      includeRefinancing: state.includeRefinancing,
      analysisHorizonYears: state.analysisHorizonYears,
      opportunityRate: state.opportunityRate,
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
            sollzins: values.sollzins ?? values.effzins,
            effzins: values.effzins,
            kaufpreis: values.kaufpreis,
            modernisierungskosten: values.modernisierungskosten,
            eigenkapital: values.eigenkapital,
            tilgungssatz: values.tilgungssatz,
            zinsbindung: values.zinsbindung,
          },
          credits: Object.entries(values.credits).flatMap(
            ([creditId, data]) => {
              const normalized = normalizeCredit(data);
              return normalized
                ? [
                    {
                      creditId,
                      data: serializeCreditForConvex(normalized),
                    },
                  ]
                : [];
            },
          ),
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
  const session = authClient.useSession();
  const remoteResult = useQuery(
    api.appState.getForCurrentUser,
    isAuthenticated ? {} : "skip",
  ) as RemoteState | null | undefined;
  const importLocalScenarios = useMutation(api.appState.importLocalScenarios);
  const deleteFinancingScenario = useMutation(
    api.appState.deleteFinancingScenario,
  );
  const deleteLiquidityScenario = useMutation(
    api.appState.deleteLiquidityScenario,
  );
  const replaceState = useMutation(api.appState.replaceForCurrentUser);
  const saveFinancingScenario = useMutation(api.appState.saveFinancingScenario);
  const saveLiquidityScenario = useMutation(api.appState.saveLiquidityScenario);
  const saveSettings = useMutation(api.appState.saveSettings);
  const [scenarios, setScenarios] = useAtom(scenariosAtom);
  const [activeScenarioId, setActiveScenarioId] = useAtom(activeScenarioIdAtom);
  const [scenarioValues, setScenarioValues] = useAtom(scenarioValuesAtom);
  const [comparedScenarioIds, setComparedScenarioIds] = useAtom(
    comparedScenarioIdsAtom,
  );
  const [detailScenarioId, setDetailScenarioId] = useAtom(detailScenarioIdAtom);
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
  const [opportunityRate, setOpportunityRate] = useAtom(opportunityRateAtom);
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
    upgradeState?: SyncedState;
  } | null>(null);
  const [accountUpgradeState, setAccountUpgradeState] =
    useState<SyncedState | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const importPreview = useQuery(
    api.appState.previewLocalScenarios,
    importReview?.imports ?? "skip",
  );
  const initializationRunning = useRef(false);
  const lastSyncedPayload = useRef<string | null>(null);
  const lastSyncedState = useRef<SyncedState | null>(null);
  const anonymousSignInRunning = useRef(false);
  const previousSessionUser = useRef<{
    id: string;
    isAnonymous: boolean;
  } | null>(null);

  const localState = useMemo<SyncedState>(
    () => ({
      version: 1,
      scenarios,
      activeScenarioId,
      scenarioValues,
      comparedScenarioIds,
      detailScenarioId,
      liquidityScenarios,
      activeLiquidityScenarioId,
      liquidityScenarioValues,
      includeRefinancing,
      analysisHorizonYears,
      opportunityRate,
    }),
    [
      activeLiquidityScenarioId,
      activeScenarioId,
      analysisHorizonYears,
      comparedScenarioIds,
      detailScenarioId,
      includeRefinancing,
      liquidityScenarioValues,
      liquidityScenarios,
      opportunityRate,
      scenarioValues,
      scenarios,
    ],
  );
  const localPayload = useMemo(() => JSON.stringify(localState), [localState]);

  const applyState = useCallback(
    (state: SyncedState) => {
      setScenarios(state.scenarios);
      setActiveScenarioId(state.activeScenarioId);
      setScenarioValues(normalizeScenarioValues(state.scenarioValues));
      setComparedScenarioIds(state.comparedScenarioIds);
      setDetailScenarioId(state.detailScenarioId ?? "");
      setLiquidityScenarios(state.liquidityScenarios);
      setActiveLiquidityScenarioId(state.activeLiquidityScenarioId);
      setLiquidityScenarioValues(state.liquidityScenarioValues);
      setIncludeRefinancing(state.includeRefinancing);
      setAnalysisHorizonYears(state.analysisHorizonYears);
      setOpportunityRate(state.opportunityRate ?? defaultOpportunityRate);
    },
    [
      setActiveLiquidityScenarioId,
      setActiveScenarioId,
      setAnalysisHorizonYears,
      setComparedScenarioIds,
      setDetailScenarioId,
      setIncludeRefinancing,
      setLiquidityScenarioValues,
      setLiquidityScenarios,
      setOpportunityRate,
      setScenarioValues,
      setScenarios,
    ],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setStorageHydrated(true), 100);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (session.isPending) return;

    const nextUser = session.data
      ? {
          id: session.data.user.id,
          isAnonymous: Boolean(session.data.user.isAnonymous),
        }
      : null;
    const previousUser = previousSessionUser.current;
    const signedOutToGuest =
      previousUser !== null &&
      !previousUser.isAnonymous &&
      (nextUser === null || nextUser.isAnonymous);
    const signedInFromGuest =
      previousUser !== null &&
      previousUser.isAnonymous &&
      nextUser !== null &&
      !nextUser.isAnonymous;

    if (signedOutToGuest) {
      applyState(defaultSyncedState());
      clearLocalAppData();
      setImportReview(null);
      setAccountUpgradeState(null);
      setPendingRemoteTimestamp(null);
      setReadyToSave(false);
      initializationRunning.current = false;
      lastSyncedPayload.current = null;
      lastSyncedState.current = null;
    }
    if (signedInFromGuest) {
      setAccountUpgradeState(localState);
      setImportReview(null);
      setPendingRemoteTimestamp(null);
      setReadyToSave(false);
      initializationRunning.current = false;
      lastSyncedPayload.current = null;
      lastSyncedState.current = null;
    }

    previousSessionUser.current = nextUser;
  }, [applyState, localState, session.data, session.isPending]);

  useEffect(() => {
    if (session.isPending || session.data || anonymousSignInRunning.current) {
      return;
    }

    anonymousSignInRunning.current = true;
    void authClient.signIn
      .anonymous()
      .catch((error: unknown) => {
        console.error("Failed to create anonymous session", error);
      })
      .finally(() => {
        anonymousSignInRunning.current = false;
      });
  }, [session.data, session.isPending]);

  useEffect(() => {
    if (!isAuthenticated) {
      setReadyToSave(false);
      setPendingRemoteTimestamp(null);
      initializationRunning.current = false;
      lastSyncedPayload.current = null;
      lastSyncedState.current = null;
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
      lastSyncedState.current = remoteResult.state;
      clearLocalAppData();
      setPendingRemoteTimestamp(null);
      setReadyToSave(true);
      return;
    }
    if (pendingRemoteTimestamp !== null) return;

    initializationRunning.current = true;
    const localDataExists = hasLocalAppData();
    const pendingLocalState = accountUpgradeState ?? localState;
    const shouldImportLocalState =
      accountUpgradeState !== null || localDataExists;

    if (remoteResult === null) {
      const remoteState = defaultSyncedState();
      if (!shouldImportLocalState) {
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

      if (accountUpgradeState !== null) {
        void toLocalImports(accountUpgradeState, remoteState)
          .then((imports) => {
            setImportReview({
              imports,
              remoteState,
              remoteWasNull: true,
              needsMigration: false,
              upgradeState: accountUpgradeState,
            });
          })
          .catch((error: unknown) => {
            console.error("Failed to prepare anonymous state import", error);
          })
          .finally(() => {
            initializationRunning.current = false;
          });
        return;
      }

      void toLocalImports(pendingLocalState, remoteState)
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

    if (!shouldImportLocalState) {
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
      lastSyncedState.current = remoteResult.state;
      clearLocalAppData();
      setReadyToSave(true);
      initializationRunning.current = false;
      return;
    }

    void toLocalImports(pendingLocalState, remoteResult.state)
      .then(async (imports) => {
        if (
          imports.financing.length === 0 &&
          imports.liquidity.length === 0 &&
          accountUpgradeState === null
        ) {
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
          lastSyncedState.current = remoteResult.state as SyncedState;
          clearLocalAppData();
          setAccountUpgradeState(null);
          setReadyToSave(true);
          return;
        }
        setImportReview({
          imports,
          remoteState: remoteResult.state as SyncedState,
          remoteWasNull: false,
          needsMigration: remoteResult.needsMigration,
          upgradeState: accountUpgradeState ?? undefined,
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
    accountUpgradeState,
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

  const finishWithoutImport = useCallback(async () => {
    if (!importReview) return;
    setReviewSubmitting(true);
    try {
      if (importReview.remoteWasNull || importReview.needsMigration) {
        const updatedAt = await replaceState(
          toConvexSnapshot(importReview.remoteState),
        );
        clearLocalAppData();
        setAccountUpgradeState(null);
        setImportReview(null);
        setPendingRemoteTimestamp(updatedAt);
        return;
      }

      applyState(importReview.remoteState);
      lastSyncedPayload.current = JSON.stringify(importReview.remoteState);
      lastSyncedState.current = importReview.remoteState;
      clearLocalAppData();
      setAccountUpgradeState(null);
      setImportReview(null);
      setReadyToSave(true);
    } catch (error) {
      console.error("Failed to discard local scenarios", error);
    } finally {
      setReviewSubmitting(false);
    }
  }, [applyState, importReview, replaceState]);

  useEffect(() => {
    if (
      importReview === null ||
      importPreview === undefined ||
      reviewSubmitting ||
      importReview.upgradeState !== undefined
    ) {
      return;
    }

    const rows = [...importPreview.financing, ...importPreview.liquidity];
    const hasNewRows = rows.some((row) => row.status === "new");
    if (hasNewRows) return;

    void finishWithoutImport();
  }, [finishWithoutImport, importPreview, importReview, reviewSubmitting]);

  async function importReviewedScenarios() {
    if (!importReview) return;
    setReviewSubmitting(true);
    try {
      if (importReview.remoteWasNull && importReview.upgradeState) {
        const updatedAt = await replaceState(
          toConvexSnapshot(importReview.upgradeState),
        );
        clearLocalAppData();
        setAccountUpgradeState(null);
        setImportReview(null);
        setPendingRemoteTimestamp(updatedAt);
        return;
      }

      if (importReview.remoteWasNull) {
        const defaultUpdatedAt = await replaceState(
          toConvexSnapshot(importReview.remoteState),
        );
        const importUpdatedAt = await importLocalScenarios(
          importReview.imports,
        );
        clearLocalAppData();
        setAccountUpgradeState(null);
        setImportReview(null);
        setPendingRemoteTimestamp(importUpdatedAt ?? defaultUpdatedAt);
        return;
      }

      const updatedAt = await importLocalScenarios(importReview.imports);
      clearLocalAppData();
      setAccountUpgradeState(null);
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
        lastSyncedState.current = importReview.remoteState;
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
      const previousState =
        lastSyncedState.current ??
        (lastSyncedPayload.current
          ? (JSON.parse(lastSyncedPayload.current) as SyncedState)
          : null);
      if (previousState === null) return;

      const snapshot = localState;
      const payload = JSON.stringify(snapshot);
      const previousSnapshot = toConvexSnapshot(previousState);
      const nextSnapshot = toConvexSnapshot(snapshot);
      lastSyncedPayload.current = payload;
      lastSyncedState.current = snapshot;

      void (async () => {
        const nextFinancingIds = new Set(
          nextSnapshot.financingScenarios.map((row) => row.scenarioId),
        );
        const nextLiquidityIds = new Set(
          nextSnapshot.liquidityScenarios.map((row) => row.scenarioId),
        );

        await Promise.all([
          ...previousSnapshot.financingScenarios
            .filter((row) => !nextFinancingIds.has(row.scenarioId))
            .map((row) =>
              deleteFinancingScenario({ scenarioId: row.scenarioId }),
            ),
          ...previousSnapshot.liquidityScenarios
            .filter((row) => !nextLiquidityIds.has(row.scenarioId))
            .map((row) =>
              deleteLiquidityScenario({ scenarioId: row.scenarioId }),
            ),
          ...nextSnapshot.financingScenarios
            .filter((scenario) => {
              const previousScenario = previousSnapshot.financingScenarios.find(
                (row) => row.scenarioId === scenario.scenarioId,
              );
              const previousCredits = previousSnapshot.credits.filter(
                (row) => row.scenarioId === scenario.scenarioId,
              );
              const nextCredits = nextSnapshot.credits.filter(
                (row) => row.scenarioId === scenario.scenarioId,
              );
              return (
                JSON.stringify(previousScenario) !== JSON.stringify(scenario) ||
                JSON.stringify(previousCredits) !== JSON.stringify(nextCredits)
              );
            })
            .map((scenario) =>
              saveFinancingScenario({
                scenario,
                credits: nextSnapshot.credits
                  .filter((row) => row.scenarioId === scenario.scenarioId)
                  .map((row) => ({
                    creditId: row.creditId,
                    data: row.data,
                  })),
              }),
            ),
          ...nextSnapshot.liquidityScenarios
            .filter((scenario) => {
              const previousScenario = previousSnapshot.liquidityScenarios.find(
                (row) => row.scenarioId === scenario.scenarioId,
              );
              const previousItems = previousSnapshot.liquidityItems.filter(
                (row) => row.scenarioId === scenario.scenarioId,
              );
              const nextItems = nextSnapshot.liquidityItems.filter(
                (row) => row.scenarioId === scenario.scenarioId,
              );
              return (
                JSON.stringify(previousScenario) !== JSON.stringify(scenario) ||
                JSON.stringify(previousItems) !== JSON.stringify(nextItems)
              );
            })
            .map((scenario) =>
              saveLiquidityScenario({
                scenario,
                items: nextSnapshot.liquidityItems
                  .filter((row) => row.scenarioId === scenario.scenarioId)
                  .map((row) => ({
                    itemId: row.itemId,
                    position: row.position,
                    data: row.data,
                  })),
              }),
            ),
        ]);

        if (
          JSON.stringify(previousSnapshot.settings) !==
          JSON.stringify(nextSnapshot.settings)
        ) {
          await saveSettings({ settings: nextSnapshot.settings });
        }
      })()
        .then(() => clearLocalAppData())
        .catch((error: unknown) => {
          lastSyncedPayload.current = null;
          lastSyncedState.current = previousState;
          console.error("Failed to sync state to Convex", error);
        });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    deleteFinancingScenario,
    deleteLiquidityScenario,
    isAuthenticated,
    localPayload,
    localState,
    readyToSave,
    saveFinancingScenario,
    saveLiquidityScenario,
    saveSettings,
  ]);

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
    if (localPayload !== lastSyncedPayload.current) return;
    if (remotePayload === lastSyncedPayload.current) return;

    lastSyncedPayload.current = remotePayload;
    lastSyncedState.current = remoteResult.state;
    applyState(remoteResult.state);
  }, [applyState, localPayload, readyToSave, remoteResult]);

  const previewRows = importPreview
    ? [...importPreview.financing, ...importPreview.liquidity]
    : [];
  const newCount = previewRows.filter((row) => row.status === "new").length;
  const isAccountUpgrade = importReview?.upgradeState !== undefined;
  const replacesEmptyAccount =
    importReview?.remoteWasNull === true && isAccountUpgrade;
  const dialogTitle = isAccountUpgrade
    ? "Gastdaten übernehmen?"
    : "Lokale Szenarien prüfen";
  const dialogDescription = replacesEmptyAccount
    ? "Du hast als Gast Daten eingegeben. Dein Account ist noch leer. Entscheide, ob diese Daten in den Account übernommen werden sollen."
    : isAccountUpgrade
      ? "Du hast als Gast Daten eingegeben. Dein Account enthält bereits Daten. Neue Gast-Szenarien können zusätzlich übernommen werden."
      : "Im Browser wurden lokale Daten gefunden. Prüfe, welche Szenarien zusätzlich in Convex übernommen werden sollen.";
  const discardLabel = isAccountUpgrade
    ? "Gastdaten verwerfen"
    : "Lokale Daten verwerfen";
  const importLabel = replacesEmptyAccount
    ? "Gastdaten übernehmen"
    : newCount > 0
      ? `${newCount} neue importieren`
      : "Ohne Import fortfahren";

  return (
    <Dialog open={importReview !== null}>
      <DialogContent
        showCloseButton={false}
        className="border-neutral-300 bg-white text-black sm:max-w-xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
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
            {previewRows.length === 0 && !replacesEmptyAccount && (
              <p className="text-sm text-neutral-600">
                Es wurden keine zusätzlichen Gast-Szenarien gefunden.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={reviewSubmitting || importPreview === undefined}
            onClick={() => void finishWithoutImport()}
          >
            {discardLabel}
          </Button>
          <Button
            type="button"
            disabled={reviewSubmitting || importPreview === undefined}
            onClick={() => void importReviewedScenarios()}
          >
            {importLabel}
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
