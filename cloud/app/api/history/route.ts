import { NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import { authUser } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const mac = url.searchParams.get("mac");

  const rows = await sql`
    select r.mac, r.day::text as day, r.kwh
    from readings r join strips s on s.mac = r.mac
    where s.user_id = ${user.id}
      ${mac ? sql`and r.mac = ${mac}` : sql``}
      and r.day > current_date - ${days}::int
    order by r.day asc`;

  // History = kWh consumed per day (delta between this day's and the
  // previous day's monotonic counter).
  const perMac = new Map<string, { total_kwh: number; daily: { date: string; kwh: number }[] }>();
  const last = new Map<string, number>();
  for (const r of rows) {
    const kwh = Number(r.kwh);
    const prev = last.get(r.mac);
    const delta = prev === undefined ? 0 : Math.max(0, kwh - prev);
    last.set(r.mac, kwh);
    if (!perMac.has(r.mac)) perMac.set(r.mac, { total_kwh: 0, daily: [] });
    const entry = perMac.get(r.mac)!;
    entry.daily.push({ date: String(r.day), kwh: Math.round(delta * 1000) / 1000 });
    entry.total_kwh += delta;
  }
  const history: Record<string, unknown> = {};
  for (const [m, v] of perMac) {
    history[m] = {
      total_kwh: Math.round(v.total_kwh * 1000) / 1000,
      daily: v.daily,
      cost: Math.round(v.total_kwh * user.per_kwh * 100) / 100,
      currency: user.currency,
    };
  }
  return NextResponse.json(history);
}
