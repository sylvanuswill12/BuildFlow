import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getDb } from "../server/db";
import {
  mysqlRows,
  selectedDatabaseName,
  usersTableExists,
} from "../server/_core/mysql-migration-preflight";

type CountRow = { rowCount: number | string };

function firstRows<T>(result: unknown): T[] {
  return mysqlRows<T>(result);
}

function safeMysqlDiagnostics(error: unknown): string[] {
  const diagnostics: string[] = [];
  const seen = new Set<object>();
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (current === null || typeof current !== "object" || seen.has(current)) {
      break;
    }
    seen.add(current);
    const details = current as Record<string, unknown>;

    if (
      typeof details.code === "string" &&
      /^[A-Z0-9_]{1,64}$/.test(details.code)
    ) {
      diagnostics.push(`code=${details.code}`);
    }
    if (
      typeof details.errno === "number" &&
      Number.isSafeInteger(details.errno)
    ) {
      diagnostics.push(`errno=${details.errno}`);
    }
    if (
      typeof details.sqlState === "string" &&
      /^[A-Z0-9]{5}$/.test(details.sqlState)
    ) {
      diagnostics.push(`sqlState=${details.sqlState}`);
    }

    current = details.cause;
  }

  return [...new Set(diagnostics)];
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
    const query = (statement: string) => database.execute(sql.raw(statement));
    const selectedDatabase = await selectedDatabaseName(query);
    if (!selectedDatabase) {
      throw new Error(
        "DATABASE_URL did not select a MySQL database. Include the database name in the URL path; no schema changes were applied."
      );
    }

    if (await usersTableExists(query)) {
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
  const diagnostics = safeMysqlDiagnostics(error);
  const diagnosticSuffix = diagnostics.length
    ? ` (${diagnostics.join(", ")})`
    : "";
  console.error(
    `[Database] Production migration failed${diagnosticSuffix}:`,
    error instanceof Error ? error.message : "unknown error"
  );
  process.exitCode = 1;
});
