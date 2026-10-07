export type MysqlTextQuery = (statement: string) => Promise<unknown>;

/**
 * Detect the legacy users table without requiring access to information_schema.
 * The fixed table name also keeps the SHOW statement free of user-controlled SQL.
 */
export async function usersTableExists(
  query: MysqlTextQuery
): Promise<boolean> {
  const result = await query("SHOW TABLES LIKE 'users'");
  if (!Array.isArray(result)) return false;

  const [rows] = result;
  return Array.isArray(rows) && rows.length > 0;
}
