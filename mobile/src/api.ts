// Talks to the powerk.py JSON API: GET /api/state, POST /api/onoff.
// Port of android/app/src/main/java/com/powerk/app/Api.kt.

export interface Outlet {
  n: number;
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

export interface Snapshot {
  serverIp: string;
  strips: Strip[];
}

/** Outlet by its number (1..4) — never by list position. */
export function outletOn(strip: Strip, n: number): boolean {
  return strip.outlets.find((o) => o.n === n)?.on ?? false;
}

export function outlet(strip: Strip, n: number): Outlet | undefined {
  return strip.outlets.find((o) => o.n === n);
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request(url: string, body: string | null, token: string): Promise<string> {
  let controller: AbortController | null = null;
  try {
    controller = new AbortController();
    const timer = setTimeout(() => controller!.abort(), 6000); // Kotlin: 4s connect / 6s read
    const response = await fetch(url, {
      method: body === null ? 'GET' : 'POST',
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
    ? o.outlets.map((x: any) => ({
        n: num(x?.n),
        on: Boolean(x?.on),
        powerW: num(x?.power_w),
        energyKwh: num(x?.energy_kwh),
        tempC: num(x?.temp_c),
      }))
    : [];
  return {
    mac: typeof o?.mac === 'string' ? o.mac : '',
    name: typeof o?.name === 'string' ? o.name : '',
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
    strips,
  };
}

export async function setOutlet(
  base: string,
  token: string,
  mac: string,
  outlet: number,
  on: boolean,
): Promise<void> {
  const body = JSON.stringify({ mac, outlet, on });
  const response = JSON.parse(await request(`${base}/api/onoff`, body, token));
  if (!response?.ok) throw new ApiError(response?.error || 'command failed');
}
