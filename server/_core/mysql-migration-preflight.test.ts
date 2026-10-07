import { describe, expect, it, vi } from "vitest";
import { usersTableExists } from "./mysql-migration-preflight";

describe("usersTableExists", () => {
  it("detects an existing users table with SHOW TABLES", async () => {
    const query = vi
      .fn()
      .mockResolvedValue([[{ Tables_in_buildflow: "users" }], []]);

    await expect(usersTableExists(query)).resolves.toBe(true);
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith("SHOW TABLES LIKE 'users'");
  });

  it("returns false when the users table has not been created yet", async () => {
    const query = vi.fn().mockResolvedValue([[], []]);

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
