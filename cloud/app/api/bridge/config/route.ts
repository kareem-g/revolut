import { NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import { authBridge } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

// Everything the bridge executes locally: its strips, names, schedules,
// voltage rules, cost. Synced every ~30 s.
export async function GET(request: Request) {
  const bridge = await authBridge(request);
  if (!bridge) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await sql`update bridges set last_seen = now() where id = ${bridge.id}`;

  const strips = await sql`
    select mac, name from strips where bridge_id = ${bridge.id} order by mac`;
  const schedules = await sql`
    select s.id, s.mac, s.outlet, s.turn_on, s.time, s.days
    from schedules s join strips st on st.mac = s.mac
    where st.bridge_id = ${bridge.id}`;
  const rules = await sql`
    select v.id, v.mac, v.outlet, v.op, v.volts, v.action
    from voltage_rules v join strips st on st.mac = v.mac
    where st.bridge_id = ${bridge.id}`;
  const owner = await sql`
    select currency, per_kwh from users where id = ${bridge.user_id}`;

  return NextResponse.json({
    strips: strips.map((s) => ({ mac: s.mac, name: s.name })),
    schedules: schedules.map((s) => ({
      id: s.id, mac: s.mac, outlet: s.outlet, on: s.turn_on, time: s.time, days: s.days,
    })),
    voltage_rules: rules.map((r) => ({
      id: r.id, mac: r.mac, outlet: r.outlet, op: r.op, volts: Number(r.volts), action: r.action,
    })),
    cost: {
      currency: owner[0]?.currency ?? "$",
      per_kwh: Number(owner[0]?.per_kwh ?? 0),
    },
  });
}
