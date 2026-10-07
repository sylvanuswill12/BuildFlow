import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertAiUsage,
  InsertAgentMemory,
  InsertProject,
  InsertProjectMessage,
  InsertProjectSnapshot,
  InsertProjectAttachment,
  InsertResearchRun,
  InsertResearchSource,
  Payment,
  Project,
  ProjectMessage,
  ProjectSnapshot,
  ProjectAttachment,
  User,
  agentMemories,
  aiUsage,
  payments,
  projects,
  messages,
  snapshots,
  attachments,
  researchRuns,
  researchSources,
  stripeEvents,
  users,
} from "../drizzle/schema";
import { isBuildFlowAdminEmail } from "./admin";
import { normalizeMySql2ConnectionUrl } from "./_core/mysql-url";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(normalizeMySql2ConnectionUrl(process.env.DATABASE_URL));
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function checkDatabase(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.warn(
      "[Database] Health check failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

export type CreateLocalUserInput = {
  name: string;
  email: string;
  passwordHash: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  return result[0];
}

export async function createLocalUser(input: CreateLocalUserInput): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const email = normalizeEmail(input.email);
  const isAdmin = isBuildFlowAdminEmail(email);
  const now = new Date();
  await db.insert(users).values({
    authId: randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash: input.passwordHash,
    role: isAdmin ? "admin" : "user",
    plan: isAdmin ? "team" : "free",
    credits: isAdmin ? 2_000 : 20,
    generationCount: 0,
    creditsResetAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
    lastSignedIn: now,
  });
  const user = await getUserByEmail(email);
  if (!user) throw new Error("User was not created");
  return user;
}

export async function touchUserLastSignedIn(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
  return getUserById(id);
}

export async function listProjects(ownerId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(
  ownerId: number,
  id: string
): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), eq(projects.id, id)))
    .limit(1);
  return result[0];
}

export async function createProject(project: InsertProject): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(projects).values(project);
  const created = await getProject(project.ownerId, project.id);
  if (!created) throw new Error("Project was not created");
  return created;
}

export async function createProjectWithCredit(
  project: InsertProject,
  userId: number
): Promise<{ project: Project; credits: number; generationCount: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const resetDue = sql`${users.creditsResetAt} <= CURRENT_TIMESTAMP`;
    await tx
      .update(users)
      .set({
        credits: sql`CASE WHEN ${resetDue} THEN CASE ${users.plan} WHEN 'pro' THEN 500 WHEN 'team' THEN 2000 ELSE 20 END ELSE ${users.credits} END`,
        generationCount: sql`CASE WHEN ${resetDue} THEN 0 ELSE ${users.generationCount} END`,
        creditsResetAt: sql`CASE WHEN ${resetDue} THEN DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 MONTH) ELSE ${users.creditsResetAt} END`,
      })
      .where(eq(users.id, userId));
    const debit = await tx
      .update(users)
      .set({
        credits: sql`${users.credits} - 1`,
        generationCount: sql`${users.generationCount} + 1`,
      })
      .where(and(eq(users.id, userId), gt(users.credits, 0)));
    if (Number((debit as { affectedRows?: number }).affectedRows ?? 0) === 0) {
      throw new Error("NO_CREDITS");
    }
    await tx.insert(projects).values(project);
    const [created] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, userId), eq(projects.id, project.id)))
      .limit(1);
    const [usage] = await tx
      .select({
        credits: users.credits,
        generationCount: users.generationCount,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!created || !usage)
      throw new Error("Project transaction did not complete");
    return { project: created, ...usage };
  });
}

export async function updateProject(
  ownerId: number,
  id: string,
  patch: Partial<
    Pick<
      Project,
      "name" | "status" | "description" | "files" | "sourceFiles" | "revision"
        | "deploymentProvider" | "deploymentId" | "deploymentUrl"
        | "deploymentStatus" | "deploymentError" | "deployedRevision"
        | "deploymentUpdatedAt"
    >
  >
): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(projects.ownerId, ownerId), eq(projects.id, id)));
  return getProject(ownerId, id);
}

export async function deleteProject(
  ownerId: number,
  id: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .delete(projects)
    .where(and(eq(projects.ownerId, ownerId), eq(projects.id, id)));
  return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

export async function listProjectMessages(
  ownerId: number,
  projectId: string
): Promise<ProjectMessage[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.ownerId, ownerId),
        eq(messages.projectId, projectId)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(500);
  return rows.reverse();
}

