import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const settingsValidator = v.object({
  activeProjectId: v.optional(v.string()),
  activeScenarioId: v.string(),
  comparedScenarioIds: v.array(v.string()),
  detailScenarioId: v.optional(v.string()),
  activeLiquidityScenarioId: v.string(),
  includeRefinancing: v.boolean(),
  analysisHorizonYears: v.number(),
  opportunityRate: v.optional(v.number()),
});

const defaultOpportunityRate = 2.5;
const defaultProjectId = "default";

const projectValidator = v.object({
  projectId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  lastActiveScenarioId: v.optional(v.string()),
  lastActiveLiquidityScenarioId: v.optional(v.string()),
});

const financingScenarioValidator = v.object({
  projectId: v.optional(v.string()),
  scenarioId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  color: v.string(),
  sollzins: v.optional(v.number()),
  effzins: v.number(),
  kaufpreis: v.number(),
  modernisierungskosten: v.number(),
  eigenkapital: v.number(),
  tilgungssatz: v.number(),
  zinsbindung: v.number(),
});

const creditValidator = v.object({
  projectId: v.optional(v.string()),
  scenarioId: v.string(),
  creditId: v.string(),
  data: v.any(),
});

const liquidityScenarioValidator = v.object({
  projectId: v.optional(v.string()),
  scenarioId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  color: v.string(),
  startCapital: v.number(),
  startMonth: v.string(),
  horizonMonths: v.number(),
  creditScenarioId: v.string(),
});

const liquidityItemValidator = v.object({
  projectId: v.optional(v.string()),
  scenarioId: v.string(),
  itemId: v.string(),
  position: v.number(),
  data: v.any(),
});

const creditDataValidator = v.object({
  creditId: v.string(),
  data: v.any(),
});

const liquidityItemDataValidator = v.object({
  itemId: v.string(),
  position: v.number(),
  data: v.any(),
});

const localFinancingImportValidator = v.object({
  fingerprint: v.string(),
  scenario: financingScenarioValidator,
  credits: v.array(
    v.object({
      creditId: v.string(),
      data: v.any(),
    }),
  ),
});

const localLiquidityImportValidator = v.object({
  fingerprint: v.string(),
  scenario: liquidityScenarioValidator,
  items: v.array(
    v.object({
      itemId: v.string(),
      position: v.number(),
      data: v.any(),
    }),
  ),
});

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("Authentication required");
  }
  return identity;
}

async function getLegacyState(ctx: QueryCtx, userIdentifier: string) {
  return await ctx.db
    .query("appStates")
    .withIndex("by_userIdentifier", (q) =>
      q.eq("userIdentifier", userIdentifier),
    )
    .unique();
}

function sameValues(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  keys: string[],
) {
  return keys.every(
    (key) => JSON.stringify(left[key]) === JSON.stringify(right[key]),
  );
}

function defaultProject(createdAt = 0) {
  return {
    projectId: defaultProjectId,
    name: "Mein Projekt",
    createdAt,
    lastActiveScenarioId: undefined as string | undefined,
    lastActiveLiquidityScenarioId: undefined as string | undefined,
  };
}

function projectForRow(row: { projectId?: string }) {
  return row.projectId ?? defaultProjectId;
}

function belongsToProject(row: { projectId?: string }, projectId: string) {
  return projectForRow(row) === projectId;
}

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;
    const userIdentifier = identity.tokenIdentifier;

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", userIdentifier),
      )
      .unique();

    if (settings === null) {
      const legacy = await getLegacyState(ctx, userIdentifier);
      if (legacy === null) return null;
      return {
        userIdentifier,
        state: legacy.state,
        updatedAt: legacy.updatedAt,
        needsMigration: true,
      };
    }

    const projectRows = await ctx.db
      .query("projects")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", userIdentifier),
      )
      .take(500);
    const projects = Object.fromEntries(
      (projectRows.length > 0 ? projectRows : [defaultProject()]).map((row) => [
        row.projectId,
        {
          id: row.projectId,
          name: row.name,
          createdAt: row.createdAt,
          lastActiveScenarioId: row.lastActiveScenarioId,
          lastActiveLiquidityScenarioId: row.lastActiveLiquidityScenarioId,
        },
      ]),
    );
    const activeProjectId =
      settings.activeProjectId && projects[settings.activeProjectId]
        ? settings.activeProjectId
        : (projectRows[0]?.projectId ?? defaultProjectId);

    const [
      allScenarioRows,
      allCreditRows,
      allLiquidityScenarioRows,
      allLiquidityItemRows,
    ] = await Promise.all([
      ctx.db
        .query("financingScenarios")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(500),
      ctx.db
        .query("credits")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(2000),
      ctx.db
        .query("liquidityScenarios")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(500),
      ctx.db
        .query("liquidityItems")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(5000),
    ]);
    const scenarioRows = allScenarioRows.filter((row) =>
      belongsToProject(row, activeProjectId),
    );
    const creditRows = allCreditRows.filter((row) =>
      belongsToProject(row, activeProjectId),
    );
    const liquidityScenarioRows = allLiquidityScenarioRows.filter((row) =>
      belongsToProject(row, activeProjectId),
    );
    const liquidityItemRows = allLiquidityItemRows.filter((row) =>
      belongsToProject(row, activeProjectId),
    );

    const scenarios: Record<string, unknown> = {};
    const scenarioValues: Record<string, unknown> = {};
    for (const row of scenarioRows) {
      scenarios[row.scenarioId] = {
        id: row.scenarioId,
        name: row.name,
        createdAt: row.createdAt,
        color: row.color,
      };
      scenarioValues[row.scenarioId] = {
        sollzins: row.sollzins ?? row.effzins,
        effzins: row.effzins,
        kaufpreis: row.kaufpreis,
        modernisierungskosten: row.modernisierungskosten,
        eigenkapital: row.eigenkapital,
        tilgungssatz: row.tilgungssatz,
        zinsbindung: row.zinsbindung,
        credits: {},
      };
    }
    for (const row of creditRows) {
      const values = scenarioValues[row.scenarioId] as
        | { credits: Record<string, unknown> }
        | undefined;
      if (values) values.credits[row.creditId] = row.data;
    }

    const liquidityScenarios: Record<string, unknown> = {};
    const liquidityScenarioValues: Record<string, unknown> = {};
    for (const row of liquidityScenarioRows) {
      liquidityScenarios[row.scenarioId] = {
        id: row.scenarioId,
        name: row.name,
        createdAt: row.createdAt,
        color: row.color,
      };
      liquidityScenarioValues[row.scenarioId] = {
        startCapital: row.startCapital,
        startMonth: row.startMonth,
        horizonMonths: row.horizonMonths,
        creditScenarioId: row.creditScenarioId,
        items: [],
      };
    }
    liquidityItemRows.sort((left, right) => left.position - right.position);
    for (const row of liquidityItemRows) {
      const values = liquidityScenarioValues[row.scenarioId] as
        | { items: unknown[] }
        | undefined;
      if (values) values.items.push(row.data);
    }

    const updatedAt = Math.max(
      settings.updatedAt,
      ...scenarioRows.map((row) => row.updatedAt),
      ...creditRows.map((row) => row.updatedAt),
      ...liquidityScenarioRows.map((row) => row.updatedAt),
      ...liquidityItemRows.map((row) => row.updatedAt),
    );

    return {
      userIdentifier,
      state: {
        version: 1,
        projects,
        activeProjectId,
        scenarios,
        activeScenarioId: settings.activeScenarioId,
        scenarioValues,
        comparedScenarioIds: settings.comparedScenarioIds,
        detailScenarioId: settings.detailScenarioId,
        liquidityScenarios,
        activeLiquidityScenarioId: settings.activeLiquidityScenarioId,
        liquidityScenarioValues,
        includeRefinancing: settings.includeRefinancing,
        analysisHorizonYears: settings.analysisHorizonYears,
        opportunityRate: settings.opportunityRate ?? defaultOpportunityRate,
      },
      updatedAt,
      needsMigration: false,
    };
  },
});

