import { and, desc, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertAgentMemory,
  InsertProject,
  InsertResearchRun,
  InsertResearchSource,
  InsertUser,
  Payment,
  Project,
  User,
  agentMemories,
  payments,
  projects,
  researchRuns,
  researchSources,
  stripeEvents,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { isBuildFlowAdminEmail } from "./admin";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    const isBuildFlowAdmin = isBuildFlowAdminEmail(user.email);
    if (isBuildFlowAdmin) {
      values.role = "admin";
      values.plan = "team";
      values.credits = 2_000;
      values.generationCount = 0;
      values.creditsResetAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      updateSet.role = "admin";
      updateSet.plan = "team";
      updateSet.credits = 2_000;
      updateSet.generationCount = 0;
      updateSet.creditsResetAt = values.creditsResetAt;
    } else if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
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
  patch: Pick<InsertUser, "name" | "email">
): Promise<User | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
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
