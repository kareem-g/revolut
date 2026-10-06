import { NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import { authUser } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

function validDays(days: unknown): days is number[] {
  return Array.isArray(days) && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

export async function GET(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await sql`
    select s.id, s.mac, s.outlet, s.turn_on, s.time, s.days
    from schedules s join strips st on st.mac = s.mac
    where st.user_id = ${user.id} order by s.created asc`;
  return NextResponse.json({
    schedules: rows.map((r) => ({
      id: r.id, mac: r.mac, outlet: r.outlet, on: r.turn_on, time: r.time, days: r.days,
    })),
  });
}

export async function POST(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const mac = String(b?.mac ?? "");
  const outlet = Number(b?.outlet);
  const time = String(b?.time ?? "");
  if (!/^\d{2}:\d{2}$/.test(time) || !validDays(b?.days))
    return NextResponse.json({ error: "bad time or days" }, { status: 400 });
  const owned = await sql`select mac from strips where mac = ${mac} and user_id = ${user.id}`;
  if (owned.length !== 1) return NextResponse.json({ error: "unknown strip" }, { status: 404 });
  const rows = await sql`
    insert into schedules (mac, outlet, turn_on, time, days)
    values (${mac}, ${outlet}, ${Boolean(b?.on)}, ${time}, ${b.days})
    returning id`;
  return NextResponse.json({ ok: true, id: rows[0].id });
}

export async function DELETE(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await sql`
    delete from schedules s using strips st
    where s.mac = st.mac and s.id = ${id} and st.user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
