export type MysqlTextQuery = (statement: string) => Promise<unknown>;

type DatabaseNameRow = { databaseName: string | null };

/**
 * Drizzle's MySQL2 execute() returns rows directly, while the lower-level
 * mysql2 promise API returns [rows, fields]. Accept both shapes so callers
 * cannot silently mistake a successful SELECT for an empty result.
 */
export function mysqlRows<T>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];
  const first = result[0];
  return (Array.isArray(first) ? first : result) as T[];
}

/** Read the currently selected schema before any production migration runs. */
export async function selectedDatabaseName(
  query: MysqlTextQuery
): Promise<string | null> {
  const rows = mysqlRows<DatabaseNameRow>(
    await query("SELECT DATABASE() AS databaseName")
  );
  const name = rows[0]?.databaseName;
  return typeof name === "string" && name.trim() ? name : null;
}

/**
 * Detect the legacy users table via MySQL's INFORMATION_SCHEMA.TABLES view.
 * The table identifier is fixed, and the lookup is scoped to DATABASE().
 */
export async function usersTableExists(
  query: MysqlTextQuery
): Promise<boolean> {
  const result = await query(
    "SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' LIMIT 1"
  );
  return mysqlRows(result).length > 0;
}
