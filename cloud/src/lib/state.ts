import { sql } from "./db";
import type { User } from "./auth";

// Builds the exact payload the mobile app's api.ts expects for /api/state:
// { devices: [strip], local_ip, cost } with snake_case fields (same wire
// format as powerk.py), so server mode works unchanged.

const ONLINE_WINDOW_SEC = 30;

type Json = Record<string, unknown>;

export async function userState(user: User): Promise<Json> {
  const strips = await sql`
    select mac, name, model, fw, online, last_seen, payload, bridge_id
    from strips where user_id = ${user.id} order by mac`;

  const nameRows = await sql`
    select o.mac, o.outlet, o.name from outlet_names o
    join strips s on s.mac = o.mac where s.user_id = ${user.id}`;
  const outletNames = new Map<string, Record<string, string>>();
  for (const r of nameRows) {
    const entry = outletNames.get(r.mac) ?? {};
    entry[String(r.outlet)] = r.name;
    outletNames.set(r.mac, entry);
  }

  const devices: Json[] = [];
  for (const s of strips) {
    const fresh =
      s.last_seen !== null &&
      Date.now() - new Date(s.last_seen).getTime() < ONLINE_WINDOW_SEC * 1000;
    if (fresh && s.payload) {
      const payload = s.payload as Json;
      devices.push({
        ...payload,
        name: s.name ?? payload.name ?? `MTTL ${String(s.mac).slice(-7)}`,
        online: true,
        outlets: withOutletNames(payload.outlets, outletNames.get(s.mac)),
      });
    } else {
      const shell = offlineShell(s.mac, s.name, s.model, s.fw, s.payload as Json | null);
      devices.push({ ...shell, outlets: withOutletNames(shell.outlets, outletNames.get(s.mac)) });
    }
  }

  const bridgeIp = await sql`
    select public_ip from bridges
    where user_id = ${user.id} and public_ip is not null
    order by last_seen desc nulls last limit 1`;

  return {
    devices,
    local_ip: bridgeIp[0]?.public_ip ?? "",
    cost: { currency: user.currency, per_kwh: user.per_kwh },
  };
}

/** Cloud-stored outlet names win over whatever the strip/bridge reports. */
function withOutletNames(outlets: unknown, names: Record<string, string> | undefined): Json[] {
  const list = Array.isArray(outlets) ? (outlets as Json[]) : [];
  return list.map((o) => {
    const n = Number(o?.n);
    return { ...o, name: names?.[String(n)] ?? (typeof o?.name === "string" && o.name ? o.name : `Outlet ${n}`) };
  });
}

function offlineShell(mac: string, name: string | null, model: string | null, fw: string | null, payload: Json | null): Json {
  const last = (payload ?? {}) as Json;
  return {
    mac,
    name: name ?? last.name ?? `MTTL ${mac.slice(-7)}`,
    model: model ?? last.model ?? "",
    fw: fw ?? last.fw ?? "",
    online: false,
    on: false,
    power_w: 0,
    energy_kwh: Number(last.energy_kwh ?? 0),
    voltage: null,
    current_a: null,
    rssi: null,
    outlets: [1, 2, 3, 4].map((n) => {
      const prev = Array.isArray(last.outlets)
        ? (last.outlets as Json[]).find((x) => x?.n === n)
        : undefined;
      return {
        n,
        name: prev?.name ?? `Outlet ${n}`,
        on: false,
        power_w: 0,
        energy_kwh: Number(prev?.energy_kwh ?? 0),
        temp_c: Number(prev?.temp_c ?? 0),
      };
    }),
  };
}

export async function recordReading(mac: string, energyKwh: number): Promise<void> {
  if (!Number.isFinite(energyKwh) || energyKwh <= 0) return;
  const day = new Date().toISOString().slice(0, 10);
  // the strip's counter is monotonic: keep the highest value seen each day
  await sql`
    insert into readings (mac, day, kwh) values (${mac}, ${day}, ${energyKwh})
    on conflict (mac, day) do update set kwh = greatest(readings.kwh, ${energyKwh})`;
}
