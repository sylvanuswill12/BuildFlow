import {
  customType,
  foreignKey,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

const mediumBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "mediumblob",
});

/**
 * Core user table backing auth flow and BuildFlow entitlements.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  authId: varchar("authId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["free", "pro", "team"]).default("free").notNull(),
  credits: int("credits").default(20).notNull(),
  generationCount: int("generationCount").default(0).notNull(),
  creditsResetAt: timestamp("creditsResetAt").defaultNow().notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", {
    length: 128,
  }).unique(),
  stripePriceId: varchar("stripePriceId", { length: 128 }),
  stripeSubscriptionStatus: varchar("stripeSubscriptionStatus", { length: 32 }),
  stripeCurrentPeriodEnd: timestamp("stripeCurrentPeriodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    type: varchar("type", { length: 80 }).notNull(),
    description: text("description").notNull(),
    status: mysqlEnum("status", ["Brouillon", "En cours", "Publié", "Archivé"])
      .default("En cours")
      .notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    files: int("files").default(12).notNull(),
    sourceFiles: mediumtext("sourceFiles"),
    revision: int("revision").default(1).notNull(),
    accent: varchar("accent", { length: 32 }).default("#3B82F6").notNull(),
    gradient: varchar("gradient", { length: 160 })
      .default("from-blue-500/30 via-violet-500/10 to-transparent")
      .notNull(),
    initials: varchar("initials", { length: 8 }).default("BF").notNull(),
    deploymentProvider: mysqlEnum("deploymentProvider", ["vercel", "netlify", "cloudflare"]),
    deploymentId: varchar("deploymentId", { length: 256 }),
    deploymentUrl: varchar("deploymentUrl", { length: 2_048 }),
    deploymentStatus: mysqlEnum("deploymentStatus", ["queued", "building", "ready", "error"]),
    deploymentError: text("deploymentError"),
    deployedRevision: int("deployedRevision"),
    deploymentUpdatedAt: timestamp("deploymentUpdatedAt"),
  },
  table => ({
    ownerIdx: index("projects_owner_idx").on(table.ownerId),
    updatedIdx: index("projects_updated_idx").on(table.updatedAt),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "projects_owner_fk",
    }),
  })
);
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export const aiUsage = mysqlTable(
  "ai_usage",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    projectId: varchar("projectId", { length: 64 }),
    provider: varchar("provider", { length: 48 }).notNull(),
    model: varchar("model", { length: 160 }).notNull(),
    complexity: mysqlEnum("complexity", ["low", "medium", "high"]).notNull(),
    inputTokens: int("inputTokens").notNull(),
    outputTokens: int("outputTokens").notNull(),
    totalTokens: int("totalTokens").notNull(),
    estimatedCostMicros: int("estimatedCostMicros").notNull(),
    tokenCountsEstimated: int("tokenCountsEstimated").default(1).notNull(),
    latencyMs: int("latencyMs").notNull(),
    fallbackFrom: varchar("fallbackFrom", { length: 48 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerIdx: index("ai_usage_owner_idx").on(table.ownerId),
    projectIdx: index("ai_usage_project_idx").on(table.projectId),
    createdIdx: index("ai_usage_created_idx").on(table.createdAt),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "ai_usage_owner_fk",
    }),
    projectFk: foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: "ai_usage_project_fk",
    }).onDelete("set null"),
  })
);
export type AiUsage = typeof aiUsage.$inferSelect;
export type InsertAiUsage = typeof aiUsage.$inferInsert;

export const messages = mysqlTable(
  "messages",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    projectId: varchar("projectId", { length: 64 }).notNull(),
    role: varchar("role", { length: 16 }).notNull(),
    content: mediumtext("content").notNull(),
    actions: json("actions").$type<string[] | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerIdx: index("messages_owner_idx").on(table.ownerId),
    projectIdx: index("messages_project_idx").on(table.projectId),
    createdIdx: index("messages_created_idx").on(table.createdAt),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "messages_owner_fk",
    }),
    projectFk: foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: "messages_project_fk",
    }).onDelete("cascade"),
  })
);
export type ProjectMessage = typeof messages.$inferSelect;
export type InsertProjectMessage = typeof messages.$inferInsert;

export const snapshots = mysqlTable(
  "snapshots",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    projectId: varchar("projectId", { length: 64 }).notNull(),
    label: varchar("label", { length: 320 }).notNull(),
    files: mediumtext("files").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerIdx: index("snapshots_owner_idx").on(table.ownerId),
    projectIdx: index("snapshots_project_idx").on(table.projectId),
    createdIdx: index("snapshots_created_idx").on(table.createdAt),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "snapshots_owner_fk",
    }),
    projectFk: foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: "snapshots_project_fk",
    }).onDelete("cascade"),
  })
);
export type ProjectSnapshot = typeof snapshots.$inferSelect;
export type InsertProjectSnapshot = typeof snapshots.$inferInsert;

export const attachments = mysqlTable(
  "attachments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    projectId: varchar("projectId", { length: 64 }).notNull(),
    storageKey: varchar("storageKey", { length: 96 }).notNull().unique(),
    originalName: varchar("originalName", { length: 240 }).notNull(),
    mimeType: varchar("mimeType", { length: 32 }).notNull(),
    size: int("size").notNull(),
    fileData: mediumBlob("fileData"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerIdx: index("attachments_owner_idx").on(table.ownerId),
    projectIdx: index("attachments_project_idx").on(table.projectId),
    createdIdx: index("attachments_created_idx").on(table.createdAt),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "attachments_owner_fk",
    }),
    projectFk: foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: "attachments_project_fk",
    }).onDelete("cascade"),
  })
);
export type ProjectAttachment = typeof attachments.$inferSelect;
export type InsertProjectAttachment = typeof attachments.$inferInsert;

export const researchSources = mysqlTable(
  "research_sources",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    projectId: varchar("projectId", { length: 64 }),
    url: varchar("url", { length: 2_048 }).notNull(),
    title: varchar("title", { length: 320 }),
    topic: varchar("topic", { length: 160 }).notNull(),
    trustScore: int("trustScore").default(50).notNull(),
    active: int("active").default(1).notNull(),
    lastFetchedAt: timestamp("lastFetchedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerIdx: index("research_sources_owner_idx").on(table.ownerId),
    projectIdx: index("research_sources_project_idx").on(table.projectId),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "research_sources_owner_fk",
    }),
  })
);
export type ResearchSource = typeof researchSources.$inferSelect;
export type InsertResearchSource = typeof researchSources.$inferInsert;

export const researchRuns = mysqlTable(
  "research_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    projectId: varchar("projectId", { length: 64 }),
    query: varchar("query", { length: 2_000 }).notNull(),
    status: mysqlEnum("status", ["queued", "running", "completed", "failed"])
      .default("completed")
      .notNull(),
    findings: mediumtext("findings"),
    citations: mediumtext("citations"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerIdx: index("research_runs_owner_idx").on(table.ownerId),
    projectIdx: index("research_runs_project_idx").on(table.projectId),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "research_runs_owner_fk",
    }),
  })
);
export type ResearchRun = typeof researchRuns.$inferSelect;
export type InsertResearchRun = typeof researchRuns.$inferInsert;

export const agentMemories = mysqlTable(
  "agent_memories",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    projectId: varchar("projectId", { length: 64 }),
    agentRole: varchar("agentRole", { length: 120 }).notNull(),
    key: varchar("key", { length: 160 }).notNull(),
    content: mediumtext("content").notNull(),
    confidence: int("confidence").default(50).notNull(),
    sourceRunId: varchar("sourceRunId", { length: 64 }),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerIdx: index("agent_memories_owner_idx").on(table.ownerId),
    projectIdx: index("agent_memories_project_idx").on(table.projectId),
    roleIdx: index("agent_memories_role_idx").on(table.agentRole),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "agent_memories_owner_fk",
    }),
  })
);
export type AgentMemory = typeof agentMemories.$inferSelect;
export type InsertAgentMemory = typeof agentMemories.$inferInsert;

export const stripeEvents = mysqlTable("stripe_events", {
  id: varchar("id", { length: 128 }).primaryKey(),
  type: varchar("type", { length: 128 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});
export type StripeEvent = typeof stripeEvents.$inferSelect;

export const payments = mysqlTable(
  "payments",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    plan: mysqlEnum("plan", ["pro", "team"]).notNull(),
    amount: int("amount").notNull(),
    currency: varchar("currency", { length: 8 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", {
      length: 128,
    }).unique(),
    stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerIdx: index("payments_owner_idx").on(table.ownerId),
    createdIdx: index("payments_created_idx").on(table.createdAt),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "payments_owner_fk",
    }),
  })
);
export type Payment = typeof payments.$inferSelect;
