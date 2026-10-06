import { NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import { authUser } from "@/src/lib/auth";

export async function POST(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const currency = typeof body?.currency === "string" && body.currency ? body.currency.slice(0, 4) : user.currency;
  const perKwh = Math.max(0, Number(body?.per_kwh) || 0);
  await sql`update users set currency = ${currency}, per_kwh = ${perKwh} where id = ${user.id}`;
  return NextResponse.json({ cost: { currency, per_kwh: perKwh } });
}
