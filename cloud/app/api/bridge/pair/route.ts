import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/src/lib/db";

// One-time pairing: the bridge exchanges the short code shown on the dashboard
// for a permanent bridge token. The code is consumed on use.
export async function POST(request: Request) {
  await ensureSchema();
  const { code } = await request.json().catch(() => ({}));
  const pairCode = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,12}$/.test(pairCode))
    return NextResponse.json({ error: "bad pairing code" }, { status: 400 });
  const token = `bridge_${crypto.randomUUID().replace(/-/g, "")}`;
  const rows = await sql`
    update bridges set token = ${token}, pair_code = null
    where pair_code = ${pairCode} and user_id is not null
    returning id, user_id`;
  if (rows.length !== 1)
    return NextResponse.json({ error: "unknown or already-used pairing code" }, { status: 404 });
  return NextResponse.json({ ok: true, token });
}
