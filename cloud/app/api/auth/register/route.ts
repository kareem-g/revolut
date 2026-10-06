import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/src/lib/db";
import { hashPassword, newToken, sessionCookieHeader } from "@/src/lib/auth";

export async function POST(request: Request) {
  await ensureSchema();
  const { email, password } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  if (typeof password !== "string" || password.length < 8)
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });

  const existing = await sql`select id from users where email = ${email}`;
  if (existing.length > 0)
    return NextResponse.json({ error: "email already registered" }, { status: 409 });

  const apiToken = newToken("pk");
  const rows = await sql`
    insert into users (email, pw_hash, api_token) values (${email}, ${hashPassword(password)}, ${apiToken})
    returning id`;
  const session = newToken("s");
  await sql`insert into sessions (token, user_id) values (${session}, ${rows[0].id})`;
  const res = NextResponse.json({ ok: true, api_token: apiToken });
  res.headers.set("set-cookie", await sessionCookieHeader(session));
  return res;
}
