import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Signing key derived from the password — changing the password invalidates
// every issued token.
const signingKey = crypto.createHash("sha256").update(env.APP_PASSWORD).digest();

export function authEnabled(): boolean {
  return env.APP_PASSWORD.length > 0;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingKey).update(payload).digest("base64url");
}

export function createToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string): boolean {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) {
    return false;
  }
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: number };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function checkPassword(input: unknown): boolean {
  if (!authEnabled() || typeof input !== "string") {
    return false;
  }
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(env.APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!authEnabled()) {
    next();
    return;
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (verifyToken(token)) {
    next();
    return;
  }
  res.status(401).json({ error: "Não autorizado." });
}

// Basic in-memory brute-force throttle on the login endpoint.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map<string, { count: number; resetAt: number }>();

export function loginThrottled(ip: string): boolean {
  const entry = failures.get(ip);
  if (entry && entry.resetAt > Date.now()) {
    return entry.count >= MAX_FAILURES;
  }
  return false;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= now) {
    failures.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}
