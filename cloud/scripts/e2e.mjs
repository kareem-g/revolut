// End-to-end check of the production stack, no cloud account needed.
//
//   docker run -d --name powerk-pg -e POSTGRES_PASSWORD=powerk -e POSTGRES_DB=powerk -p 55432:5432 postgres:16-alpine
//   cd cloud && DATABASE_URL=postgres://postgres:powerk@localhost:55432/powerk npm run build && npm start &
//   node scripts/e2e.mjs
//
// Registers a user, pairs a bridge, runs the bridge, simulates a strip dialing
// in, then asserts: state ingest, commands, schedules, naming, cost, history.

import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE ?? "http://localhost:3000";
const MAC = "A1B2C3D4E5F6";
const here = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_DIR = path.join(here, "..", "..", "bridge");

const log = (...a) => console.log("•", ...a);
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, timeoutMs = 20000, stepMs = 500) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn().catch(() => undefined);
    if (v) return v;
    if (Date.now() > deadline) return undefined;
    await sleep(stepMs);
  }
}

// ---------- simulated strip (dials the bridge and speaks the protocol) ----------

function startFakeStrip(port = 10086) {
  const state = { 1: true, 2: true, 3: false, 4: false };
  const socket = net.createConnection({ host: "127.0.0.1", port });
  socket.setEncoding("utf8");
  let buffer = "";
  const ch = (n, watts, temp) => {
    const on = state[n];
    return `${n}:-1;${on ? "on" : "off"};0;normal;normal;${on ? watts : 0};000003E8;00000000;00000000;ok;00;${temp}`;
  };
  const getinfo = () => `up:getinfo:${ch(1, 812, 41)};${ch(2, 1247, 43)};${ch(3, 640, 38)};${ch(4, 0, 39)}`;
  socket.on("connect", () => {
    socket.write(`up:bootinfo:MTTL-W01;${MAC};001122334455;0.1.54-1.0.66;connect\r\n`);
  });
  socket.on("data", (chunk) => {
    buffer += chunk;
    for (;;) {
      const i = buffer.indexOf("\n");
      if (i === -1) break;
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      const onoff = /up:onoff:(\d):(on|off)/i.exec(line);
      if (onoff) state[Number(onoff[1])] = onoff[2].toLowerCase() === "on";
      else if (/^up:getinfo/i.test(line)) socket.write(getinfo() + "\r\n");
      else if (/^up:power_report/i.test(line)) socket.write("up:power_report:1:231244\r\n");
      else if (/^up:query/i.test(line)) socket.write("up:query:-52\r\n");
    }
  });
  socket.on("error", () => {});
  return { state, close: () => socket.destroy() };
}

// ---------- cloud helpers ----------

async function api(pathname, { method = "GET", body, token, cookie } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      ...(token ? { "X-Token": token } : {}),
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
}

const state = (token) => api("/api/state", { token }).then((r) => r.json);
const strip = async (token) => (await state(token)).devices?.[0];

// ---------- run ----------

let bridge;
let stripSim;