async function deleteMissingRows(
  ctx: MutationCtx,
  table:
    | "financingScenarios"
    | "credits"
    | "liquidityScenarios"
    | "liquidityItems",
  userIdentifier: string,
  retainedKeys: Set<string>,
  keyForRow: (row: Record<string, unknown>) => string,
) {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_userIdentifier", (q) =>
      q.eq("userIdentifier", userIdentifier),
    )
    .take(5000);
  for (const row of rows) {
    if (!retainedKeys.has(keyForRow(row))) {
      await ctx.db.delete(row._id);
    }
  }
}

function importedName(name: string, takenNames: Set<string>) {
  const base = `${name} (lokal importiert)`;
  if (!takenNames.has(base.toLowerCase())) {
    takenNames.add(base.toLowerCase());
    return base;
  }
  let suffix = 2;
  while (takenNames.has(`${base} ${suffix}`.toLowerCase())) suffix += 1;
  const result = `${base} ${suffix}`;
  takenNames.add(result.toLowerCase());
  return result;
}

function importedId(kind: "financing" | "liquidity", fingerprint: string) {
  const safeFingerprint = fingerprint.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${kind}-local-${safeFingerprint.slice(0, 80)}`;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isPlainRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "id")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, canonicalValue(nestedValue)]),
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalCollection(values: unknown[]) {
  return values
    .map((value) => JSON.stringify(canonicalValue(value)))
    .sort()
    .join("\u0000");
}

function canonicalSequence(values: unknown[]) {
  return values
    .map((value) => JSON.stringify(canonicalValue(value)))
    .join("\u0000");
}

function sameFinancingContent(
  existing: Record<string, unknown>,
  candidate: {
    scenario: {
      effzins: number;
      sollzins?: number;
      kaufpreis: number;
      modernisierungskosten: number;
      eigenkapital: number;
      tilgungssatz: number;
      zinsbindung: number;
    };
    credits: Array<{ data: unknown }>;
  },
  existingCredits: unknown[],
) {
  return (
    sameValues(existing, candidate.scenario, [
      "effzins",
      "sollzins",
      "kaufpreis",
      "modernisierungskosten",
      "eigenkapital",
      "tilgungssatz",
      "zinsbindung",
    ]) &&
    canonicalCollection(existingCredits) ===
      canonicalCollection(candidate.credits.map((credit) => credit.data))
  );
}

function sameLiquidityContent(
  existing: Record<string, unknown>,
  candidate: {
    scenario: {
      startCapital: number;
      startMonth: string;
      horizonMonths: number;
    };
    items: Array<{ position: number; data: unknown }>;
  },
  expectedCreditScenarioId: string,
  existingItems: Array<{ position: number; data: unknown }>,
) {
  return (
    sameValues(existing, candidate.scenario, [
      "startCapital",
      "startMonth",
      "horizonMonths",
    ]) &&
    existing.creditScenarioId === expectedCreditScenarioId &&
    canonicalSequence(
      existingItems
        .sort((left, right) => left.position - right.position)
        .map((item) => item.data),
    ) ===
      canonicalSequence(
        candidate.items
          .sort((left, right) => left.position - right.position)
          .map((item) => item.data),
      )
  );
}

export const previewLocalScenarios = query({
  args: {
    financing: v.array(localFinancingImportValidator),
    liquidity: v.array(localLiquidityImportValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const [financingRows, creditRows, liquidityRows, liquidityItemRows] =
      await Promise.all([
        ctx.db
          .query("financingScenarios")
          .withIndex("by_userIdentifier", (q) =>
            q.eq("userIdentifier", userIdentifier),
          )
          .take(500),
        ctx.db
          .query("credits")
          .withIndex("by_userIdentifier", (q) =>
            q.eq("userIdentifier", userIdentifier),
          )
          .take(2000),
        ctx.db
          .query("liquidityScenarios")
          .withIndex("by_userIdentifier", (q) =>
            q.eq("userIdentifier", userIdentifier),
          )
          .take(500),
        ctx.db
          .query("liquidityItems")
          .withIndex("by_userIdentifier", (q) =>
            q.eq("userIdentifier", userIdentifier),
          )
          .take(5000),
      ]);
    const financingIdMap = new Map<string, string>();

    const financing = args.financing.map((candidate) => {
      const match = financingRows.find((row) =>
        sameFinancingContent(
          row,
          candidate,
          creditRows
            .filter((credit) => credit.scenarioId === row.scenarioId)
            .map((credit) => credit.data),
        ),
      );
      if (match) {
        financingIdMap.set(candidate.scenario.scenarioId, match.scenarioId);
      }
      return {
        scenarioId: candidate.scenario.scenarioId,
        name: candidate.scenario.name,
        status: match ? ("duplicate" as const) : ("new" as const),
        matchingScenarioId: match?.scenarioId ?? null,
        matchingName: match?.name ?? null,
      };
    });

    const liquidity = args.liquidity.map((candidate) => {
      const expectedCreditScenarioId =
        financingIdMap.get(candidate.scenario.creditScenarioId) ??
        candidate.scenario.creditScenarioId;
      const match = liquidityRows.find((row) =>
        sameLiquidityContent(
          row,
          candidate,
          expectedCreditScenarioId,
          liquidityItemRows
            .filter((item) => item.scenarioId === row.scenarioId)
            .map((item) => ({
              position: item.position,
              data: item.data,
            })),
        ),
      );
      return {
        scenarioId: candidate.scenario.scenarioId,
        name: candidate.scenario.name,
        status: match ? ("duplicate" as const) : ("new" as const),
        matchingScenarioId: match?.scenarioId ?? null,
        matchingName: match?.name ?? null,
      };
    });

    return { financing, liquidity };
  },
});

export const importLocalScenarios = mutation({
  args: {
    financing: v.array(localFinancingImportValidator),
    liquidity: v.array(localLiquidityImportValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const importedAt = Date.now();
    const financingIdMap = new Map<string, string>();
    const financingRows = await ctx.db
      .query("financingScenarios")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", userIdentifier),
      )
      .take(500);
    const financingNames = new Set(
      financingRows.map((row) => row.name.toLowerCase()),
    );
    const creditRows = await ctx.db
      .query("credits")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", userIdentifier),
      )
      .take(2000);
    let didImport = false;

    for (const candidate of args.financing) {
      const previousImport = await ctx.db
        .query("localImports")
        .withIndex("by_userIdentifier_and_kind_and_fingerprint", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("kind", "financing")
            .eq("fingerprint", candidate.fingerprint),
        )
        .unique();
      if (previousImport !== null) {
        const importedScenario = await ctx.db
          .query("financingScenarios")
          .withIndex("by_userIdentifier_and_scenarioId", (q) =>
            q
              .eq("userIdentifier", userIdentifier)
              .eq("scenarioId", previousImport.importedScenarioId),
          )
          .unique();
        if (importedScenario !== null) {
          financingIdMap.set(
            candidate.scenario.scenarioId,
            previousImport.importedScenarioId,
          );
          continue;
        }
      }

      const contentMatch = financingRows.find((row) =>
        sameFinancingContent(
          row,
          candidate,
          creditRows
            .filter((credit) => credit.scenarioId === row.scenarioId)
            .map((credit) => credit.data),
        ),
      );
      if (contentMatch) {
        financingIdMap.set(
          candidate.scenario.scenarioId,
          contentMatch.scenarioId,
        );
        const nextImport = {
          userIdentifier,
          kind: "financing" as const,
          fingerprint: candidate.fingerprint,
          importedScenarioId: contentMatch.scenarioId,
          importedAt,
        };
        if (previousImport === null) {
          await ctx.db.insert("localImports", nextImport);
        } else {
          await ctx.db.replace("localImports", previousImport._id, nextImport);
        }
        continue;
      }

      const existing = await ctx.db
        .query("financingScenarios")
        .withIndex("by_userIdentifier_and_scenarioId", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("scenarioId", candidate.scenario.scenarioId),
        )
        .unique();
      const scenarioId =
        existing === null
          ? candidate.scenario.scenarioId
          : importedId("financing", candidate.fingerprint);
      const name =
        existing === null &&
        !financingNames.has(candidate.scenario.name.toLowerCase())
          ? candidate.scenario.name
          : importedName(candidate.scenario.name, financingNames);
      financingNames.add(name.toLowerCase());
      financingIdMap.set(candidate.scenario.scenarioId, scenarioId);

      const insertedScenarioId = await ctx.db.insert("financingScenarios", {
        userIdentifier,
        ...candidate.scenario,
        scenarioId,
        name,
        createdAt: importedAt,
        updatedAt: importedAt,
      });
      financingRows.push({
        _id: insertedScenarioId,
        _creationTime: importedAt,
        userIdentifier,
        ...candidate.scenario,
        scenarioId,
        name,
        createdAt: importedAt,
        updatedAt: importedAt,
      });
      for (const credit of candidate.credits) {
        const insertedCreditId = await ctx.db.insert("credits", {
          userIdentifier,
          scenarioId,
          creditId: credit.creditId,
          data: credit.data,
          updatedAt: importedAt,
        });
        creditRows.push({
          _id: insertedCreditId,
          _creationTime: importedAt,
          userIdentifier,
          scenarioId,
          creditId: credit.creditId,
          data: credit.data,
          updatedAt: importedAt,
        });
      }
      const nextImport = {
        userIdentifier,
        kind: "financing" as const,
        fingerprint: candidate.fingerprint,
        importedScenarioId: scenarioId,
        importedAt,
      };
      if (previousImport === null) {
        await ctx.db.insert("localImports", nextImport);
      } else {
        await ctx.db.replace("localImports", previousImport._id, nextImport);
      }
      didImport = true;
    }

    const liquidityRows = await ctx.db
      .query("liquidityScenarios")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", userIdentifier),
      )
      .take(500);
    const liquidityNames = new Set(
      liquidityRows.map((row) => row.name.toLowerCase()),
    );
    const liquidityItemRows = await ctx.db
      .query("liquidityItems")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", userIdentifier),
      )
      .take(5000);

    for (const candidate of args.liquidity) {
      const previousImport = await ctx.db
        .query("localImports")
        .withIndex("by_userIdentifier_and_kind_and_fingerprint", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("kind", "liquidity")
            .eq("fingerprint", candidate.fingerprint),
        )
        .unique();
      if (previousImport !== null) {
        const importedScenario = await ctx.db
          .query("liquidityScenarios")
          .withIndex("by_userIdentifier_and_scenarioId", (q) =>
            q
              .eq("userIdentifier", userIdentifier)
              .eq("scenarioId", previousImport.importedScenarioId),
          )
          .unique();
        if (importedScenario !== null) continue;
      }

      const expectedCreditScenarioId =
        financingIdMap.get(candidate.scenario.creditScenarioId) ??
        candidate.scenario.creditScenarioId;
      const contentMatch = liquidityRows.find((row) =>
        sameLiquidityContent(
          row,
          candidate,
          expectedCreditScenarioId,
          liquidityItemRows
            .filter((item) => item.scenarioId === row.scenarioId)
            .map((item) => ({
              position: item.position,
              data: item.data,
            })),
        ),
      );
      if (contentMatch) {
        const nextImport = {
          userIdentifier,
          kind: "liquidity" as const,
          fingerprint: candidate.fingerprint,
          importedScenarioId: contentMatch.scenarioId,
          importedAt,
        };
        if (previousImport === null) {
          await ctx.db.insert("localImports", nextImport);
        } else {
          await ctx.db.replace("localImports", previousImport._id, nextImport);
        }
        continue;
      }

      const existing = await ctx.db
        .query("liquidityScenarios")
        .withIndex("by_userIdentifier_and_scenarioId", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("scenarioId", candidate.scenario.scenarioId),
        )
        .unique();
      const scenarioId =
        existing === null
          ? candidate.scenario.scenarioId
          : importedId("liquidity", candidate.fingerprint);
      const name =
        existing === null &&
        !liquidityNames.has(candidate.scenario.name.toLowerCase())
          ? candidate.scenario.name
          : importedName(candidate.scenario.name, liquidityNames);
      liquidityNames.add(name.toLowerCase());

      const insertedScenarioId = await ctx.db.insert("liquidityScenarios", {
        userIdentifier,
        ...candidate.scenario,
        scenarioId,
        name,
        createdAt: importedAt,
        creditScenarioId: expectedCreditScenarioId,
        updatedAt: importedAt,
      });
      liquidityRows.push({
        _id: insertedScenarioId,
        _creationTime: importedAt,
        userIdentifier,
        ...candidate.scenario,
        scenarioId,
        name,
        createdAt: importedAt,
        creditScenarioId: expectedCreditScenarioId,
        updatedAt: importedAt,
      });
      for (const item of candidate.items) {
        const insertedItemId = await ctx.db.insert("liquidityItems", {
          userIdentifier,
          scenarioId,
          itemId: item.itemId,
          position: item.position,
          data: item.data,
          updatedAt: importedAt,
        });
        liquidityItemRows.push({
          _id: insertedItemId,
          _creationTime: importedAt,
          userIdentifier,
          scenarioId,
          itemId: item.itemId,
          position: item.position,
          data: item.data,
          updatedAt: importedAt,
        });
      }
      const nextImport = {
        userIdentifier,
        kind: "liquidity" as const,
        fingerprint: candidate.fingerprint,
        importedScenarioId: scenarioId,
        importedAt,
      };
      if (previousImport === null) {
        await ctx.db.insert("localImports", nextImport);
      } else {
        await ctx.db.replace("localImports", previousImport._id, nextImport);
      }
      didImport = true;
    }

    return didImport ? importedAt : null;
  },
});

export const saveSettings = mutation({
  args: { settings: settingsValidator },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const updatedAt = Date.now();
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", userIdentifier),
      )
      .unique();
    const nextSettings = {
      userIdentifier,
      ...args.settings,
      activeProjectId: args.settings.activeProjectId ?? defaultProjectId,
      updatedAt,
    };

    if (existingSettings === null) {
      await ctx.db.insert("userSettings", nextSettings);
      return updatedAt;
    }

    if (
      !sameValues(existingSettings, nextSettings, [
        "activeProjectId",
        "activeScenarioId",
        "comparedScenarioIds",
        "detailScenarioId",
        "activeLiquidityScenarioId",
        "includeRefinancing",
        "analysisHorizonYears",
        "opportunityRate",
      ])
    ) {
      await ctx.db.replace("userSettings", existingSettings._id, nextSettings);
    }

    return updatedAt;
  },
});

export const saveFinancingScenario = mutation({
  args: {
    scenario: financingScenarioValidator,
    credits: v.array(creditDataValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const projectId = args.scenario.projectId ?? defaultProjectId;
    const updatedAt = Date.now();
    const existingScenario = await ctx.db
      .query("financingScenarios")
      .withIndex("by_userIdentifier_and_projectId_and_scenarioId", (q) =>
        q
          .eq("userIdentifier", userIdentifier)
          .eq("projectId", projectId)
          .eq("scenarioId", args.scenario.scenarioId),
      )
      .unique();
    const nextScenario = {
      userIdentifier,
      ...args.scenario,
      projectId,
      updatedAt,
    };

    if (existingScenario === null) {
      await ctx.db.insert("financingScenarios", nextScenario);
    } else if (
      !sameValues(existingScenario, nextScenario, [
        "name",
        "createdAt",
        "color",
        "sollzins",
        "effzins",
        "kaufpreis",
        "modernisierungskosten",
        "eigenkapital",
        "tilgungssatz",
        "zinsbindung",
      ])
    ) {
      await ctx.db.replace(
        "financingScenarios",
        existingScenario._id,
        nextScenario,
      );
    }

    for (const credit of args.credits) {
      const existingCredit = await ctx.db
        .query("credits")
        .withIndex(
          "by_userIdentifier_and_projectId_and_scenarioId_and_creditId",
          (q) =>
            q
              .eq("userIdentifier", userIdentifier)
              .eq("projectId", projectId)
              .eq("scenarioId", args.scenario.scenarioId)
              .eq("creditId", credit.creditId),
        )
        .unique();
      const nextCredit = {
        userIdentifier,
        projectId,
        scenarioId: args.scenario.scenarioId,
        creditId: credit.creditId,
        data: credit.data,
        updatedAt,
      };
      if (existingCredit === null) {
        await ctx.db.insert("credits", nextCredit);
      } else if (!sameValues(existingCredit, nextCredit, ["data"])) {
        await ctx.db.replace("credits", existingCredit._id, nextCredit);
      }
    }

    const retainedCreditIds = new Set(args.credits.map((row) => row.creditId));
    const existingCredits = await ctx.db
      .query("credits")
      .withIndex(
        "by_userIdentifier_and_projectId_and_scenarioId_and_creditId",
        (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("projectId", projectId)
            .eq("scenarioId", args.scenario.scenarioId),
      )
      .take(2000);
    for (const credit of existingCredits) {
      if (!retainedCreditIds.has(credit.creditId)) {
        await ctx.db.delete(credit._id);
      }
    }

    return updatedAt;
  },
});

export const deleteFinancingScenario = mutation({
  args: { projectId: v.optional(v.string()), scenarioId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const projectId = args.projectId ?? defaultProjectId;
    let scenario = await ctx.db
      .query("financingScenarios")
      .withIndex("by_userIdentifier_and_projectId_and_scenarioId", (q) =>
        q
          .eq("userIdentifier", userIdentifier)
          .eq("projectId", projectId)
          .eq("scenarioId", args.scenarioId),
      )
      .unique();
    if (scenario !== null) await ctx.db.delete(scenario._id);

    const credits = await ctx.db
      .query("credits")
      .withIndex(
        "by_userIdentifier_and_projectId_and_scenarioId_and_creditId",
        (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("projectId", projectId)
            .eq("scenarioId", args.scenarioId),
      )
      .take(2000);
    for (const credit of credits) await ctx.db.delete(credit._id);

    return Date.now();
  },
});

export const saveLiquidityScenario = mutation({
  args: {
    scenario: liquidityScenarioValidator,
    items: v.array(liquidityItemDataValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const projectId = args.scenario.projectId ?? defaultProjectId;
    const updatedAt = Date.now();
    const existingScenario = await ctx.db
      .query("liquidityScenarios")
      .withIndex("by_userIdentifier_and_projectId_and_scenarioId", (q) =>
        q
          .eq("userIdentifier", userIdentifier)
          .eq("projectId", projectId)
          .eq("scenarioId", args.scenario.scenarioId),
      )
      .unique();
    const nextScenario = {
      userIdentifier,
      ...args.scenario,
      projectId,
      updatedAt,
    };

    if (existingScenario === null) {
      await ctx.db.insert("liquidityScenarios", nextScenario);
    } else if (
      !sameValues(existingScenario, nextScenario, [
        "name",
        "createdAt",
        "color",
        "startCapital",
        "startMonth",
        "horizonMonths",
        "creditScenarioId",
      ])
    ) {
      await ctx.db.replace(
        "liquidityScenarios",
        existingScenario._id,
        nextScenario,
      );
    }

    for (const item of args.items) {
      const existingItem = await ctx.db
        .query("liquidityItems")
        .withIndex(
          "by_userIdentifier_and_projectId_and_scenarioId_and_itemId",
          (q) =>
            q
              .eq("userIdentifier", userIdentifier)
              .eq("projectId", projectId)
              .eq("scenarioId", args.scenario.scenarioId)
              .eq("itemId", item.itemId),
        )
        .unique();
      const nextItem = {
        userIdentifier,
        projectId,
        scenarioId: args.scenario.scenarioId,
        itemId: item.itemId,
        position: item.position,
        data: item.data,
        updatedAt,
      };
      if (existingItem === null) {
        await ctx.db.insert("liquidityItems", nextItem);
      } else if (!sameValues(existingItem, nextItem, ["position", "data"])) {
        await ctx.db.replace("liquidityItems", existingItem._id, nextItem);
      }
    }

    const retainedItemIds = new Set(args.items.map((row) => row.itemId));
    const existingItems = await ctx.db
      .query("liquidityItems")
      .withIndex(
        "by_userIdentifier_and_projectId_and_scenarioId_and_itemId",
        (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("projectId", projectId)
            .eq("scenarioId", args.scenario.scenarioId),
      )
      .take(5000);
    for (const item of existingItems) {
      if (!retainedItemIds.has(item.itemId)) {
        await ctx.db.delete(item._id);
      }
    }

    return updatedAt;
  },
});

export const deleteLiquidityScenario = mutation({
  args: { projectId: v.optional(v.string()), scenarioId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const projectId = args.projectId ?? defaultProjectId;
    let scenario = await ctx.db
      .query("liquidityScenarios")
      .withIndex("by_userIdentifier_and_projectId_and_scenarioId", (q) =>
        q
          .eq("userIdentifier", userIdentifier)
          .eq("projectId", projectId)
          .eq("scenarioId", args.scenarioId),
      )
      .unique();
    if (scenario !== null) await ctx.db.delete(scenario._id);

    const items = await ctx.db
      .query("liquidityItems")
      .withIndex(
        "by_userIdentifier_and_projectId_and_scenarioId_and_itemId",
        (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("projectId", projectId)
            .eq("scenarioId", args.scenarioId),
      )
      .take(5000);
    for (const item of items) await ctx.db.delete(item._id);

    return Date.now();
  },
});

export const getProjectOverview = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const [projectRows, financingRows, liquidityRows] = await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(500),
      ctx.db
        .query("financingScenarios")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(500),
      ctx.db
        .query("liquidityScenarios")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(500),
    ]);

    const projects = (projectRows.length > 0 ? projectRows : [defaultProject()])
      .map((project) => ({
        projectId: project.projectId,
        name: project.name,
        createdAt: project.createdAt,
      }))
      .sort((left, right) => left.createdAt - right.createdAt);

    return {
      projects,
      financingScenarios: financingRows.map((scenario) => ({
        projectId: projectForRow(scenario),
        scenarioId: scenario.scenarioId,
        name: scenario.name,
        createdAt: scenario.createdAt,
        color: scenario.color,
      })),
      liquidityScenarios: liquidityRows
        .map((scenario) => ({
          scenarioId: scenario.scenarioId,
          name: scenario.name,
          createdAt: scenario.createdAt,
          color: scenario.color,
          creditScenarioId: scenario.creditScenarioId,
        }))
        .sort((left, right) => left.createdAt - right.createdAt),
    };
  },
});

export const moveFinancingScenarioToProject = mutation({
  args: {
    scenarioId: v.string(),
    fromProjectId: v.string(),
    toProjectId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const updatedAt = Date.now();
    let scenario = await ctx.db
      .query("financingScenarios")
      .withIndex("by_userIdentifier_and_projectId_and_scenarioId", (q) =>
        q
          .eq("userIdentifier", userIdentifier)
          .eq("projectId", args.fromProjectId)
          .eq("scenarioId", args.scenarioId),
      )
      .unique();
    if (scenario === null && args.fromProjectId === defaultProjectId) {
      scenario = await ctx.db
        .query("financingScenarios")
        .withIndex("by_userIdentifier_and_scenarioId", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("scenarioId", args.scenarioId),
        )
        .unique();
    }
    if (scenario === null) throw new ConvexError("Scenario not found");

    await ctx.db.patch(scenario._id, {
      projectId: args.toProjectId,
      updatedAt,
    });
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_userIdentifier_and_scenarioId_and_creditId", (q) =>
        q
          .eq("userIdentifier", userIdentifier)
          .eq("scenarioId", args.scenarioId),
      )
      .take(2000);
    for (const credit of credits) {
      if (!belongsToProject(credit, args.fromProjectId)) continue;
      await ctx.db.patch(credit._id, {
        projectId: args.toProjectId,
        updatedAt,
      });
    }
    return updatedAt;
  },
});

async function projectSnapshot(
  ctx: QueryCtx | MutationCtx,
  userIdentifier: string,
  projectId: string,
  selectedLiquidityScenarioIds: string[],
) {
  const project = await ctx.db
    .query("projects")
    .withIndex("by_userIdentifier_and_projectId", (q) =>
      q.eq("userIdentifier", userIdentifier).eq("projectId", projectId),
    )
    .unique();
  const [scenarioRows, creditRows, liquidityScenarioRows, liquidityItemRows] =
    await Promise.all([
      ctx.db
        .query("financingScenarios")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(500),
      ctx.db
        .query("credits")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(2000),
      ctx.db
        .query("liquidityScenarios")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(500),
      ctx.db
        .query("liquidityItems")
        .withIndex("by_userIdentifier", (q) =>
          q.eq("userIdentifier", userIdentifier),
        )
        .take(5000),
    ]);

  const selectedSet = new Set(selectedLiquidityScenarioIds);

  return {
    project: {
      projectId,
      name: project?.name ?? defaultProject().name,
      createdAt: project?.createdAt ?? 0,
    },
    financingScenarios: scenarioRows.filter((row) =>
      belongsToProject(row, projectId),
    ),
    credits: creditRows.filter((row) => belongsToProject(row, projectId)),
    liquidityScenarios: liquidityScenarioRows.filter(
      (row) => selectedSet.size === 0 || selectedSet.has(row.scenarioId),
    ),
    liquidityItems: liquidityItemRows.filter(
      (row) =>
        (selectedSet.size === 0 || selectedSet.has(row.scenarioId)) &&
        belongsToProject(row, projectId),
    ),
  };
}

export const saveProject = mutation({
  args: { project: projectValidator },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const updatedAt = Date.now();
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_userIdentifier_and_projectId", (q) =>
        q
          .eq("userIdentifier", userIdentifier)
          .eq("projectId", args.project.projectId),
      )
      .unique();
    const next = { userIdentifier, ...args.project, updatedAt };
    if (existing === null) await ctx.db.insert("projects", next);
    else if (
      !sameValues(existing, next, [
        "name",
        "createdAt",
        "lastActiveScenarioId",
        "lastActiveLiquidityScenarioId",
      ])
    ) {
      await ctx.db.replace("projects", existing._id, next);
    }
    return updatedAt;
  },
});

export const deleteProject = mutation({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    if (args.projectId === defaultProjectId) {
      throw new ConvexError("Default project cannot be deleted");
    }
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const project = await ctx.db
      .query("projects")
      .withIndex("by_userIdentifier_and_projectId", (q) =>
        q.eq("userIdentifier", userIdentifier).eq("projectId", args.projectId),
      )
      .unique();
    if (project !== null) await ctx.db.delete(project._id);
    for (const table of ["financingScenarios", "credits"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_userIdentifier_and_projectId", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("projectId", args.projectId),
        )
        .take(5000);
      for (const row of rows) await ctx.db.delete(row._id);
    }
    const shares = await ctx.db
      .query("projectShares")
      .withIndex("by_userIdentifier_and_projectId", (q) =>
        q.eq("userIdentifier", userIdentifier).eq("projectId", args.projectId),
      )
      .take(100);
    for (const share of shares) {
      await ctx.db.patch(share._id, { revokedAt: Date.now() });
    }
    return Date.now();
  },
});

export const createProjectShare = mutation({
  args: {
    projectId: v.string(),
    liquidityScenarioIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const existingShares = await ctx.db
      .query("projectShares")
      .withIndex("by_userIdentifier_and_projectId", (q) =>
        q.eq("userIdentifier", userIdentifier).eq("projectId", args.projectId),
      )
      .take(100);
    const activeShare = existingShares.find(
      (share) =>
        share.revokedAt === undefined &&
        JSON.stringify(share.liquidityScenarioIds.sort()) ===
          JSON.stringify([...args.liquidityScenarioIds].sort()),
    );
    if (activeShare) return activeShare.token;
    const token = crypto.randomUUID();
    await ctx.db.insert("projectShares", {
      token,
      userIdentifier,
      projectId: args.projectId,
      liquidityScenarioIds: args.liquidityScenarioIds,
      createdAt: Date.now(),
    });
    return token;
  },
});

export const revokeProjectShare = mutation({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const shares = await ctx.db
      .query("projectShares")
      .withIndex("by_userIdentifier_and_projectId", (q) =>
        q.eq("userIdentifier", userIdentifier).eq("projectId", args.projectId),
      )
      .take(100);
    const now = Date.now();
    for (const share of shares) {
      if (share.revokedAt === undefined)
        await ctx.db.patch(share._id, { revokedAt: now });
    }
    return now;
  },
});

export const getSharedProject = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("projectShares")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (share === null || share.revokedAt !== undefined) return null;
    return await projectSnapshot(
      ctx,
      share.userIdentifier,
      share.projectId,
      share.liquidityScenarioIds,
    );
  },
});

export const importSharedProject = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const targetUserIdentifier = identity.tokenIdentifier;
    const share = await ctx.db
      .query("projectShares")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (share === null || share.revokedAt !== undefined) {
      throw new ConvexError("Share link is not available");
    }
    const snapshot = await projectSnapshot(
      ctx,
      share.userIdentifier,
      share.projectId,
      share.liquidityScenarioIds,
    );
    const importedAt = Date.now();
    const projectId = crypto.randomUUID();
    await ctx.db.insert("projects", {
      userIdentifier: targetUserIdentifier,
      projectId,
      name: `${snapshot.project.name} Kopie`,
      createdAt: importedAt,
      updatedAt: importedAt,
    });
    const scenarioIdMap = new Map<string, string>();
    let firstScenarioId = "basis";
    for (const scenario of snapshot.financingScenarios) {
      const scenarioId = crypto.randomUUID();
      if (scenarioIdMap.size === 0) firstScenarioId = scenarioId;
      scenarioIdMap.set(scenario.scenarioId, scenarioId);
      await ctx.db.insert("financingScenarios", {
        userIdentifier: targetUserIdentifier,
        projectId,
        scenarioId,
        name: scenario.name,
        createdAt: importedAt,
        color: scenario.color,
        sollzins: scenario.sollzins,
        effzins: scenario.effzins,
        kaufpreis: scenario.kaufpreis,
        modernisierungskosten: scenario.modernisierungskosten,
        eigenkapital: scenario.eigenkapital,
        tilgungssatz: scenario.tilgungssatz,
        zinsbindung: scenario.zinsbindung,
        updatedAt: importedAt,
      });
    }
    for (const credit of snapshot.credits) {
      await ctx.db.insert("credits", {
        userIdentifier: targetUserIdentifier,
        projectId,
        scenarioId: scenarioIdMap.get(credit.scenarioId) ?? credit.scenarioId,
        creditId: credit.creditId,
        data: credit.data,
        updatedAt: importedAt,
      });
    }
    const liquidityIdMap = new Map<string, string>();
    let firstLiquidityScenarioId = "basis";
    for (const scenario of snapshot.liquidityScenarios) {
      const scenarioId = crypto.randomUUID();
      if (liquidityIdMap.size === 0) firstLiquidityScenarioId = scenarioId;
      liquidityIdMap.set(scenario.scenarioId, scenarioId);
      await ctx.db.insert("liquidityScenarios", {
        userIdentifier: targetUserIdentifier,
        scenarioId,
        name: scenario.name,
        createdAt: importedAt,
        color: scenario.color,
        startCapital: scenario.startCapital,
        startMonth: scenario.startMonth,
        horizonMonths: scenario.horizonMonths,
        creditScenarioId:
          scenarioIdMap.get(scenario.creditScenarioId) ??
          scenario.creditScenarioId,
        updatedAt: importedAt,
      });
    }
    for (const item of snapshot.liquidityItems) {
      await ctx.db.insert("liquidityItems", {
        userIdentifier: targetUserIdentifier,
        scenarioId: liquidityIdMap.get(item.scenarioId) ?? item.scenarioId,
        itemId: item.itemId,
        position: item.position,
        data: item.data,
        updatedAt: importedAt,
      });
    }
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", targetUserIdentifier),
      )
      .unique();
    const nextSettings = {
      userIdentifier: targetUserIdentifier,
      activeProjectId: projectId,
      activeScenarioId: firstScenarioId,
      comparedScenarioIds: [],
      detailScenarioId: firstScenarioId,
      activeLiquidityScenarioId: firstLiquidityScenarioId,
      includeRefinancing: false,
      analysisHorizonYears: 30,
      opportunityRate: defaultOpportunityRate,
      updatedAt: importedAt,
    };
    if (existingSettings === null) {
      await ctx.db.insert("userSettings", nextSettings);
    } else {
      await ctx.db.replace("userSettings", existingSettings._id, nextSettings);
    }
    return { projectId, importedAt };
  },
});

export const replaceForCurrentUser = mutation({
  args: {
    projects: v.optional(v.array(projectValidator)),
    settings: settingsValidator,
    financingScenarios: v.array(financingScenarioValidator),
    credits: v.array(creditValidator),
    liquidityScenarios: v.array(liquidityScenarioValidator),
    liquidityItems: v.array(liquidityItemValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const userIdentifier = identity.tokenIdentifier;
    const updatedAt = Date.now();

    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", userIdentifier),
      )
      .unique();
    const nextSettings = {
      userIdentifier,
      ...args.settings,
      updatedAt,
    };
    if (existingSettings === null) {
      await ctx.db.insert("userSettings", nextSettings);
    } else if (
      !sameValues(existingSettings, nextSettings, [
        "activeProjectId",
        "activeScenarioId",
        "comparedScenarioIds",
        "detailScenarioId",
        "activeLiquidityScenarioId",
        "includeRefinancing",
        "analysisHorizonYears",
        "opportunityRate",
      ])
    ) {
      await ctx.db.replace("userSettings", existingSettings._id, nextSettings);
    }

    for (const project of args.projects ?? [defaultProject()]) {
      const existingProject = await ctx.db
        .query("projects")
        .withIndex("by_userIdentifier_and_projectId", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("projectId", project.projectId),
        )
        .unique();
      const nextProject = { userIdentifier, ...project, updatedAt };
      if (existingProject === null) {
        await ctx.db.insert("projects", nextProject);
      } else if (
        !sameValues(existingProject, nextProject, ["name", "createdAt"])
      ) {
        await ctx.db.replace("projects", existingProject._id, nextProject);
      }
    }

    for (const scenario of args.financingScenarios) {
      const existing = await ctx.db
        .query("financingScenarios")
        .withIndex("by_userIdentifier_and_scenarioId", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("scenarioId", scenario.scenarioId),
        )
        .unique();
      const next = {
        userIdentifier,
        ...scenario,
        projectId: scenario.projectId ?? defaultProjectId,
        updatedAt,
      };
      if (existing === null) {
        await ctx.db.insert("financingScenarios", next);
      } else if (
        !sameValues(existing, next, [
          "name",
          "createdAt",
          "color",
          "sollzins",
          "effzins",
          "kaufpreis",
          "modernisierungskosten",
          "eigenkapital",
          "tilgungssatz",
          "zinsbindung",
        ])
      ) {
        await ctx.db.replace("financingScenarios", existing._id, next);
      }
    }

    for (const credit of args.credits) {
      const existing = await ctx.db
        .query("credits")
        .withIndex("by_userIdentifier_and_scenarioId_and_creditId", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("scenarioId", credit.scenarioId)
            .eq("creditId", credit.creditId),
        )
        .unique();
      const next = {
        userIdentifier,
        ...credit,
        projectId: credit.projectId ?? defaultProjectId,
        updatedAt,
      };
      if (existing === null) {
        await ctx.db.insert("credits", next);
      } else if (!sameValues(existing, next, ["data"])) {
        await ctx.db.replace("credits", existing._id, next);
      }
    }

    for (const scenario of args.liquidityScenarios) {
      const existing = await ctx.db
        .query("liquidityScenarios")
        .withIndex("by_userIdentifier_and_scenarioId", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("scenarioId", scenario.scenarioId),
        )
        .unique();
      const next = {
        userIdentifier,
        ...scenario,
        projectId: scenario.projectId ?? defaultProjectId,
        updatedAt,
      };
      if (existing === null) {
        await ctx.db.insert("liquidityScenarios", next);
      } else if (
        !sameValues(existing, next, [
          "name",
          "createdAt",
          "color",
          "startCapital",
          "startMonth",
          "horizonMonths",
          "creditScenarioId",
        ])
      ) {
        await ctx.db.replace("liquidityScenarios", existing._id, next);
      }
    }

    for (const item of args.liquidityItems) {
      const existing = await ctx.db
        .query("liquidityItems")
        .withIndex("by_userIdentifier_and_scenarioId_and_itemId", (q) =>
          q
            .eq("userIdentifier", userIdentifier)
            .eq("scenarioId", item.scenarioId)
            .eq("itemId", item.itemId),
        )
        .unique();
      const next = {
        userIdentifier,
        ...item,
        projectId: item.projectId ?? defaultProjectId,
        updatedAt,
      };
      if (existing === null) {
        await ctx.db.insert("liquidityItems", next);
      } else if (!sameValues(existing, next, ["position", "data"])) {
        await ctx.db.replace("liquidityItems", existing._id, next);
      }
    }

    await deleteMissingRows(
      ctx,
      "financingScenarios",
      userIdentifier,
      new Set(args.financingScenarios.map((row) => row.scenarioId)),
      (row) => String(row.scenarioId),
    );
    await deleteMissingRows(
      ctx,
      "credits",
      userIdentifier,
      new Set(
        args.credits.map((row) => `${row.scenarioId}\u0000${row.creditId}`),
      ),
      (row) => `${String(row.scenarioId)}\u0000${String(row.creditId)}`,
    );
    await deleteMissingRows(
      ctx,
      "liquidityScenarios",
      userIdentifier,
      new Set(args.liquidityScenarios.map((row) => row.scenarioId)),
      (row) => String(row.scenarioId),
    );
    await deleteMissingRows(
      ctx,
      "liquidityItems",
      userIdentifier,
      new Set(
        args.liquidityItems.map(
          (row) => `${row.scenarioId}\u0000${row.itemId}`,
        ),
      ),
      (row) => `${String(row.scenarioId)}\u0000${String(row.itemId)}`,
    );

    const legacy = await ctx.db
      .query("appStates")
      .withIndex("by_userIdentifier", (q) =>
        q.eq("userIdentifier", userIdentifier),
      )
      .unique();
    if (legacy !== null) await ctx.db.delete(legacy._id);

    return updatedAt;
  },
});
