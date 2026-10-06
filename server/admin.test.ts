import { afterEach, describe, expect, it } from "vitest";
import { isBuildFlowAdminEmail } from "./admin";

const original = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = original;
});

describe("BuildFlow administrator", () => {
  it("recognizes configured administrator emails case-insensitively", () => {
    process.env.ADMIN_EMAILS = " owner@example.com , second@example.com ";
    expect(isBuildFlowAdminEmail("OWNER@example.com")).toBe(true);
    expect(isBuildFlowAdminEmail("second@example.com")).toBe(true);
  });
  it("does not promote accounts outside the configured list", () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    expect(isBuildFlowAdminEmail("other@example.com")).toBe(false);
  });
});
