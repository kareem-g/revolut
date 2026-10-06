import { NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import { authBridge } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

// Command queue: the bridge claims pending commands (long-poll friendly),
// executes them on the strip's TCP session, and posts back the ids it sent.
export async function GET(request: Request) {
  const bridge = await authBridge(request);
  if (!bridge) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await sql`update bridges set last_seen = now() where id = ${bridge.id}`;

  // expire commands that sat too long (strip was offline)
  await sql`
    update commands set status = 'expired'
    where status = 'pending' and created < now() - interval '60 seconds'`;

  const rows = await sql`
    select c.id, c.mac, c.outlet, c.turn_on
    from commands c join strips s on s.mac = c.mac
    where s.bridge_id = ${bridge.id} and c.status = 'pending'
    order by c.created asc limit 20`;
  return NextResponse.json({
    commands: rows.map((r) => ({ id: r.id, mac: r.mac, outlet: r.outlet, on: r.turn_on })),
  });
}

export async function POST(request: Request) {
  const bridge = await authBridge(request);
  if (!bridge) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ids } = await request.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  await sql`
    update commands set status = 'done'
    where id = any(${ids.map((i: unknown) => String(i))}::uuid[])`;
  return NextResponse.json({ ok: true });
}