try {
  // 0. dashboard reachable
  const home = await api("/");
  check("dashboard serves", home.status === 200);

  // 1. register
  const email = `e2e+${Date.now()}@test.local`;
  const reg = await api("/api/auth/register", { method: "POST", body: { email, password: "testtest" } });
  check("register returns api token", reg.status === 200 && typeof reg.json.api_token === "string");
  const apiToken = reg.json.api_token;
  const cookie = reg.setCookie?.split(";")[0];

  // 2. pair code -> bridge token
  const code = await api("/api/bridge/pair-code", { method: "POST", cookie });
  check("pair code issued", code.status === 200 && !!code.json.pair_code, code.json.pair_code);

  fs.rmSync(path.join(BRIDGE_DIR, "bridge.json"), { force: true });
  const paired = spawn(process.execPath, ["bridge.js", "--pair", code.json.pair_code, "--url", BASE], {
    cwd: BRIDGE_DIR,
    stdio: "inherit",
  });
  await new Promise((r) => paired.on("exit", r));
  check("bridge paired and saved token", fs.existsSync(path.join(BRIDGE_DIR, "bridge.json")));

  // 3. run the bridge, dial in as a strip
  bridge = spawn(process.execPath, ["bridge.js"], { cwd: BRIDGE_DIR, stdio: ["ignore", "pipe", "pipe"] });
  bridge.stdout.on("data", (d) => process.stdout.write(`  [bridge] ${d}`));
  bridge.stderr.on("data", (d) => process.stderr.write(`  [bridge] ${d}`));
  await sleep(2500);
  stripSim = startFakeStrip();

  // 4. state ingest (auto-claim on first sight of the MAC)
  const online = await until(async () => {
    const s = await strip(apiToken);
    return s?.online && typeof s.power_w === "number" && s.voltage != null && s.outlets?.length === 4
      ? s
      : undefined;
  }, 25000);
  check("strip auto-claimed and online", !!online, online ? `${online.name} ${online.power_w} W` : "timed out");
  if (online) {
    // the wire carries milliwatts; the bridge converts to watts like powerk.py
    check("power ingested (mW -> W)", Math.abs(online.power_w - 2.06) < 0.02, `${online.power_w} W`);
    check("voltage parsed", online.voltage === 231.2, `${online.voltage} V`);
    check("rssi parsed", online.rssi === -52, `${online.rssi} dBm`);
    check("outlets parsed", online.outlets?.length === 4 && Math.abs(online.outlets[0].power_w - 0.81) < 0.02, `${online.outlets?.[0]?.power_w} W`);
  }

  // 5. command round-trip: cloud -> bridge -> strip -> state
  const off = await api("/api/onoff", { method: "POST", token: apiToken, body: { mac: MAC, outlet: 1, on: false } });
  check("onoff accepted", off.status === 200 && off.json.ok === true);
  const applied = await until(async () => {
    const s = await strip(apiToken);
    return s?.outlets?.find((o) => o.n === 1)?.on === false ? s : undefined;
  }, 15000);
  check("outlet 1 switched off through the bridge", !!applied);

  // 6. schedule fires locally on the bridge
  const now = new Date(Date.now() + 60000); // next minute: the bridge re-syncs config every 30 s
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const sched = await api("/api/schedules", {
    method: "POST", token: apiToken, body: { mac: MAC, outlet: 3, on: true, time, days: [] },
  });
  check("schedule stored", sched.status === 200 && !!sched.json.id);
  const firedOk = await until(async () => {
    const s = await strip(apiToken);
    return s?.outlets?.find((o) => o.n === 3)?.on === true ? s : undefined;
  }, 120000);
  check("schedule turned outlet 3 on", !!firedOk);

  // 7. naming + cost
  await api("/api/name", { method: "POST", token: apiToken, body: { mac: MAC, name: "Kitchen", outlet: 2, outletName: "Fridge" } });
  const named = await strip(apiToken);
  check("strip renamed", named?.name === "Kitchen", named?.name);
  check("outlet renamed", named?.outlets?.find((o) => o.n === 2)?.name === "Fridge");

  const cost = await api("/api/cost", { method: "POST", token: apiToken, body: { currency: "EGP", per_kwh: 2.5 } });
  check("cost saved", cost.json?.cost?.currency === "EGP" && cost.json?.cost?.per_kwh === 2.5);

  // 8. history + auth guards
  const hist = await api("/api/history", { token: apiToken });
  check("history returns readings", hist.status === 200 && typeof hist.json === "object");
  const anon = await api("/api/state");
  check("unauthenticated state rejected", anon.status === 401);
  const badToken = await api("/api/state", { token: "pk_nope" });
  check("bad token rejected", badToken.status === 401);
} finally {
  stripSim?.close();
  bridge?.kill();
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