export async function createProjectMessage(
  input: Omit<InsertProjectMessage, "id" | "createdAt">
): Promise<ProjectMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const message = { ...input, id: randomUUID() };
  await db.insert(messages).values(message);
  const [created] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.ownerId, input.ownerId),
        eq(messages.id, message.id)
      )
    )
    .limit(1);
  if (!created) throw new Error("Project message was not created");
  return created;
}

export async function createAiUsage(input: InsertAiUsage): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(aiUsage).values(input);
}

export async function listAiUsage(ownerId: number, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({
    id: aiUsage.id,
    projectId: aiUsage.projectId,
    provider: aiUsage.provider,
    model: aiUsage.model,
    complexity: aiUsage.complexity,
    inputTokens: aiUsage.inputTokens,
    outputTokens: aiUsage.outputTokens,
    totalTokens: aiUsage.totalTokens,
    estimatedCostMicros: aiUsage.estimatedCostMicros,
    tokenCountsEstimated: aiUsage.tokenCountsEstimated,
    latencyMs: aiUsage.latencyMs,
    fallbackFrom: aiUsage.fallbackFrom,
    createdAt: aiUsage.createdAt,
  }).from(aiUsage).where(eq(aiUsage.ownerId, ownerId)).orderBy(desc(aiUsage.createdAt)).limit(limit);
}

export async function listProjectSnapshots(ownerId: number, projectId: string): Promise<Array<Omit<ProjectSnapshot, "files">>> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({
    id: snapshots.id,
    ownerId: snapshots.ownerId,
    projectId: snapshots.projectId,
    label: snapshots.label,
    createdAt: snapshots.createdAt,
  }).from(snapshots)
    .where(and(eq(snapshots.ownerId, ownerId), eq(snapshots.projectId, projectId)))
    .orderBy(desc(snapshots.createdAt))
    .limit(100);
}

export async function getProjectSnapshot(ownerId: number, id: string): Promise<ProjectSnapshot | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [snapshot] = await db.select().from(snapshots)
    .where(and(eq(snapshots.ownerId, ownerId), eq(snapshots.id, id)))
    .limit(1);
  return snapshot;
}

export async function createProjectSnapshot(input: Omit<InsertProjectSnapshot, "id" | "createdAt">): Promise<ProjectSnapshot> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const id = randomUUID();
  await db.insert(snapshots).values({ ...input, id });
  const created = await getProjectSnapshot(input.ownerId, id);
  if (!created) throw new Error("Project snapshot was not created");
  return created;
}

export async function createProjectAttachment(input: InsertProjectAttachment): Promise<Omit<ProjectAttachment, "fileData">> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(attachments).values(input);
  const [created] = await db.select({
    id: attachments.id,
    ownerId: attachments.ownerId,
    projectId: attachments.projectId,
    storageKey: attachments.storageKey,
    originalName: attachments.originalName,
    mimeType: attachments.mimeType,
    size: attachments.size,
    createdAt: attachments.createdAt,
  }).from(attachments)
    .where(and(eq(attachments.ownerId, input.ownerId), eq(attachments.id, input.id)))
    .limit(1);
  if (!created) throw new Error("Image attachment was not created");
  return created;
}

export async function getProjectAttachment(ownerId: number, id: string): Promise<ProjectAttachment | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [attachment] = await db.select().from(attachments)
    .where(and(eq(attachments.ownerId, ownerId), eq(attachments.id, id)))
    .limit(1);
  return attachment;
}

export async function listProjectAttachments(ownerId: number, projectId: string, ids: string[]): Promise<ProjectAttachment[]> {
  if (!ids.length) return [];
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(attachments)
    .where(and(eq(attachments.ownerId, ownerId), eq(attachments.projectId, projectId), inArray(attachments.id, ids)));
}

