import { NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import { authBridge } from "@/src/lib/auth";
import { recordReading } from "@/src/lib/state";

// State ingest: the bridge posts each strip's snapshot in the same snake_case
// shape powerk.py serves. First sight of a MAC binds it to this bridge.
export async function POST(request: Request) {
  const bridge = await authBridge(request);
  if (!bridge) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const mac = String(body?.mac ?? "").toUpperCase();
  const snap = body?.snapshot;
  if (!/^[0-9A-Fa-f]{12}$/.test(mac) || typeof snap !== "object" || snap === null)
    return NextResponse.json({ error: "bad state" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await sql`update bridges set last_seen = now(), public_ip = coalesce(${ip}, public_ip) where id = ${bridge.id}`;

  const existing = await sql`select user_id, bridge_id from strips where mac = ${mac}`;
  if (existing.length === 0) {
    // auto-claim: a strip that dials this bridge belongs to its owner
    await sql`
      insert into strips (mac, user_id, bridge_id, name, model, fw, online, last_seen, payload)
      values (${mac}, ${bridge.user_id}, ${bridge.id}, ${String(snap.name ?? "")},
              ${String(snap.model ?? "")}, ${String(snap.fw ?? "")}, true, now(), ${snap}::jsonb)`;
  } else {
    if (existing[0].bridge_id === null) {
      await sql`update strips set bridge_id = ${bridge.id} where mac = ${mac}`;
    }
    if (existing[0].user_id !== bridge.user_id)
      return NextResponse.json({ error: "strip owned by another user" }, { status: 403 });
    await sql`
      update strips set online = true, last_seen = now(), payload = ${snap}::jsonb,
        model = coalesce(nullif(${String(snap.model ?? "")}, ''), model),
        fw = coalesce(nullif(${String(snap.fw ?? "")}, ''), fw)
      where mac = ${mac}`;
  }

  const energy = Number(snap.energy_kwh);
  if (Number.isFinite(energy)) await recordReading(mac, energy);

  return NextResponse.json({ ok: true });
}
