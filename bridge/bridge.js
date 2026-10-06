// powerk bridge — runs at home, no dependencies, Node 18+.
//
//   node bridge.js --pair ABCD-1234 --url https://your-app.vercel.app
//   node bridge.js                       (after pairing; reads bridge.json)
//
// It listens on TCP 10086 for the strip's session (provision the strip with
// THIS machine's LAN IP), relays state to the cloud over outbound HTTPS, and
// executes queued commands, schedules and voltage rules locally. Outbound
// only — nothing needs to be open on your router.

import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "bridge.json");
const DEVICE_PORT = 10086;
const POLL_MS = 5000;
const COMMAND_POLL_MS = 1000;
const SCHEDULE_TICK_MS = 15000;

// ---------- config ----------

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

let config;
if (fs.existsSync(STATE_FILE)) {
  config = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
} else if (arg("pair") && arg("url")) {
  config = { url: arg("url").replace(/\/$/, ""), token: null };
} else {
  console.error("No bridge.json. Pair first: node bridge.js --pair ABCD-1234 --url https://…");
  process.exit(1);
}
if (arg("url")) config.url = arg("url").replace(/\/$/, "");
config.token = config.token ?? null;

function saveConfig() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(config, null, 2));
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- cloud client ----------

async function cloud(path, body, method) {
  const res = await fetch(`${config.url}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

// ---------- protocol (port of mobile/src/hub) ----------

const BOOTINFO_RE =
  /^up:bootinfo:([^;\r\n]+);([0-9A-Fa-f]{12});([0-9A-Fa-f]{12});([^;\r\n]+);connect$/i;
const GETINFO_RE =
  /(?<ch>[1-5]):(?<runtime>-?\d+);(?<relay>on|off);(?<state>-?\d+);(?<overload>[^;:]+);(?<overheat>[^;:]+);(?<power>-?\d+);(?<energy>[0-9A-Fa-f]{8});(?<previous>[0-9A-Fa-f]{8});(?<config>[0-9A-Fa-f]{8});(?<status>[^;:]+);(?<event>[0-9A-Fa-f]{2});(?<temperature>-?\d+)/i;

const outletsOf = (line) => {
  const text = line.replace(/^up:getinfo:/i, "").replace(/[\r\n\x00]/g, "");
  const out = [];
  for (const m of text.matchAll(new RegExp(GETINFO_RE.source, "gi"))) {
    const ch = Number(m.groups.ch);
    if (ch > 4) continue;
    out.push({
      n: ch,
      on: m.groups.relay.toLowerCase() === "on",
      power_w: Math.round(Number(m.groups.power) / 1000.0 * 100) / 100,
      energy_kwh: Math.round((parseInt(m.groups.energy, 16) / 1000.0) * 1000) / 1000,
      temp_c: Number(m.groups.temperature),
    });
  }
  return out;
};

/** One strip session: speak the protocol, keep the live snapshot. */
class Session {
  constructor(socket, onChange) {
    this.socket = socket;
    this.onChange = onChange;
    this.mac = null;
    this.buffer = "";
    this.online = false;
    this.snapshot = null;
    this.pollCount = 0;
    this.waiters = [];
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => this.feed(chunk));
    socket.on("error", () => this.close());
    socket.on("close", () => this.close());
    this.pollTimer = setInterval(() => this.poll(), POLL_MS);
    this.pushTimer = setInterval(() => this.onChange(this), 5000); // heartbeat
    this.poll();
  }

  feed(chunk) {
    this.buffer += chunk;
    for (;;) {
      const i = this.buffer.indexOf("\n");
      if (i === -1) break;
      const raw = this.buffer.slice(0, i).replace(/\0/g, "").trim();
      this.buffer = this.buffer.slice(i + 1);
      if (raw) this.handle(raw);
    }
  }

  handle(line) {
    const boot = BOOTINFO_RE.exec(line);
    if (boot) {
      this.mac = boot[2].toUpperCase();
      this.snapshot = {
        mac: this.mac,
        name: "",
        model: boot[1],
        fw: boot[4],
        online: true,
        on: false,
        power_w: 0,
        energy_kwh: 0,
        voltage: null,
        current_a: null,
        rssi: null,
        outlets: [1, 2, 3, 4].map((n) => ({ n, name: "", on: false, power_w: 0, energy_kwh: 0, temp_c: 0 })),
      };
      this.online = true;
      log(`strip connected: ${this.mac} (${boot[1]} ${boot[4]})`);
      this.onChange(this);
      return;
    }
    if (!this.mac) return;
    if (/^up:getinfo:/i.test(line)) {
      const records = outletsOf(line);
      if (records.length === 4) {
        const byN = new Map(records.map((r) => [r.n, r]));
        this.snapshot.outlets = this.snapshot.outlets.map((o) => byN.get(o.n) ?? o);
        this.snapshot.on = records.some((r) => r.on);
        this.snapshot.power_w = Math.round(records.reduce((s, r) => s + r.power_w, 0) * 100) / 100;
        this.snapshot.energy_kwh = Math.max(...records.map((r) => r.energy_kwh));
        this.resolveWaiters();
        this.onChange(this);
      }
      return;
    }
    const power = /^up:power_report:(\d+):(-?\d+)$/i.exec(line);
    if (power) {
      const v = Number(power[2]);
      if (v >= 50000) this.snapshot.voltage = Math.round(v / 1000.0 * 10) / 10;
      this.onChange(this);
      return;
    }
    const rssi = /^up:query:(-?\d+)$/i.exec(line);
    if (rssi) {
      this.snapshot.rssi = Number(rssi[1]);
      this.onChange(this);
    }
  }

  send(cmd) {
    try {
      this.socket.write(`${cmd}\r\n`);
    } catch {}
  }

  poll() {
    if (!this.online) return;
    this.pollCount += 1;
    this.send("up:getinfo:all");
    if (this.pollCount % 3 === 0) {
      this.send("up:power_report:1:vol");
      this.send("up:query:wifirssi");
    }
  }

  resolveWaiters() {
    const w = this.waiters;
    this.waiters = [];
    w.forEach((fn) => fn());
  }

  /** Waits (max timeoutMs) for a fresh getinfo so commands reflect quickly. */
  settle(timeoutMs = 2000) {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          resolve();
        }
      }, timeoutMs);
      this.waiters.push(() => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  close() {
    if (!this.online) return;
    this.online = false;
    clearInterval(this.pollTimer);
    clearInterval(this.pushTimer);
    log(`strip disconnected: ${this.mac}`);
    this.onChange(this);
  }
}

// ---------- schedules + voltage rules (executed locally) ----------

const fired = new Set();

function dueSchedules(now, schedules) {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const minuteKey = `${hh}:${mm}`;
  const stamp = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  return (schedules ?? []).filter((s) => {
    if (s.time !== minuteKey) return false;
    if (Array.isArray(s.days) && s.days.length > 0 && !s.days.includes(now.getDay())) return false;
    return !fired.has(`${s.id}:${stamp}:${minuteKey}`);
  });
}

function markFired(now, events) {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  for (const e of events) fired.add(`${e.id}:${stamp}:${hh}:${mm}`);
}

// ---------- main ----------

const sessions = new Map(); // mac -> Session
let cloudConfig = { strips: [], schedules: [], voltage_rules: [], cost: { currency: "$", per_kwh: 0 } };

function namesFor(mac) {
  return cloudConfig.strips.find((s) => s.mac === mac) ?? {};
}

function snapshotForCloud(session) {
  const names = namesFor(session.mac);
  const s = session.snapshot;
  const powerW = s.outlets.reduce((acc, o) => acc + o.power_w, 0);
  return {
    mac: s.mac,
    name: names.name || `MTTL ${s.mac.slice(-7)}`,
    model: s.model,
    fw: s.fw,
    online: true,
    on: s.outlets.some((o) => o.on),
    power_w: powerW,
    energy_kwh: s.energy_kwh,
    voltage: s.voltage,
    current_a: s.voltage ? Math.round((powerW / s.voltage) * 100) / 100 : null,
    rssi: s.rssi,
    outlets: s.outlets.map((o) => ({ ...o, name: (names.outlets ?? {})[String(o.n)] || `Outlet ${o.n}` })),
  };
}

async function pushState(session) {
  if (!config.token || !session.online) return;
  try {
    await cloud("/api/bridge/state", { mac: session.mac, snapshot: snapshotForCloud(session) });
  } catch (e) {
    log("state push failed:", e.message);
  }
}

async function pair() {
  const res = await cloud("/api/bridge/pair", { code: arg("pair") });
  config.token = res.token;
  saveConfig();
  log("paired ✓ — bridge.json saved. Start the bridge with: node bridge.js");
  process.exit(0);
}

async function syncConfig() {
  try {
    cloudConfig = await cloud("/api/bridge/config");
    log(`config synced: ${cloudConfig.strips.length} strip(s), ${cloudConfig.schedules.length} schedule(s)`);
  } catch (e) {
    log("config sync failed:", e.message);
  }
}

async function runCommands() {
  if (!config.token) return;
  let commands;
  try {
    commands = (await cloud("/api/bridge/commands")).commands ?? [];
  } catch {
    return;
  }
  for (const c of commands) {
    const session = sessions.get(c.mac.toUpperCase());
    if (!session || !session.online) continue; // stays pending until the strip dials in
    const channels = c.outlet === 0 ? [1, 2, 3, 4] : [c.outlet];
    channels.forEach((ch) => session.send(`up:onoff:${ch}:${c.on ? "on" : "off"}`));
    await new Promise((r) => setTimeout(r, 300));
    session.poll();
    await session.settle();
    await cloud("/api/bridge/commands", { ids: [c.id] });
    log(`command: ${c.mac} outlet ${c.outlet} -> ${c.on ? "on" : "off"}`);
  }
}

function runSchedules() {
  const now = new Date();
  const events = dueSchedules(now, cloudConfig.schedules);
  if (events.length === 0) return;
  markFired(now, events);
  for (const e of events) {
    const session = sessions.get(e.mac.toUpperCase());
    if (!session || !session.online) continue;
    const channels = e.outlet === 0 ? [1, 2, 3, 4] : [e.outlet];
    channels.forEach((ch) => session.send(`up:onoff:${ch}:${e.on ? "on" : "off"}`));
    log(`schedule: ${e.mac} outlet ${e.outlet} -> ${e.on ? "on" : "off"}`);
  }
}

function runVoltageRules() {
  for (const session of sessions.values()) {
    if (!session.online || session.snapshot?.voltage == null) continue;
    const volts = session.snapshot.voltage * 1000;
    for (const rule of cloudConfig.voltage_rules ?? []) {
      if (rule.mac !== session.mac) continue;
      const channels = rule.outlet === 0 ? [1, 2, 3, 4] : [rule.outlet];
      const trip =
        rule.op === "below" ? volts < rule.volts : rule.op === "above" ? volts > rule.volts : volts === rule.volts;
      if (trip) {
        const key = `v:${rule.id}:${new Date().toDateString()}`;
        if (!fired.has(key)) {
          fired.add(key);
          channels.forEach((ch) => session.send(`up:onoff:${ch}:${rule.action}`));
          log(`voltage rule: ${volts / 1000} V ${rule.op} ${rule.volts / 1000} V -> outlets ${rule.action}`);
        }
      }
    }
  }
}

// ---------- boot ----------

if (arg("pair")) {
  pair().catch((e) => {
    console.error("pairing failed:", e.message);
    process.exit(1);
  });
} else {
  if (!config.token) {
    console.error("bridge.json has no token — pair first.");
    process.exit(1);
  }

  net.createServer((socket) => {
    const session = new Session(socket, (s) => {
      if (s.online && !sessions.has(s.mac)) sessions.set(s.mac, s);
      if (!s.online && s.mac) sessions.delete(s.mac);
      void pushState(s);
    });
  }).listen(DEVICE_PORT, "0.0.0.0", () => {
    log(`listening for strips on 0.0.0.0:${DEVICE_PORT}`);
  });

  log(`cloud: ${config.url}`);
  void syncConfig();
  setInterval(() => void syncConfig(), 30000);
  setInterval(() => void runCommands(), COMMAND_POLL_MS);
  setInterval(runSchedules, SCHEDULE_TICK_MS);
  setInterval(runVoltageRules, 5000);
}
