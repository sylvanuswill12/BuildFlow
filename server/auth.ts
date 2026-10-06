import { timingSafeEqual, scrypt as scryptCallback } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import type { User } from "../drizzle/schema";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import * as db from "./db";
import { ENV } from "./_core/env";

const HASH_VERSION = "scrypt-v1";
const KEY_LENGTH = 64;

type SessionPayload = {
  userId: number;
  authId: string;
};

export type PublicUser = Omit<User, "passwordHash">;

function deriveKey(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(Buffer.from(derivedKey));
    });
  });
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

function sessionKey() {
  if (ENV.sessionSecret.length < 32) {
    throw new Error(
      "APP_SESSION_SECRET must contain at least 32 characters before local authentication can be used."
    );
  }
  return new TextEncoder().encode(ENV.sessionSecret);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveKey(password, Buffer.from(salt), KEY_LENGTH);
  return `${HASH_VERSION}$${Buffer.from(salt).toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string | null
): Promise<boolean> {
  if (!encoded) return false;
  const [version, saltHex, digestHex] = encoded.split("$");
  if (version !== HASH_VERSION || !saltHex || !digestHex) return false;
  try {
    const expected = Buffer.from(digestHex, "hex");
    const derived = await deriveKey(password, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

export async function createSessionToken(user: User): Promise<string> {
  if (!user.authId) throw new Error("Local authentication ID is missing for this user.");
  const expiresAt = Math.floor((Date.now() + SESSION_MAX_AGE_MS) / 1000);
  return new SignJWT({ authId: user.authId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(sessionKey());
}

async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    const authId = typeof payload.authId === "string" ? payload.authId : "";
    if (!Number.isInteger(userId) || userId < 1 || !authId) return null;
    return { userId, authId };
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: Request): Promise<User | null> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const bearer = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const session = await verifySession(cookies[COOKIE_NAME] ?? bearer);
  if (!session) return null;
  const user = await db.getUserById(session.userId);
  if (!user || user.authId !== session.authId) return null;
  return user;
}
