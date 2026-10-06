import { NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import { authUser } from "@/src/lib/auth";

export async function POST(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const mac = String(body?.mac ?? "");
  const owned = await sql`select mac from strips where mac = ${mac} and user_id = ${user.id}`;
  if (owned.length !== 1) return NextResponse.json({ error: "unknown strip" }, { status: 404 });

  if (typeof body?.name === "string" && body.name.trim())
    await sql`update strips set name = ${body.name.trim()} where mac = ${mac}`;
  if (Number.isInteger(body?.outlet) && typeof body?.outletName === "string" && body.outletName.trim()) {
    const outlet = Number(body.outlet);
    await sql`
      insert into outlet_names (mac, outlet, name) values (${mac}, ${outlet}, ${body.outletName.trim()})
      on conflict (mac, outlet) do update set name = ${body.outletName.trim()}`;
  }
  return NextResponse.json({ ok: true });
}