export async function consumeCredit(
  userId: number
): Promise<{ credits: number; generationCount: number } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const resetDue = sql`${users.creditsResetAt} <= CURRENT_TIMESTAMP`;
  await db
    .update(users)
    .set({
      credits: sql`CASE WHEN ${resetDue} THEN CASE ${users.plan} WHEN 'pro' THEN 500 WHEN 'team' THEN 2000 ELSE 20 END ELSE ${users.credits} END`,
      generationCount: sql`CASE WHEN ${resetDue} THEN 0 ELSE ${users.generationCount} END`,
      creditsResetAt: sql`CASE WHEN ${resetDue} THEN DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 MONTH) ELSE ${users.creditsResetAt} END`,
    })
    .where(eq(users.id, userId));
  const result = await db
    .update(users)
    .set({
      credits: sql`${users.credits} - 1`,
      generationCount: sql`${users.generationCount} + 1`,
    })
    .where(and(eq(users.id, userId), gt(users.credits, 0)));
  if (Number((result as { affectedRows?: number }).affectedRows ?? 0) === 0)
    return null;
  const usage = await db
    .select({ credits: users.credits, generationCount: users.generationCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return usage[0] ?? null;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateUserProfile(
  userId: number,
  patch: Pick<CreateLocalUserInput, "name" | "email">
): Promise<User | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(users)
    .set({ ...patch, email: normalizeEmail(patch.email), updatedAt: new Date() })
    .where(eq(users.id, userId));
  return getUserById(userId);
}

export async function updateUserBilling(
  userId: number,
  patch: Partial<
    Pick<
      User,
      | "plan"
      | "credits"
      | "generationCount"
      | "creditsResetAt"
      | "stripeCustomerId"
      | "stripeSubscriptionId"
      | "stripePriceId"
      | "stripeSubscriptionStatus"
      | "stripeCurrentPeriodEnd"
    >
  >
): Promise<User | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return getUserById(userId);
}

export async function getUserByStripeSubscriptionId(
  subscriptionId: string
): Promise<User | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .select()
    .from(users)
    .where(eq(users.stripeSubscriptionId, subscriptionId))
    .limit(1);
  return result[0];
}

export async function recordStripeEvent(event: {
  id: string;
  type: string;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .insert(stripeEvents)
    .values(event)
    .onDuplicateKeyUpdate({ set: { id: sql`${stripeEvents.id}` } });
  return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

export async function hasStripeEvent(eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, eventId))
    .limit(1);
  return result.length > 0;
}

export async function deleteStripeEvent(eventId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(stripeEvents).where(eq(stripeEvents.id, eventId));
}

export async function createPayment(
  payment: Omit<Payment, "createdAt">
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(payments)
    .values(payment)
    .onDuplicateKeyUpdate({
      set: {
        status: payment.status,
        stripePaymentIntentId: payment.stripePaymentIntentId,
      },
    });
}

export async function updatePaymentStatusByPaymentIntent(
  paymentIntentId: string,
  status: string
): Promise<Payment | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(payments)
    .set({ status })
    .where(eq(payments.stripePaymentIntentId, paymentIntentId));
  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  return result[0];
}

export async function listPayments(ownerId: number): Promise<Payment[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(payments)
    .where(eq(payments.ownerId, ownerId))
    .orderBy(desc(payments.createdAt));
}

export async function createResearchSource(source: InsertResearchSource) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(researchSources).values(source);
  return source;
}

export async function listResearchSources(ownerId: number, projectId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(researchSources)
    .where(
      projectId
        ? and(
            eq(researchSources.ownerId, ownerId),
            eq(researchSources.projectId, projectId)
          )
        : eq(researchSources.ownerId, ownerId)
    )
    .orderBy(desc(researchSources.createdAt));
}

export async function createResearchRun(run: InsertResearchRun): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(researchRuns).values(run);
}

export async function listResearchRuns(ownerId: number, projectId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(researchRuns)
    .where(
      projectId
        ? and(
            eq(researchRuns.ownerId, ownerId),
            eq(researchRuns.projectId, projectId)
          )
        : eq(researchRuns.ownerId, ownerId)
    )
    .orderBy(desc(researchRuns.createdAt))
    .limit(30);
}

export async function upsertAgentMemory(
  memory: InsertAgentMemory
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(agentMemories)
    .values(memory)
    .onDuplicateKeyUpdate({
      set: {
        content: memory.content,
        confidence: memory.confidence,
        sourceRunId: memory.sourceRunId,
        expiresAt: memory.expiresAt,
        updatedAt: new Date(),
      },
    });
}

export async function listAgentMemories(ownerId: number, projectId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(agentMemories)
    .where(
      projectId
        ? and(
            eq(agentMemories.ownerId, ownerId),
            eq(agentMemories.projectId, projectId)
          )
        : eq(agentMemories.ownerId, ownerId)
    )
    .orderBy(desc(agentMemories.updatedAt))
    .limit(100);
}
