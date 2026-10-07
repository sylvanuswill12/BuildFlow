import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getDb } from "../server/db";
import { usersTableExists } from "../server/_core/mysql-migration-preflight";

type CountRow = { rowCount: number | string };

function firstRows<T>(result: unknown): T[] {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return [];
  return result[0] as T[];
}

async function countRows(
  database: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  query: ReturnType<typeof sql>
) {
  const result = await database.execute(query);
  const [row] = firstRows<CountRow>(result);
  return Number(row?.rowCount ?? 0);
}

async function main() {
  const context = process.env.CONTEXT ?? "local";
  if (context !== "production") {
    console.info(
      `[Database] Production migrations skipped for CONTEXT=${context}.`
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for production migrations; no schema changes were applied."
    );
  }

  const database = await getDb();
  if (!database)
    throw new Error(
      "Could not initialize the production database; no schema changes were applied."
    );

  try {
    if (
      await usersTableExists(statement => database.$client.query(statement))
    ) {
      const duplicateEmailGroups = await countRows(
        database,
        sql`SELECT COUNT(*) AS rowCount FROM (
          SELECT LOWER(TRIM(email)) AS normalizedEmail
          FROM users
          WHERE email IS NOT NULL AND TRIM(email) <> ''
          GROUP BY LOWER(TRIM(email))
          HAVING COUNT(*) > 1
        ) AS duplicate_email_groups`
      );
      if (duplicateEmailGroups > 0) {
        throw new Error(
          `Production migration blocked: ${duplicateEmailGroups} duplicate email group(s) exist. Resolve them before deployment; no migration was run.`
        );
      }
    }

    await migrate(database, { migrationsFolder: "./drizzle" });
    console.info("[Database] Production migrations completed.");
  } finally {
    await database.$client.end();
  }
}

main().catch(error => {
  console.error(
    "[Database] Production migration failed:",
    error instanceof Error ? error.message : "unknown error"
  );
  process.exitCode = 1;
});
