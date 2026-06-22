import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    userIdentifier: v.string(),
    projectId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastActiveScenarioId: v.optional(v.string()),
    lastActiveLiquidityScenarioId: v.optional(v.string()),
  })
    .index("by_userIdentifier", ["userIdentifier"])
    .index("by_userIdentifier_and_projectId", ["userIdentifier", "projectId"]),
  userSettings: defineTable({
    userIdentifier: v.string(),
    activeProjectId: v.optional(v.string()),
    activeScenarioId: v.string(),
    comparedScenarioIds: v.array(v.string()),
    detailScenarioId: v.optional(v.string()),
    activeLiquidityScenarioId: v.string(),
    includeRefinancing: v.boolean(),
    analysisHorizonYears: v.number(),
    opportunityRate: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_userIdentifier", ["userIdentifier"]),
  financingScenarios: defineTable({
    userIdentifier: v.string(),
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
    updatedAt: v.number(),
  })
    .index("by_userIdentifier", ["userIdentifier"])
    .index("by_userIdentifier_and_projectId", ["userIdentifier", "projectId"])
    .index("by_userIdentifier_and_scenarioId", ["userIdentifier", "scenarioId"])
    .index("by_userIdentifier_and_projectId_and_scenarioId", [
      "userIdentifier",
      "projectId",
      "scenarioId",
    ]),
  credits: defineTable({
    userIdentifier: v.string(),
    projectId: v.optional(v.string()),
    scenarioId: v.string(),
    creditId: v.string(),
    data: v.any(),
    updatedAt: v.number(),
  })
    .index("by_userIdentifier", ["userIdentifier"])
    .index("by_userIdentifier_and_projectId", ["userIdentifier", "projectId"])
    .index("by_userIdentifier_and_scenarioId_and_creditId", [
      "userIdentifier",
      "scenarioId",
      "creditId",
    ])
    .index("by_userIdentifier_and_projectId_and_scenarioId_and_creditId", [
      "userIdentifier",
      "projectId",
      "scenarioId",
      "creditId",
    ]),
  liquidityScenarios: defineTable({
    userIdentifier: v.string(),
    projectId: v.optional(v.string()),
    scenarioId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    color: v.string(),
    startCapital: v.number(),
    startMonth: v.string(),
    horizonMonths: v.number(),
    creditScenarioId: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userIdentifier", ["userIdentifier"])
    .index("by_userIdentifier_and_projectId", ["userIdentifier", "projectId"])
    .index("by_userIdentifier_and_scenarioId", ["userIdentifier", "scenarioId"])
    .index("by_userIdentifier_and_projectId_and_scenarioId", [
      "userIdentifier",
      "projectId",
      "scenarioId",
    ]),
  liquidityItems: defineTable({
    userIdentifier: v.string(),
    projectId: v.optional(v.string()),
    scenarioId: v.string(),
    itemId: v.string(),
    position: v.number(),
    data: v.any(),
    updatedAt: v.number(),
  })
    .index("by_userIdentifier", ["userIdentifier"])
    .index("by_userIdentifier_and_projectId", ["userIdentifier", "projectId"])
    .index("by_userIdentifier_and_scenarioId_and_itemId", [
      "userIdentifier",
      "scenarioId",
      "itemId",
    ])
    .index("by_userIdentifier_and_projectId_and_scenarioId_and_itemId", [
      "userIdentifier",
      "projectId",
      "scenarioId",
      "itemId",
    ]),
  localImports: defineTable({
    userIdentifier: v.string(),
    kind: v.union(v.literal("financing"), v.literal("liquidity")),
    fingerprint: v.string(),
    importedScenarioId: v.string(),
    importedAt: v.number(),
  }).index("by_userIdentifier_and_kind_and_fingerprint", [
    "userIdentifier",
    "kind",
    "fingerprint",
  ]),
  appStates: defineTable({
    userIdentifier: v.string(),
    state: v.any(),
    updatedAt: v.number(),
  }).index("by_userIdentifier", ["userIdentifier"]),
  projectShares: defineTable({
    token: v.string(),
    userIdentifier: v.string(),
    projectId: v.string(),
    liquidityScenarioIds: v.array(v.string()),
    access: v.optional(v.union(v.literal("view"), v.literal("edit"))),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_userIdentifier_and_projectId", ["userIdentifier", "projectId"]),
});
