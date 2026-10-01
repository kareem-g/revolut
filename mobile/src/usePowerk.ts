import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Snapshot, setOutlet, snapshot } from './api';
import { hub } from './hub/hub';
import { startHubServer, stopHubServer } from './hub/server';
import { useConn } from './server';

export interface PowerkState {
  snapshot: Snapshot | null;
  error: string | null;
  loading: boolean;
  /** "mac:outlet" -> target state we are switching to right now */
  pending: Record<string, boolean>;
  refresh: () => Promise<void>;
  command: (mac: string, outlet: number, on: boolean) => void;
  /** direct mode: the phone's current Wi-Fi IP (null while unknown) */
  phoneIp: string | null;
  /** direct mode: hub server state ('starting' | 'running' | 'failed') */
  hubState: 'starting' | 'running' | 'failed';
}

const POLL_MS = 2000;

/** Unified store: in-app hub in direct mode, HTTP polling in server mode. */
export function usePowerk(): PowerkState {
  const conn = useConn();
  const direct = conn.mode === 'direct' && Platform.OS !== 'web';

  // --- direct mode: live hub snapshots ------------------------------------
  const [hubStrips, setHubStrips] = useState(hub.snapshot().strips);
  const [hubState, setHubState] = useState<PowerkState['hubState']>(
    hub.running ? 'running' : 'starting',
  );
  const [phoneIp, setPhoneIp] = useState<string | null>(null);

  useEffect(() => {
    if (!direct) {
      stopHubServer();
      return;
    }
    let alive = true;
    setHubState('starting');
    // Defer the socket bind so it never races the launch/splash on iOS (it also
    // triggers the Local Network permission prompt). Only bind once foregrounded.
    const bind = () =>
      startHubServer()
        .then(() => alive && setHubState('running'))
        .catch(() => alive && setHubState('failed'));
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(bind, 1200);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (timer) clearTimeout(timer);
        timer = setTimeout(bind, 300);
      }
    });
    const unsub = hub.subscribe(() => setHubStrips(hub.snapshot().strips));
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      sub.remove();
      unsub();
    };
  }, [direct]);

  useEffect(() => {
    if (!direct) {
      setPhoneIp(null);
      return;
    }
    const read = () =>
      NetInfo.fetch().then((s) => {
        const details = s.details as { ipAddress?: string | null } | null;
        setPhoneIp(s.type === 'wifi' ? details?.ipAddress ?? null : null);
      });
    void read();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void read();
    });
    return () => sub.remove();
  }, [direct]);

  // --- server mode: HTTP polling ------------------------------------------
  const [httpSnap, setHttpSnap] = useState<Snapshot | null>(null);
  const [httpError, setHttpError] = useState<string | null>(null);
  const [httpLoading, setHttpLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (direct || !conn.configured) return;
    setHttpLoading(true);
    try {
      const snap = await snapshot(conn.base, conn.token);
      setHttpSnap(snap);
      setHttpError(null);
    } catch (e) {
      setHttpError(e instanceof Error ? e.message : String(e));
      setHttpSnap(null);
    }
    setHttpLoading(false);
  }, [direct, conn.configured, conn.base, conn.token]);

  useEffect(() => {
    if (direct) return;
    if (!conn.configured) {
      setHttpSnap(null);
      setHttpError(null);
      return;
    }
    let alive = true;
    (async () => {
      while (alive) {
        if (AppState.currentState === 'active') await refresh();
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    })();
    return () => {
      alive = false;
    };
  }, [direct, conn.configured, conn.host, conn.port, conn.token, refresh]);

  useEffect(() => {
    if (direct) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && conn.configured) void refresh();
    });
    return () => sub.remove();
  }, [direct, conn.configured, refresh]);

  // --- shared command path --------------------------------------------------
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const markPending = (keys: string[], value?: boolean) =>
    setPending((prev) => {
      const next = { ...prev };
      keys.forEach((k) => (value === undefined ? delete next[k] : (next[k] = value)));
      return next;
    });

  const command = useCallback(
    (mac: string, outlet: number, on: boolean) => {
      const keys = outlet === 0 ? [1, 2, 3, 4].map((n) => `${mac}:${n}`) : [`${mac}:${outlet}`];
      if (keys.some((k) => pendingRef.current[k] !== undefined)) return;
      markPending(keys, on);
      const run = direct
        ? hub.setOutlet(mac, outlet, on)
        : setOutlet(conn.base, conn.token, mac, outlet, on).then(() => refresh());
      run.catch(() => undefined).finally(() => markPending(keys));
    },
    [direct, conn.base, conn.token, refresh],
  );

  const snapshotData: Snapshot | null = direct
    ? { serverIp: phoneIp ?? '', strips: hubStrips }
    : httpSnap;
  const error = direct ? (hubState === 'failed' ? 'port 10086 busy' : null) : httpError;
  const loading = direct ? false : httpLoading;

  return { snapshot: snapshotData, error, loading, pending, refresh, command, phoneIp, hubState };
}

/** Whether any outlet of this strip is mid-command. */
export function stripPending(pending: Record<string, boolean>, mac: string): boolean {
  return [1, 2, 3, 4].some((n) => pending[`${mac}:${n}`] !== undefined);
}
