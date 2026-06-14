import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const settingsValidator = v.object({
  activeScenarioId: v.string(),
  comparedScenarioIds: v.array(v.string()),
  activeLiquidityScenarioId: v.string(),
  includeRefinancing: v.boolean(),
  analysisHorizonYears: v.number(),
});

const financingScenarioValidator = v.object({
  scenarioId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  color: v.string(),
  effzins: v.number(),
  kaufpreis: v.number(),
  modernisierungskosten: v.number(),
  eigenkapital: v.number(),
  tilgungssatz: v.number(),
  zinsbindung: v.number(),
});

const creditValidator = v.object({
  scenarioId: v.string(),
  creditId: v.string(),
  data: v.any(),
});

const liquidityScenarioValidator = v.object({
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
  scenarioId: v.string(),
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
        scenarios,
        activeScenarioId: settings.activeScenarioId,
        scenarioValues,
        comparedScenarioIds: settings.comparedScenarioIds,
        liquidityScenarios,
        activeLiquidityScenarioId: settings.activeLiquidityScenarioId,
        liquidityScenarioValues,
        includeRefinancing: settings.includeRefinancing,
        analysisHorizonYears: settings.analysisHorizonYears,
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

export const replaceForCurrentUser = mutation({
  args: {
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
        "activeScenarioId",
        "comparedScenarioIds",
        "activeLiquidityScenarioId",
        "includeRefinancing",
        "analysisHorizonYears",
      ])
    ) {
      await ctx.db.replace("userSettings", existingSettings._id, nextSettings);
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
      const next = { userIdentifier, ...scenario, updatedAt };
      if (existing === null) {
        await ctx.db.insert("financingScenarios", next);
      } else if (
        !sameValues(existing, next, [
          "name",
          "createdAt",
          "color",
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
      const next = { userIdentifier, ...credit, updatedAt };
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
      const next = { userIdentifier, ...scenario, updatedAt };
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
      const next = { userIdentifier, ...item, updatedAt };
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
