import { describe, expect, it, vi } from "vitest";
import {
  mysqlRows,
  selectedDatabaseName,
  usersTableExists,
} from "./mysql-migration-preflight";

describe("mysqlRows", () => {
  it("accepts the row-array shape returned by Drizzle MySQL2 execute()", () => {
    expect(mysqlRows([{ rowCount: 3 }])).toEqual([{ rowCount: 3 }]);
  });

  it("also accepts the [rows, fields] shape from mysql2's promise API", () => {
    expect(mysqlRows([[{ rowCount: 3 }], []])).toEqual([{ rowCount: 3 }]);
  });

  it("returns an empty list for non-row results", () => {
    expect(mysqlRows(null)).toEqual([]);
    expect(mysqlRows({ affectedRows: 1 })).toEqual([]);
  });
});

describe("selectedDatabaseName", () => {
  it("returns the schema selected by the connection URL", async () => {
    const query = vi.fn().mockResolvedValue([{ databaseName: "defaultdb" }]);

    await expect(selectedDatabaseName(query)).resolves.toBe("defaultdb");
    expect(query).toHaveBeenCalledWith("SELECT DATABASE() AS databaseName");
  });

  it("returns null when the connection has no selected schema", async () => {
    const query = vi.fn().mockResolvedValue([{ databaseName: null }]);

    await expect(selectedDatabaseName(query)).resolves.toBeNull();
  });
});

describe("usersTableExists", () => {
  it("detects an existing users table from Drizzle's row-array result", async () => {
    const query = vi.fn().mockResolvedValue([{ tableName: "users" }]);

    await expect(usersTableExists(query)).resolves.toBe(true);
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      "SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' LIMIT 1"
    );
  });

  it("returns false when the users table has not been created yet", async () => {
    const query = vi.fn().mockResolvedValue([]);

    await expect(usersTableExists(query)).resolves.toBe(false);
  });

  it("propagates driver errors so the production log retains the database cause", async () => {
    const driverError = Object.assign(new Error("database query failed"), {
      code: "ER_ACCESS_DENIED_ERROR",
    });
    const query = vi.fn().mockRejectedValue(driverError);

    await expect(usersTableExists(query)).rejects.toBe(driverError);
  });
});
