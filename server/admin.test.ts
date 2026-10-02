import { describe, expect, it } from "vitest";
import { BUILD_FLOW_ADMIN_EMAIL, isBuildFlowAdminEmail } from "./admin";

describe("BuildFlow administrator", () => {
  it("recognizes the configured admin email case-insensitively", () => {
    expect(isBuildFlowAdminEmail(`  ${BUILD_FLOW_ADMIN_EMAIL.toUpperCase()} `)).toBe(true);
  });

  it("does not promote another account", () => {
    expect(isBuildFlowAdminEmail("other@example.com")).toBe(false);
  });
});
