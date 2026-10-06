import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

describe("application session cookie", () => {
  it("supports cross-site HTTPS Preview and production sessions", () => {
    const options = getSessionCookieOptions({} as never);
    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });
});
