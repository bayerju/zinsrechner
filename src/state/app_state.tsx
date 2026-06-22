"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";
import { authClient } from "~/lib/auth-client";
import { normalizeCredit, serializeCreditForConvex } from "~/lib/credit";
import {
  defaultAnalysisHorizonYears,
  defaultOpportunityRate,
} from "./analysis_settings_atom";
import {
  defaultLiquidityScenarioId,
  defaultLiquidityScenarios,
  defaultLiquidityScenarioValues,
  normalizeLiquidityScenarioValues,
  type LiquidityScenario,
  type LiquidityScenarioValues,
} from "./liquidity_scenarios_atom";
import {
  defaultScenarioId,
  defaultScenarios,
  type Scenario,
} from "./scenarios_atom";
import {
  defaultScenarioValues,
  normalizeScenarioValues,
  type ScenarioValues,
} from "./scenario_values_atom";

type SyncedState = {
  version: 1;
  projects: Record<string, Project>;
  activeProjectId: string;
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

type Project = {
  id: string;
  name: string;
  createdAt: number;
  lastActiveScenarioId?: string;
  lastActiveLiquidityScenarioId?: string;
};

type SharedProjectResult = NonNullable<
  ReturnType<typeof useQuery<typeof api.appState.getSharedProject>>
>;

type Settings = {
  activeProjectId?: string;
  activeScenarioId: string;
  comparedScenarioIds: string[];
  detailScenarioId?: string;
  activeLiquidityScenarioId: string;
  includeRefinancing: boolean;
  analysisHorizonYears: number;
  opportunityRate?: number;
};

type AppStateContextValue = {
  state: SyncedState;
  projects: Record<string, Project>;
  projectList: Project[];
  activeProjectId: string;
  activeProject: Project;
  scenarios: Record<string, Scenario>;
  scenarioList: Scenario[];
  activeScenarioId: string;
  activeScenario: Scenario;
  scenarioValues: Record<string, ScenarioValues>;
  activeScenarioValues: ScenarioValues;
  credits: ScenarioValues["credits"];
  comparedScenarioIds: string[];
  detailScenarioId: string;
  liquidityScenarios: Record<string, LiquidityScenario>;
  liquidityScenarioList: LiquidityScenario[];
  activeLiquidityScenarioId: string;
  activeLiquidityScenario: LiquidityScenario;
  liquidityScenarioValues: Record<string, LiquidityScenarioValues>;
  activeLiquidityScenarioValues: LiquidityScenarioValues;
  includeRefinancing: boolean;
  analysisHorizonYears: number;
  opportunityRate: number;
  setSettings: (settings: Partial<Settings>) => Promise<void>;
  setActiveProjectId: (projectId: string) => Promise<void>;
  createProject: (options: {
    id: string;
    name: string;
    createdAt: number;
  }) => Promise<void>;
  renameProject: (projectId: string, name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  createProjectShare: (
    projectId: string,
    liquidityScenarioIds: string[],
    access: "view" | "edit",
  ) => Promise<string>;
  revokeProjectShare: (projectId: string) => Promise<void>;
  importSharedProject: (token: string) => Promise<string>;
  setActiveScenarioId: (scenarioId: string) => Promise<void>;
  createScenario: (options: {
    id: string;
    name: string;
    createdAt: number;
    color: string;
    duplicateFromActive: boolean;
  }) => Promise<void>;
  renameScenario: (scenarioId: string, name: string) => Promise<void>;
  deleteScenario: (scenarioId: string) => Promise<void>;
  updateActiveScenarioValues: (
    update: ScenarioValues | ((prev: ScenarioValues) => ScenarioValues),
  ) => Promise<void>;
  setCredits: (
    update:
      | ScenarioValues["credits"]
      | ((prev: ScenarioValues["credits"]) => ScenarioValues["credits"]),
  ) => Promise<void>;
  setActiveLiquidityScenarioId: (scenarioId: string) => Promise<void>;
  createLiquidityScenario: (options: {
    id: string;
    name: string;
    createdAt: number;
    color: string;
    duplicateFromActive: boolean;
  }) => Promise<void>;
  renameLiquidityScenario: (scenarioId: string, name: string) => Promise<void>;
  deleteLiquidityScenarioById: (scenarioId: string) => Promise<void>;
  updateActiveLiquidityScenarioValues: (
    update:
      | LiquidityScenarioValues
      | ((prev: LiquidityScenarioValues) => LiquidityScenarioValues),
  ) => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSyncedState(value: unknown): value is SyncedState {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    (value.projects === undefined || isRecord(value.projects)) &&
    (value.activeProjectId === undefined ||
      typeof value.activeProjectId === "string") &&
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

const defaultProjectId = "default";

function defaultProjects(): Record<string, Project> {
  return {
    [defaultProjectId]: {
      id: defaultProjectId,
      name: "Mein Projekt",
      createdAt: 0,
    },
  };
}

function defaultSyncedState(): SyncedState {
  return {
    version: 1,
    projects: defaultProjects(),
    activeProjectId: defaultProjectId,
    scenarios: structuredClone(defaultScenarios),
    activeScenarioId: defaultScenarioId,
    scenarioValues: {
      [defaultScenarioId]: structuredClone(defaultScenarioValues),
    },
    comparedScenarioIds: [],
    detailScenarioId: "",
    liquidityScenarios: structuredClone(defaultLiquidityScenarios),
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

function normalizeState(state: SyncedState): SyncedState {
  const projects =
    state.projects && Object.keys(state.projects).length > 0
      ? state.projects
      : defaultProjects();
  const projectIds = Object.keys(projects);
  const activeProjectId = projects[state.activeProjectId]
    ? state.activeProjectId
    : (projectIds[0] ?? defaultProjectId);
  const scenarios =
    Object.keys(state.scenarios).length > 0
      ? state.scenarios
      : structuredClone(defaultScenarios);
  const scenarioIds = Object.keys(scenarios);
  const activeScenarioId = scenarios[state.activeScenarioId]
    ? state.activeScenarioId
    : (scenarioIds[0] ?? defaultScenarioId);
  const scenarioValues = Object.fromEntries(
    Object.entries(scenarios).map(([scenarioId]) => [
      scenarioId,
      normalizeScenarioValues(
        state.scenarioValues[scenarioId] ??
          (scenarioId === defaultScenarioId
            ? defaultScenarioValues
            : defaultScenarioValues),
      ),
    ]),
  );

  const liquidityScenarios =
    Object.keys(state.liquidityScenarios).length > 0
      ? state.liquidityScenarios
      : structuredClone(defaultLiquidityScenarios);
  const liquidityIds = Object.keys(liquidityScenarios);
  const activeLiquidityScenarioId = liquidityScenarios[
    state.activeLiquidityScenarioId
  ]
    ? state.activeLiquidityScenarioId
    : (liquidityIds[0] ?? defaultLiquidityScenarioId);
  const liquidityScenarioValues = Object.fromEntries(
    Object.entries(liquidityScenarios).map(([scenarioId]) => [
      scenarioId,
      normalizeLiquidityScenarioValues(
        state.liquidityScenarioValues[scenarioId] ??
          defaultLiquidityScenarioValues,
      ),
    ]),
  );

  return {
    ...state,
    projects,
    activeProjectId,
    scenarios,
    activeScenarioId,
    scenarioValues,
    comparedScenarioIds: state.comparedScenarioIds.filter(
      (id) => scenarios[id],
    ),
    detailScenarioId: scenarios[state.detailScenarioId]
      ? state.detailScenarioId
      : activeScenarioId,
    liquidityScenarios,
    activeLiquidityScenarioId,
    liquidityScenarioValues,
    analysisHorizonYears:
      Number.isFinite(state.analysisHorizonYears) &&
      state.analysisHorizonYears > 0
        ? state.analysisHorizonYears
        : defaultAnalysisHorizonYears,
    opportunityRate:
      typeof state.opportunityRate === "number"
        ? state.opportunityRate
        : defaultOpportunityRate,
  };
}

function toConvexSnapshot(state: SyncedState) {
  const projectId = state.activeProjectId;
  const projects = Object.values(state.projects).map((project) => ({
    projectId: project.id,
    name: project.name,
    createdAt: project.createdAt,
  }));
  const financingScenarios = Object.values(state.scenarios).flatMap(
    (scenario) => {
      const values = state.scenarioValues[scenario.id];
      if (!values) return [];
      return [
        {
          scenarioId: scenario.id,
          projectId,
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
                projectId,
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
          projectId,
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
        projectId,
        itemId: data.id,
        position,
        data,
      })),
  );

  return {
    projects,
    settings: toSettings(state),
    financingScenarios,
    credits,
    liquidityScenarios,
    liquidityItems,
  };
}

function toSettings(state: SyncedState): Settings {
  return {
    activeProjectId: state.activeProjectId,
    activeScenarioId: state.activeScenarioId,
    comparedScenarioIds: state.comparedScenarioIds,
    detailScenarioId: state.detailScenarioId,
    activeLiquidityScenarioId: state.activeLiquidityScenarioId,
    includeRefinancing: state.includeRefinancing,
    analysisHorizonYears: state.analysisHorizonYears,
    opportunityRate: state.opportunityRate,
  };
}

function sharedProjectToState(shared: SharedProjectResult): SyncedState {
  const scenarios: Record<string, Scenario> = {};
  const scenarioValues: Record<string, ScenarioValues> = {};
  for (const scenario of shared.financingScenarios) {
    scenarios[scenario.scenarioId] = {
      id: scenario.scenarioId,
      name: scenario.name,
      createdAt: scenario.createdAt,
      color: scenario.color,
    };
    scenarioValues[scenario.scenarioId] = normalizeScenarioValues({
      sollzins: scenario.sollzins ?? scenario.effzins,
      effzins: scenario.effzins,
      kaufpreis: scenario.kaufpreis,
      modernisierungskosten: scenario.modernisierungskosten,
      eigenkapital: scenario.eigenkapital,
      tilgungssatz: scenario.tilgungssatz,
      zinsbindung: scenario.zinsbindung,
      credits: {},
    });
  }
  for (const credit of shared.credits) {
    const values = scenarioValues[credit.scenarioId];
    const normalized = normalizeCredit(credit.data);
    if (values && normalized) values.credits[credit.creditId] = normalized;
  }

  const liquidityScenarios: Record<string, LiquidityScenario> = {};
  const liquidityScenarioValues: Record<string, LiquidityScenarioValues> = {};
  for (const scenario of shared.liquidityScenarios) {
    liquidityScenarios[scenario.scenarioId] = {
      id: scenario.scenarioId,
      name: scenario.name,
      createdAt: scenario.createdAt,
      color: scenario.color,
    };
    liquidityScenarioValues[scenario.scenarioId] =
      normalizeLiquidityScenarioValues({
        startCapital: scenario.startCapital,
        startMonth: scenario.startMonth,
        horizonMonths: scenario.horizonMonths,
        creditScenarioId: scenario.creditScenarioId,
        items: [],
      });
  }
  for (const item of [...shared.liquidityItems].sort(
    (left, right) => left.position - right.position,
  )) {
    const values = liquidityScenarioValues[item.scenarioId];
    if (values) {
      values.items.push(
        item.data as unknown as LiquidityScenarioValues["items"][number],
      );
    }
  }

  const firstScenarioId =
    shared.financingScenarios[0]?.scenarioId ?? defaultScenarioId;
  const firstLiquidityScenarioId =
    shared.liquidityScenarios[0]?.scenarioId ?? defaultLiquidityScenarioId;

  return normalizeState({
    version: 1,
    projects: {
      [shared.project.projectId]: {
        id: shared.project.projectId,
        name: shared.project.name,
        createdAt: shared.project.createdAt,
      },
    },
    activeProjectId: shared.project.projectId,
    scenarios,
    activeScenarioId: firstScenarioId,
    scenarioValues,
    comparedScenarioIds: [],
    detailScenarioId: firstScenarioId,
    liquidityScenarios,
    activeLiquidityScenarioId: firstLiquidityScenarioId,
    liquidityScenarioValues,
    includeRefinancing: false,
    analysisHorizonYears: defaultAnalysisHorizonYears,
    opportunityRate: defaultOpportunityRate,
  });
}

function updateQueryState(
  localStore: OptimisticLocalStore,
  updater: (state: SyncedState) => SyncedState,
) {
  const current = localStore.getQuery(api.appState.getForCurrentUser, {});
  if (!current || !isSyncedState(current.state)) return;
  localStore.setQuery(
    api.appState.getForCurrentUser,
    {},
    {
      ...current,
      state: normalizeState(updater(normalizeState(current.state))),
      updatedAt: Date.now(),
      needsMigration: false,
    },
  );
}

function applyScenarioToState(
  state: SyncedState,
  scenarioId: string,
  values: ScenarioValues,
  scenario?: Scenario,
) {
  const currentScenario = scenario ?? state.scenarios[scenarioId];
  if (!currentScenario) return state;
  return normalizeState({
    ...state,
    scenarios: {
      ...state.scenarios,
      [scenarioId]: currentScenario,
    },
    scenarioValues: {
      ...state.scenarioValues,
      [scenarioId]: normalizeScenarioValues(values),
    },
  });
}

function scenarioMutationPayload(
  projectId: string,
  scenario: Scenario,
  values: ScenarioValues,
) {
  return {
    scenario: {
      projectId,
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
    credits: Object.entries(values.credits).flatMap(([creditId, data]) => {
      const normalized = normalizeCredit(data);
      return normalized
        ? [{ creditId, data: serializeCreditForConvex(normalized) }]
        : [];
    }),
  };
}

function liquidityMutationPayload(
  projectId: string,
  scenario: LiquidityScenario,
  values: LiquidityScenarioValues,
) {
  return {
    scenario: {
      projectId,
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
  };
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-900 text-neutral-100">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-500 border-t-white" />
    </main>
  );
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const shareToken = pathname.startsWith("/projekt/share/")
    ? pathname.split("/")[3]
    : undefined;
  const [shareSettings, setShareSettings] = useState<Partial<Settings>>({});
  const session = authClient.useSession();
  const { isAuthenticated } = useConvexAuth();
  const anonymousSignInRunning = useRef(false);
  const initializingRemote = useRef(false);

  const remoteResult = useQuery(
    api.appState.getForCurrentUser,
    isAuthenticated && shareToken === undefined ? {} : "skip",
  );
  const sharedProject = useQuery(
    api.appState.getSharedProject,
    shareToken ? { token: shareToken } : "skip",
  );

  const replaceState = useMutation(api.appState.replaceForCurrentUser);
  const saveProjectMutation = useMutation(api.appState.saveProject);
  const deleteProjectMutation = useMutation(api.appState.deleteProject);
  const createProjectShareMutation = useMutation(
    api.appState.createProjectShare,
  );
  const revokeProjectShareMutation = useMutation(
    api.appState.revokeProjectShare,
  );
  const importSharedProjectMutation = useMutation(
    api.appState.importSharedProject,
  );
  const saveSettingsMutation = useMutation(
    api.appState.saveSettings,
  ).withOptimisticUpdate((localStore, args) => {
    updateQueryState(localStore, (state) =>
      normalizeState({
        ...state,
        ...args.settings,
        activeProjectId: args.settings.activeProjectId ?? state.activeProjectId,
        detailScenarioId: args.settings.detailScenarioId ?? "",
        opportunityRate:
          args.settings.opportunityRate ?? defaultOpportunityRate,
      }),
    );
  });
  const saveFinancingScenarioMutation = useMutation(
    api.appState.saveFinancingScenario,
  ).withOptimisticUpdate((localStore, args) => {
    updateQueryState(localStore, (state) => {
      const values = normalizeScenarioValues({
        sollzins: args.scenario.sollzins ?? args.scenario.effzins,
        effzins: args.scenario.effzins,
        kaufpreis: args.scenario.kaufpreis,
        modernisierungskosten: args.scenario.modernisierungskosten,
        eigenkapital: args.scenario.eigenkapital,
        tilgungssatz: args.scenario.tilgungssatz,
        zinsbindung: args.scenario.zinsbindung,
        credits: Object.fromEntries(
          args.credits.flatMap((credit) => {
            const normalized = normalizeCredit(credit.data);
            return normalized ? [[credit.creditId, normalized]] : [];
          }),
        ),
      });
      return applyScenarioToState(state, args.scenario.scenarioId, values, {
        id: args.scenario.scenarioId,
        name: args.scenario.name,
        createdAt: args.scenario.createdAt,
        color: args.scenario.color,
      });
    });
  });
  const deleteFinancingScenarioMutation = useMutation(
    api.appState.deleteFinancingScenario,
  ).withOptimisticUpdate((localStore, args) => {
    updateQueryState(localStore, (state) => {
      const scenarios = { ...state.scenarios };
      const scenarioValues = { ...state.scenarioValues };
      delete scenarios[args.scenarioId];
      delete scenarioValues[args.scenarioId];
      const nextIds = Object.keys(scenarios);
      const activeScenarioId = scenarios[state.activeScenarioId]
        ? state.activeScenarioId
        : (nextIds[0] ?? defaultScenarioId);
      return normalizeState({
        ...state,
        scenarios,
        scenarioValues,
        activeScenarioId,
        comparedScenarioIds: state.comparedScenarioIds.filter(
          (id) => id !== args.scenarioId,
        ),
        detailScenarioId:
          state.detailScenarioId === args.scenarioId
            ? activeScenarioId
            : state.detailScenarioId,
      });
    });
  });
  const saveLiquidityScenarioMutation = useMutation(
    api.appState.saveLiquidityScenario,
  ).withOptimisticUpdate((localStore, args) => {
    updateQueryState(localStore, (state) =>
      normalizeState({
        ...state,
        liquidityScenarios: {
          ...state.liquidityScenarios,
          [args.scenario.scenarioId]: {
            id: args.scenario.scenarioId,
            name: args.scenario.name,
            createdAt: args.scenario.createdAt,
            color: args.scenario.color,
          },
        },
        liquidityScenarioValues: {
          ...state.liquidityScenarioValues,
          [args.scenario.scenarioId]: normalizeLiquidityScenarioValues({
            startCapital: args.scenario.startCapital,
            startMonth: args.scenario.startMonth,
            horizonMonths: args.scenario.horizonMonths,
            creditScenarioId: args.scenario.creditScenarioId,
            items: args.items
              .slice()
              .sort((left, right) => left.position - right.position)
              .map(
                (item) =>
                  item.data as unknown as LiquidityScenarioValues["items"][number],
              ),
          }),
        },
      }),
    );
  });
  const deleteLiquidityScenarioMutation = useMutation(
    api.appState.deleteLiquidityScenario,
  ).withOptimisticUpdate((localStore, args) => {
    updateQueryState(localStore, (state) => {
      const liquidityScenarios = { ...state.liquidityScenarios };
      const liquidityScenarioValues = { ...state.liquidityScenarioValues };
      delete liquidityScenarios[args.scenarioId];
      delete liquidityScenarioValues[args.scenarioId];
      const nextIds = Object.keys(liquidityScenarios);
      return normalizeState({
        ...state,
        liquidityScenarios,
        liquidityScenarioValues,
        activeLiquidityScenarioId: liquidityScenarios[
          state.activeLiquidityScenarioId
        ]
          ? state.activeLiquidityScenarioId
          : (nextIds[0] ?? defaultLiquidityScenarioId),
      });
    });
  });

  const bypassAppState = false;

  useEffect(() => {
    setShareSettings({});
  }, [shareToken]);

  useEffect(() => {
    if (shareToken !== undefined) return;
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
  }, [session.data, session.isPending, shareToken]);

  useEffect(() => {
    if (
      shareToken !== undefined ||
      !isAuthenticated ||
      remoteResult === undefined
    )
      return;
    if (remoteResult !== null && !remoteResult.needsMigration) return;
    if (initializingRemote.current) return;

    initializingRemote.current = true;
    const nextState =
      remoteResult !== null && isSyncedState(remoteResult.state)
        ? normalizeState(remoteResult.state)
        : defaultSyncedState();

    void replaceState(toConvexSnapshot(nextState))
      .catch((error: unknown) => {
        console.error("Failed to initialize Convex state", error);
      })
      .finally(() => {
        initializingRemote.current = false;
      });
  }, [isAuthenticated, remoteResult, replaceState, shareToken]);

  const appState = useMemo(() => {
    if (shareToken !== undefined) {
      if (!sharedProject) return null;
      return normalizeState({
        ...sharedProjectToState(sharedProject),
        ...shareSettings,
      });
    }
    if (!remoteResult || !isSyncedState(remoteResult.state)) return null;
    return normalizeState(remoteResult.state);
  }, [remoteResult, shareSettings, shareToken, sharedProject]);

  const value = useMemo<AppStateContextValue | null>(() => {
    if (!appState) return null;
    const state = appState;

    const scenarioList = Object.values(state.scenarios).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    const activeScenario =
      state.scenarios[state.activeScenarioId] ??
      scenarioList[0] ??
      defaultScenarios[defaultScenarioId]!;
    const activeScenarioValues = normalizeScenarioValues(
      state.scenarioValues[activeScenario.id] ?? defaultScenarioValues,
    );
    const liquidityScenarioList = Object.values(state.liquidityScenarios).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    const activeLiquidityScenario =
      state.liquidityScenarios[state.activeLiquidityScenarioId] ??
      liquidityScenarioList[0] ??
      defaultLiquidityScenarios[defaultLiquidityScenarioId]!;
    const activeLiquidityScenarioValues = normalizeLiquidityScenarioValues(
      state.liquidityScenarioValues[activeLiquidityScenario.id] ??
        defaultLiquidityScenarioValues,
    );

    async function setSettings(settings: Partial<Settings>) {
      if (shareToken !== undefined) {
        setShareSettings((current) => ({ ...current, ...settings }));
        return;
      }
      const nextSettings = {
        ...toSettings(state),
        ...settings,
      };
      await saveSettingsMutation({ settings: nextSettings });
    }

    async function persistScenario(scenario: Scenario, values: ScenarioValues) {
      if (shareToken !== undefined) return;
      await saveFinancingScenarioMutation(
        scenarioMutationPayload(
          state.activeProjectId,
          scenario,
          normalizeScenarioValues(values),
        ),
      );
    }

    async function persistLiquidityScenario(
      scenario: LiquidityScenario,
      values: LiquidityScenarioValues,
    ) {
      if (shareToken !== undefined) return;
      await saveLiquidityScenarioMutation(
        liquidityMutationPayload(
          state.activeProjectId,
          scenario,
          normalizeLiquidityScenarioValues(values),
        ),
      );
    }

    return {
      state,
      projects: state.projects,
      projectList: Object.values(state.projects).sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
      activeProjectId: state.activeProjectId,
      activeProject:
        state.projects[state.activeProjectId] ??
        defaultProjects()[defaultProjectId]!,
      scenarios: state.scenarios,
      scenarioList,
      activeScenarioId: state.activeScenarioId,
      activeScenario,
      scenarioValues: state.scenarioValues,
      activeScenarioValues,
      credits: activeScenarioValues.credits,
      comparedScenarioIds: state.comparedScenarioIds,
      detailScenarioId: state.detailScenarioId,
      liquidityScenarios: state.liquidityScenarios,
      liquidityScenarioList,
      activeLiquidityScenarioId: state.activeLiquidityScenarioId,
      activeLiquidityScenario,
      liquidityScenarioValues: state.liquidityScenarioValues,
      activeLiquidityScenarioValues,
      includeRefinancing: state.includeRefinancing,
      analysisHorizonYears: state.analysisHorizonYears,
      opportunityRate: state.opportunityRate,
      setSettings,
      setActiveProjectId: async (projectId) => {
        if (shareToken !== undefined) return;
        if (projectId === state.activeProjectId) return;
        const currentProject = state.projects[state.activeProjectId];
        if (currentProject) {
          await saveProjectMutation({
            project: {
              projectId: currentProject.id,
              name: currentProject.name,
              createdAt: currentProject.createdAt,
              lastActiveScenarioId: state.activeScenarioId,
              lastActiveLiquidityScenarioId: state.activeLiquidityScenarioId,
            },
          });
        }
        const targetProject = state.projects[projectId];
        const nextScenarioId =
          targetProject?.lastActiveScenarioId ?? defaultScenarioId;
        const nextLiquidityScenarioId =
          targetProject?.lastActiveLiquidityScenarioId ??
          defaultLiquidityScenarioId;
        await setSettings({
          activeProjectId: projectId,
          activeScenarioId: nextScenarioId,
          activeLiquidityScenarioId: nextLiquidityScenarioId,
        });
      },
      createProject: async (options) => {
        if (shareToken !== undefined) return;
        const currentProject = state.projects[state.activeProjectId];
        if (currentProject) {
          await saveProjectMutation({
            project: {
              projectId: currentProject.id,
              name: currentProject.name,
              createdAt: currentProject.createdAt,
              lastActiveScenarioId: state.activeScenarioId,
              lastActiveLiquidityScenarioId: state.activeLiquidityScenarioId,
            },
          });
        }
        await saveProjectMutation({
          project: {
            projectId: options.id,
            name: options.name,
            createdAt: options.createdAt,
          },
        });
        await setSettings({
          activeProjectId: options.id,
          activeScenarioId: defaultScenarioId,
          activeLiquidityScenarioId: defaultLiquidityScenarioId,
        });
      },
      renameProject: async (projectId, name) => {
        if (shareToken !== undefined) return;
        const project = state.projects[projectId];
        if (!project) return;
        await saveProjectMutation({
          project: { projectId, name, createdAt: project.createdAt },
        });
      },
      deleteProject: async (projectId) => {
        if (shareToken !== undefined) return;
        if (projectId === defaultProjectId) return;
        await deleteProjectMutation({ projectId });
        if (state.activeProjectId === projectId) {
          const nextProject = Object.values(state.projects).find(
            (project) => project.id !== projectId,
          );
          await setSettings({
            activeProjectId: nextProject?.id ?? defaultProjectId,
          });
        }
      },
      createProjectShare: async (projectId, liquidityScenarioIds, access) =>
        await createProjectShareMutation({
          projectId,
          liquidityScenarioIds,
          access,
        }),
      revokeProjectShare: async (projectId) => {
        await revokeProjectShareMutation({ projectId });
      },
      importSharedProject: async (token) => {
        const result = await importSharedProjectMutation({ token });
        await setSettings({ activeProjectId: result.projectId });
        return result.projectId;
      },
      setActiveScenarioId: (scenarioId) =>
        setSettings({ activeScenarioId: scenarioId }),
      createScenario: async (options) => {
        const sourceValues =
          state.scenarioValues[state.activeScenarioId] ?? defaultScenarioValues;
        const values = options.duplicateFromActive
          ? structuredClone(sourceValues)
          : structuredClone(defaultScenarioValues);
        const scenario = {
          id: options.id,
          name: options.name,
          createdAt: options.createdAt,
          color: options.color,
        };
        await persistScenario(scenario, values);
        await setSettings({ activeScenarioId: options.id });
      },
      renameScenario: async (scenarioId, name) => {
        const scenario = state.scenarios[scenarioId];
        const values = state.scenarioValues[scenarioId];
        if (!scenario || !values) return;
        await persistScenario({ ...scenario, name }, values);
      },
      deleteScenario: async (scenarioId) => {
        if (scenarioList.length <= 1) return;
        const next = scenarioList.find(
          (scenario) => scenario.id !== scenarioId,
        );
        await deleteFinancingScenarioMutation({
          projectId: state.activeProjectId,
          scenarioId,
        });
        await setSettings({
          activeScenarioId: next?.id ?? defaultScenarioId,
          comparedScenarioIds: state.comparedScenarioIds.filter(
            (id) => id !== scenarioId,
          ),
          detailScenarioId:
            state.detailScenarioId === scenarioId
              ? (next?.id ?? defaultScenarioId)
              : state.detailScenarioId,
        });
      },
      updateActiveScenarioValues: async (update) => {
        const nextValues =
          typeof update === "function" ? update(activeScenarioValues) : update;
        await persistScenario(activeScenario, nextValues);
      },
      setCredits: async (update) => {
        const nextCredits =
          typeof update === "function"
            ? update(activeScenarioValues.credits)
            : update;
        await persistScenario(activeScenario, {
          ...activeScenarioValues,
          credits: nextCredits,
        });
      },
      setActiveLiquidityScenarioId: (scenarioId) =>
        setSettings({ activeLiquidityScenarioId: scenarioId }),
      createLiquidityScenario: async (options) => {
        const sourceValues =
          state.liquidityScenarioValues[state.activeLiquidityScenarioId] ??
          defaultLiquidityScenarioValues;
        const values = options.duplicateFromActive
          ? structuredClone(sourceValues)
          : structuredClone(defaultLiquidityScenarioValues);
        const scenario = {
          id: options.id,
          name: options.name,
          createdAt: options.createdAt,
          color: options.color,
        };
        await persistLiquidityScenario(scenario, values);
        await setSettings({ activeLiquidityScenarioId: options.id });
      },
      renameLiquidityScenario: async (scenarioId, name) => {
        const scenario = state.liquidityScenarios[scenarioId];
        const values = state.liquidityScenarioValues[scenarioId];
        if (!scenario || !values) return;
        await persistLiquidityScenario({ ...scenario, name }, values);
      },
      deleteLiquidityScenarioById: async (scenarioId) => {
        if (liquidityScenarioList.length <= 1) return;
        const next = liquidityScenarioList.find(
          (scenario) => scenario.id !== scenarioId,
        );
        await deleteLiquidityScenarioMutation({
          projectId: state.activeProjectId,
          scenarioId,
        });
        await setSettings({
          activeLiquidityScenarioId: next?.id ?? defaultLiquidityScenarioId,
        });
      },
      updateActiveLiquidityScenarioValues: async (update) => {
        const nextValues =
          typeof update === "function"
            ? update(activeLiquidityScenarioValues)
            : update;
        await persistLiquidityScenario(activeLiquidityScenario, nextValues);
      },
    };
  }, [
    deleteFinancingScenarioMutation,
    deleteLiquidityScenarioMutation,
    deleteProjectMutation,
    createProjectShareMutation,
    importSharedProjectMutation,
    revokeProjectShareMutation,
    saveProjectMutation,
    saveFinancingScenarioMutation,
    saveLiquidityScenarioMutation,
    saveSettingsMutation,
    shareToken,
    appState,
  ]);

  const isLoading =
    shareToken === undefined
      ? session.isPending ||
        !isAuthenticated ||
        remoteResult === undefined ||
        !value
      : sharedProject === undefined || !value;

  if (shareToken !== undefined && sharedProject === null)
    return <>{children}</>;
  if (bypassAppState) return <>{children}</>;
  if (isLoading) return <LoadingScreen />;

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return value;
}
