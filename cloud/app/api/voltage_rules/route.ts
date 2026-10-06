import { NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import { authUser } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await sql`
    select v.id, v.mac, v.outlet, v.op, v.volts, v.action
    from voltage_rules v join strips st on st.mac = v.mac
    where st.user_id = ${user.id} order by v.created asc`;
  return NextResponse.json({
    voltage_rules: rows.map((r) => ({
      id: r.id, mac: r.mac, outlet: r.outlet, op: r.op, volts: Number(r.volts), action: r.action,
    })),
  });
}

export async function POST(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const mac = String(b?.mac ?? "");
  const op = String(b?.op ?? "");
  const action = String(b?.action ?? "");
  const volts = Number(b?.volts);
  if (!["below", "above", "equals"].includes(op) || !["on", "off"].includes(action) || !Number.isFinite(volts))
    return NextResponse.json({ error: "bad rule" }, { status: 400 });
  const owned = await sql`select mac from strips where mac = ${mac} and user_id = ${user.id}`;
  if (owned.length !== 1) return NextResponse.json({ error: "unknown strip" }, { status: 404 });
  const rows = await sql`
    insert into voltage_rules (mac, outlet, op, volts, action)
    values (${mac}, ${Number(b?.outlet) || 0}, ${op}, ${volts}, ${action})
    returning id`;
  return NextResponse.json({ ok: true, id: rows[0].id });
}

export async function DELETE(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await sql`
    delete from voltage_rules v using strips st
    where v.mac = st.mac and v.id = ${id} and st.user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
