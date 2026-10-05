// In-app port of powerk.py's Hub/Session: keeps live strip state, speaks the
// `up:` protocol over a transport (TCP socket in the app, plain functions in
// tests). Polls every 5 s, diagnostics every 3rd poll, one command transaction
// per strip at a time — same timing as the reference server.

import type { Strip } from '../api';
import {
  Bootinfo,
  OutletRecord,
  cleanLine,
  isOnoffAck,
  matchBootinfo,
  matchEvent,
  matchPowerReport,
  matchQuery,
  parseGetinfo,
  round,
  stripName,
} from './protocol';

export interface HubTransport {
  ip: string;
  send(cmd: string): void;
  close(): void;
}

export interface HubConnection {
  /** Feed a raw TCP chunk; the hub buffers and splits lines. */
  feed(chunk: string): void;
  /** Peer dropped or the socket errored. */
  closed(): void;
}

interface DeviceState {
  mac: string;
  model: string;
  fw: string;
  ip: string;
  online: boolean;
  voltage: number | null;
  rssi: number | null;
  outlets: Map<number, OutletRecord>;
}

const POLL_MS = 5000;
const DIAG_EVERY = 3;
const REFRESH_TIMEOUT_MS = 6000;
const SETTLE_MS = 300;
const MAX_LINE = 8192;

const emptyOutlets = (): Map<number, OutletRecord> =>
  new Map(
    [1, 2, 3, 4].map((n) => [n, { n, on: false, powerW: 0, energyKwh: 0, tempC: 0 } as OutletRecord]),
  );

class Hub {
  private devices = new Map<string, DeviceState>();
  private transports = new Map<string, HubTransport>(); // mac -> live transport
  private sessionMac = new Map<HubConnection, string>();
  private sessionTransport = new Map<HubConnection, HubTransport>();
  private waiters = new Map<string, () => void>(); // mac -> getinfo resolver
  private locks = new Map<string, Promise<unknown>>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollCount = 0;
  private listeners = new Set<() => void>();

  running = false;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  /** Registers an incoming TCP connection; returns the feeder for its socket. */
  openConnection(ip: string, transport: HubTransport): HubConnection {
    let buffer = '';
    const conn: HubConnection = {
      feed: (chunk: string) => {
        buffer += chunk;
        for (;;) {
          const newline = buffer.indexOf('\n');
          if (newline === -1) break;
          const raw = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (raw.length > MAX_LINE) {
            conn.closed();
            return;
          }
          this.handleLine(conn, transport, raw);
        }
      },
      closed: () => this.closeSession(conn),
    };
    this.sessionTransport.set(conn, transport);
    return conn;
  }

  private closeSession(conn: HubConnection) {
    const mac = this.sessionMac.get(conn);
    const ownTransport = this.sessionTransport.get(conn);
    this.sessionMac.delete(conn);
    this.sessionTransport.delete(conn);
    // Only the *registered* session marks the strip offline — a replaced
    // session's close must not unregister its successor.
    if (mac && ownTransport && this.transports.get(mac) === ownTransport) {
      this.transports.delete(mac);
      const d = this.devices.get(mac);
      if (d && d.online) {
        d.online = false;
        this.notify();
      }
    }
  }

