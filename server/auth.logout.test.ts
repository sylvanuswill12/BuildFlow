import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user = {
    id: 1,
    authId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    passwordHash: "scrypt-v1$00$00",
    role: "user",
    plan: "free",
    credits: 20,
    generationCount: 0,
    creditsResetAt: new Date(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    stripeSubscriptionStatus: null,
    stripeCurrentPeriodEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as User;
  const ctx: TrpcContext = {
    user,
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: (name: string, options: Record<string, unknown>) => clearedCookies.push({ name, options }) } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the local session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const result = await appRouter.createCaller(ctx).auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1, secure: true, sameSite: "none", httpOnly: true, path: "/" });
  });
});
