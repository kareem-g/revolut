import { NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import { authUser } from "@/src/lib/auth";

export async function POST(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const mac = String(body?.mac ?? "");
  const outlet = Number(body?.outlet);
  const on = Boolean(body?.on);
  if (!/^[0-9A-Fa-f]{12}$/.test(mac) || ![0, 1, 2, 3, 4].includes(outlet))
    return NextResponse.json({ error: "bad mac or outlet" }, { status: 400 });

  const strip = await sql`select last_seen from strips where mac = ${mac} and user_id = ${user.id}`;
  if (strip.length !== 1) return NextResponse.json({ error: "unknown strip" }, { status: 404 });
  const fresh =
    strip[0].last_seen !== null && Date.now() - new Date(strip[0].last_seen).getTime() < 30000;
  if (!fresh) return NextResponse.json({ error: "device offline" }, { status: 503 });

  const outlets = outlet === 0 ? [1, 2, 3, 4] : [outlet];
  for (const ch of outlets) {
    await sql`insert into commands (mac, outlet, turn_on) values (${mac}, ${ch}, ${on})`;
  }
  return NextResponse.json({ ok: true, confirmed: false });
}