  private handleLine(conn: HubConnection, transport: HubTransport, rawLine: string) {
    const line = cleanLine(rawLine);
    if (!line) return;

    const boot: Bootinfo | null = matchBootinfo(line);
    if (boot) {
      const mac = boot.mac;
      const existing = this.devices.get(mac);
      const d: DeviceState =
        existing ?? { mac, model: boot.model, fw: boot.fw, ip: transport.ip, online: true, voltage: null, rssi: null, outlets: emptyOutlets() };
      d.model = boot.model;
      d.fw = boot.fw;
      d.ip = transport.ip;
      d.online = true;
      this.devices.set(mac, d);
      this.sessionMac.set(conn, mac);
      const old = this.transports.get(mac);
      if (old && old !== transport) old.close();
      this.transports.set(mac, transport);
      // fire-and-forget initial refresh, like powerk.py's create_task
      void this.refresh(mac).catch(() => undefined);
      this.notify();
      return;
    }

    const mac = this.sessionMac.get(conn);
    if (!mac) return;
    const d = this.devices.get(mac);
    if (!d) return;

    if (line.toLowerCase().startsWith('up:getinfo:')) {
      const records = parseGetinfo(line);
      if (records.length === 4) {
        d.outlets = new Map(records.map((r) => [r.n, r]));
        this.waiters.get(mac)?.();
        this.waiters.delete(mac);
        this.notify();
      }
      return;
    }

    const report = matchPowerReport(line);
    if (report) {
      // >=50000 is mV; smaller values are per-outlet mA, unused (as in powerk.py)
      if (report.value >= 50000) d.voltage = round(report.value / 1000.0, 1);
      this.notify();
      return;
    }

    const rssi = matchQuery(line);
    if (rssi !== null) {
      d.rssi = rssi;
      this.notify();
      return;
    }

    const event = matchEvent(line);
    if (event) {
      if (event.ch) {
        const outlet = d.outlets.get(event.ch);
        if (outlet) outlet.on = event.on;
        this.notify();
      }
      return;
    }

    isOnoffAck(line); // acks carry no state
  }

  // --- commands ------------------------------------------------------------

  private enqueue<T>(mac: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(mac) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.locks.set(
      mac,
      next.catch(() => undefined),
    );
    return next;
  }

  private send(mac: string, cmd: string): boolean {
    const t = this.transports.get(mac);
    if (!t) return false;
    t.send(cmd);
    return true;
  }

  private waitGetinfo(mac: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          this.waiters.delete(mac);
          resolve(false);
        }
      }, timeoutMs);
      this.waiters.set(mac, () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(true);
        }
      });
    });
  }

  private async refresh(mac: string): Promise<boolean> {
    if (!this.send(mac, 'up:getinfo:all')) return false;
    return this.waitGetinfo(mac, REFRESH_TIMEOUT_MS);
  }

  private async diagnostics(mac: string): Promise<void> {
    this.send(mac, 'up:power_report:1:vol');
    this.send(mac, 'up:query:wifirssi');
  }

  /** Toggles outlets (0 = all) and refreshes after the relays settle. */
  setOutlet(mac: string, outlet: number, on: boolean): Promise<void> {
    return this.enqueue(mac, async () => {
      if (!this.transports.get(mac)) throw new Error('strip offline');
      const channels = outlet === 0 ? [1, 2, 3, 4] : [outlet];
      channels.forEach((ch) => this.send(mac, `up:onoff:${ch}:${on ? 'on' : 'off'}`));
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      await this.refresh(mac);
    });
  }

  // --- lifecycle -----------------------------------------------------------

  start(): void {
    if (this.pollTimer) return;
    this.running = true;
    this.pollTimer = setInterval(() => {
      this.pollCount += 1;
      for (const mac of [...this.transports.keys()]) {
        void this.refresh(mac)
          .then((ok) => {
            if (ok && this.pollCount % DIAG_EVERY === 0) return this.diagnostics(mac);
            if (!ok) this.notify(); // poll timeout; state unchanged but log-worthy
            return undefined;
          })
          .catch(() => undefined);
      }
    }, POLL_MS);
    this.notify();
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.running = false;
    [...this.transports.values()].forEach((t) => t.close());
    this.notify();
  }

  snapshot(): { strips: Strip[] } {
    const strips = [...this.devices.values()]
      .sort((a, b) => (a.mac < b.mac ? -1 : 1))
      .map((d): Strip => {
        const outlets = [...d.outlets.values()].sort((a, b) => a.n - b.n).map((o) => ({ ...o, name: `Outlet ${o.n}` }));
        const powerW = round(outlets.reduce((s, o) => s + o.powerW, 0), 2);
        return {
          mac: d.mac,
          name: stripName(d.mac),
          model: d.model,
          fw: d.fw,
          online: d.online,
          on: outlets.some((o) => o.on),
          powerW,
          energyKwh: round(outlets.reduce((s, o) => s + o.energyKwh, 0), 3),
          voltage: d.voltage,
          currentA: d.voltage ? round(powerW / d.voltage, 2) : 0,
          rssi: d.rssi,
          outlets,
        };
      });
    return { strips };
  }
}

export const hub = new Hub();
