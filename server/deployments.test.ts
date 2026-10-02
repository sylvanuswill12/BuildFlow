import { afterEach, describe, expect, it } from "vitest";
import { deployFiles, deploymentPreflight } from "./deployments";

const names = [
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "NETLIFY_AUTH_TOKEN",
  "NETLIFY_SITE_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_PROJECT_NAME",
  "CLOUDFLARE_WRANGLER_BIN",
] as const;
const original = Object.fromEntries(names.map(name => [name, process.env[name]]));

afterEach(() => {
  for (const name of names) {
    const value = original[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("deployment adapters", () => {
  it("reports missing provider credentials without exposing values", () => {
    for (const name of names) delete process.env[name];
    const result = deploymentPreflight("netlify");
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(["NETLIFY_AUTH_TOKEN", "NETLIFY_SITE_ID"]);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("refuses to publish source-only projects without index.html", async () => {
    await expect(
      deployFiles("netlify", { "page.tsx": "export default function Page() { return null; }" })
    ).rejects.toThrow("index.html");
  });
});
