// Pure schedule logic — no React Native imports, so node tests exercise it
// directly (same split as hub.ts vs hub/server.ts).

export interface OutletSchedule {
  id: string;
  mac: string;
  outlet: number; // 1..4
  /** Action at `time`: true = switch on, false = switch off. */
  on: boolean;
  /** Local wall-clock time, "HH:MM" (24 h). */
  time: string;
  /** Weekdays 0=Sunday..6=Saturday. Empty = every day. */
  days: number[];
  enabled: boolean;
}

export function makeSchedule(
  partial: Omit<OutletSchedule, 'id' | 'enabled'> & { enabled?: boolean },
): OutletSchedule {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { enabled: true, ...partial, id };
}

/** "07:05" -> { h: 7, m: 5 }, or null when malformed. */
export function parseTime(time: string): { h: number; m: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

export function isSchedule(v: unknown): v is OutletSchedule {
  const s = v as OutletSchedule;
  return (
    !!s &&
    typeof s.id === 'string' &&
    typeof s.mac === 'string' &&
    typeof s.outlet === 'number' &&
    typeof s.on === 'boolean' &&
    typeof s.time === 'string' &&
    /^\d{2}:\d{2}$/.test(s.time) &&
    Array.isArray(s.days) &&
    s.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    typeof s.enabled === 'boolean'
  );
}

/** Minute-of-day + date stamp used as the dedup key for fired events. */
export function minuteStamp(now: Date): { minuteKey: string; stamp: string } {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return {
    minuteKey: `${hh}:${mm}`,
    stamp: `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`,
  };
}

/**
 * Events due at `now` that were not already fired for this exact minute.
 */
export function dueEvents(
  now: Date,
  list: OutletSchedule[],
  fired: ReadonlySet<string>,
): OutletSchedule[] {
  const { minuteKey, stamp } = minuteStamp(now);
  return list.filter((s) => {
    if (!s.enabled) return false;
    if (s.time !== minuteKey) return false;
    if (s.days.length > 0 && !s.days.includes(now.getDay())) return false;
    return !fired.has(`${s.id}:${stamp}:${minuteKey}`);
  });
}

/** Marks events as fired for this minute (keeps the set bounded). */
export function markFired(fired: Set<string>, events: OutletSchedule[], now: Date): void {
  const { minuteKey, stamp } = minuteStamp(now);
  for (const e of events) fired.add(`${e.id}:${stamp}:${minuteKey}`);
  if (fired.size > 500) {
    const keep = [...fired].slice(-200);
    fired.clear();
    keep.forEach((k) => fired.add(k));
  }
}

/** Sorts events by time of day for display. */
export function sortEvents(list: OutletSchedule[]): OutletSchedule[] {
  return [...list].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}
