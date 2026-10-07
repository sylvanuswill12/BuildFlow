import { describe, expect, it } from "vitest";
import { normalizeMySql2ConnectionUrl } from "./mysql-url";

describe("normalizeMySql2ConnectionUrl", () => {
  it("leaves MySQL URLs without ssl-mode unchanged", () => {
    const url = "mysql://user:pass@db.example:1234/app?charset=utf8mb4";
    expect(normalizeMySql2ConnectionUrl(url)).toBe(url);
  });

  it("maps Aiven ssl-mode=REQUIRED to mysql2 SSL with verification enabled", () => {
    const result = new URL(
      normalizeMySql2ConnectionUrl(
        "mysql://user:pass@db.example:1234/app?ssl-mode=REQUIRED&charset=utf8mb4"
      )
    );

    expect(result.searchParams.has("ssl-mode")).toBe(false);
    expect(result.searchParams.get("charset")).toBe("utf8mb4");
    expect(JSON.parse(result.searchParams.get("ssl") ?? "null")).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("preserves a caller-supplied SSL configuration", () => {
    const ssl = JSON.stringify({ ca: "test-ca", rejectUnauthorized: true });
    const input = new URL("mysql://user:pass@db.example:1234/app");
    input.searchParams.set("ssl-mode", "VERIFY_IDENTITY");
    input.searchParams.set("ssl", ssl);

    const result = new URL(normalizeMySql2ConnectionUrl(input.toString()));
    expect(result.searchParams.has("ssl-mode")).toBe(false);
    expect(JSON.parse(result.searchParams.get("ssl") ?? "null")).toEqual({
      ca: "test-ca",
      rejectUnauthorized: true,
    });
  });

  it("rejects disabled TLS instead of silently connecting without encryption", () => {
    expect(() =>
      normalizeMySql2ConnectionUrl(
        "mysql://user:pass@db.example:1234/app?ssl-mode=DISABLED"
      )
    ).toThrow(/requires TLS/i);
  });

  it("rejects certificate-verification bypasses", () => {
    const input = new URL("mysql://user:pass@db.example:1234/app");
    input.searchParams.set("ssl-mode", "REQUIRED");
    input.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: false }));

    expect(() => normalizeMySql2ConnectionUrl(input.toString())).toThrow(
      /must not disable certificate verification/i
    );
  });

  it("rejects VERIFY modes without an explicit CA-capable SSL configuration", () => {
    expect(() =>
      normalizeMySql2ConnectionUrl(
        "mysql://user:pass@db.example:1234/app?ssl-mode=VERIFY_CA"
      )
    ).toThrow(/Aiven CA certificate/i);
  });
});
