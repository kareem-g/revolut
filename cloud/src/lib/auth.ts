import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql, ensureSchema } from "./db";

// Auth: email + scrypt password for the dashboard, a stable api_token for the
// mobile app (sent as X-Token, matching powerk.py's scheme), and per-bridge
// tokens for bridges. Everything is one helper: authUser(request).

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function newToken(prefix = "pk"): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export interface User {
  id: string;
  email: string;
  api_token: string;
  currency: string;
  per_kwh: number;
}

function cookieToken(request: Request): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  const match = /(?:^|;\s*)pk_session=([^;]+)/.exec(raw);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Resolves the caller: X-Token / Bearer (app, bridge) or session cookie (web). */
export async function authUser(request: Request): Promise<User | null> {
  await ensureSchema();
  const header =
    request.headers.get("x-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const token = header || cookieToken(request);
  if (!token) return null;

  const byApi = await sql`
    select id, email, api_token, currency, per_kwh from users where api_token = ${token}`;
  if (byApi.length === 1) {
    const u = byApi[0];
    return { id: u.id, email: u.email, api_token: u.api_token, currency: u.currency, per_kwh: Number(u.per_kwh) };
  }

  const bySession = await sql`
    select u.id, u.email, u.api_token, u.currency, u.per_kwh
    from sessions s join users u on u.id = s.user_id
    where s.token = ${token} and s.created > now() - interval '90 days'`;
  if (bySession.length === 1) {
    const u = bySession[0];
    return { id: u.id, email: u.email, api_token: u.api_token, currency: u.currency, per_kwh: Number(u.per_kwh) };
  }
  return null;
}

/** Bridge auth: Bearer bridge token -> bridge row (with owner). */
export async function authBridge(request: Request) {
  await ensureSchema();
  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-bridge-token") ??
    "";
  if (!token) return null;
  const rows = await sql`
    select b.id, b.user_id, b.public_ip from bridges b where b.token = ${token}`;
  return rows[0] ?? null;
}

export async function sessionCookieHeader(token: string): Promise<string> {
  return `pk_session=${encodeURIComponent(token)}; HttpOnly; Secure; Path=/; Max-Age=7776000; SameSite=Lax`;
}
