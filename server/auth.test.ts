import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("local password hashing", () => {
  it("verifies a valid scrypt password hash", async () => {
    const encoded = await hashPassword("long-enough-password");
    expect(encoded).toMatch(/^scrypt-v1\$/);
    await expect(verifyPassword("long-enough-password", encoded)).resolves.toBe(true);
  });
  it("rejects an invalid password and malformed hash", async () => {
    const encoded = await hashPassword("long-enough-password");
    await expect(verifyPassword("wrong-password", encoded)).resolves.toBe(false);
    await expect(verifyPassword("long-enough-password", "broken")).resolves.toBe(false);
  });
});
