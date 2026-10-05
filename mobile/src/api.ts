// Talks to the powerk.py JSON API. All features (state, onoff, naming, cost,
// history, schedules, voltage rules) ride the same base + token auth.

export interface Outlet {
  n: number;
  name: string;
  on: boolean;
  powerW: number;
  energyKwh: number;
  tempC: number;
}

export interface Strip {
  mac: string;
  name: string;
  model: string;
  fw: string;
  online: boolean;
  on: boolean;
  powerW: number;
  energyKwh: number;
  voltage: number | null;
  currentA: number | null;
  rssi: number | null;
  outlets: Outlet[];
}

export interface Cost {
  currency: string;
  per_kwh: number;
}

export interface Snapshot {
  serverIp: string;
  cost: Cost;
  strips: Strip[];
}

export interface Schedule {
  id: string;
  mac: string;
  outlet: number;
  on: boolean;
  time: string;
  days: number[];
}

export interface VoltageRule {
  id: string;
  mac: string;
  outlet: number;
  op: 'below' | 'above' | 'equals';
  volts: number;
  action: 'on' | 'off';
}

export interface History {
  [mac: string]: {
    total_kwh: number;
    daily: { date: string; kwh: number }[];
    cost: number;
    currency: string;
  };
}

export function outletOn(strip: Strip, n: number): boolean {
  return strip.outlets.find((o) => o.n === n)?.on ?? false;
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request(url: string, body: string | null, token: string, method?: 'GET' | 'POST' | 'DELETE'): Promise<string> {
  let controller: AbortController | null = null;
  try {
    controller = new AbortController();
    const timer = setTimeout(() => controller!.abort(), 6000);
    const response = await fetch(url, {
      method: method ?? (body === null ? 'GET' : 'POST'),
      headers: {
        ...(token ? { 'X-Token': token } : {}),
        ...(body !== null ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ?? undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await response.text();
    if (!response.ok) throw new ApiError(errorOf(text, response.status));
    return text;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new ApiError('timed out');
    throw new ApiError(e instanceof Error ? e.message : 'connection failed');
  }
}

function errorOf(body: string, code: number): string {
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.error === 'string' && parsed.error) return parsed.error;
  } catch {}
  return `HTTP ${code}`;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseStrip(o: any): Strip {
  const outlets: Outlet[] = Array.isArray(o?.outlets)
    ? o.outlets.map((x: any, i: number) => ({
        n: num(x?.n, i + 1),
        name: typeof x?.name === 'string' && x.name ? x.name : `Outlet ${num(x?.n, i + 1)}`,
        on: Boolean(x?.on),
        powerW: num(x?.power_w),
        energyKwh: num(x?.energy_kwh),
        tempC: num(x?.temp_c),
      }))
    : [];
  return {
    mac: typeof o?.mac === 'string' ? o.mac : '',
    name: typeof o?.name === 'string' && o.name ? o.name : '',
    model: typeof o?.model === 'string' ? o.model : '',
    fw: typeof o?.fw === 'string' ? o.fw : '',
    online: Boolean(o?.online),
    on: Boolean(o?.on),
    powerW: num(o?.power_w),
    energyKwh: num(o?.energy_kwh),
    voltage: numOrNull(o?.voltage),
    currentA: numOrNull(o?.current_a),
    rssi: numOrNull(o?.rssi),
    outlets,
  };
}

export async function snapshot(base: string, token: string): Promise<Snapshot> {
  const root = JSON.parse(await request(`${base}/api/state`, null, token));
  const strips: Strip[] = Array.isArray(root?.devices) ? root.devices.map(parseStrip) : [];
  return {
    serverIp: typeof root?.local_ip === 'string' ? root.local_ip : '',
    cost: {
      currency: root?.cost?.currency ?? '$',
      per_kwh: num(root?.cost?.per_kwh),
    },
    strips,
  };
}

export async function setOutlet(base: string, token: string, mac: string, outlet: number, on: boolean): Promise<void> {
  const body = JSON.stringify({ mac, outlet, on });
  const response = JSON.parse(await request(`${base}/api/onoff`, body, token));
  if (!response?.ok) throw new ApiError(response?.error || 'command failed');
}

// --- naming -----------------------------------------------------------------

export async function rename(base: string, token: string, opts: { mac: string; name?: string; outlet?: number; outletName?: string }): Promise<void> {
  await request(`${base}/api/name`, JSON.stringify(opts), token);
}

// --- cost -------------------------------------------------------------------

export async function setCost(base: string, token: string, currency: string, perKwh: number): Promise<Cost> {
  const res = JSON.parse(await request(`${base}/api/cost`, JSON.stringify({ currency, per_kwh: perKwh }), token));
  return res?.cost ?? { currency, per_kwh: perKwh };
}

// --- history ----------------------------------------------------------------

export async function history(base: string, token: string, mac?: string, days = 30): Promise<History> {
  const q = mac ? `?mac=${encodeURIComponent(mac)}&days=${days}` : `?days=${days}`;
  return JSON.parse(await request(`${base}/api/history${q}`, null, token));
}

// --- schedules --------------------------------------------------------------

export async function schedules(base: string, token: string): Promise<Schedule[]> {
  const res = JSON.parse(await request(`${base}/api/schedules`, null, token));
  return Array.isArray(res?.schedules) ? res.schedules : [];
}

export async function addSchedule(base: string, token: string, s: Omit<Schedule, 'id'>): Promise<string> {
  const res = JSON.parse(await request(`${base}/api/schedules`, JSON.stringify(s), token));
  if (!res?.ok) throw new ApiError(res?.error || 'failed to add schedule');
  return res.id;
}

export async function delSchedule(base: string, token: string, id: string): Promise<void> {
  await request(`${base}/api/schedules?id=${encodeURIComponent(id)}`, null, token, 'DELETE');
}

// --- voltage rules -----------------------------------------------------------

export async function voltageRules(base: string, token: string): Promise<VoltageRule[]> {
  const res = JSON.parse(await request(`${base}/api/voltage_rules`, null, token));
  return Array.isArray(res?.voltage_rules) ? res.voltage_rules : [];
}

export async function addVoltageRule(base: string, token: string, r: Omit<VoltageRule, 'id'>): Promise<string> {
  const res = JSON.parse(await request(`${base}/api/voltage_rules`, JSON.stringify(r), token));
  if (!res?.ok) throw new ApiError(res?.error || 'failed to add rule');
  return res.id;
}

export async function delVoltageRule(base: string, token: string, id: string): Promise<void> {
  await request(`${base}/api/voltage_rules?id=${encodeURIComponent(id)}`, null, token, 'DELETE');
}