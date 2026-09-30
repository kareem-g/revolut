// Wire-format parser for the MTTL-W01 strip's `up:` line protocol on TCP 10086.
// Pure logic, ported 1:1 from powerk.py (regexes + parse_getinfo) so it can be
// unit-tested in node without any RN imports.

export interface Bootinfo {
  model: string;
  mac: string; // uppercase
  fw: string;
}

export interface OutletRecord {
  n: number;
  on: boolean;
  powerW: number;
  energyKwh: number;
  tempC: number;
}

const BOOTINFO_RE =
  /^up:bootinfo:([^;\r\n]+);([0-9A-Fa-f]{12});([0-9A-Fa-f]{12});([^;\r\n]+);connect$/;
const GETINFO_RE =
  /([1-5]):(-?\d+);(on|off);(-?\d+);([^;:]+);([^;:]+);(-?\d+);([0-9A-Fa-f]{8});([0-9A-Fa-f]{8});([0-9A-Fa-f]{8});([^;:]+);([0-9A-Fa-f]{2});(-?\d+)/gi;
const ONOFF_ACK_RE = /^up:onoff:([1-4]):(on|off)$/i;
const EVENT_RE = /^up:event:onoff:([0-4]):(on|off)$/i;
const POWER_REPORT_RE = /^up:power_report:([1-5]):(-?\d+)$/i;
const QUERY_RE = /^up:query:(-?\d+)$/;

export function matchBootinfo(line: string): Bootinfo | null {
  const m = BOOTINFO_RE.exec(line);
  if (!m) return null;
  return { model: m[1], mac: m[2].toUpperCase(), fw: m[4] };
}

/** Parse 'up:getinfo:...' into per-outlet records (channel 5 is the aggregate — skipped). */
export function parseGetinfo(line: string): OutletRecord[] {
  let text = line.trim();
  if (text.toLowerCase().startsWith('up:getinfo:')) text = text.slice('up:getinfo:'.length);
  const out: OutletRecord[] = [];
  let m: RegExpExecArray | null;
  GETINFO_RE.lastIndex = 0;
  while ((m = GETINFO_RE.exec(text)) !== null) {
    const ch = Number(m[1]);
    if (ch > 4) continue;
    out.push({
      n: ch,
      on: m[3].toLowerCase() === 'on',
      powerW: round(Number(m[7]) / 1000.0, 2),
      energyKwh: round(parseInt(m[8], 16) / 1000.0, 3),
      tempC: Number(m[13]),
    });
  }
  return out;
}

export function matchPowerReport(line: string): { ch: number; value: number } | null {
  const m = POWER_REPORT_RE.exec(line);
  if (!m) return null;
  return { ch: Number(m[1]), value: Number(m[2]) };
}

export function matchQuery(line: string): number | null {
  const m = QUERY_RE.exec(line);
  return m ? Number(m[1]) : null;
}

export function matchEvent(line: string): { ch: number; on: boolean } | null {
  const m = EVENT_RE.exec(line);
  if (!m) return null;
  return { ch: Number(m[1]), on: m[2].toLowerCase() === 'on' };
}

export function isOnoffAck(line: string): boolean {
  return ONOFF_ACK_RE.test(line);
}

export function stripName(mac: string): string {
  return `MTTL ${mac.slice(-7)}`;
}

export function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Cleans one raw line exactly like powerk.py's readline loop (NULs removed, ends trimmed). */
export function cleanLine(raw: string): string {
  return raw.replace(/\0/g, '').replace(/^[\r\n ]+|[\r\n ]+$/g, '');
}
