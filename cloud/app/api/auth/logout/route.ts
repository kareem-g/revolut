import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/src/lib/db";

export async function POST() {
  const token = (await cookies()).get("pk_session")?.value;
  if (token) await sql`delete from sessions where token = ${token}`;
  const res = NextResponse.json({ ok: true });
  res.headers.set("set-cookie", "pk_session=; HttpOnly; Secure; Path=/; Max-Age=0");
  return res;
}
