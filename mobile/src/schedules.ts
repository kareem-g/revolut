import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import {
  OutletSchedule,
  dueEvents,
  isSchedule,
  markFired,
} from './schedule-logic';

export type { OutletSchedule } from './schedule-logic';

// Schedule storage + evaluation engine. The engine reuses the app's normal
// command path, so schedules work in both direct and server modes. Honest
// limit, same as direct mode itself: events only fire while the app runs.

const STORAGE_KEY = 'outlet_schedules';
const TICK_MS = 15000;

let cache: OutletSchedule[] | null = null;

export async function loadSchedules(): Promise<OutletSchedule[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    cache = Array.isArray(list) ? list.filter(isSchedule) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export async function saveSchedules(list: OutletSchedule[]): Promise<void> {
  cache = list;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable: schedules stay in memory for this session
  }
}

type Executor = (mac: string, outlet: number, on: boolean) => void;

let engineStarted = false;
let paused = false;
let swapExecutor: ((fn: Executor) => void) | null = null;

/** Stops firing events (server mode: the external powerk.py executes them). */
export function pauseScheduleEngine(): void {
  paused = true;
}

/**
 * Starts the evaluation loop (idempotent). The executor is the app's normal
 * command path; it may be swapped at any time (mode switches, reconnects).
 * Returns an unsubscribe (used by tests / never in the app).
 */
export function startScheduleEngine(executor: Executor): () => void {
  paused = false;
  if (engineStarted && swapExecutor) {
    swapExecutor(executor);
    return () => undefined;
  }
  engineStarted = true;
  swapExecutor = (fn) => {
    exec = fn;
  };

  const fired = new Set<string>();
  let exec: Executor = executor;

  const timer = setInterval(() => {
    if (paused || AppState.currentState !== 'active') return;
    const now = new Date();
    const list = cache ?? [];
    const due = dueEvents(now, list, fired);
    if (due.length === 0) return;
    markFired(fired, due, now);
    for (const e of due) exec(e.mac, e.outlet, e.on);
  }, TICK_MS);

  return () => clearInterval(timer);
}
