"use client";

import { useCallback, useEffect, useState } from "react";

// The production dashboard: pair a bridge, watch live strip state, toggle
// outlets, and copy the API token the mobile app uses (server mode).

interface Outlet {
  n: number; name: string; on: boolean; power_w: number; energy_kwh: number; temp_c: number;
}
interface Strip {
  mac: string; name: string; model: string; fw: string; online: boolean; on: boolean;
  power_w: number; energy_kwh: number; voltage: number | null; current_a: number | null;
  rssi: number | null; outlets: Outlet[];
}
interface State {
  devices: Strip[];
  local_ip: string;
  cost: { currency: string; per_kwh: number };
}

export default function Dashboard({ email, apiToken }: { email: string; apiToken: string }) {
  const [state, setState] = useState<State | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(() => void poll(), 2500);
    return () => clearInterval(t);
  }, [poll]);

  const createPairCode = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/bridge/pair-code", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setPairCode(json.pair_code);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (mac: string, outlet: number, on: boolean) => {
    await fetch("/api/onoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac, outlet, on }),
    });
    setTimeout(() => void poll(), 600);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/";
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 60px" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <span style={{ fontSize: 26, fontWeight: 800 }}>powerk</span>
          <span style={{ color: "#9BA29A", fontSize: 13, marginLeft: 10 }}>{email}</span>
        </div>
        <button onClick={() => void logout()} style={ghost}>Sign out</button>
      </header>

      <Section title="Bridge">
        <p style={{ ...muted, marginTop: 0 }}>
          Run this on an always-on device at home (Raspberry Pi, old laptop). It dials
          <em> out</em> to this dashboard — no ports to open.
        </p>
        {pairCode ? (
          <div style={box}>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 22, letterSpacing: 2 }}>{pairCode}</div>
            <div style={{ ...muted, marginTop: 8 }}>expires when used — then run:</div>
            <code style={code}>npx powerk-bridge --pair {pairCode} --url {location.origin}</code>
          </div>
        ) : (
          <button onClick={() => void createPairCode()} disabled={busy} style={primary}>
            {busy ? "…" : "Pair a new bridge"}
          </button>
        )}
      </Section>

      <Section title="Strips">
        {!state ? (
          <p style={muted}>loading…</p>
        ) : state.devices.length === 0 ? (
          <p style={muted}>No strips yet. Pair a bridge, then provision a strip with its setup WiFi — it will appear here.</p>
        ) : (
          state.devices.map((s) => (
            <div key={s.mac} style={{ ...box, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 5, display: "inline-block", background: s.online ? "#51CF66" : "#555" }} />
                <strong style={{ fontSize: 16 }}>{s.name || `MTTL ${s.mac.slice(-7)}`}</strong>
                <span style={{ ...muted, fontSize: 12 }}>{s.online ? `${Math.round(s.power_w)} W · ${s.voltage ?? "–"} V · ${s.rssi ?? "–"} dBm` : "offline"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {s.outlets.map((o) => (
                  <button
                    key={o.n}
                    onClick={() => void toggle(s.mac, o.n, !o.on)}
                    disabled={!s.online}
                    style={{
                      padding: "12px 14px", borderRadius: 8, textAlign: "start", cursor: s.online ? "pointer" : "default",
                      border: `1px solid ${o.on ? "#FF7A33" : "#333831"}`,
                      background: o.on ? "#43200A" : "#161913",
                      color: o.on ? "#FFC29E" : "#9BA29A",
                      opacity: s.online ? 1 : 0.55,
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{o.name || `Outlet ${o.n}`}</div>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, marginTop: 2 }}>
                      {o.on ? `${Math.round(o.power_w)} W · ${o.temp_c} °C` : "off"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Mobile app">
        <p style={{ ...muted, marginTop: 0 }}>
          In the app: Settings → Mode → <strong>Server</strong>, host <code style={code}>{typeof location !== "undefined" ? location.host : ""}</code>, port 443, token:
        </p>
        <code style={code}>{apiToken}</code>
      </Section>
    </main>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: 30 }}>
    <h2 style={{ fontSize: 13, fontWeight: 700, color: "#9BA29A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{title}</h2>
    {children}
  </section>
);

const muted: React.CSSProperties = { color: "#9BA29A", fontSize: 13, lineHeight: 1.5 };
const box: React.CSSProperties = { background: "#1B1E19", border: "1px solid #333831", borderRadius: 10, padding: 16 };
const primary: React.CSSProperties = { padding: "10px 16px", borderRadius: 8, border: 0, background: "#FF7A33", color: "#2A1200", fontWeight: 700, cursor: "pointer" };
const ghost: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #333831", background: "transparent", color: "#9BA29A", cursor: "pointer" };
const code: React.CSSProperties = { display: "block", marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#161913", border: "1px solid #333831", fontFamily: "ui-monospace, monospace", fontSize: 13, wordBreak: "break-all" };
