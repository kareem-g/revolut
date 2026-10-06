"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  };

  const input = {
    width: "100%", boxSizing: "border-box" as const, padding: "12px 14px", marginBottom: 12,
    borderRadius: 8, border: "1px solid #333831", background: "#161913", color: "#E7E9E3", fontSize: 15,
  };
  return (
    <div style={{ width: 340, background: "#1B1E19", border: "1px solid #333831", borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>powerk</div>
      <div style={{ color: "#9BA29A", fontSize: 13, marginBottom: 20 }}>your strip, from anywhere</div>
      <input style={input} placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
      <input style={input} placeholder="password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
      {error && <div style={{ color: "#FF7B72", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button
        onClick={() => void submit()}
        disabled={busy}
        style={{ width: "100%", padding: 12, borderRadius: 8, border: 0, background: "#FF7A33", color: "#2A1200", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
        {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <div style={{ marginTop: 14, textAlign: "center", fontSize: 13 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); setError(null); }} style={{ color: "#FF7A33" }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </a>
      </div>
    </div>
  );
}
