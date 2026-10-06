import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/src/lib/db";
import { verifyPassword, newToken, sessionCookieHeader } from "@/src/lib/auth";

export async function POST(request: Request) {
  await ensureSchema();
  const { email, password } = await request.json().catch(() => ({}));
  const rows = await sql`
    select id, pw_hash, api_token from users where email = ${String(email ?? "")}`;
  if (rows.length !== 1 || !verifyPassword(String(password ?? ""), rows[0].pw_hash))
    return NextResponse.json({ error: "wrong email or password" }, { status: 401 });
  const session = newToken("s");
  await sql`insert into sessions (token, user_id) values (${session}, ${rows[0].id})`;
  const res = NextResponse.json({ ok: true, api_token: rows[0].api_token });
  res.headers.set("set-cookie", await sessionCookieHeader(session));
  return res;
}
